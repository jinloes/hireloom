//! Workspace load/save and atomic, permission-restricted file writes.

use crate::{contract::*, validation::validate_workspace};
use std::{
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};
use tempfile::NamedTempFile;

pub(crate) fn workspace_path(app: &AppHandle) -> CommandResult<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(WORKSPACE_FILE))
        .map_err(|error| format!("Unable to resolve Hireloom app data directory: {error}"))
}

pub(crate) fn load_workspace_from_path(path: &Path) -> CommandResult<Option<Workspace>> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Unable to read workspace: {error}")),
    };
    if bytes.len() > MAX_WORKSPACE_BYTES {
        return Err("Workspace file exceeds the 2 MB limit".to_string());
    }
    let workspace = serde_json::from_slice::<Workspace>(&bytes)
        .map_err(|error| format!("Workspace file is malformed or unsupported: {error}"))?;
    let workspace = migrate_workspace(workspace)?;
    validate_workspace(&workspace)?;
    Ok(Some(workspace))
}

pub(crate) fn migrate_workspace(mut workspace: Workspace) -> CommandResult<Workspace> {
    if workspace.version == 1 {
        for resume in &mut workspace.resumes {
            if resume.target_job.description.is_empty() {
                resume.target_job.description =
                    resume.legacy_job_description.take().unwrap_or_default();
            } else {
                resume.legacy_job_description = None;
            }
            resume.additional_section_order = default_additional_section_order();
        }
        workspace.version = WORKSPACE_VERSION;
    }
    Ok(workspace)
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
pub(crate) fn replace_path(temporary: &Path, destination: &Path) -> io::Result<()> {
    fs::rename(temporary, destination)
}

#[cfg(windows)]
pub(crate) fn replace_path(temporary: &Path, destination: &Path) -> io::Result<()> {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::*;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;

    #[test]
    fn round_trips_workspace_and_rejects_corrupt_data() {
        let directory = test_directory("workspace");
        let path = directory.join(WORKSPACE_FILE);
        assert!(load_workspace_from_path(&path)
            .expect("missing load")
            .is_none());
        let bytes = serialize_valid_workspace(&sample_workspace()).expect("serialize");
        write_atomic(&path, &bytes).expect("write");
        assert_eq!(
            load_workspace_from_path(&path)
                .expect("load")
                .expect("workspace")
                .active_resume_id,
            "resume-1"
        );
        fs::write(&path, b"{not-json").expect("corrupt");
        assert!(load_workspace_from_path(&path).is_err());
        fs::remove_dir_all(directory).expect("cleanup");
    }

    #[test]
    fn migrates_version_one_workspaces_without_losing_job_description() {
        let directory = test_directory("workspace-v1");
        let path = directory.join(WORKSPACE_FILE);
        let mut legacy = serde_json::to_value(sample_workspace()).expect("serialize legacy");
        legacy["version"] = serde_json::json!(1);
        legacy["resumes"][0]["jobDescription"] =
            serde_json::json!("Build reliable distributed systems.");
        legacy["resumes"][0]["basics"]
            .as_object_mut()
            .expect("legacy basics")
            .remove("github");
        for field in [
            "targetJob",
            "projects",
            "certifications",
            "awards",
            "volunteer",
            "publications",
            "languages",
            "additionalSectionOrder",
        ] {
            legacy["resumes"][0]
                .as_object_mut()
                .expect("legacy resume")
                .remove(field);
        }
        fs::write(&path, serde_json::to_vec(&legacy).expect("legacy bytes")).expect("write legacy");
        let workspace = load_workspace_from_path(&path)
            .expect("load legacy")
            .expect("workspace");
        assert_eq!(workspace.version, WORKSPACE_VERSION);
        assert!(workspace.resumes[0].basics.github.is_empty());
        assert_eq!(
            workspace.resumes[0].target_job.description,
            "Build reliable distributed systems."
        );
        assert!(workspace.resumes[0].projects.is_empty());
        assert_eq!(
            workspace.resumes[0].additional_section_order,
            default_additional_section_order()
        );
        validate_workspace(&workspace).expect("validate legacy workspace");
        let serialized = serialize_valid_workspace(&workspace).expect("serialize migrated");
        let serialized: serde_json::Value =
            serde_json::from_slice(&serialized).expect("migrated json");
        assert_eq!(serialized["version"], serde_json::json!(2));
        assert!(serialized["resumes"][0].get("jobDescription").is_none());
        fs::remove_dir_all(directory).expect("cleanup");
    }

    #[test]
    fn atomic_write_replaces_existing_data() {
        let directory = test_directory("atomic");
        let path = directory.join("value.json");
        write_atomic(&path, b"old").expect("first write");
        write_atomic(&path, b"new").expect("second write");
        assert_eq!(fs::read(&path).expect("read"), b"new");
        #[cfg(unix)]
        assert_eq!(
            fs::metadata(&path).expect("metadata").permissions().mode() & 0o777,
            0o600
        );
        fs::remove_dir_all(directory).expect("cleanup");
    }
}
