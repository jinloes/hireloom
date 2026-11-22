use crate::contract::*;
use std::collections::HashSet;

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
    validate_career_library(&workspace.career_library)?;
    Ok(())
}

fn validate_optional_id(field: &str, value: &Option<String>) -> CommandResult<()> {
    if let Some(id) = value {
        validate_nonempty_text(field, id, MAX_ID_BYTES)?;
    }
    Ok(())
}

fn validate_experience_item(
    experience: &Experience,
    allow_library_link: bool,
) -> CommandResult<()> {
    validate_nonempty_text("experience id", &experience.id, MAX_ID_BYTES)?;
    if allow_library_link {
        validate_optional_id("experience.libraryId", &experience.library_id)?;
    } else if experience.library_id.is_some() {
        return Err("Canonical careerLibrary.experiences items cannot set libraryId".to_string());
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
    validate_bullets(&experience.bullets, "experience.bullets")
}

fn validate_project_item(project: &Project, allow_library_link: bool) -> CommandResult<()> {
    validate_nonempty_text("project id", &project.id, MAX_ID_BYTES)?;
    if allow_library_link {
        validate_optional_id("project.libraryId", &project.library_id)?;
    } else if project.library_id.is_some() {
        return Err("Canonical careerLibrary.projects items cannot set libraryId".to_string());
    }
    validate_text("project.name", &project.name, MAX_SHORT_TEXT_BYTES)?;
    validate_text("project.subtitle", &project.subtitle, MAX_SHORT_TEXT_BYTES)?;
    validate_text("project.url", &project.url, MAX_SHORT_TEXT_BYTES)?;
    validate_text(
        "project.startDate",
        &project.start_date,
        MAX_SHORT_TEXT_BYTES,
    )?;
    validate_text("project.endDate", &project.end_date, MAX_SHORT_TEXT_BYTES)?;
    validate_bullets(&project.bullets, "project.bullets")
}

fn validate_education_item(education: &Education, allow_library_link: bool) -> CommandResult<()> {
    validate_nonempty_text("education id", &education.id, MAX_ID_BYTES)?;
    if allow_library_link {
        validate_optional_id("education.libraryId", &education.library_id)?;
    } else if education.library_id.is_some() {
        return Err("Canonical careerLibrary.education items cannot set libraryId".to_string());
    }
    validate_text("education.school", &education.school, MAX_SHORT_TEXT_BYTES)?;
    validate_text("education.degree", &education.degree, MAX_SHORT_TEXT_BYTES)?;
    validate_text(
        "education.graduation",
        &education.graduation,
        MAX_SHORT_TEXT_BYTES,
    )
}

fn validate_certification_item(
    certification: &Certification,
    allow_library_link: bool,
) -> CommandResult<()> {
    validate_nonempty_text("certification id", &certification.id, MAX_ID_BYTES)?;
    if allow_library_link {
        validate_optional_id("certification.libraryId", &certification.library_id)?;
    } else if certification.library_id.is_some() {
        return Err(
            "Canonical careerLibrary.certifications items cannot set libraryId".to_string(),
        );
    }
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
        "certification.url",
        &certification.url,
        MAX_SHORT_TEXT_BYTES,
    )
}

fn validate_skill_group_item(group: &SkillGroup, allow_library_link: bool) -> CommandResult<()> {
    validate_nonempty_text("skillGroup id", &group.id, MAX_ID_BYTES)?;
    if allow_library_link {
        validate_optional_id("skillGroup.libraryId", &group.library_id)?;
    } else if group.library_id.is_some() {
        return Err("Canonical careerLibrary.skillGroups items cannot set libraryId".to_string());
    }
    validate_text("skillGroup.category", &group.category, MAX_SHORT_TEXT_BYTES)?;
    if group.items.len() > MAX_SKILLS_PER_GROUP {
        return Err(format!(
            "A skill group may contain at most {MAX_SKILLS_PER_GROUP} skills"
        ));
    }
    for item in &group.items {
        validate_text("skillGroup.item", item, 100)?;
    }
    Ok(())
}

pub(crate) fn validate_career_library(library: &CareerLibrary) -> CommandResult<()> {
    if library.experiences.len() > MAX_LIBRARY_EXPERIENCES {
        return Err(format!(
            "Career Library may contain at most {MAX_LIBRARY_EXPERIENCES} experiences"
        ));
    }
    let mut exp_ids = HashSet::with_capacity(library.experiences.len());
    for item in &library.experiences {
        if !exp_ids.insert(item.id.as_str()) {
            return Err(format!(
                "Duplicate careerLibrary experience id: {}",
                item.id
            ));
        }
        validate_experience_item(item, false)?;
    }

    if library.projects.len() > MAX_LIBRARY_PROJECTS {
        return Err(format!(
            "Career Library may contain at most {MAX_LIBRARY_PROJECTS} projects"
        ));
    }
    let mut proj_ids = HashSet::with_capacity(library.projects.len());
    for item in &library.projects {
        if !proj_ids.insert(item.id.as_str()) {
            return Err(format!("Duplicate careerLibrary project id: {}", item.id));
        }
        validate_project_item(item, false)?;
    }

    if library.education.len() > MAX_LIBRARY_EDUCATION {
        return Err(format!(
            "Career Library may contain at most {MAX_LIBRARY_EDUCATION} education entries"
        ));
    }
    let mut edu_ids = HashSet::with_capacity(library.education.len());
    for item in &library.education {
        if !edu_ids.insert(item.id.as_str()) {
            return Err(format!("Duplicate careerLibrary education id: {}", item.id));
        }
        validate_education_item(item, false)?;
    }

    if library.certifications.len() > MAX_LIBRARY_CERTIFICATIONS {
        return Err(format!(
            "Career Library may contain at most {MAX_LIBRARY_CERTIFICATIONS} certifications"
        ));
    }
    let mut cert_ids = HashSet::with_capacity(library.certifications.len());
    for item in &library.certifications {
        if !cert_ids.insert(item.id.as_str()) {
            return Err(format!(
                "Duplicate careerLibrary certification id: {}",
                item.id
            ));
        }
        validate_certification_item(item, false)?;
    }

    if library.skill_groups.len() > MAX_LIBRARY_SKILL_GROUPS {
        return Err(format!(
            "Career Library may contain at most {MAX_LIBRARY_SKILL_GROUPS} skill groups"
        ));
    }
    let mut sg_ids = HashSet::with_capacity(library.skill_groups.len());
    for item in &library.skill_groups {
        if !sg_ids.insert(item.id.as_str()) {
            return Err(format!(
                "Duplicate careerLibrary skillGroup id: {}",
                item.id
            ));
        }
        validate_skill_group_item(item, false)?;
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
        "jobDescription",
        &resume.job_description,
        MAX_JOB_DESCRIPTION_BYTES,
    )?;

    if resume.experience.len() > MAX_EXPERIENCE {
        return Err(format!(
            "A resume may contain at most {MAX_EXPERIENCE} experience entries"
        ));
    }
    let mut experience_ids = HashSet::with_capacity(resume.experience.len());
    for experience in &resume.experience {
        if !experience_ids.insert(experience.id.as_str()) {
            return Err(format!("Duplicate experience id: {}", experience.id));
        }
        validate_experience_item(experience, true)?;
    }

    if resume.projects.len() > MAX_PROJECTS {
        return Err(format!(
            "A resume may contain at most {MAX_PROJECTS} project entries"
        ));
    }
    let mut project_ids = HashSet::with_capacity(resume.projects.len());
    for project in &resume.projects {
        if !project_ids.insert(project.id.as_str()) {
            return Err(format!("Duplicate project id: {}", project.id));
        }
        validate_project_item(project, true)?;
    }

    if resume.education.len() > MAX_EDUCATION {
        return Err(format!(
            "A resume may contain at most {MAX_EDUCATION} education entries"
        ));
    }
    let mut education_ids = HashSet::with_capacity(resume.education.len());
    for education in &resume.education {
        if !education_ids.insert(education.id.as_str()) {
            return Err(format!("Duplicate education id: {}", education.id));
        }
        validate_education_item(education, true)?;
    }

    if resume.certifications.len() > MAX_CERTIFICATIONS {
        return Err(format!(
            "A resume may contain at most {MAX_CERTIFICATIONS} certifications"
        ));
    }
    let mut cert_ids = HashSet::with_capacity(resume.certifications.len());
    for cert in &resume.certifications {
        if !cert_ids.insert(cert.id.as_str()) {
            return Err(format!("Duplicate certification id: {}", cert.id));
        }
        validate_certification_item(cert, true)?;
    }

    if resume.custom_sections.len() > MAX_CUSTOM_SECTIONS {
        return Err(format!(
            "A resume may contain at most {MAX_CUSTOM_SECTIONS} custom sections"
        ));
    }
    let mut custom_section_ids = HashSet::with_capacity(resume.custom_sections.len());
    for section in &resume.custom_sections {
        validate_nonempty_text("customSection id", &section.id, MAX_ID_BYTES)?;
        if !custom_section_ids.insert(section.id.as_str()) {
            return Err(format!("Duplicate customSection id: {}", section.id));
        }
        validate_text("customSection.title", &section.title, MAX_SHORT_TEXT_BYTES)?;
        if section.entries.len() > MAX_CUSTOM_ENTRIES {
            return Err(format!(
                "A custom section may contain at most {MAX_CUSTOM_ENTRIES} entries"
            ));
        }
        let mut entry_ids = HashSet::with_capacity(section.entries.len());
        for entry in &section.entries {
            validate_nonempty_text("customEntry id", &entry.id, MAX_ID_BYTES)?;
            if !entry_ids.insert(entry.id.as_str()) {
                return Err(format!("Duplicate customEntry id: {}", entry.id));
            }
            validate_text("customEntry.heading", &entry.heading, MAX_SHORT_TEXT_BYTES)?;
            validate_text(
                "customEntry.subheading",
                &entry.subheading,
                MAX_SHORT_TEXT_BYTES,
            )?;
            validate_text("customEntry.date", &entry.date, MAX_SHORT_TEXT_BYTES)?;
            validate_bullets(&entry.bullets, "customEntry.bullets")?;
        }
    }

    if resume.skills.len() > MAX_SKILLS {
        return Err(format!("A resume may contain at most {MAX_SKILLS} skills"));
    }
    for skill in &resume.skills {
        validate_text("skill", skill, 100)?;
    }

    if resume.skill_groups.len() > MAX_SKILL_GROUPS {
        return Err(format!(
            "A resume may contain at most {MAX_SKILL_GROUPS} skill groups"
        ));
    }
    let mut skill_group_ids = HashSet::with_capacity(resume.skill_groups.len());
    for group in &resume.skill_groups {
        if !skill_group_ids.insert(group.id.as_str()) {
            return Err(format!("Duplicate skillGroup id: {}", group.id));
        }
        validate_skill_group_item(group, true)?;
    }

    if resume.section_order.len() != SECTION_COUNT {
        return Err("Section order must include each section once".to_string());
    }
    let mut seen_sections = HashSet::with_capacity(SECTION_COUNT);
    for section in &resume.section_order {
        if !seen_sections.insert(*section) {
            return Err("Section order must include each section once".to_string());
        }
    }

    if resume.skipped_keywords.len() > MAX_SKIPPED_KEYWORDS {
        return Err(format!(
            "A resume may contain at most {MAX_SKIPPED_KEYWORDS} skipped keywords"
        ));
    }
    let mut skipped = HashSet::with_capacity(resume.skipped_keywords.len());
    for keyword in &resume.skipped_keywords {
        validate_nonempty_text("skippedKeyword", keyword, 100)?;
        if !skipped.insert(keyword.as_str()) {
            return Err(format!("Duplicate skipped keyword: {keyword}"));
        }
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

fn validate_iso_datetime(value: &str) -> CommandResult<()> {
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

fn parse_ascii_digits(bytes: &[u8]) -> Option<u32> {
    if bytes.is_empty() || !bytes.iter().all(u8::is_ascii_digit) {
        return None;
    }
    Some(
        bytes
            .iter()
            .fold(0, |value, digit| value * 10 + u32::from(digit - b'0')),
    )
}
