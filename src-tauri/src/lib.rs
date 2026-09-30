//! Hireloom native backend. `CODE_MAP.md` lists what each module owns.

mod ai;
mod commands;
mod contract;
mod copilot;
mod persistence;
mod process;
#[cfg(test)]
mod test_support;
mod validation;

pub use contract::{
    Accent, AiProposal, AprAnalysis, AprDimension, AprOption, AprOptionId, AprStatus, AprTarget,
    Basics, CopilotStatus, Education, Experience, ExportKind, HighlightReview, ProposalExperience,
    Resume, Template, Workspace,
};

use commands::*;
use tauri::{Manager, RunEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            load_workspace,
            save_workspace,
            export_document,
            copilot_status,
            copilot_login,
            generate_resume,
            analyze_accomplishment,
            refine_accomplishment,
            review_highlights
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
