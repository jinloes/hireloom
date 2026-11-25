use crate::{
    contract::*,
    providers::{load_ai_settings_from_path, AiSettings, AI_SETTINGS_FILE},
    validation::validate_workspace,
};
use serde::Deserialize;
use std::{
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};
use tempfile::NamedTempFile;

pub(crate) fn ai_settings_path(app: &AppHandle) -> CommandResult<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(AI_SETTINGS_FILE))
        .map_err(|error| format!("Unable to resolve Hireloom app data directory: {error}"))
}

pub(crate) fn load_ai_settings_for_app(app: &AppHandle) -> CommandResult<AiSettings> {
    let path = ai_settings_path(app)?;
    load_ai_settings_from_path(&path)
}

pub(crate) fn workspace_path(app: &AppHandle) -> CommandResult<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(WORKSPACE_FILE))
        .map_err(|error| format!("Unable to resolve Hireloom app data directory: {error}"))
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LegacyTargetJob {
    #[serde(default)]
    title: String,
    #[serde(default)]
    company: String,
    #[serde(default)]
    source_url: String,
    #[serde(default)]
    description: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LegacyProject {
    id: String,
    name: String,
    #[serde(default)]
    role: String,
    #[serde(default)]
    url: String,
    #[serde(default)]
    start_date: String,
    #[serde(default)]
    end_date: String,
    #[serde(default)]
    bullets: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LegacyCertification {
    id: String,
    name: String,
    #[serde(default)]
    issuer: String,
    #[serde(default)]
    date: String,
    #[serde(default)]
    credential_url: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LegacyAward {
    id: String,
    title: String,
    #[serde(default)]
    issuer: String,
    #[serde(default)]
    date: String,
    #[serde(default)]
    description: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LegacyVolunteer {
    id: String,
    #[serde(default)]
    organization: String,
    #[serde(default)]
    role: String,
    #[serde(default)]
    start_date: String,
    #[serde(default)]
    end_date: String,
    #[serde(default)]
    bullets: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LegacyPublication {
    id: String,
    title: String,
    #[serde(default)]
    publisher: String,
    #[serde(default)]
    date: String,
    #[serde(default)]
    url: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LegacyLanguage {
    id: String,
    name: String,
    #[serde(default)]
    proficiency: String,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
enum LegacyAdditionalSection {
    Projects,
    Certifications,
    Awards,
    Volunteer,
    Publications,
    Languages,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LegacyResumeV2 {
    id: String,
    title: String,
    updated_at: String,
    basics: Basics,
    summary: String,
    experience: Vec<Experience>,
    education: Vec<Education>,
    skills: Vec<String>,
    #[serde(default)]
    target_job: LegacyTargetJob,
    #[serde(default)]
    projects: Vec<LegacyProject>,
    #[serde(default)]
    certifications: Vec<LegacyCertification>,
    #[serde(default)]
    awards: Vec<LegacyAward>,
    #[serde(default)]
    volunteer: Vec<LegacyVolunteer>,
    #[serde(default)]
    publications: Vec<LegacyPublication>,
    #[serde(default)]
    languages: Vec<LegacyLanguage>,
    #[serde(default)]
    additional_section_order: Vec<LegacyAdditionalSection>,
    #[serde(default)]
    job_description: Option<String>,
    template: Template,
    accent: Accent,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LegacyWorkspaceV2 {
    version: u32,
    active_resume_id: String,
    resumes: Vec<LegacyResumeV2>,
}

fn format_legacy_date_range(start: &str, end: &str) -> String {
    match (start.trim(), end.trim()) {
        ("", "") => String::new(),
        (s, "") => s.to_string(),
        ("", e) => e.to_string(),
        (s, e) => format!("{s} – {e}"),
    }
}

fn upgrade_legacy_resume_v2(legacy: LegacyResumeV2) -> Resume {
    let _ = (
        &legacy.target_job.title,
        &legacy.target_job.company,
        &legacy.target_job.source_url,
        &legacy.additional_section_order,
    );
    let job_description = if !legacy.target_job.description.trim().is_empty() {
        legacy.target_job.description
    } else {
        legacy.job_description.unwrap_or_default()
    };

    let mut custom_sections = Vec::new();
    if !legacy.awards.is_empty() {
        custom_sections.push(CustomSection {
            id: "legacy-awards".to_string(),
            title: "Awards".to_string(),
            entries: legacy
                .awards
                .into_iter()
                .map(|award| CustomEntry {
                    id: award.id,
                    heading: award.title,
                    subheading: award.issuer,
                    date: award.date,
                    bullets: if award.description.trim().is_empty() {
                        Vec::new()
                    } else {
                        vec![award.description]
                    },
                })
                .collect(),
        });
    }
    if !legacy.volunteer.is_empty() {
        custom_sections.push(CustomSection {
            id: "legacy-volunteer".to_string(),
            title: "Volunteer".to_string(),
            entries: legacy
                .volunteer
                .into_iter()
                .map(|item| CustomEntry {
                    id: item.id,
                    heading: item.role,
                    subheading: item.organization,
                    date: format_legacy_date_range(&item.start_date, &item.end_date),
                    bullets: item.bullets,
                })
                .collect(),
        });
    }
    if !legacy.publications.is_empty() {
        custom_sections.push(CustomSection {
            id: "legacy-publications".to_string(),
            title: "Publications".to_string(),
            entries: legacy
                .publications
                .into_iter()
                .map(|item| CustomEntry {
                    id: item.id,
                    heading: item.title,
                    subheading: item.publisher,
                    date: item.date,
                    bullets: if item.url.trim().is_empty() {
                        Vec::new()
                    } else {
                        vec![item.url]
                    },
                })
                .collect(),
        });
    }
    if !legacy.languages.is_empty() {
        custom_sections.push(CustomSection {
            id: "legacy-languages".to_string(),
            title: "Languages".to_string(),
            entries: legacy
                .languages
                .into_iter()
                .map(|item| CustomEntry {
                    id: item.id,
                    heading: item.name,
                    subheading: item.proficiency,
                    date: String::new(),
                    bullets: Vec::new(),
                })
                .collect(),
        });
    }

    Resume {
        id: legacy.id,
        title: legacy.title,
        updated_at: legacy.updated_at,
        basics: legacy.basics,
        summary: legacy.summary,
        experience: legacy.experience,
        projects: legacy
            .projects
            .into_iter()
            .map(|project| Project {
                id: project.id,
                name: project.name,
                subtitle: project.role,
                url: project.url,
                start_date: project.start_date,
                end_date: project.end_date,
                bullets: project.bullets,
                library_id: None,
            })
            .collect(),
        education: legacy.education,
        certifications: legacy
            .certifications
            .into_iter()
            .map(|cert| Certification {
                id: cert.id,
                name: cert.name,
                issuer: cert.issuer,
                date: cert.date,
                url: cert.credential_url,
                library_id: None,
            })
            .collect(),
        custom_sections,
        skills: legacy.skills,
        skill_groups: Vec::new(),
        section_order: default_section_order(),
        skipped_keywords: Vec::new(),
        job_description,
        template: legacy.template,
        accent: legacy.accent,
        page_size: default_page_size(),
        density: default_density(),
    }
}

pub(crate) fn parse_workspace_bytes(bytes: &[u8]) -> CommandResult<Workspace> {
    if bytes.len() > MAX_WORKSPACE_BYTES {
        return Err("Workspace file exceeds the 2 MB limit".to_string());
    }
    let raw_version = serde_json::from_slice::<serde_json::Value>(bytes)
        .map_err(|error| format!("Workspace file is malformed or unsupported: {error}"))?
        .get("version")
        .and_then(serde_json::Value::as_u64);

    let workspace = match raw_version {
        Some(1) => {
            let v1 = serde_json::from_slice::<WorkspaceV1>(bytes)
                .map_err(|error| format!("Workspace file is malformed or unsupported: {error}"))?;
            if v1.version != 1 {
                return Err("Invalid legacy workspace version".to_string());
            }
            Workspace {
                version: WORKSPACE_VERSION,
                active_resume_id: v1.active_resume_id,
                resumes: v1.resumes,
                career_library: CareerLibrary::default(),
            }
        }
        Some(version) if version == u64::from(WORKSPACE_VERSION) => {
            match serde_json::from_slice::<Workspace>(bytes) {
                Ok(workspace) => workspace,
                Err(primary_error) => match serde_json::from_slice::<LegacyWorkspaceV2>(bytes) {
                    Ok(legacy) if legacy.version == WORKSPACE_VERSION => Workspace {
                        version: WORKSPACE_VERSION,
                        active_resume_id: legacy.active_resume_id,
                        resumes: legacy
                            .resumes
                            .into_iter()
                            .map(upgrade_legacy_resume_v2)
                            .collect(),
                        career_library: CareerLibrary::default(),
                    },
                    _ => {
                        return Err(format!(
                            "Workspace file is malformed or unsupported: {primary_error}"
                        ));
                    }
                },
            }
        }
        Some(version) => {
            return Err(format!(
                "Unsupported workspace version {version}; expected {WORKSPACE_VERSION}"
            ));
        }
        None => {
            return Err("Workspace file is malformed or unsupported: missing version".to_string());
        }
    };
    validate_workspace(&workspace)?;
    Ok(workspace)
}

pub(crate) fn load_workspace_from_path(path: &Path) -> CommandResult<Option<Workspace>> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Unable to read workspace: {error}")),
    };
    parse_workspace_bytes(&bytes).map(Some)
}

pub(crate) fn serialize_valid_workspace(workspace: &Workspace) -> CommandResult<Vec<u8>> {
    validate_workspace(workspace)?;
    let bytes = serde_json::to_vec(workspace)
        .map_err(|error| format!("Unable to serialize workspace: {error}"))?;
    if bytes.len() > MAX_WORKSPACE_BYTES {
        return Err("Workspace exceeds the 2 MB limit".to_string());
    }
    Ok(bytes)
}

pub(crate) fn create_restricted_dir(path: &Path) -> io::Result<()> {
    fs::create_dir_all(path)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

pub(crate) fn write_atomic(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "path has no parent"))?;
    if !parent.is_dir() {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            "parent directory does not exist",
        ));
    }
    let mut temporary = NamedTempFile::new_in(parent)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        temporary
            .as_file()
            .set_permissions(fs::Permissions::from_mode(0o600))?;
    }
    temporary.write_all(bytes)?;
    temporary.as_file().sync_all()?;
    let temporary_path = temporary.into_temp_path();
    replace_path(&temporary_path, path)?;
    #[cfg(unix)]
    {
        let _ = fs::File::open(parent).and_then(|directory| directory.sync_all());
    }
    Ok(())
}

#[cfg(not(windows))]
fn replace_path(temporary: &Path, destination: &Path) -> io::Result<()> {
    fs::rename(temporary, destination)
}

#[cfg(windows)]
fn replace_path(temporary: &Path, destination: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let source: Vec<u16> = temporary
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let target: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let result = unsafe {
        MoveFileExW(
            source.as_ptr(),
            target.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if result == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
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
    if matches!(kind, ExportKind::Docx) && !contents.starts_with(b"PK\x03\x04") {
        return Err("DOCX export contents do not have a valid ZIP header".to_string());
    }
    Ok(())
}

fn validate_export_filename(filename: &str, kind: &ExportKind) -> CommandResult<()> {
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
        ExportKind::Docx => "docx",
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
