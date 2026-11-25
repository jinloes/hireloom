use crate::{
    contract::*,
    providers::{validate_model_id, ProviderKind},
    storage::{create_restricted_dir, write_atomic},
};
use serde_json::json;
use std::{
    collections::HashSet,
    fs,
    io::{self, BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Command, ExitStatus, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};

pub(crate) fn find_copilot() -> Option<PathBuf> {
    let executable = if cfg!(windows) {
        "copilot.exe"
    } else {
        "copilot"
    };
    if let Some(path) = std::env::var_os("PATH") {
        for directory in std::env::split_paths(&path) {
            let candidate = directory.join(executable);
            if is_executable(&candidate) {
                return Some(candidate);
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        find_known_macos_copilot()
    }
    #[cfg(not(target_os = "macos"))]
    {
        None
    }
}

#[cfg(target_os = "macos")]
fn find_known_macos_copilot() -> Option<PathBuf> {
    [
        PathBuf::from("/opt/homebrew/bin/copilot"),
        PathBuf::from("/usr/local/bin/copilot"),
        PathBuf::from("/usr/bin/copilot"),
    ]
    .into_iter()
    .find(|candidate| is_executable(candidate))
}

fn is_executable(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::metadata(path)
            .map(|metadata| metadata.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
    }
    #[cfg(not(unix))]
    {
        true
    }
}

pub(crate) fn probe_copilot(app: &AppHandle) -> CopilotStatus {
    let Some(executable) = find_copilot() else {
        return CopilotStatus {
            available: false,
            version: None,
            detail:
                "GitHub Copilot CLI was not found on PATH or the known macOS install locations."
                    .to_string(),
        };
    };
    let paths = match copilot_paths(app) {
        Ok(paths) => paths,
        Err(error) => {
            return CopilotStatus {
                available: false,
                version: None,
                detail: error,
            }
        }
    };
    let mut command = Command::new(&executable);
    command.arg("--version");
    if let Err(error) = configure_copilot_command(&mut command, &paths) {
        return CopilotStatus {
            available: false,
            version: None,
            detail: error,
        };
    }
    let output = match run_process(command, None, COPILOT_VERSION_TIMEOUT, 16 * 1024) {
        Ok(output) => output,
        Err(error) => {
            return CopilotStatus {
                available: false,
                version: None,
                detail: format!("GitHub Copilot CLI version probe failed: {error}"),
            }
        }
    };
    if output.timed_out {
        return CopilotStatus {
            available: false,
            version: None,
            detail: "GitHub Copilot CLI version probe timed out.".to_string(),
        };
    }
    if !output.status.success() {
        return CopilotStatus {
            available: false,
            version: None,
            detail: format!(
                "GitHub Copilot CLI version probe exited unsuccessfully: {}",
                summarize_process_error(&output)
            ),
        };
    }
    let version =
        first_nonempty_line(&output.stdout).or_else(|| first_nonempty_line(&output.stderr));
    CopilotStatus {
        available: true,
        version,
        detail: "GitHub Copilot CLI is installed. This probe does not indicate authentication."
            .to_string(),
    }
}

pub(crate) fn login_to_copilot(app: &AppHandle, cancel: &AiCancelFlag) -> CommandResult<()> {
    cancel.ensure_not_cancelled()?;
    let executable = find_copilot().ok_or_else(|| {
        "GitHub Copilot CLI was not found on PATH or known macOS locations".to_string()
    })?;
    let paths = copilot_paths(app)?;
    let mut command = Command::new(executable);
    command.args(["login", "--web-flow"]);
    configure_copilot_command(&mut command, &paths)?;
    let output = run_process_cancellable(command, None, COPILOT_TIMEOUT, 32 * 1024, Some(cancel))
        .map_err(|error| format!("GitHub Copilot login failed to start: {error}"))?;
    if output.cancelled {
        return Err(AI_CANCELLED_MESSAGE.to_string());
    }
    if output.timed_out {
        return Err("GitHub Copilot login timed out after 180 seconds".to_string());
    }
    if !output.status.success() {
        return Err(format!(
            "GitHub Copilot login failed: {}",
            summarize_process_error(&output)
        ));
    }
    Ok(())
}

pub(crate) struct CopilotPaths {
    pub(crate) system_home: PathBuf,
    pub(crate) home: PathBuf,
    pub(crate) work: PathBuf,
}

pub(crate) fn copilot_paths(app: &AppHandle) -> CommandResult<CopilotPaths> {
    let system_home = app
        .path()
        .home_dir()
        .map_err(|error| format!("Unable to resolve the system home directory: {error}"))?;
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Unable to resolve Copilot app data directory: {error}"))?;
    let home = app_data.join("copilot");
    let work = home.join("work");
    let temporary = home.join("tmp");
    let cache = home.join("cache");
    let github_config = home.join("github");
    create_restricted_dir(&home)
        .and_then(|_| create_restricted_dir(&work))
        .and_then(|_| create_restricted_dir(&temporary))
        .and_then(|_| create_restricted_dir(&cache))
        .and_then(|_| create_restricted_dir(&github_config))
        .map_err(|error| format!("Unable to prepare isolated Copilot storage: {error}"))?;
    ensure_copilot_config(&home)?;
    Ok(CopilotPaths {
        system_home,
        home,
        work,
    })
}

pub(crate) fn ensure_copilot_config(home: &Path) -> CommandResult<()> {
    let config_path = home.join("config.json");
    let mut config = match fs::read(&config_path) {
        Ok(bytes) => parse_jsonc(&bytes)
            .map_err(|error| format!("Isolated Copilot config is malformed: {error}"))?,
        Err(error) if error.kind() == io::ErrorKind::NotFound => json!({}),
        Err(error) => return Err(format!("Unable to read isolated Copilot config: {error}")),
    };
    let object = config
        .as_object_mut()
        .ok_or_else(|| "Isolated Copilot config must be a JSON object".to_string())?;
    object.insert("disableAllHooks".to_string(), json!(true));
    object.insert("memory".to_string(), json!(false));
    object.insert(
        "ide".to_string(),
        json!({
            "autoConnect": false,
        }),
    );
    object.insert("defaultPermissionMode".to_string(), json!("manual"));
    let bytes = serde_json::to_vec(&config)
        .map_err(|error| format!("Unable to serialize isolated Copilot config: {error}"))?;
    write_atomic(&config_path, &bytes)
        .map_err(|error| format!("Unable to secure isolated Copilot config: {error}"))
}

fn parse_jsonc(bytes: &[u8]) -> CommandResult<serde_json::Value> {
    let input = std::str::from_utf8(bytes)
        .map_err(|error| format!("config is not valid UTF-8: {error}"))?;
    let without_comments = strip_jsonc_comments(input)?;
    let normalized = strip_jsonc_trailing_commas(&without_comments);
    serde_json::from_str(&normalized).map_err(|error| error.to_string())
}

fn strip_jsonc_comments(input: &str) -> CommandResult<String> {
    let mut output = String::with_capacity(input.len());
    let mut characters = input.chars().peekable();
    let mut in_string = false;
    let mut escaped = false;

    while let Some(character) = characters.next() {
        if in_string {
            output.push(character);
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == '"' {
                in_string = false;
            }
            continue;
        }

        if character == '"' {
            in_string = true;
            output.push(character);
            continue;
        }

        if character != '/' {
            output.push(character);
            continue;
        }

        match characters.peek() {
            Some('/') => {
                characters.next();
                for comment_character in characters.by_ref() {
                    if comment_character == '\n' {
                        output.push('\n');
                        break;
                    }
                }
            }
            Some('*') => {
                characters.next();
                let mut closed = false;
                let mut previous = '\0';
                for comment_character in characters.by_ref() {
                    if comment_character == '\n' {
                        output.push('\n');
                    }
                    if previous == '*' && comment_character == '/' {
                        closed = true;
                        break;
                    }
                    previous = comment_character;
                }
                if !closed {
                    return Err("unterminated block comment".to_string());
                }
            }
            _ => output.push(character),
        }
    }

    Ok(output)
}

fn strip_jsonc_trailing_commas(input: &str) -> String {
    let characters: Vec<char> = input.chars().collect();
    let mut output = String::with_capacity(input.len());
    let mut in_string = false;
    let mut escaped = false;

    for (index, character) in characters.iter().copied().enumerate() {
        if in_string {
            output.push(character);
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == '"' {
                in_string = false;
            }
            continue;
        }

        if character == '"' {
            in_string = true;
            output.push(character);
            continue;
        }

        if character == ',' {
            let next = characters[index + 1..]
                .iter()
                .copied()
                .find(|candidate| !candidate.is_whitespace());
            if matches!(next, Some('}') | Some(']')) {
                continue;
            }
        }
        output.push(character);
    }

    output
}

pub(crate) fn configure_copilot_command(
    command: &mut Command,
    paths: &CopilotPaths,
) -> CommandResult<()> {
    command
        .env_clear()
        .current_dir(&paths.work)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    for name in [
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
    ] {
        if let Some(value) = std::env::var_os(name) {
            command.env(name, value);
        }
    }
    command
        .env("HOME", &paths.system_home)
        .env("USERPROFILE", &paths.system_home)
        .env("COPILOT_HOME", &paths.home)
        .env("GH_CONFIG_DIR", paths.home.join("github"))
        .env("XDG_CONFIG_HOME", &paths.home)
        .env("XDG_CACHE_HOME", paths.home.join("cache"))
        .env("TMPDIR", paths.home.join("tmp"))
        .env("TMP", paths.home.join("tmp"))
        .env("TEMP", paths.home.join("tmp"))
        .env("NO_COLOR", "1");
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ReasoningEffort {
    Low,
    Medium,
}

impl ReasoningEffort {
    const fn as_cli_arg(self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Medium => "medium",
        }
    }
}

const MAX_COPILOT_EVENT_STREAM_BYTES: usize = 2 * 1024 * 1024;

pub(crate) fn run_copilot_prompt(
    app: &AppHandle,
    model: &str,
    prompt: &str,
    effort: ReasoningEffort,
    cancel: &AiCancelFlag,
) -> CommandResult<Vec<u8>> {
    cancel.ensure_not_cancelled()?;
    if prompt.len() > MAX_PROMPT_BYTES {
        return Err("Copilot request exceeds the 256 KB limit".to_string());
    }
    validate_model_id(ProviderKind::Copilot, model)?;
    let executable = find_copilot().ok_or_else(|| {
        "GitHub Copilot CLI was not found on PATH or known macOS locations".to_string()
    })?;
    let paths = copilot_paths(app)?;
    let mut command = Command::new(executable);
    command.args(copilot_generation_args(model, effort));
    configure_copilot_command(&mut command, &paths)?;
    command.stdin(Stdio::piped());
    let output = run_process_cancellable(
        command,
        Some(prompt.as_bytes()),
        COPILOT_TIMEOUT,
        MAX_COPILOT_EVENT_STREAM_BYTES,
        Some(cancel),
    )
    .map_err(|error| format!("GitHub Copilot request failed to start: {error}"))?;
    if output.cancelled {
        return Err(AI_CANCELLED_MESSAGE.to_string());
    }
    if output.timed_out {
        return Err("GitHub Copilot request timed out after 180 seconds".to_string());
    }
    if output.output_truncated {
        return Err("Copilot event stream exceeds the 2 MB limit".to_string());
    }
    if !output.status.success() {
        return Err(format!(
            "GitHub Copilot request failed: {}",
            summarize_process_error(&output)
        ));
    }
    let response = extract_copilot_final_response(&output.stdout)?;
    if response.len() > MAX_GENERATION_OUTPUT_BYTES {
        return Err("Copilot response exceeds the 128 KB limit".to_string());
    }
    Ok(response)
}

pub(crate) fn extract_copilot_final_response(output: &[u8]) -> CommandResult<Vec<u8>> {
    let text = std::str::from_utf8(output)
        .map_err(|error| format!("Copilot event stream is not valid UTF-8: {error}"))?;
    let mut final_phase_response = None;
    let mut unphased_response = None;
    for (index, line) in text.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        let event: serde_json::Value = serde_json::from_str(line).map_err(|error| {
            format!(
                "Copilot event stream contains invalid JSON on line {}: {error}",
                index + 1
            )
        })?;
        if event.get("type").and_then(serde_json::Value::as_str) != Some("assistant.message") {
            continue;
        }
        let phase = event
            .pointer("/data/phase")
            .and_then(serde_json::Value::as_str);
        match phase {
            Some("final_answer") => {
                let content = event
                    .pointer("/data/content")
                    .and_then(serde_json::Value::as_str)
                    .ok_or_else(|| {
                        "Copilot final response event does not contain text content".to_string()
                    })?;
                final_phase_response = Some(content.as_bytes().to_vec());
            }
            None => {
                let Some(content_value) = event.pointer("/data/content") else {
                    continue;
                };
                let content = content_value.as_str().ok_or_else(|| {
                    "Copilot assistant message event does not contain text content".to_string()
                })?;
                if !content.trim().is_empty() {
                    unphased_response = Some(content.as_bytes().to_vec());
                }
            }
            Some(_) => continue,
        }
    }
    final_phase_response
        .or(unphased_response)
        .ok_or_else(|| "Copilot event stream did not contain a final response".to_string())
}

pub(crate) fn copilot_generation_args(model: &str, effort: ReasoningEffort) -> [&str; 18] {
    [
        "--silent",
        "--stream",
        "off",
        "--output-format",
        "json",
        "--model",
        model,
        "--reasoning-effort",
        effort.as_cli_arg(),
        "--available-tools",
        "--disable-builtin-mcps",
        "--no-custom-instructions",
        "--no-ask-user",
        "--no-auto-update",
        "--no-remote-export",
        "--log-level",
        "none",
        "--no-color",
    ]
}

const COPILOT_MODEL_DISCOVERY_TIMEOUT: Duration = Duration::from_secs(15);
const COPILOT_ACP_MAX_OUTPUT_BYTES: usize = 512 * 1024;

pub(crate) fn copilot_acp_discovery_args() -> [&'static str; 9] {
    [
        "--acp",
        "--available-tools",
        "--disable-builtin-mcps",
        "--no-custom-instructions",
        "--no-ask-user",
        "--no-auto-update",
        "--log-level",
        "none",
        "--no-color",
    ]
}

pub(crate) fn discover_copilot_models(app: &AppHandle) -> CommandResult<Vec<String>> {
    let executable = find_copilot().ok_or_else(|| {
        "GitHub Copilot CLI was not found on PATH or known macOS locations".to_string()
    })?;
    let paths = copilot_paths(app)?;
    discover_copilot_models_with_executable(&executable, &paths, COPILOT_MODEL_DISCOVERY_TIMEOUT)
}

pub(crate) fn discover_copilot_models_with_executable(
    executable: &Path,
    paths: &CopilotPaths,
    timeout: Duration,
) -> CommandResult<Vec<String>> {
    let mut command = Command::new(executable);
    command.args(copilot_acp_discovery_args());
    configure_copilot_command(&mut command, paths)?;
    command.stdin(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|error| format!("GitHub Copilot model discovery failed to start: {error}"))?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Unable to open stdin for Copilot model discovery".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Unable to open stdout for Copilot model discovery".to_string())?;
    let stderr_reader = child
        .stderr
        .take()
        .map(|stderr| thread::spawn(move || read_capped(stderr, 16 * 1024)));

    let init_request = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": 1,
            "clientCapabilities": {}
        }
    });
    let session_request = json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "session/new",
        "params": {
            "cwd": paths.work.to_string_lossy(),
            "mcpServers": []
        }
    });
    let payload = format!("{init_request}\n{session_request}\n");
    if let Err(error) = stdin
        .write_all(payload.as_bytes())
        .and_then(|_| stdin.flush())
    {
        let _ = child.kill();
        let _ = child.wait();
        return Err(format!(
            "Unable to query GitHub Copilot CLI models: {error}"
        ));
    }

    let (tx, rx) = mpsc::channel::<CommandResult<Vec<String>>>();
    let stdout_reader = thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        let mut total_bytes = 0usize;
        loop {
            line.clear();
            match reader.read_line(&mut line) {
                Ok(0) => break,
                Ok(n) => {
                    total_bytes += n;
                    if total_bytes > COPILOT_ACP_MAX_OUTPUT_BYTES {
                        let _ = tx.send(Err(
                            "GitHub Copilot model discovery output exceeded 512 KB".to_string(),
                        ));
                        return;
                    }
                    if let Some(result) = parse_copilot_acp_model_line(&line) {
                        let _ = tx.send(result);
                        return;
                    }
                }
                Err(error) => {
                    let _ = tx.send(Err(format!(
                        "Unable to read Copilot model discovery output: {error}"
                    )));
                    return;
                }
            }
        }
        let _ = tx.send(Err(
            "GitHub Copilot CLI exited before returning available models".to_string(),
        ));
    });

    let outcome = match rx.recv_timeout(timeout) {
        Ok(result) => result,
        Err(mpsc::RecvTimeoutError::Timeout) => {
            Err("Timed out waiting for GitHub Copilot CLI to list available models".to_string())
        }
        Err(mpsc::RecvTimeoutError::Disconnected) => {
            Err("GitHub Copilot CLI exited before returning available models".to_string())
        }
    };

    drop(stdin);
    let _ = child.kill();
    let _ = child.wait();
    let _ = stdout_reader.join();
    let stderr_text = stderr_reader
        .and_then(|handle| handle.join().ok())
        .and_then(Result::ok)
        .and_then(|capped| first_nonempty_line(&capped.bytes));

    match outcome {
        Ok(models) if !models.is_empty() => Ok(models),
        Ok(_) => Err("GitHub Copilot CLI returned no available models".to_string()),
        Err(error) => {
            if let Some(detail) = stderr_text {
                Err(format!("{error} ({detail})"))
            } else {
                Err(error)
            }
        }
    }
}

fn parse_copilot_acp_model_line(line: &str) -> Option<CommandResult<Vec<String>>> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }
    let value: serde_json::Value = serde_json::from_str(trimmed).ok()?;
    let id = value.get("id").and_then(serde_json::Value::as_i64)?;
    if let Some(error) = value.get("error") {
        let message = error
            .get("message")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("unknown ACP error");
        return Some(Err(format!(
            "GitHub Copilot CLI model discovery failed: {message}"
        )));
    }
    if id != 2 {
        return None;
    }
    let available = value
        .pointer("/result/models/availableModels")
        .and_then(serde_json::Value::as_array)?;
    let mut seen = HashSet::new();
    let mut models = Vec::new();
    for entry in available {
        let disabled = entry
            .pointer("/_meta/copilotEnablement")
            .and_then(serde_json::Value::as_str)
            == Some("disabled");
        if disabled {
            continue;
        }
        if let Some(model_id) = entry.get("modelId").and_then(serde_json::Value::as_str) {
            if validate_model_id(ProviderKind::Copilot, model_id).is_ok()
                && seen.insert(model_id.to_string())
            {
                models.push(model_id.to_string());
            }
        }
    }
    Some(Ok(models))
}

pub(crate) struct ProcessOutput {
    pub(crate) status: ExitStatus,
    pub(crate) stdout: Vec<u8>,
    pub(crate) stderr: Vec<u8>,
    pub(crate) timed_out: bool,
    pub(crate) cancelled: bool,
    pub(crate) output_truncated: bool,
}

struct CappedRead {
    bytes: Vec<u8>,
    truncated: bool,
}

pub(crate) fn run_process(
    command: Command,
    input: Option<&[u8]>,
    timeout: Duration,
    output_limit: usize,
) -> CommandResult<ProcessOutput> {
    run_process_cancellable(command, input, timeout, output_limit, None)
}

pub(crate) fn run_process_cancellable(
    mut command: Command,
    input: Option<&[u8]>,
    timeout: Duration,
    output_limit: usize,
    cancel: Option<&AiCancelFlag>,
) -> CommandResult<ProcessOutput> {
    if input.is_some() {
        command.stdin(Stdio::piped());
    }
    let mut child = command
        .spawn()
        .map_err(|error| format!("unable to launch process: {error}"))?;
    let input_writer = child.stdin.take().map(|mut stdin| {
        let input = input.map(ToOwned::to_owned);
        thread::spawn(move || {
            if let Some(input) = input {
                let _ = stdin.write_all(&input);
            }
        })
    });

    let stdout_reader = child
        .stdout
        .take()
        .map(|stdout| thread::spawn(move || read_capped(stdout, output_limit)));
    let stderr_reader = child
        .stderr
        .take()
        .map(|stderr| thread::spawn(move || read_capped(stderr, 32 * 1024)));

    let deadline = Instant::now() + timeout;
    let mut timed_out = false;
    let mut cancelled = false;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if cancel.is_some_and(AiCancelFlag::is_cancelled) => {
                cancelled = true;
                let _ = child.kill();
                break child
                    .wait()
                    .map_err(|error| format!("unable to reap cancelled process: {error}"))?;
            }
            Ok(None) if Instant::now() >= deadline => {
                timed_out = true;
                let _ = child.kill();
                break child
                    .wait()
                    .map_err(|error| format!("unable to reap timed-out process: {error}"))?;
            }
            Ok(None) => thread::sleep(Duration::from_millis(20)),
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("unable to inspect process: {error}"));
            }
        }
    };

    if let Some(writer) = input_writer {
        let _ = writer.join();
    }
    let stdout = join_reader(stdout_reader, output_limit)?;
    let stderr = join_reader(stderr_reader, 32 * 1024)?;
    Ok(ProcessOutput {
        status,
        stdout: stdout.bytes,
        stderr: stderr.bytes,
        timed_out,
        cancelled,
        output_truncated: stdout.truncated,
    })
}

fn read_capped<R: Read>(mut reader: R, limit: usize) -> io::Result<CappedRead> {
    let mut bytes = Vec::with_capacity(limit.min(16 * 1024));
    let mut buffer = [0_u8; 8 * 1024];
    let mut truncated = false;
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        if bytes.len() < limit {
            let remaining = limit - bytes.len();
            let copied = remaining.min(read);
            bytes.extend_from_slice(&buffer[..copied]);
            if copied < read {
                truncated = true;
            }
        } else {
            truncated = true;
        }
    }
    Ok(CappedRead { bytes, truncated })
}

fn join_reader(
    reader: Option<thread::JoinHandle<io::Result<CappedRead>>>,
    limit: usize,
) -> CommandResult<CappedRead> {
    match reader {
        Some(reader) => reader
            .join()
            .map_err(|_| "process output reader panicked".to_string())?
            .map_err(|error| format!("unable to read process output (limit {limit}): {error}")),
        None => Ok(CappedRead {
            bytes: Vec::new(),
            truncated: false,
        }),
    }
}

fn first_nonempty_line(bytes: &[u8]) -> Option<String> {
    std::str::from_utf8(bytes)
        .ok()?
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(|line| line.chars().take(200).collect())
}

pub(crate) fn summarize_process_error(output: &ProcessOutput) -> String {
    let stderr =
        first_nonempty_line(&output.stderr).unwrap_or_else(|| "no diagnostic output".to_string());
    format!("{} ({stderr})", output.status)
}
