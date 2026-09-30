//! Strict parsing and validation of Copilot responses.

use crate::{contract::*, validation::*};
use std::collections::HashSet;

pub(crate) fn parse_ai_proposal<'a, I>(output: &[u8], expected_ids: I) -> CommandResult<AiProposal>
where
    I: IntoIterator<Item = &'a str>,
{
    if output.len() > MAX_GENERATION_OUTPUT_BYTES {
        return Err("Copilot response exceeds the 128 KB limit".to_string());
    }
    let text = std::str::from_utf8(output)
        .map_err(|error| format!("Copilot response is not valid UTF-8: {error}"))?
        .trim();
    let expected_ids: HashSet<&str> = expected_ids.into_iter().collect();
    let mut candidates = vec![text.to_string()];
    if let Some(fenced) = extract_single_fenced_json(text) {
        candidates.push(fenced);
    }
    let mut last_error = None;
    for candidate in candidates {
        match serde_json::from_str::<AiProposal>(&candidate) {
            Ok(proposal) => match validate_ai_proposal(&proposal, &expected_ids) {
                Ok(()) => return Ok(proposal),
                Err(error) => last_error = Some(error),
            },
            Err(error) => {
                last_error = Some(format!(
                    "Copilot response is not valid proposal JSON: {error}"
                ))
            }
        }
    }
    Err(last_error.unwrap_or_else(|| "Copilot response was empty".to_string()))
}

pub(crate) fn extract_single_fenced_json(text: &str) -> Option<String> {
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

pub(crate) fn validate_ai_proposal(
    proposal: &AiProposal,
    expected_ids: &HashSet<&str>,
) -> CommandResult<()> {
    validate_text("proposal.summary", &proposal.summary, MAX_SUMMARY_BYTES)?;
    if proposal.experience.len() != expected_ids.len() {
        return Err(
            "Copilot proposal must contain exactly one entry per original experience".to_string(),
        );
    }
    if proposal.experience.len() > MAX_EXPERIENCE {
        return Err(format!(
            "Copilot proposal may contain at most {MAX_EXPERIENCE} experience entries"
        ));
    }
    let mut seen = HashSet::with_capacity(proposal.experience.len());
    for experience in &proposal.experience {
        validate_nonempty_text("proposal experience id", &experience.id, MAX_ID_BYTES)?;
        if !expected_ids.contains(experience.id.as_str()) {
            return Err(format!(
                "Copilot proposal contains unknown experience id: {}",
                experience.id
            ));
        }
        if !seen.insert(experience.id.as_str()) {
            return Err(format!(
                "Copilot proposal contains duplicate experience id: {}",
                experience.id
            ));
        }
        validate_bullets(&experience.bullets, "proposal.experience.bullets")?;
    }
    if seen.len() != expected_ids.len() {
        return Err("Copilot proposal is missing an original experience id".to_string());
    }
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

pub(crate) fn parse_apr_response(output: &[u8]) -> CommandResult<AprCopilotResponse> {
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
    let mut last_error = None;
    for candidate in candidates {
        match serde_json::from_str::<AprCopilotResponse>(&candidate) {
            Ok(response) => match validate_apr_response(&response) {
                Ok(()) => return Ok(response),
                Err(error) => last_error = Some(error),
            },
            Err(error) => {
                last_error = Some(format!("Copilot response is not valid APR JSON: {error}"))
            }
        }
    }
    Err(last_error.unwrap_or_else(|| "Copilot response was empty".to_string()))
}

pub(crate) fn parse_highlight_review_response(
    output: &[u8],
    expected: usize,
) -> CommandResult<Vec<HighlightReviewVerdict>> {
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
    let mut last_error = None;
    for candidate in candidates {
        match serde_json::from_str::<HighlightReviewResponse>(&candidate) {
            Ok(response) => match validate_highlight_review_response(&response, expected) {
                Ok(()) => return Ok(response.reviews),
                Err(error) => last_error = Some(error),
            },
            Err(error) => {
                last_error = Some(format!(
                    "Copilot response is not valid highlight review JSON: {error}"
                ))
            }
        }
    }
    Err(last_error.unwrap_or_else(|| "Copilot response was empty".to_string()))
}

pub(crate) fn validate_highlight_review_response(
    response: &HighlightReviewResponse,
    expected: usize,
) -> CommandResult<()> {
    if response.reviews.len() != expected {
        return Err(
            "Copilot review must contain exactly one verdict per requested highlight".to_string(),
        );
    }
    let mut seen = HashSet::with_capacity(expected);
    for review in &response.reviews {
        if review.index >= expected {
            return Err(format!(
                "Copilot review contains an unknown highlight index: {}",
                review.index
            ));
        }
        if !seen.insert(review.index) {
            return Err(format!(
                "Copilot review contains a duplicate highlight index: {}",
                review.index
            ));
        }
    }
    if seen.len() != expected {
        return Err("Copilot review is missing at least one highlight".to_string());
    }
    Ok(())
}

pub(crate) fn validate_apr_dimension(name: &str, dimension: &AprDimension) -> CommandResult<()> {
    validate_nonempty_text(
        &format!("{name} feedback"),
        &dimension.feedback,
        MAX_BULLET_BYTES,
    )
}

pub(crate) fn validate_apr_response(response: &AprCopilotResponse) -> CommandResult<()> {
    validate_apr_dimension("action", &response.action)?;
    validate_apr_dimension("project", &response.project)?;
    validate_apr_dimension("result", &response.result)?;
    validate_apr_options(&response.options)
}

pub(crate) fn validate_apr_options(options: &[AprOption]) -> CommandResult<()> {
    if options.is_empty() || options.len() > MAX_APR_OPTIONS {
        return Err("APR options must contain one to three strategies".to_string());
    }
    let mut option_sequences = HashSet::with_capacity(options.len());
    let mut previous_rank = None;
    for option in options {
        let rank = match option.id {
            AprOptionId::Concise => 0,
            AprOptionId::DetailForward => 1,
            AprOptionId::Split => 2,
        };
        if previous_rank.is_some_and(|previous| rank <= previous) {
            return Err("APR options must be unique and in canonical strategy order".to_string());
        }
        previous_rank = Some(rank);
        let expected_bullets = if option.id == AprOptionId::Split {
            2
        } else {
            1
        };
        if option.bullets.len() != expected_bullets {
            return Err(format!(
                "APR option {:?} must contain exactly {expected_bullets} bullet(s)",
                option.id
            ));
        }
        for bullet in &option.bullets {
            validate_nonempty_text("APR option bullet", bullet, MAX_BULLET_BYTES)?;
        }
        if !option_sequences.insert(option.bullets.clone()) {
            return Err("APR option bullet sequences must be distinct".to_string());
        }
        if option.id == AprOptionId::Split && option.bullets[0] == option.bullets[1] {
            return Err("Split APR bullets must be nonredundant".to_string());
        }
    }
    Ok(())
}

pub(crate) fn validate_apr_options_changed(
    options: &[AprOption],
    original: &str,
) -> CommandResult<()> {
    for option in options {
        if option.bullets.len() == 1 && option.bullets[0] == original {
            return Err("Every APR option must change the original highlight".to_string());
        }
    }
    Ok(())
}

pub(crate) fn validate_apr_analysis(
    analysis: &AprAnalysis,
    expected_target: &AprTarget,
) -> CommandResult<()> {
    validate_apr_target(&analysis.target)?;
    if &analysis.target != expected_target {
        return Err("Copilot returned an analysis for a different accomplishment".to_string());
    }
    validate_apr_response(&AprCopilotResponse {
        action: analysis.action.clone(),
        project: analysis.project.clone(),
        result: analysis.result.clone(),
        options: analysis.options.clone(),
    })?;
    validate_apr_options_changed(&analysis.options, &analysis.target.bullet)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::bind_highlight_reviews;
    use crate::test_support::*;

    #[test]
    fn proposal_requires_exact_original_experience_ids() {
        let valid =
            br#"{"summary":"","experience":[{"id":"experience-1","bullets":[]}],"notes":[]}"#;
        let proposal = parse_ai_proposal(valid, ["experience-1"]).expect("valid proposal");
        assert_eq!(proposal.experience[0].id, "experience-1");

        let duplicate =
            br#"{"summary":"","experience":[{"id":"experience-1","bullets":[]},{"id":"experience-1","bullets":[]}],"notes":[]}"#;
        assert!(parse_ai_proposal(duplicate, ["experience-1", "experience-2"]).is_err());
        let unknown = br#"{"summary":"","experience":[{"id":"other","bullets":[]}],"notes":[]}"#;
        assert!(parse_ai_proposal(unknown, ["experience-1"]).is_err());
        assert!(parse_ai_proposal(b"not json", ["experience-1"]).is_err());
        let extra =
        br#"{"summary":"","experience":[{"id":"experience-1","bullets":[]}],"notes":[],"extra":true}"#;
        assert!(parse_ai_proposal(extra, ["experience-1"]).is_err());
        let fenced =
        b"```json\n{\"summary\":\"ok\",\"experience\":[{\"id\":\"experience-1\",\"bullets\":[]}],\"notes\":[]}\n```";
        assert!(parse_ai_proposal(fenced, ["experience-1"]).is_ok());
    }

    #[test]
    fn apr_response_is_strict_bounded_and_bound_to_the_local_target() {
        let valid = br#"{"action":{"status":"clear","feedback":"Specific action."},"project":{"status":"partial","feedback":"Add context."},"result":{"status":"missing","feedback":"Add supported impact."},"options":[{"id":"concise","bullets":["Built a focused system."]},{"id":"detail-forward","bullets":["Built a useful system for product teams."]},{"id":"split","bullets":["Built a useful system.","Supported product teams."]}]}"#;
        let response = parse_apr_response(valid).expect("valid APR response");
        let target = sample_apr_target();
        let analysis = AprAnalysis {
            target: target.clone(),
            action: response.action,
            project: response.project,
            result: response.result,
            options: response.options,
        };
        validate_apr_analysis(&analysis, &target).expect("matching target");
        let one_option = br#"{"action":{"status":"clear","feedback":"Action."},"project":{"status":"clear","feedback":"Project."},"result":{"status":"missing","feedback":"No supported impact."},"options":[{"id":"detail-forward","bullets":["Built a useful system for product teams."]}]}"#;
        assert!(parse_apr_response(one_option).is_ok());
        let empty_options = br#"{"action":{"status":"clear","feedback":"Action."},"project":{"status":"clear","feedback":"Project."},"result":{"status":"missing","feedback":"No supported impact."},"options":[]}"#;
        assert!(parse_apr_response(empty_options).is_err());

        let extra = br#"{"action":{"status":"clear","feedback":"Action."},"project":{"status":"clear","feedback":"Project."},"result":{"status":"clear","feedback":"Result."},"options":[],"questions":[],"ideasToVerify":[],"extra":true}"#;
        assert!(parse_apr_response(extra).is_err());
        let invalid_status = br#"{"action":{"status":"strong","feedback":"Action."},"project":{"status":"clear","feedback":"Project."},"result":{"status":"clear","feedback":"Result."},"options":[]}"#;
        assert!(parse_apr_response(invalid_status).is_err());
        let questions_are_rejected = br#"{"action":{"status":"clear","feedback":"Action."},"project":{"status":"clear","feedback":"Project."},"result":{"status":"clear","feedback":"Result."},"options":[],"questions":["What changed?"]}"#;
        assert!(parse_apr_response(questions_are_rejected).is_err());
        let bad_order = br#"{"action":{"status":"clear","feedback":"Action."},"project":{"status":"clear","feedback":"Project."},"result":{"status":"clear","feedback":"Result."},"options":[{"id":"detail-forward","bullets":["Changed one."]},{"id":"concise","bullets":["Changed two."]}]}"#;
        assert!(parse_apr_response(bad_order).is_err());
        let bad_split = br#"{"action":{"status":"clear","feedback":"Action."},"project":{"status":"clear","feedback":"Project."},"result":{"status":"clear","feedback":"Result."},"options":[{"id":"concise","bullets":["Changed one."]},{"id":"detail-forward","bullets":["Changed two."]},{"id":"split","bullets":["Only one."]}]}"#;
        assert!(parse_apr_response(bad_split).is_err());

        let mut mismatched = target.clone();
        mismatched.bullet_index = 1;
        assert!(validate_apr_analysis(&analysis, &mismatched).is_err());
    }

    #[test]
    fn highlight_review_response_is_strict_and_index_complete() {
        let targets = review_targets(3, "Led a focused onboarding redesign");
        let valid = br#"{"reviews":[{"index":2,"action":"missing","project":"partial","result":"clear"},{"index":0,"action":"clear","project":"partial","result":"missing"},{"index":1,"action":"partial","project":"clear","result":"clear"}]}"#;
        let verdicts = parse_highlight_review_response(valid, targets.len())
            .expect("a shuffled but complete review is accepted");
        let reviews = bind_highlight_reviews(&targets, verdicts).expect("verdicts bind by index");
        assert_eq!(reviews.len(), 3);
        // Each verdict is rebound to the unchanged local target at that index.
        assert_eq!(reviews[0].target.bullet, targets[0].bullet);
        assert_eq!(reviews[2].target.bullet, targets[2].bullet);
        assert!(matches!(reviews[0].action, AprStatus::Clear));
        assert!(matches!(reviews[0].result, AprStatus::Missing));
        assert!(matches!(reviews[2].action, AprStatus::Missing));

        let fenced = b"```json\n{\"reviews\":[{\"index\":0,\"action\":\"clear\",\"project\":\"clear\",\"result\":\"clear\"}]}\n```";
        assert!(parse_highlight_review_response(fenced, 1).is_ok());

        let missing = br#"{"reviews":[{"index":0,"action":"clear","project":"clear","result":"clear"},{"index":1,"action":"clear","project":"clear","result":"clear"}]}"#;
        assert!(parse_highlight_review_response(missing, 3).is_err());
        let duplicate = br#"{"reviews":[{"index":0,"action":"clear","project":"clear","result":"clear"},{"index":0,"action":"clear","project":"clear","result":"clear"},{"index":2,"action":"clear","project":"clear","result":"clear"}]}"#;
        assert!(parse_highlight_review_response(duplicate, 3).is_err());
        let out_of_range = br#"{"reviews":[{"index":0,"action":"clear","project":"clear","result":"clear"},{"index":1,"action":"clear","project":"clear","result":"clear"},{"index":9,"action":"clear","project":"clear","result":"clear"}]}"#;
        assert!(parse_highlight_review_response(out_of_range, 3).is_err());
        let extra_field = br#"{"reviews":[{"index":0,"action":"clear","project":"clear","result":"clear","feedback":"Add impact."}]}"#;
        assert!(parse_highlight_review_response(extra_field, 1).is_err());
        let rewrite_smuggled = br#"{"reviews":[{"index":0,"action":"clear","project":"clear","result":"clear"}],"options":[{"id":"concise","bullets":["A rewrite."]}]}"#;
        assert!(parse_highlight_review_response(rewrite_smuggled, 1).is_err());
        let invalid_status =
            br#"{"reviews":[{"index":0,"action":"strong","project":"clear","result":"clear"}]}"#;
        assert!(parse_highlight_review_response(invalid_status, 1).is_err());
        assert!(parse_highlight_review_response(b"not json", 1).is_err());
        assert!(parse_highlight_review_response(b"", 1).is_err());
        let oversized = vec![b'a'; MAX_GENERATION_OUTPUT_BYTES + 1];
        assert!(parse_highlight_review_response(&oversized, 1).is_err());
    }
}
