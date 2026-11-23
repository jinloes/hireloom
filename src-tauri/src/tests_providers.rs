use super::*;
#[cfg(unix)]
use crate::tests_workspace::test_directory;
use serde_json::json;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::{
    collections::HashSet,
    io::{Read, Write},
    thread,
    time::Duration,
};
#[cfg(unix)]
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

#[cfg(unix)]
fn fake_executable(directory: &Path, name: &str, body: &str) -> PathBuf {
    let path = directory.join(name);
    fs::write(&path, format!("#!/bin/sh\n{body}\n")).expect("write fake executable");
    let mut permissions = fs::metadata(&path).expect("fake metadata").permissions();
    permissions.set_mode(0o700);
    fs::set_permissions(&path, permissions).expect("fake permissions");
    path
}

#[test]
fn copilot_generation_args_pin_sonnet_model_and_task_reasoning_effort() {
    assert_eq!(COPILOT_MODEL, "claude-sonnet-5.5");
    let apr_args = copilot_generation_args(COPILOT_MODEL, ReasoningEffort::Medium);
    assert!(apr_args
        .windows(2)
        .any(|w| w == ["--model", "claude-sonnet-5.5"]));
    assert!(apr_args
        .windows(2)
        .any(|w| w == ["--reasoning-effort", "medium"]));
    assert!(apr_args.contains(&"--available-tools"));
    assert!(!apr_args.contains(&"--allow-all"));

    let refine_args = copilot_generation_args("gpt-6.1-terra", ReasoningEffort::Low);
    assert!(refine_args
        .windows(2)
        .any(|w| w == ["--model", "gpt-6.1-terra"]));
    assert!(refine_args
        .windows(2)
        .any(|w| w == ["--reasoning-effort", "low"]));
}

#[cfg(unix)]
#[test]
fn fake_copilot_process_receives_safe_flags_and_stdin() {
    let directory = test_directory("copilot-args");
    let args_path = directory.join("args");
    let stdin_path = directory.join("stdin");
    let script = format!(
        "printf '%s\\n' \"$@\" > '{}'; cat > '{}'; printf '%s' '{{\"summary\":\"\",\"experience\":[{{\"id\":\"experience-1\",\"bullets\":[]}}],\"notes\":[]}}'",
        args_path.display(),
        stdin_path.display()
    );
    let executable = fake_executable(&directory, "fake-copilot", &script);
    let mut command = Command::new(executable);
    command.args(copilot_generation_args(
        COPILOT_MODEL,
        ReasoningEffort::Medium,
    ));
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let output = run_process(
        command,
        Some(b"PRIVATE NAME\njob data"),
        Duration::from_secs(2),
        4096,
    )
    .expect("run fake copilot");
    assert!(output.status.success());
    let args = fs::read_to_string(args_path).expect("args");
    assert!(args.contains("--available-tools"));
    assert!(!args.contains("--deny-tool"));
    assert!(args.contains("--output-format"));
    assert!(args.contains("json"));
    assert!(args.contains("--model"));
    assert!(args.contains(COPILOT_MODEL));
    assert!(args.contains("--reasoning-effort"));
    assert!(args.contains("medium"));
    assert!(!args.contains("--allow-all"));
    assert_eq!(
        fs::read_to_string(stdin_path).expect("stdin"),
        "PRIVATE NAME\njob data"
    );
    fs::remove_dir_all(directory).expect("cleanup");
}

#[test]
fn copilot_json_event_transport_preserves_escaped_response_content() {
    let content = r#"{"action":{"status":"partial","feedback":"\"Assisted\" needs a stronger verb."},"project":{"status":"clear","feedback":"The project is specific."},"result":{"status":"missing","feedback":"No supported outcome is stated."},"questions":["What changed?"]}"#;
    let output = format!(
        "{}\n{}\n",
        json!({"type": "session.start", "data": {}}),
        json!({
            "type": "assistant.message",
            "data": {
                "phase": "final_answer",
                "content": content,
            }
        })
    );
    let extracted = extract_copilot_final_response(output.as_bytes()).expect("extract response");
    assert_eq!(extracted, content.as_bytes());
    parse_apr_response(&extracted).expect("parse preserved APR response");
}

#[test]
fn copilot_json_event_transport_rejects_missing_or_malformed_final_output() {
    let missing = json!({"type": "session.shutdown", "data": {}}).to_string();
    assert!(extract_copilot_final_response(missing.as_bytes()).is_err());
    assert!(extract_copilot_final_response(b"not json").is_err());
    let non_text = json!({
        "type": "assistant.message",
        "data": {
            "phase": "final_answer",
            "content": 42,
        }
    })
    .to_string();
    assert!(extract_copilot_final_response(non_text.as_bytes()).is_err());
}

#[cfg(unix)]
#[test]
fn copilot_command_preserves_keychain_home_and_isolates_configuration() {
    let directory = test_directory("copilot-environment");
    let system_home = directory.join("system-home");
    let home = directory.join("copilot");
    let work = home.join("work");
    let github_config = home.join("github");
    for path in [&system_home, &home, &work, &github_config] {
        fs::create_dir_all(path).expect("create environment directory");
    }
    let environment_path = directory.join("environment");
    let script = format!(
        "printf '%s\\n%s\\n%s\\n%s\\n%s' \"$HOME\" \"$COPILOT_HOME\" \"$GH_CONFIG_DIR\" \"$XDG_CONFIG_HOME\" \"$PWD\" > '{}'",
        environment_path.display()
    );
    let executable = fake_executable(&directory, "fake-copilot", &script);
    let paths = CopilotPaths {
        system_home: system_home.clone(),
        home: home.clone(),
        work: work.clone(),
    };
    let mut command = Command::new(executable);
    configure_copilot_command(&mut command, &paths).expect("configure command");
    let output =
        run_process(command, None, Duration::from_secs(2), 4096).expect("run fake copilot");
    assert!(output.status.success());
    let environment = fs::read_to_string(environment_path).expect("read environment");
    assert_eq!(
        environment.lines().collect::<Vec<_>>(),
        vec![
            system_home.to_string_lossy(),
            home.to_string_lossy(),
            github_config.to_string_lossy(),
            home.to_string_lossy(),
            work.to_string_lossy(),
        ]
    );
    fs::remove_dir_all(directory).expect("cleanup");
}

#[cfg(unix)]
#[test]
fn fake_copilot_nonzero_and_timeout_are_reported() {
    let directory = test_directory("copilot-errors");
    let failing = fake_executable(&directory, "failing", "printf 'bad news' >&2; exit 7");
    let mut command = Command::new(failing);
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let output = run_process(command, None, Duration::from_secs(2), 4096).expect("run failing");
    assert!(!output.status.success());
    assert!(summarize_process_error(&output).contains("bad news"));

    let slow = fake_executable(&directory, "slow", "exec sleep 2");
    let mut command = Command::new(slow);
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let output = run_process(command, None, Duration::from_millis(100), 4096).expect("run slow");
    assert!(output.timed_out);
    fs::remove_dir_all(directory).expect("cleanup");
}

#[cfg(unix)]
#[test]
fn fake_copilot_malformed_response_is_rejected() {
    let directory = test_directory("copilot-malformed");
    let malformed = fake_executable(&directory, "malformed", "printf 'not json'");
    let mut command = Command::new(malformed);
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let output =
        run_process(command, None, Duration::from_secs(2), 4096).expect("run malformed copilot");
    assert!(parse_ai_proposal(&output.stdout, ["experience-1"]).is_err());
    fs::remove_dir_all(directory).expect("cleanup");
}

fn spawn_single_response_http_server(body: &str) -> (String, thread::JoinHandle<String>) {
    use std::net::TcpListener;
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind mock server");
    let addr = listener.local_addr().expect("mock addr");
    let response_body = body.to_string();
    let handle = thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("accept request");
        stream
            .set_read_timeout(Some(Duration::from_secs(3)))
            .expect("set timeout");
        let mut request_buf = [0_u8; 8192];
        let read_len = stream.read(&mut request_buf).unwrap_or(0);
        let request_text = String::from_utf8_lossy(&request_buf[..read_len]).to_string();
        let http_response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            response_body.len(),
            response_body
        );
        let _ = stream.write_all(http_response.as_bytes());
        request_text
    });
    (format!("http://127.0.0.1:{}", addr.port()), handle)
}

#[test]
fn multi_provider_http_transports_and_url_security_work_locally() {
    assert!(providers::validate_compatible_base_url("http://127.0.0.1:11434/v1").is_ok());
    assert!(providers::validate_compatible_base_url("https://api.example.com/v1").is_ok());
    assert!(providers::validate_compatible_base_url("http://insecure.example.com/v1").is_err());
    assert!(providers::validate_compatible_base_url("******example.com/v1").is_err());
    assert!(validate_model_id(ProviderKind::Copilot, "--allow-all").is_err());
    assert!(validate_model_id(ProviderKind::Gemini, "../../evil").is_err());

    let (openai_url, openai_req) = spawn_single_response_http_server(
        r#"{"choices":[{"message":{"content":"{\"options\":[{\"label\":\"Concise\",\"summary\":\"Focused platform engineer.\"}]}"}}]}"#,
    );
    let endpoints = HttpEndpoints {
        openai_base: openai_url,
        ..HttpEndpoints::default()
    };
    let openai_out = run_http_provider_prompt(
        ProviderKind::Openai,
        "gpt-4.1",
        "prompt",
        Some("sk-test-secret"),
        "http://127.0.0.1:11434/v1",
        &endpoints,
        Duration::from_secs(3),
        MAX_GENERATION_OUTPUT_BYTES,
    )
    .expect("openai mock call");
    let summary_opts = parse_summary_options_response(&openai_out).expect("parse options");
    assert_eq!(summary_opts.options[0].label, "Concise");
    let captured_openai = openai_req.join().expect("join openai server");
    assert!(captured_openai
        .to_ascii_lowercase()
        .contains("authorization: bearer sk-test-secret"));

    let (anthropic_url, anthropic_req) = spawn_single_response_http_server(
        r#"{"content":[{"type":"text","text":"{\"entryId\":\"experience-1\",\"bullets\":[\"Improved reliability.\"],\"notes\":[]}"}]}"#,
    );
    let endpoints = HttpEndpoints {
        anthropic_base: anthropic_url,
        ..HttpEndpoints::default()
    };
    let anthropic_out = run_http_provider_prompt(
        ProviderKind::Anthropic,
        "claude-sonnet-4-6",
        "prompt",
        Some("ant-test-key"),
        "http://127.0.0.1:11434/v1",
        &endpoints,
        Duration::from_secs(3),
        MAX_GENERATION_OUTPUT_BYTES,
    )
    .expect("anthropic mock call");
    let role_tailor =
        parse_role_tailor_response(&anthropic_out, "experience-1").expect("parse role tailor");
    assert_eq!(role_tailor.bullets, vec!["Improved reliability."]);
    let captured_ant = anthropic_req.join().expect("join anthropic server");
    assert!(captured_ant
        .to_ascii_lowercase()
        .contains("x-api-key: ant-test-key"));

    let (gemini_url, gemini_req) = spawn_single_response_http_server(
        r#"{"candidates":[{"content":{"parts":[{"text":"{\"items\":[{\"key\":\"rewrite\",\"status\":\"supported\",\"note\":\"Directly supported by source bullet.\"}]}"}]}}]}"#,
    );
    let endpoints = HttpEndpoints {
        gemini_base: gemini_url,
        ..HttpEndpoints::default()
    };
    let gemini_out = run_http_provider_prompt(
        ProviderKind::Gemini,
        "gemini-2.5-pro",
        "grounding prompt",
        Some("gem-secret-key"),
        "http://127.0.0.1:11434/v1",
        &endpoints,
        Duration::from_secs(3),
        MAX_GENERATION_OUTPUT_BYTES,
    )
    .expect("gemini mock call");
    let mut expected_keys = HashSet::new();
    expected_keys.insert("rewrite");
    let grounding = parse_grounding_response(&gemini_out, &expected_keys).expect("parse grounding");
    assert_eq!(grounding[0].status, GroundingStatus::Supported);
    let captured_gem = gemini_req.join().expect("join gemini server");
    let first_line = captured_gem.lines().next().unwrap_or("");
    assert!(!first_line.contains("gem-secret-key"));
    assert!(captured_gem
        .to_ascii_lowercase()
        .contains("x-goog-api-key: gem-secret-key"));
}

#[test]
fn import_cleanup_rejects_unredacted_emails_and_parses_structured_output() {
    assert!(
        validate_redacted_import_lines(&["contact me at person@example.com".to_string()]).is_err()
    );
    validate_redacted_import_lines(&[
        "Alex Morgan".to_string(),
        "[REDACTED_EMAIL] · Remote".to_string(),
    ])
    .expect("redacted lines accepted");

    let valid_import = br#"{"headline":"Staff Designer","summary":"Designs accessible systems.","experience":[{"role":"Designer","company":"Acme","location":"Remote","startDate":"2022-01","endDate":"Present","bullets":["Shipped tokens."]}],"projects":[],"education":[],"certifications":[],"skills":["Figma"],"skillGroups":[]}"#;
    let parsed = parse_imported_structure_response(valid_import).expect("parse import cleanup");
    assert_eq!(parsed.headline, "Staff Designer");
    assert_eq!(parsed.experience.len(), 1);
}

#[test]
fn cancellation_aborts_stalled_http_and_cli_requests_immediately() {
    use std::net::TcpListener;
    use std::time::Instant;

    let listener = TcpListener::bind("127.0.0.1:0").expect("bind stalled server");
    let addr = listener.local_addr().expect("stalled addr");
    let stalled_server = thread::spawn(move || {
        let (_stream, _) = listener.accept().expect("accept stalled client");
        thread::sleep(Duration::from_millis(600));
    });

    let cancel = AiCancelFlag::new();
    let cancel_trigger = cancel.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(60));
        cancel_trigger.cancel();
    });

    let started = Instant::now();
    let endpoints = HttpEndpoints {
        openai_base: format!("http://127.0.0.1:{}", addr.port()),
        ..HttpEndpoints::default()
    };
    let result = run_http_provider_prompt_cancellable(
        ProviderKind::Openai,
        "gpt-4.1",
        "prompt",
        Some("sk-test"),
        "http://127.0.0.1:11434/v1",
        &endpoints,
        Duration::from_secs(5),
        MAX_GENERATION_OUTPUT_BYTES,
        Some(&cancel),
    );
    assert_eq!(result, Err(AI_CANCELLED_MESSAGE.to_string()));
    assert!(started.elapsed() < Duration::from_millis(500));
    let _ = stalled_server.join();

    let proc_cancel = AiCancelFlag::new();
    let proc_trigger = proc_cancel.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(60));
        proc_trigger.cancel();
    });
    let slow_cmd = if cfg!(windows) {
        let mut cmd = std::process::Command::new("powershell");
        cmd.args(["-NoProfile", "-Command", "Start-Sleep -Seconds 5"]);
        cmd
    } else {
        let mut cmd = std::process::Command::new("sleep");
        cmd.arg("5");
        cmd
    };
    let proc_started = Instant::now();
    let output = run_process_cancellable(
        slow_cmd,
        None,
        Duration::from_secs(10),
        4096,
        Some(&proc_cancel),
    )
    .expect("run cancellable process");
    assert!(output.cancelled);
    assert!(!output.timed_out);
    assert!(proc_started.elapsed() < Duration::from_secs(2));
}
