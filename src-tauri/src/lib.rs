mod apr_responses;
mod contract;
mod copilot;
mod prompts;
mod provider_http;
mod providers;
mod responses;
mod storage;
mod validation;
mod workflows;

pub use contract::*;

use apr_responses::*;
use copilot::*;
use prompts::*;
use providers::{
    provider_credential_statuses, validate_ai_settings, AiSettings, CredentialStore,
    OsKeyringStore, ProviderKind,
};
#[cfg(test)]
use providers::{run_http_provider_prompt, validate_model_id, HttpEndpoints};
use responses::*;
use std::sync::{Arc, Mutex};
use storage::*;
use tauri::{AppHandle, Manager, RunEvent, State};
use tauri_plugin_dialog::DialogExt;
use validation::*;
use workflows::*;

#[derive(Default)]
struct AppState {
    save_lock: Mutex<()>,
    generation_lock: Arc<tokio::sync::Mutex<()>>,
}

#[tauri::command]
fn load_workspace(app: AppHandle) -> CommandResult<Option<Workspace>> {
    let path = workspace_path(&app)?;
    load_workspace_from_path(&path)
}

#[tauri::command]
fn save_workspace(
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
async fn export_document(
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
            ExportKind::Docx => ("Word document", &["docx"][..]),
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
async fn ai_provider_status(app: AppHandle) -> CommandResult<AiProviderStatusResponse> {
    tauri::async_runtime::spawn_blocking(move || {
        let settings = load_ai_settings_for_app(&app)?;
        let copilot = probe_copilot(&app);
        let providers = provider_credential_statuses(&OsKeyringStore, copilot.available);
        Ok(AiProviderStatusResponse {
            settings,
            copilot,
            providers,
        })
    })
    .await
    .map_err(|error| format!("AI provider status worker failed: {error}"))?
}

#[tauri::command]
fn save_ai_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: AiSettings,
) -> CommandResult<AiSettings> {
    validate_ai_settings(&settings)?;
    let bytes = serde_json::to_vec_pretty(&settings)
        .map_err(|error| format!("Unable to serialize AI settings: {error}"))?;
    let _guard = state
        .save_lock
        .lock()
        .map_err(|_| "Settings save lock is unavailable".to_string())?;
    let path = ai_settings_path(&app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "AI settings path has no parent directory".to_string())?;
    create_restricted_dir(parent)
        .map_err(|error| format!("Unable to prepare app data directory: {error}"))?;
    write_atomic(&path, &bytes).map_err(|error| format!("Unable to save AI settings: {error}"))?;
    Ok(settings)
}

#[tauri::command]
async fn set_provider_api_key(provider: ProviderKind, api_key: String) -> CommandResult<()> {
    tauri::async_runtime::spawn_blocking(move || OsKeyringStore.set_key(provider, &api_key))
        .await
        .map_err(|error| format!("Credential worker failed: {error}"))?
}

#[tauri::command]
async fn clear_provider_api_key(provider: ProviderKind) -> CommandResult<()> {
    tauri::async_runtime::spawn_blocking(move || OsKeyringStore.clear_key(provider))
        .await
        .map_err(|error| format!("Credential worker failed: {error}"))?
}

#[tauri::command]
async fn copilot_status(app: AppHandle) -> CopilotStatus {
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
async fn copilot_login(app: AppHandle) -> CommandResult<()> {
    tauri::async_runtime::spawn_blocking(move || login_to_copilot(&app))
        .await
        .map_err(|error| format!("GitHub Copilot login worker failed: {error}"))?
}

#[tauri::command]
async fn generate_resume(
    app: AppHandle,
    state: State<'_, AppState>,
    resume: Resume,
    consent: bool,
) -> CommandResult<AiProposal> {
    ensure_consent(consent)?;
    validate_resume(&resume)?;
    let generation_lock = state.generation_lock.clone();
    let _guard = generation_lock.lock().await;
    tauri::async_runtime::spawn_blocking(move || generate_resume_with_provider(&app, &resume))
        .await
        .map_err(|error| format!("Resume generation worker failed: {error}"))?
}

#[tauri::command]
async fn generate_summary_options(
    app: AppHandle,
    state: State<'_, AppState>,
    resume: Resume,
    consent: bool,
) -> CommandResult<SummaryOptionsProposal> {
    ensure_consent(consent)?;
    validate_resume(&resume)?;
    let generation_lock = state.generation_lock.clone();
    let _guard = generation_lock.lock().await;
    tauri::async_runtime::spawn_blocking(move || {
        generate_summary_options_with_provider(&app, &resume)
    })
    .await
    .map_err(|error| format!("Summary options worker failed: {error}"))?
}

#[tauri::command]
async fn tailor_experience_role(
    app: AppHandle,
    state: State<'_, AppState>,
    resume: Resume,
    entry_id: String,
    consent: bool,
) -> CommandResult<RoleTailorProposal> {
    ensure_consent(consent)?;
    validate_resume(&resume)?;
    validate_nonempty_text("entryId", &entry_id, MAX_ID_BYTES)?;
    let generation_lock = state.generation_lock.clone();
    let _guard = generation_lock.lock().await;
    tauri::async_runtime::spawn_blocking(move || {
        tailor_experience_role_with_provider(&app, &resume, &entry_id)
    })
    .await
    .map_err(|error| format!("Role tailoring worker failed: {error}"))?
}

#[tauri::command]
async fn structure_imported_resume(
    app: AppHandle,
    state: State<'_, AppState>,
    redacted_lines: Vec<String>,
    consent: bool,
) -> CommandResult<ImportedStructureProposal> {
    ensure_consent(consent)?;
    validate_redacted_import_lines(&redacted_lines)?;
    let generation_lock = state.generation_lock.clone();
    let _guard = generation_lock.lock().await;
    tauri::async_runtime::spawn_blocking(move || {
        structure_imported_resume_with_provider(&app, &redacted_lines)
    })
    .await
    .map_err(|error| format!("Import cleanup worker failed: {error}"))?
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
async fn analyze_accomplishment(
    app: AppHandle,
    state: State<'_, AppState>,
    resume_id: String,
    experience_id: String,
    bullet_index: usize,
    role: String,
    bullet: String,
    focus_keyword: Option<String>,
    consent: bool,
) -> CommandResult<AprAnalysis> {
    ensure_consent(consent)?;
    let target = AprTarget {
        resume_id,
        experience_id,
        bullet_index,
        role,
        bullet,
        focus_keyword,
    };
    validate_apr_target(&target)?;
    let generation_lock = state.generation_lock.clone();
    let _guard = generation_lock.lock().await;
    tauri::async_runtime::spawn_blocking(move || {
        analyze_accomplishment_with_provider(&app, &target)
    })
    .await
    .map_err(|error| format!("Accomplishment analysis worker failed: {error}"))?
}

#[tauri::command]
async fn refine_accomplishment(
    app: AppHandle,
    state: State<'_, AppState>,
    target: AprTarget,
    questions: Vec<String>,
    answers: Vec<AprQuestionAnswer>,
    consent: bool,
) -> CommandResult<AprRefinement> {
    ensure_consent(consent)?;
    validate_apr_target(&target)?;
    validate_apr_question_answers(&questions, &answers)?;
    let generation_lock = state.generation_lock.clone();
    let _guard = generation_lock.lock().await;
    tauri::async_runtime::spawn_blocking(move || {
        refine_accomplishment_with_provider(&app, &target, &questions, &answers)
    })
    .await
    .map_err(|error| format!("Accomplishment refinement worker failed: {error}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            load_workspace,
            save_workspace,
            export_document,
            ai_provider_status,
            save_ai_settings,
            set_provider_api_key,
            clear_provider_api_key,
            copilot_status,
            copilot_login,
            generate_resume,
            generate_summary_options,
            tailor_experience_role,
            structure_imported_resume,
            analyze_accomplishment,
            refine_accomplishment
        ])
        .build(tauri::generate_context!())
        .expect("error while building Hireloom");
    app.run(|app_handle, event| {
        if let RunEvent::ExitRequested { api, .. } = event {
            if let Some(window) = app_handle.get_webview_window("main") {
                // Route Cmd+Q and native menu exits through the same renderer
                // close handler used by the window close button.
                api.prevent_exit();
                if let Err(error) = window.close() {
                    eprintln!("Unable to route exit through close protection: {error}");
                }
            }
        }
    });
}

#[cfg(test)]
mod tests_ai;
#[cfg(test)]
mod tests_providers;
#[cfg(test)]
mod tests_workspace;
