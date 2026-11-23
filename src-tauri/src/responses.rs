use crate::{
    contract::*,
    validation::{validate_bullets, validate_nonempty_text, validate_text},
};
use std::collections::HashSet;

pub(crate) fn copilot_json_candidates(output: &[u8]) -> CommandResult<Vec<String>> {
    if output.len() > MAX_GENERATION_OUTPUT_BYTES {
        return Err("Copilot response exceeds the 128 KB limit".to_string());
    }
    let text = std::str::from_utf8(output)
        .map_err(|error| format!("Copilot response is not valid UTF-8: {error}"))?
        .trim();
    let mut candidates = vec![text.to_string()];
    if let Some(fenced) = extract_single_fenced_json(text) {
        candidates.push(fenced);
    }
    Ok(candidates)
}

#[cfg(test)]
pub(crate) fn parse_ai_proposal<'a, I>(output: &[u8], expected_ids: I) -> CommandResult<AiProposal>
where
    I: IntoIterator<Item = &'a str>,
{
    parse_ai_proposal_with_projects(output, expected_ids, std::iter::empty())
}

pub(crate) fn parse_ai_proposal_with_projects<'a, E, P>(
    output: &[u8],
    expected_experience_ids: E,
    expected_project_ids: P,
) -> CommandResult<AiProposal>
where
    E: IntoIterator<Item = &'a str>,
    P: IntoIterator<Item = &'a str>,
{
    if output.len() > MAX_GENERATION_OUTPUT_BYTES {
        return Err("Copilot response exceeds the 128 KB limit".to_string());
    }
    let text = std::str::from_utf8(output)
        .map_err(|error| format!("Copilot response is not valid UTF-8: {error}"))?
        .trim();
    let expected_experience_ids: HashSet<&str> = expected_experience_ids.into_iter().collect();
    let expected_project_ids: HashSet<&str> = expected_project_ids.into_iter().collect();
    let mut candidates = vec![text.to_string()];
    if let Some(fenced) = extract_single_fenced_json(text) {
        candidates.push(fenced);
    }
    let mut last_error = None;
    for candidate in candidates {
        match serde_json::from_str::<AiProposal>(&candidate) {
            Ok(proposal) => {
                match validate_ai_proposal(
                    &proposal,
                    &expected_experience_ids,
                    &expected_project_ids,
                ) {
                    Ok(()) => return Ok(proposal),
                    Err(error) => last_error = Some(error),
                }
            }
            Err(error) => {
                last_error = Some(format!(
                    "Copilot response is not valid proposal JSON: {error}"
                ))
            }
        }
    }
    Err(last_error.unwrap_or_else(|| "Copilot response was empty".to_string()))
}

fn extract_single_fenced_json(text: &str) -> Option<String> {
    let start = text.find("```")?;
    let end_relative = text[start + 3..].find("```")?;
    let end = start + 3 + end_relative;
    if text[end + 3..].contains("```") {
        return None;
    }
    let mut body = &text[start + 3..end];
    if let Some(newline) = body.find('\n') {
        let language = body[..newline].trim();
        if language.is_empty() || language.eq_ignore_ascii_case("json") {
            body = &body[newline + 1..];
        }
    }
    Some(body.trim().to_string())
}

fn validate_proposal_entries(
    entries: &[ProposalExperience],
    expected_ids: &HashSet<&str>,
    max_entries: usize,
    kind_label: &str,
) -> CommandResult<()> {
    if entries.len() != expected_ids.len() {
        return Err(format!(
            "Copilot proposal must contain exactly one entry per original {kind_label}"
        ));
    }
    if entries.len() > max_entries {
        return Err(format!(
            "Copilot proposal may contain at most {max_entries} {kind_label} entries"
        ));
    }
    let mut seen = HashSet::with_capacity(entries.len());
    for entry in entries {
        validate_nonempty_text(
            &format!("proposal {kind_label} id"),
            &entry.id,
            MAX_ID_BYTES,
        )?;
        if !expected_ids.contains(entry.id.as_str()) {
            return Err(format!(
                "Copilot proposal contains unknown {kind_label} id: {}",
                entry.id
            ));
        }
        if !seen.insert(entry.id.as_str()) {
            return Err(format!(
                "Copilot proposal contains duplicate {kind_label} id: {}",
                entry.id
            ));
        }
        validate_bullets(&entry.bullets, &format!("proposal.{kind_label}.bullets"))?;
    }
    if seen.len() != expected_ids.len() {
        return Err(format!(
            "Copilot proposal is missing an original {kind_label} id"
        ));
    }
    Ok(())
}

pub(crate) fn validate_ai_proposal(
    proposal: &AiProposal,
    expected_experience_ids: &HashSet<&str>,
    expected_project_ids: &HashSet<&str>,
) -> CommandResult<()> {
    validate_text("proposal.summary", &proposal.summary, MAX_SUMMARY_BYTES)?;
    validate_proposal_entries(
        &proposal.experience,
        expected_experience_ids,
        MAX_EXPERIENCE,
        "experience",
    )?;
    validate_proposal_entries(
        &proposal.projects,
        expected_project_ids,
        MAX_PROJECTS,
        "project",
    )?;
    if proposal.notes.len() > MAX_PROPOSAL_NOTES {
        return Err(format!(
            "Copilot proposal may contain at most {MAX_PROPOSAL_NOTES} notes"
        ));
    }
    for note in &proposal.notes {
        validate_text("proposal note", note, MAX_BULLET_BYTES)?;
    }
    Ok(())
}

fn json_candidates(output: &[u8]) -> CommandResult<Vec<String>> {
    if output.len() > MAX_GENERATION_OUTPUT_BYTES {
        return Err("AI response exceeds the 128 KB limit".to_string());
    }
    let text = std::str::from_utf8(output)
        .map_err(|error| format!("AI response is not valid UTF-8: {error}"))?
        .trim();
    let mut candidates = vec![text.to_string()];
    if let Some(fenced) = extract_single_fenced_json(text) {
        candidates.push(fenced);
    }
    Ok(candidates)
}

pub(crate) fn parse_summary_options_response(
    output: &[u8],
) -> CommandResult<SummaryOptionsProposal> {
    let mut last_error = None;
    for candidate in json_candidates(output)? {
        match serde_json::from_str::<SummaryOptionsProposal>(&candidate) {
            Ok(proposal) => {
                if proposal.options.is_empty() || proposal.options.len() > MAX_SUMMARY_OPTIONS {
                    last_error = Some(format!(
                        "Summary options must contain between 1 and {MAX_SUMMARY_OPTIONS} items"
                    ));
                    continue;
                }
                let mut valid = true;
                for option in &proposal.options {
                    if let Err(err) = validate_nonempty_text("option.label", &option.label, 80)
                        .and_then(|()| {
                            validate_nonempty_text(
                                "option.summary",
                                &option.summary,
                                MAX_SUMMARY_BYTES,
                            )
                        })
                    {
                        last_error = Some(err);
                        valid = false;
                        break;
                    }
                }
                if valid {
                    return Ok(proposal);
                }
            }
            Err(error) => {
                last_error = Some(format!(
                    "AI response is not valid summary options JSON: {error}"
                ))
            }
        }
    }
    Err(last_error.unwrap_or_else(|| "AI response was empty".to_string()))
}

pub(crate) fn parse_role_tailor_response(
    output: &[u8],
    expected_entry_id: &str,
) -> CommandResult<RoleTailorProposal> {
    let mut last_error = None;
    for candidate in json_candidates(output)? {
        match serde_json::from_str::<RoleTailorRawResponse>(&candidate) {
            Ok(raw) => {
                if raw.entry_id != expected_entry_id {
                    last_error = Some("AI response returned a mismatched entryId".to_string());
                    continue;
                }
                if let Err(err) = validate_bullets(&raw.bullets, "roleTailor.bullets") {
                    last_error = Some(err);
                    continue;
                }
                if raw.notes.len() > MAX_PROPOSAL_NOTES {
                    last_error = Some("Too many role tailoring notes".to_string());
                    continue;
                }
                if let Some(err) = raw
                    .notes
                    .iter()
                    .find_map(|n| validate_text("roleTailor.note", n, MAX_BULLET_BYTES).err())
                {
                    last_error = Some(err);
                    continue;
                }
                return Ok(RoleTailorProposal {
                    entry_id: raw.entry_id,
                    bullets: raw.bullets,
                    notes: raw.notes,
                    verification: None,
                    verification_warning: None,
                });
            }
            Err(error) => {
                last_error = Some(format!(
                    "AI response is not valid role tailoring JSON: {error}"
                ))
            }
        }
    }
    Err(last_error.unwrap_or_else(|| "AI response was empty".to_string()))
}

pub(crate) fn parse_imported_structure_response(
    output: &[u8],
) -> CommandResult<ImportedStructureProposal> {
    let mut last_error = None;
    for candidate in json_candidates(output)? {
        match serde_json::from_str::<ImportedStructureProposal>(&candidate) {
            Ok(parsed) => match validate_imported_structure(&parsed) {
                Ok(()) => return Ok(parsed),
                Err(err) => last_error = Some(err),
            },
            Err(error) => {
                last_error = Some(format!(
                    "AI response is not valid import structure JSON: {error}"
                ))
            }
        }
    }
    Err(last_error.unwrap_or_else(|| "AI response was empty".to_string()))
}

fn validate_imported_structure(draft: &ImportedStructureProposal) -> CommandResult<()> {
    validate_text("headline", &draft.headline, MAX_SHORT_TEXT_BYTES)?;
    validate_text("summary", &draft.summary, MAX_SUMMARY_BYTES)?;
    if draft.experience.len() > MAX_EXPERIENCE {
        return Err("Too many imported experience entries".to_string());
    }
    for exp in &draft.experience {
        validate_text("experience.role", &exp.role, MAX_SHORT_TEXT_BYTES)?;
        validate_text("experience.company", &exp.company, MAX_SHORT_TEXT_BYTES)?;
        validate_text("experience.location", &exp.location, MAX_SHORT_TEXT_BYTES)?;
        validate_text(
            "experience.startDate",
            &exp.start_date,
            MAX_SHORT_TEXT_BYTES,
        )?;
        validate_text("experience.endDate", &exp.end_date, MAX_SHORT_TEXT_BYTES)?;
        validate_bullets(&exp.bullets, "experience.bullets")?;
    }
    if draft.projects.len() > MAX_PROJECTS {
        return Err("Too many imported projects".to_string());
    }
    for proj in &draft.projects {
        validate_text("project.name", &proj.name, MAX_SHORT_TEXT_BYTES)?;
        validate_text("project.subtitle", &proj.subtitle, MAX_SHORT_TEXT_BYTES)?;
        validate_text("project.startDate", &proj.start_date, MAX_SHORT_TEXT_BYTES)?;
        validate_text("project.endDate", &proj.end_date, MAX_SHORT_TEXT_BYTES)?;
        validate_bullets(&proj.bullets, "project.bullets")?;
    }
    if draft.education.len() > MAX_EDUCATION {
        return Err("Too many imported education entries".to_string());
    }
    for edu in &draft.education {
        validate_text("education.school", &edu.school, MAX_SHORT_TEXT_BYTES)?;
        validate_text("education.degree", &edu.degree, MAX_SHORT_TEXT_BYTES)?;
        validate_text(
            "education.graduation",
            &edu.graduation,
            MAX_SHORT_TEXT_BYTES,
        )?;
    }
    if draft.certifications.len() > MAX_CERTIFICATIONS {
        return Err("Too many imported certifications".to_string());
    }
    for cert in &draft.certifications {
        validate_text("certification.name", &cert.name, MAX_SHORT_TEXT_BYTES)?;
        validate_text("certification.issuer", &cert.issuer, MAX_SHORT_TEXT_BYTES)?;
        validate_text("certification.date", &cert.date, MAX_SHORT_TEXT_BYTES)?;
    }
    if draft.skills.len() > MAX_SKILLS {
        return Err("Too many imported skills".to_string());
    }
    for skill in &draft.skills {
        validate_text("skill", skill, 100)?;
    }
    if draft.skill_groups.len() > MAX_SKILL_GROUPS {
        return Err("Too many imported skill groups".to_string());
    }
    for group in &draft.skill_groups {
        validate_text("skillGroup.category", &group.category, MAX_SHORT_TEXT_BYTES)?;
        if group.items.len() > MAX_SKILLS_PER_GROUP {
            return Err("Too many items in imported skill group".to_string());
        }
        for item in &group.items {
            validate_text("skillGroup.item", item, 100)?;
        }
    }
    Ok(())
}

pub(crate) fn parse_grounding_response(
    output: &[u8],
    expected_keys: &HashSet<&str>,
) -> CommandResult<Vec<GroundingItem>> {
    let mut last_error = None;
    for candidate in json_candidates(output)? {
        match serde_json::from_str::<GroundingVerifierResponse>(&candidate) {
            Ok(parsed) => {
                if parsed.items.len() != expected_keys.len() {
                    last_error = Some(
                        "Grounding verifier returned a mismatched number of items".to_string(),
                    );
                    continue;
                }
                let mut seen = HashSet::with_capacity(parsed.items.len());
                let mut valid = true;
                for item in &parsed.items {
                    if !expected_keys.contains(item.key.as_str()) || !seen.insert(item.key.as_str())
                    {
                        last_error = Some(format!(
                            "Grounding verifier returned unknown or duplicate key: {}",
                            item.key
                        ));
                        valid = false;
                        break;
                    }
                    if let Err(err) = validate_nonempty_text("grounding.note", &item.note, 500) {
                        last_error = Some(err);
                        valid = false;
                        break;
                    }
                }
                if valid {
                    return Ok(parsed.items);
                }
            }
            Err(error) => {
                last_error = Some(format!(
                    "Verifier response is not valid grounding JSON: {error}"
                ))
            }
        }
    }
    Err(last_error.unwrap_or_else(|| "Verifier response was empty".to_string()))
}

pub(crate) fn ensure_consent(consent: bool) -> CommandResult<()> {
    if consent {
        Ok(())
    } else {
        Err("Explicit consent is required before contacting an AI provider".to_string())
    }
}
