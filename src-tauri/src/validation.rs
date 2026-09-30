//! Native validation of workspaces, resumes, text fields, AI request targets, and export requests.

use crate::contract::*;
use std::{collections::HashSet, path::Path};

pub(crate) fn validate_workspace(workspace: &Workspace) -> CommandResult<()> {
    if workspace.version != WORKSPACE_VERSION {
        return Err(format!(
            "Unsupported workspace version {}; expected {WORKSPACE_VERSION}",
            workspace.version
        ));
    }
    if workspace.resumes.len() > MAX_RESUMES {
        return Err(format!(
            "Workspace may contain at most {MAX_RESUMES} resumes"
        ));
    }
    let mut ids = HashSet::with_capacity(workspace.resumes.len());
    for resume in &workspace.resumes {
        if !ids.insert(resume.id.as_str()) {
            return Err(format!("Duplicate resume id: {}", resume.id));
        }
        validate_resume(resume)?;
    }
    if workspace.resumes.is_empty() {
        return Err("Workspace must contain at least one resume".to_string());
    }
    validate_nonempty_text("activeResumeId", &workspace.active_resume_id, MAX_ID_BYTES)?;
    if !ids.contains(workspace.active_resume_id.as_str()) {
        return Err("Active resume id does not refer to a resume".to_string());
    }
    Ok(())
}

pub(crate) fn validate_resume(resume: &Resume) -> CommandResult<()> {
    validate_nonempty_text("resume id", &resume.id, MAX_ID_BYTES)?;
    validate_nonempty_text("resume title", &resume.title, MAX_TITLE_BYTES)?;
    validate_iso_datetime(&resume.updated_at)?;
    validate_text("basics.name", &resume.basics.name, MAX_SHORT_TEXT_BYTES)?;
    validate_text(
        "basics.headline",
        &resume.basics.headline,
        MAX_SHORT_TEXT_BYTES,
    )?;
    validate_text("basics.email", &resume.basics.email, MAX_SHORT_TEXT_BYTES)?;
    validate_text("basics.phone", &resume.basics.phone, MAX_SHORT_TEXT_BYTES)?;
    validate_text(
        "basics.location",
        &resume.basics.location,
        MAX_SHORT_TEXT_BYTES,
    )?;
    validate_text(
        "basics.website",
        &resume.basics.website,
        MAX_SHORT_TEXT_BYTES,
    )?;
    validate_text("basics.github", &resume.basics.github, MAX_SHORT_TEXT_BYTES)?;
    validate_text("summary", &resume.summary, MAX_SUMMARY_BYTES)?;
    validate_text(
        "targetJob.title",
        &resume.target_job.title,
        MAX_SHORT_TEXT_BYTES,
    )?;
    validate_text(
        "targetJob.company",
        &resume.target_job.company,
        MAX_SHORT_TEXT_BYTES,
    )?;
    validate_text(
        "targetJob.sourceUrl",
        &resume.target_job.source_url,
        MAX_SHORT_TEXT_BYTES,
    )?;
    validate_text(
        "targetJob.description",
        &resume.target_job.description,
        MAX_JOB_DESCRIPTION_BYTES,
    )?;
    if resume.legacy_job_description.is_some() {
        return Err("Version 2 workspaces must not contain jobDescription".to_string());
    }

    if resume.experience.len() > MAX_EXPERIENCE {
        return Err(format!(
            "A resume may contain at most {MAX_EXPERIENCE} experience entries"
        ));
    }
    let mut experience_ids = HashSet::with_capacity(resume.experience.len());
    for experience in &resume.experience {
        validate_nonempty_text("experience id", &experience.id, MAX_ID_BYTES)?;
        if !experience_ids.insert(experience.id.as_str()) {
            return Err(format!("Duplicate experience id: {}", experience.id));
        }
        validate_text("experience.role", &experience.role, MAX_SHORT_TEXT_BYTES)?;
        validate_text(
            "experience.company",
            &experience.company,
            MAX_SHORT_TEXT_BYTES,
        )?;
        validate_text(
            "experience.location",
            &experience.location,
            MAX_SHORT_TEXT_BYTES,
        )?;
        validate_text(
            "experience.startDate",
            &experience.start_date,
            MAX_SHORT_TEXT_BYTES,
        )?;
        validate_text(
            "experience.endDate",
            &experience.end_date,
            MAX_SHORT_TEXT_BYTES,
        )?;
        validate_bullets(&experience.bullets, "experience.bullets")?;
    }

    if resume.education.len() > MAX_EDUCATION {
        return Err(format!(
            "A resume may contain at most {MAX_EDUCATION} education entries"
        ));
    }
    let mut education_ids = HashSet::with_capacity(resume.education.len());
    for education in &resume.education {
        validate_nonempty_text("education id", &education.id, MAX_ID_BYTES)?;
        if !education_ids.insert(education.id.as_str()) {
            return Err(format!("Duplicate education id: {}", education.id));
        }
        validate_text("education.school", &education.school, MAX_SHORT_TEXT_BYTES)?;
        validate_text("education.degree", &education.degree, MAX_SHORT_TEXT_BYTES)?;
        validate_text(
            "education.graduation",
            &education.graduation,
            MAX_SHORT_TEXT_BYTES,
        )?;
    }

    if resume.skills.len() > MAX_SKILLS {
        return Err(format!("A resume may contain at most {MAX_SKILLS} skills"));
    }
    for skill in &resume.skills {
        validate_text("skill", skill, 100)?;
    }

    validate_additional_entries(resume)?;
    Ok(())
}

fn validate_additional_entries(resume: &Resume) -> CommandResult<()> {
    validate_entry_count("projects", resume.projects.len())?;
    validate_entry_count("certifications", resume.certifications.len())?;
    validate_entry_count("awards", resume.awards.len())?;
    validate_entry_count("volunteer", resume.volunteer.len())?;
    validate_entry_count("publications", resume.publications.len())?;
    validate_entry_count("languages", resume.languages.len())?;

    let mut ids = HashSet::new();
    for project in &resume.projects {
        validate_unique_id(&mut ids, "project", &project.id)?;
        validate_text("project.name", &project.name, MAX_SHORT_TEXT_BYTES)?;
        validate_text("project.role", &project.role, MAX_SHORT_TEXT_BYTES)?;
        validate_text("project.url", &project.url, MAX_SHORT_TEXT_BYTES)?;
        validate_text(
            "project.startDate",
            &project.start_date,
            MAX_SHORT_TEXT_BYTES,
        )?;
        validate_text("project.endDate", &project.end_date, MAX_SHORT_TEXT_BYTES)?;
        validate_bullets(&project.bullets, "project.bullets")?;
    }
    ids.clear();
    for certification in &resume.certifications {
        validate_unique_id(&mut ids, "certification", &certification.id)?;
        validate_text(
            "certification.name",
            &certification.name,
            MAX_SHORT_TEXT_BYTES,
        )?;
        validate_text(
            "certification.issuer",
            &certification.issuer,
            MAX_SHORT_TEXT_BYTES,
        )?;
        validate_text(
            "certification.date",
            &certification.date,
            MAX_SHORT_TEXT_BYTES,
        )?;
        validate_text(
            "certification.credentialUrl",
            &certification.credential_url,
            MAX_SHORT_TEXT_BYTES,
        )?;
    }
    ids.clear();
    for award in &resume.awards {
        validate_unique_id(&mut ids, "award", &award.id)?;
        validate_text("award.title", &award.title, MAX_SHORT_TEXT_BYTES)?;
        validate_text("award.issuer", &award.issuer, MAX_SHORT_TEXT_BYTES)?;
        validate_text("award.date", &award.date, MAX_SHORT_TEXT_BYTES)?;
        validate_text("award.description", &award.description, MAX_SUMMARY_BYTES)?;
    }
    ids.clear();
    for volunteer in &resume.volunteer {
        validate_unique_id(&mut ids, "volunteer", &volunteer.id)?;
        validate_text(
            "volunteer.organization",
            &volunteer.organization,
            MAX_SHORT_TEXT_BYTES,
        )?;
        validate_text("volunteer.role", &volunteer.role, MAX_SHORT_TEXT_BYTES)?;
        validate_text(
            "volunteer.startDate",
            &volunteer.start_date,
            MAX_SHORT_TEXT_BYTES,
        )?;
        validate_text(
            "volunteer.endDate",
            &volunteer.end_date,
            MAX_SHORT_TEXT_BYTES,
        )?;
        validate_bullets(&volunteer.bullets, "volunteer.bullets")?;
    }
    ids.clear();
    for publication in &resume.publications {
        validate_unique_id(&mut ids, "publication", &publication.id)?;
        validate_text(
            "publication.title",
            &publication.title,
            MAX_SHORT_TEXT_BYTES,
        )?;
        validate_text(
            "publication.publisher",
            &publication.publisher,
            MAX_SHORT_TEXT_BYTES,
        )?;
        validate_text("publication.date", &publication.date, MAX_SHORT_TEXT_BYTES)?;
        validate_text("publication.url", &publication.url, MAX_SHORT_TEXT_BYTES)?;
    }
    ids.clear();
    for language in &resume.languages {
        validate_unique_id(&mut ids, "language", &language.id)?;
        validate_text("language.name", &language.name, MAX_SHORT_TEXT_BYTES)?;
        validate_text(
            "language.proficiency",
            &language.proficiency,
            MAX_SHORT_TEXT_BYTES,
        )?;
    }

    let expected = default_additional_section_order();
    if resume.additional_section_order.len() != expected.len()
        || resume
            .additional_section_order
            .iter()
            .copied()
            .collect::<HashSet<_>>()
            .len()
            != expected.len()
        || expected
            .iter()
            .any(|section| !resume.additional_section_order.contains(section))
    {
        return Err("additionalSectionOrder must contain every section once".to_string());
    }
    Ok(())
}

fn validate_entry_count(field: &str, count: usize) -> CommandResult<()> {
    if count > MAX_ADDITIONAL_ENTRIES {
        return Err(format!(
            "{field} may contain at most {MAX_ADDITIONAL_ENTRIES} entries"
        ));
    }
    Ok(())
}

fn validate_unique_id<'a>(
    ids: &mut HashSet<&'a str>,
    field: &str,
    id: &'a str,
) -> CommandResult<()> {
    validate_nonempty_text(&format!("{field} id"), id, MAX_ID_BYTES)?;
    if !ids.insert(id) {
        return Err(format!("Duplicate {field} id: {id}"));
    }
    Ok(())
}

pub(crate) fn validate_bullets(bullets: &[String], field: &str) -> CommandResult<()> {
    if bullets.len() > MAX_BULLETS {
        return Err(format!("{field} may contain at most {MAX_BULLETS} bullets"));
    }
    for bullet in bullets {
        validate_text(field, bullet, MAX_BULLET_BYTES)?;
    }
    Ok(())
}

pub(crate) fn validate_text(field: &str, value: &str, max_bytes: usize) -> CommandResult<()> {
    if value.len() > max_bytes {
        return Err(format!("{field} exceeds its {max_bytes}-byte limit"));
    }
    if value.chars().any(|character| {
        character == '\0' || (character.is_control() && !matches!(character, '\n' | '\r' | '\t'))
    }) {
        return Err(format!("{field} contains unsupported control characters"));
    }
    Ok(())
}

pub(crate) fn validate_nonempty_text(
    field: &str,
    value: &str,
    max_bytes: usize,
) -> CommandResult<()> {
    if value.trim().is_empty() {
        return Err(format!("{field} must not be empty"));
    }
    validate_text(field, value, max_bytes)
}

pub(crate) fn validate_iso_datetime(value: &str) -> CommandResult<()> {
    let bytes = value.as_bytes();
    let has_fraction = bytes.get(19) == Some(&b'.');
    let minimum_length = if has_fraction { 22 } else { 20 };
    if bytes.len() < minimum_length || bytes.last() != Some(&b'Z') {
        return Err("updatedAt must be an ISO UTC datetime".to_string());
    }
    for (index, expected) in [(4, b'-'), (7, b'-'), (10, b'T'), (13, b':'), (16, b':')] {
        if bytes.get(index) != Some(&expected) {
            return Err("updatedAt must be an ISO UTC datetime".to_string());
        }
    }
    let year = parse_ascii_digits(&bytes[0..4]);
    let month = parse_ascii_digits(&bytes[5..7]);
    let day = parse_ascii_digits(&bytes[8..10]);
    let hour = parse_ascii_digits(&bytes[11..13]);
    let minute = parse_ascii_digits(&bytes[14..16]);
    let second = parse_ascii_digits(&bytes[17..19]);
    let (Some(year), Some(month), Some(day), Some(hour), Some(minute), Some(second)) =
        (year, month, day, hour, minute, second)
    else {
        return Err("updatedAt must be an ISO UTC datetime".to_string());
    };
    let leap_year = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days_in_month = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap_year => 29,
        2 => 28,
        _ => 0,
    };
    if day == 0 || day > days_in_month || hour > 23 || minute > 59 || second > 59 {
        return Err("updatedAt must be an ISO UTC datetime".to_string());
    }
    if has_fraction && !bytes[20..bytes.len() - 1].iter().all(u8::is_ascii_digit) {
        return Err("updatedAt must be an ISO UTC datetime".to_string());
    }
    if !has_fraction && bytes.len() != 20 {
        return Err("updatedAt must be an ISO UTC datetime".to_string());
    }
    Ok(())
}

pub(crate) fn parse_ascii_digits(bytes: &[u8]) -> Option<u32> {
    if bytes.is_empty() || !bytes.iter().all(u8::is_ascii_digit) {
        return None;
    }
    Some(
        bytes
            .iter()
            .fold(0, |value, digit| value * 10 + u32::from(digit - b'0')),
    )
}

pub(crate) fn validate_export_request(
    filename: &str,
    contents: &[u8],
    kind: &ExportKind,
) -> CommandResult<()> {
    validate_export_filename(filename, kind)?;
    if contents.len() > MAX_EXPORT_BYTES {
        return Err("Export contents exceed the 20 MB limit".to_string());
    }
    if matches!(kind, ExportKind::Pdf) && !contents.starts_with(b"%PDF-") {
        return Err("PDF export contents do not have a valid PDF header".to_string());
    }
    Ok(())
}

pub(crate) fn validate_export_filename(filename: &str, kind: &ExportKind) -> CommandResult<()> {
    if filename.is_empty() || filename.len() > 255 {
        return Err("Export filename must be between 1 and 255 bytes".to_string());
    }
    if filename == "." || filename == ".." || filename.contains('/') || filename.contains('\\') {
        return Err("Export filename must be a basename".to_string());
    }
    if filename
        .chars()
        .any(|character| character == '\0' || character.is_control())
    {
        return Err("Export filename contains unsupported characters".to_string());
    }
    let expected_extension = match kind {
        ExportKind::Pdf => "pdf",
        ExportKind::Json => "json",
    };
    if Path::new(filename)
        .extension()
        .and_then(|extension| extension.to_str())
        .is_none_or(|extension| !extension.eq_ignore_ascii_case(expected_extension))
    {
        return Err(format!(
            "Export filename must use the .{expected_extension} extension"
        ));
    }
    Ok(())
}

pub(crate) fn validate_selected_export_path(path: &Path, kind: &ExportKind) -> CommandResult<()> {
    let filename = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Save dialog returned a path without a valid filename".to_string())?;
    validate_export_filename(filename, kind)
}

pub(crate) fn validate_apr_review(
    target: &AprTarget,
    review: Option<&HighlightReview>,
) -> CommandResult<()> {
    let Some(review) = review else {
        return Ok(());
    };
    if review.target != *target {
        return Err("Highlight review does not match the selected accomplishment".to_string());
    }
    if matches!(review.action, AprStatus::Clear)
        && matches!(review.project, AprStatus::Clear)
        && matches!(review.result, AprStatus::Clear)
    {
        return Err("Highlight review must identify at least one weak dimension".to_string());
    }
    Ok(())
}

pub(crate) fn validate_highlight_review_targets(targets: &[AprTarget]) -> CommandResult<()> {
    if targets.is_empty() {
        return Err("Add at least one highlight before requesting a review".to_string());
    }
    for target in targets {
        validate_apr_target(target)?;
    }
    Ok(())
}

pub(crate) fn validate_apr_target(target: &AprTarget) -> CommandResult<()> {
    validate_nonempty_text("resume id", &target.resume_id, MAX_ID_BYTES)?;
    validate_nonempty_text("experience id", &target.experience_id, MAX_ID_BYTES)?;
    if target.bullet_index >= MAX_BULLETS {
        return Err(format!(
            "Accomplishment index must be less than {MAX_BULLETS}"
        ));
    }
    validate_text("role", &target.role, MAX_SHORT_TEXT_BYTES)?;
    validate_nonempty_text("accomplishment", &target.bullet, MAX_BULLET_BYTES)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::*;

    #[test]
    fn apr_review_context_rejects_mismatched_and_all_clear_reviews() {
        let target = sample_apr_target();
        let mut mismatched = HighlightReview {
            target: target.clone(),
            action: AprStatus::Partial,
            project: AprStatus::Clear,
            result: AprStatus::Clear,
        };
        mismatched.target.bullet = "Different source.".to_string();
        assert!(validate_apr_review(&target, Some(&mismatched)).is_err());

        let all_clear = HighlightReview {
            target,
            action: AprStatus::Clear,
            project: AprStatus::Clear,
            result: AprStatus::Clear,
        };
        assert!(validate_apr_review(&all_clear.target, Some(&all_clear)).is_err());
        assert!(validate_apr_review(&all_clear.target, None).is_ok());
    }
}
