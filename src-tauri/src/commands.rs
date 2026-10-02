//! Tauri command handlers: consent, validation, and locking before delegating to owning modules.

use crate::{ai::*, contract::*, copilot::*, persistence::*, validation::*};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
pub(crate) struct AppState {
    pub(crate) save_lock: Mutex<()>,
    pub(crate) generation_lock: Arc<tokio::sync::Mutex<()>>,
}

#[tauri::command]
pub(crate) fn load_workspace(app: AppHandle) -> CommandResult<Option<Workspace>> {
    let path = workspace_path(&app)?;
    load_workspace_from_path(&path)
}

#[tauri::command]
pub(crate) fn save_workspace(
    app: AppHandle,
    state: State<'_, AppState>,
    workspace: Workspace,
) -> CommandResult<()> {
    let bytes = serialize_valid_workspace(&workspace)?;
    let _guard = state
        .save_lock
        .lock()
        .map_err(|_| "Workspace save lock is unavailable".to_string())?;
    let path = workspace_path(&app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "Workspace path has no parent directory".to_string())?;
    create_restricted_dir(parent)
        .map_err(|error| format!("Unable to prepare workspace directory: {error}"))?;
    write_atomic(&path, &bytes).map_err(|error| format!("Unable to save workspace: {error}"))
}

#[tauri::command]
pub(crate) async fn export_document(
    app: AppHandle,
    filename: String,
    contents: Vec<u8>,
    kind: ExportKind,
) -> CommandResult<bool> {
    validate_export_request(&filename, &contents, &kind)?;
    let dialog_filename = filename.clone();
    let dialog_kind = kind.clone();
    let dialog_app = app.clone();
    let selected = tauri::async_runtime::spawn_blocking(move || {
        let (filter_name, filter_extensions) = match dialog_kind {
            ExportKind::Pdf => ("PDF document", &["pdf"][..]),
            ExportKind::Json => ("JSON document", &["json"][..]),
        };
        dialog_app
            .dialog()
            .file()
            .set_title("Export resume")
            .set_file_name(dialog_filename)
            .add_filter(filter_name, filter_extensions)
            .blocking_save_file()
    })
    .await
    .map_err(|error| format!("Save dialog failed: {error}"))?;

    let Some(selected) = selected else {
        return Ok(false);
    };
    let selected_path = selected
        .into_path()
        .map_err(|error| format!("Invalid selected path: {error}"))?;
    validate_selected_export_path(&selected_path, &kind)?;

    tauri::async_runtime::spawn_blocking(move || {
        write_atomic(&selected_path, &contents)
            .map_err(|error| format!("Unable to export document: {error}"))
    })
    .await
    .map_err(|error| format!("Export worker failed: {error}"))??;
    Ok(true)
}

#[tauri::command]
pub(crate) async fn copilot_status(app: AppHandle) -> CopilotStatus {
    let result = tauri::async_runtime::spawn_blocking(move || probe_copilot(&app)).await;
    match result {
        Ok(status) => status,
        Err(error) => CopilotStatus {
            available: false,
            version: None,
            detail: format!("GitHub Copilot CLI probe failed: {error}"),
        },
    }
}

#[tauri::command]
pub(crate) async fn copilot_login(app: AppHandle) -> CommandResult<()> {
    tauri::async_runtime::spawn_blocking(move || login_to_copilot(&app))
        .await
        .map_err(|error| format!("GitHub Copilot login worker failed: {error}"))?
}

#[tauri::command]
pub(crate) async fn generate_resume(
    app: AppHandle,
    state: State<'_, AppState>,
    resume: Resume,
    consent: bool,
) -> CommandResult<AiProposal> {
    ensure_consent(consent)?;
    validate_resume(&resume)?;
    let generation_lock = state.generation_lock.clone();
    let _guard = generation_lock.lock().await;
    generate_resume_with_copilot(&app, &resume).await
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub(crate) async fn analyze_accomplishment(
    app: AppHandle,
    state: State<'_, AppState>,
    resume_id: String,
    experience_id: String,
    bullet_index: usize,
    role: String,
    bullet: String,
    review: Option<HighlightReview>,
    consent: bool,
) -> CommandResult<AprAnalysis> {
    ensure_consent(consent)?;
    let target = AprTarget {
        resume_id,
        experience_id,
        bullet_index,
        role,
        bullet,
    };
    validate_apr_target(&target)?;
    validate_apr_review(&target, review.as_ref())?;
    let generation_lock = state.generation_lock.clone();
    let _guard = generation_lock.lock().await;
    analyze_accomplishment_with_copilot(&app, &target, review.as_ref()).await
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub(crate) async fn refine_accomplishment(
    app: AppHandle,
    state: State<'_, AppState>,
    resume_id: String,
    experience_id: String,
    bullet_index: usize,
    role: String,
    bullet: String,
    options: Vec<AprOption>,
    feedback: String,
    consent: bool,
) -> CommandResult<AprAnalysis> {
    ensure_consent(consent)?;
    let target = AprTarget {
        resume_id,
        experience_id,
        bullet_index,
        role,
        bullet,
    };
    validate_apr_target(&target)?;
    validate_apr_options(&options)?;
    validate_apr_options_changed(&options, &target.bullet)?;
    validate_nonempty_text("refinement feedback", &feedback, MAX_BULLET_BYTES)?;
    let generation_lock = state.generation_lock.clone();
    let _guard = generation_lock.lock().await;
    refine_accomplishment_with_copilot(&app, &target, &options, &feedback).await
}

#[tauri::command]
pub(crate) async fn review_highlights(
    app: AppHandle,
    state: State<'_, AppState>,
    targets: Vec<AprTarget>,
    consent: bool,
) -> CommandResult<Vec<HighlightReview>> {
    ensure_consent(consent)?;
    validate_highlight_review_targets(&targets)?;
    let generation_lock = state.generation_lock.clone();
    let _guard = generation_lock.lock().await;
    review_highlights_with_copilot(&app, &targets).await
}

#[tauri::command]
pub(crate) async fn draft_highlights(
    app: AppHandle,
    state: State<'_, AppState>,
    resume_id: String,
    experience_id: String,
    role: String,
    notes: String,
    consent: bool,
) -> CommandResult<HighlightDraft> {
    ensure_consent(consent)?;
    let target = HighlightDraftTarget {
        resume_id,
        experience_id,
        role,
        notes,
    };
    validate_highlight_draft_target(&target)?;
    let generation_lock = state.generation_lock.clone();
    let _guard = generation_lock.lock().await;
    draft_highlights_with_copilot(&app, &target).await
}

pub(crate) fn ensure_consent(consent: bool) -> CommandResult<()> {
    if consent {
        Ok(())
    } else {
        Err("Explicit consent is required before contacting GitHub Copilot".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn consent_is_required_before_generation() {
        assert!(ensure_consent(false).is_err());
        assert!(ensure_consent(true).is_ok());
    }
}
