//! Copilot CLI discovery plus the direct `--version` and `login` subprocesses.

use super::profile::{copilot_paths, CopilotPaths};
use crate::{contract::*, process::*};
use std::{
    path::{Path, PathBuf},
    process::{Command, Stdio},
};
use tauri::AppHandle;

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
pub(crate) fn find_known_macos_copilot() -> Option<PathBuf> {
    [
        PathBuf::from("/opt/homebrew/bin/copilot"),
        PathBuf::from("/usr/local/bin/copilot"),
        PathBuf::from("/usr/bin/copilot"),
    ]
    .into_iter()
    .find(|candidate| is_executable(candidate))
}

pub(crate) fn is_executable(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::metadata(path)
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
    if output.output_truncated {
        return CopilotStatus {
            available: false,
            version: None,
            detail: "GitHub Copilot CLI version output exceeded the 16 KB limit.".to_string(),
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

pub(crate) fn login_to_copilot(app: &AppHandle) -> CommandResult<()> {
    let executable = find_copilot().ok_or_else(|| {
        "GitHub Copilot CLI was not found on PATH or known macOS locations".to_string()
    })?;
    let paths = copilot_paths(app)?;
    let mut command = Command::new(executable);
    command.args(["login", "--web-flow"]);
    configure_copilot_command(&mut command, &paths)?;
    let output = run_process(command, None, COPILOT_TIMEOUT, 32 * 1024)
        .map_err(|error| format!("GitHub Copilot login failed to start: {error}"))?;
    if output.timed_out {
        return Err("GitHub Copilot login timed out after 180 seconds".to_string());
    }
    if output.output_truncated {
        return Err("GitHub Copilot login output exceeded the 32 KB limit".to_string());
    }
    if !output.status.success() {
        return Err(format!(
            "GitHub Copilot login failed: {}",
            summarize_process_error(&output)
        ));
    }
    Ok(())
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

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use crate::test_support::*;
    use std::fs;

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
            run_process(command, None, FAKE_EXECUTABLE_TIMEOUT, 4096).expect("run fake copilot");
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
}
