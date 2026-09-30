//! Locked-down Copilot SDK client/session configuration and the shared no-fallback request runner.

use super::{
    cli::find_copilot,
    profile::{copilot_paths, CopilotPaths},
};
use crate::contract::*;
use github_copilot_sdk::{
    handler::DenyAllHandler,
    session_events::{AssistantMessageData, SessionEventType},
    types::{MessageOptions, SessionConfig, SessionEvent},
    CliProgram, Client, ClientMode, ClientOptions, IndexMap,
};
use std::{collections::HashSet, ffi::OsString, path::PathBuf, sync::Arc};
use tauri::AppHandle;

pub(crate) async fn run_copilot_prompt(
    app: &AppHandle,
    prompt: &str,
    model: &str,
) -> CommandResult<Vec<u8>> {
    if prompt.len() > MAX_PROMPT_BYTES {
        return Err("Copilot request exceeds the 256 KB limit".to_string());
    }
    let executable = find_copilot().ok_or_else(|| {
        "GitHub Copilot CLI was not found on PATH or known macOS locations".to_string()
    })?;
    let paths = copilot_paths(app)?;
    let client = Client::start(copilot_client_options(executable, &paths))
        .await
        .map_err(|error| format!("GitHub Copilot SDK failed to start the CLI: {error}"))?;
    let request_result = run_copilot_session(&client, prompt, model, &paths).await;
    let stop_result = client.stop().await;
    match (request_result, stop_result) {
        (Err(error), _) => Err(error),
        (Ok(_), Err(error)) => Err(format!(
            "GitHub Copilot SDK failed to stop the CLI: {error}"
        )),
        (Ok(response), Ok(())) => Ok(response),
    }
}

pub(crate) async fn run_copilot_session(
    client: &Client,
    prompt: &str,
    model: &str,
    paths: &CopilotPaths,
) -> CommandResult<Vec<u8>> {
    let session = client
        .create_session(copilot_session_config(model, paths))
        .await
        .map_err(|error| format!("GitHub Copilot SDK could not create a session: {error}"))?;
    let request_result = session
        .send_and_wait(MessageOptions::new(prompt).with_wait_timeout(COPILOT_TIMEOUT))
        .await
        .map_err(|error| format!("GitHub Copilot request failed: {error}"))
        .and_then(|event| {
            event
                .as_ref()
                .ok_or_else(|| "Copilot session became idle without a final response".to_string())
                .and_then(extract_copilot_response)
        });
    let disconnect_result = session.disconnect().await;
    match (request_result, disconnect_result) {
        (Err(error), _) => Err(error),
        (Ok(_), Err(error)) => Err(format!("GitHub Copilot session cleanup failed: {error}")),
        (Ok(response), Ok(())) => Ok(response),
    }
}

pub(crate) fn extract_copilot_response(event: &SessionEvent) -> CommandResult<Vec<u8>> {
    if event.parsed_type() != SessionEventType::AssistantMessage {
        return Err(format!(
            "Copilot session did not return a final assistant message (received {})",
            event.event_type
        ));
    }
    let message = event
        .typed_data::<AssistantMessageData>()
        .ok_or_else(|| "Copilot final response event is malformed".to_string())?;
    if !matches!(message.phase.as_deref(), Some("final_answer") | None) {
        return Err(format!(
            "Copilot session did not return a final response (phase: {})",
            message.phase.as_deref().unwrap_or("none")
        ));
    }
    if message
        .tool_requests
        .as_ref()
        .is_some_and(|requests| !requests.is_empty())
    {
        return Err("Copilot final response requested unavailable tools".to_string());
    }
    if message.content.trim().is_empty() {
        return Err("Copilot final response did not contain text content".to_string());
    }
    if message.content.len() > MAX_GENERATION_OUTPUT_BYTES {
        return Err("Copilot response exceeds the 128 KB limit".to_string());
    }
    Ok(message.content.into_bytes())
}

pub(crate) fn copilot_client_options(executable: PathBuf, paths: &CopilotPaths) -> ClientOptions {
    let (environment, environment_removals) = copilot_sdk_environment(paths);
    ClientOptions::new()
        .with_program(CliProgram::Path(executable))
        .with_mode(ClientMode::Empty)
        .with_base_directory(&paths.home)
        .with_cwd(&paths.work)
        .with_env(environment)
        .with_env_remove(environment_removals)
        .with_use_logged_in_user(true)
        .with_enable_remote_sessions(false)
}

pub(crate) fn copilot_sdk_environment(
    paths: &CopilotPaths,
) -> (Vec<(OsString, OsString)>, Vec<OsString>) {
    const INHERITED_NAMES: [&str; 17] = [
        "PATH",
        "LANG",
        "LC_ALL",
        "NO_PROXY",
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "GH_TOKEN",
        "GITHUB_TOKEN",
        "GITHUB_ENTERPRISE_TOKEN",
        "GH_HOST",
        "SystemRoot",
        "ComSpec",
        "WINDIR",
        "APPDATA",
        "LOCALAPPDATA",
        "SSL_CERT_FILE",
    ];
    let mut environment = INHERITED_NAMES
        .iter()
        .filter_map(|name| std::env::var_os(name).map(|value| (OsString::from(name), value)))
        .collect::<Vec<_>>();
    environment.extend([
        (
            OsString::from("HOME"),
            paths.system_home.as_os_str().to_owned(),
        ),
        (
            OsString::from("USERPROFILE"),
            paths.system_home.as_os_str().to_owned(),
        ),
        (
            OsString::from("COPILOT_HOME"),
            paths.home.as_os_str().to_owned(),
        ),
        (
            OsString::from("GH_CONFIG_DIR"),
            paths.home.join("github").into_os_string(),
        ),
        (
            OsString::from("XDG_CONFIG_HOME"),
            paths.home.as_os_str().to_owned(),
        ),
        (
            OsString::from("XDG_CACHE_HOME"),
            paths.home.join("cache").into_os_string(),
        ),
        (
            OsString::from("TMPDIR"),
            paths.home.join("tmp").into_os_string(),
        ),
        (
            OsString::from("TMP"),
            paths.home.join("tmp").into_os_string(),
        ),
        (
            OsString::from("TEMP"),
            paths.home.join("tmp").into_os_string(),
        ),
        (OsString::from("NO_COLOR"), OsString::from("1")),
    ]);
    let permitted_names = environment
        .iter()
        .map(|(name, _)| name.clone())
        .collect::<HashSet<_>>();
    let removals = std::env::vars_os()
        .map(|(name, _)| name)
        .filter(|name| name != "COPILOT_CONNECTION_TOKEN" && !permitted_names.contains(name))
        .collect();
    (environment, removals)
}

pub(crate) fn copilot_session_config(model: &str, paths: &CopilotPaths) -> SessionConfig {
    SessionConfig::default()
        .with_model(model)
        .with_streaming(false)
        .with_available_tools(Vec::<String>::new())
        .with_permission_handler(Arc::new(DenyAllHandler))
        .with_mcp_servers(IndexMap::new())
        .with_enable_config_discovery(false)
        .with_enable_on_demand_instruction_discovery(false)
        .with_enable_file_hooks(false)
        .with_enable_host_git_operations(false)
        .with_enable_session_store(false)
        .with_enable_skills(false)
        .with_enable_mcp_apps(false)
        .with_skill_directories(Vec::<PathBuf>::new())
        .with_instruction_directories(Vec::<PathBuf>::new())
        .with_plugin_directories(Vec::<PathBuf>::new())
        .with_custom_agents(Vec::new())
        .with_enable_session_telemetry(false)
        .with_enable_citations(false)
        .with_enable_file_change_tracking(false)
        .with_enable_managed_settings(false)
        .with_config_directory(&paths.home)
        .with_working_directory(&paths.work)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::parse_apr_response;
    use serde_json::json;

    #[test]
    fn copilot_sdk_configuration_is_isolated_and_tool_free() {
        let paths = CopilotPaths {
            system_home: PathBuf::from("/system-home"),
            home: PathBuf::from("/copilot-home"),
            work: PathBuf::from("/copilot-home/work"),
        };
        let executable = PathBuf::from("/usr/local/bin/copilot");
        let options = copilot_client_options(executable.clone(), &paths);
        assert!(matches!(
            options.program,
            CliProgram::Path(ref path) if path == &executable
        ));
        assert_eq!(options.mode, ClientMode::Empty);
        assert_eq!(options.base_directory.as_ref(), Some(&paths.home));
        assert_eq!(options.working_directory, paths.work);
        assert!(!options.enable_remote_sessions);
        assert!(options
            .env
            .iter()
            .any(|(name, value)| { name == "COPILOT_HOME" && value == paths.home.as_os_str() }));
        assert!(options
            .env
            .iter()
            .any(|(name, value)| { name == "HOME" && value == paths.system_home.as_os_str() }));
        assert!(options
            .env_remove
            .iter()
            .all(|removed| options.env.iter().all(|(kept, _)| kept != removed)));

        for (model, excluded) in [
            (GENERATE_RESUME_MODEL, INLINE_APR_MODEL),
            (INLINE_APR_MODEL, GENERATE_RESUME_MODEL),
        ] {
            let config = copilot_session_config(model, &paths);
            assert_eq!(config.model.as_deref(), Some(model));
            assert_ne!(config.model.as_deref(), Some(excluded));
            assert_eq!(config.streaming, Some(false));
            assert_eq!(config.available_tools, Some(Vec::new()));
            assert!(config.permission_handler.is_some());
            assert!(config.mcp_servers.as_ref().is_some_and(IndexMap::is_empty));
            assert_eq!(config.enable_config_discovery, Some(false));
            assert_eq!(config.enable_on_demand_instruction_discovery, Some(false));
            assert_eq!(config.enable_file_hooks, Some(false));
            assert_eq!(config.enable_host_git_operations, Some(false));
            assert_eq!(config.enable_session_store, Some(false));
            assert_eq!(config.enable_skills, Some(false));
            assert_eq!(config.enable_mcp_apps, Some(false));
            assert_eq!(config.enable_session_telemetry, Some(false));
            assert_eq!(config.enable_file_change_tracking, Some(false));
            assert_eq!(config.config_directory.as_ref(), Some(&paths.home));
            assert_eq!(config.working_directory.as_ref(), Some(&paths.work));
        }
    }

    fn assistant_event(data: serde_json::Value) -> SessionEvent {
        SessionEvent {
            id: "event-1".to_string(),
            timestamp: "2026-01-01T00:00:00Z".to_string(),
            parent_id: None,
            ephemeral: None,
            agent_id: None,
            debug_cli_received_at_ms: None,
            debug_ws_forwarded_at_ms: None,
            event_type: "assistant.message".to_string(),
            data,
        }
    }

    #[test]
    fn copilot_sdk_preserves_escaped_response_content() {
        let content = r#"{"action":{"status":"partial","feedback":"\"Assisted\" needs a stronger verb."},"project":{"status":"clear","feedback":"The project is specific."},"result":{"status":"missing","feedback":"No supported outcome is stated."},"options":[{"id":"detail-forward","bullets":["Built a useful system."]}]}"#;
        let event = assistant_event(json!({
            "messageId": "message-1",
            "phase": "final_answer",
            "content": content,
        }));
        let extracted = extract_copilot_response(&event).expect("extract response");
        assert_eq!(extracted, content.as_bytes());
        parse_apr_response(&extracted).expect("parse preserved APR response");
    }

    #[test]
    fn copilot_sdk_accepts_unphased_non_tool_message() {
        let final_content = r#"{"options":[]}"#;
        let event = assistant_event(json!({
            "messageId": "message-1",
            "content": final_content,
            "toolRequests": [],
        }));
        assert_eq!(
            extract_copilot_response(&event).expect("extract final response"),
            final_content.as_bytes()
        );
    }

    #[test]
    fn copilot_sdk_enforces_final_response_limit() {
        let event = assistant_event(json!({
            "messageId": "message-1",
            "phase": "final_answer",
            "content": "x".repeat(MAX_GENERATION_OUTPUT_BYTES + 1),
        }));
        assert_eq!(
            extract_copilot_response(&event),
            Err("Copilot response exceeds the 128 KB limit".to_string())
        );
    }

    #[test]
    fn copilot_sdk_rejects_malformed_nonfinal_and_tool_output() {
        let malformed = assistant_event(json!({
            "messageId": "message-1",
            "phase": "final_answer",
            "content": 42,
        }));
        assert!(extract_copilot_response(&malformed).is_err());

        let commentary = assistant_event(json!({
            "messageId": "message-1",
            "phase": "commentary",
            "content": "not final",
        }));
        assert_eq!(
            extract_copilot_response(&commentary),
            Err("Copilot session did not return a final response (phase: commentary)".to_string())
        );

        let tools = assistant_event(json!({
            "messageId": "message-1",
            "phase": "final_answer",
            "content": "not allowed",
            "toolRequests": [{"toolCallId": "tool-1", "name": "shell"}],
        }));
        assert_eq!(
            extract_copilot_response(&tools),
            Err("Copilot final response requested unavailable tools".to_string())
        );

        let mut wrong_type = assistant_event(json!({}));
        wrong_type.event_type = "session.idle".to_string();
        assert!(extract_copilot_response(&wrong_type).is_err());
    }
}
