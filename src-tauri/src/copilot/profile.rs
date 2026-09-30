//! App-owned Copilot home, directories, and isolation-enforcing CLI configuration.

use crate::{
    contract::*,
    persistence::{create_restricted_dir, write_atomic},
};
use serde_json::json;
use std::{
    fs, io,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

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

pub(crate) fn parse_jsonc(bytes: &[u8]) -> CommandResult<serde_json::Value> {
    let input = std::str::from_utf8(bytes)
        .map_err(|error| format!("config is not valid UTF-8: {error}"))?;
    let without_comments = strip_jsonc_comments(input)?;
    let normalized = strip_jsonc_trailing_commas(&without_comments);
    serde_json::from_str(&normalized).map_err(|error| error.to_string())
}

pub(crate) fn strip_jsonc_comments(input: &str) -> CommandResult<String> {
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

pub(crate) fn strip_jsonc_trailing_commas(input: &str) -> String {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::*;

    #[test]
    fn copilot_config_disables_persistence_and_hooks_without_dropping_existing_settings() {
        let directory = test_directory("copilot-config");
        let path = directory.join("config.json");
        fs::write(
            &path,
            br#"// User settings for Copilot CLI
{
  "theme": "dark",
  "documentation": "https://example.com/path//segment",
  /* Copilot may preserve comments and trailing commas. */
  "memory": true,
}
"#,
        )
        .expect("seed config");
        ensure_copilot_config(&directory).expect("secure config");
        let config: serde_json::Value =
            serde_json::from_slice(&fs::read(path).expect("read config")).expect("parse config");
        assert_eq!(config["theme"], "dark");
        assert_eq!(config["documentation"], "https://example.com/path//segment");
        assert_eq!(config["disableAllHooks"], true);
        assert_eq!(config["memory"], false);
        assert_eq!(config["ide"]["autoConnect"], false);
        assert_eq!(config["defaultPermissionMode"], "manual");
        fs::remove_dir_all(directory).expect("cleanup");
    }

    #[test]
    fn malformed_copilot_config_is_not_silently_replaced() {
        let directory = test_directory("copilot-config-malformed");
        let path = directory.join("config.json");
        fs::write(&path, b"/* unterminated").expect("seed config");
        let error = ensure_copilot_config(&directory).expect_err("reject malformed config");
        assert!(error.contains("unterminated block comment"));
        assert_eq!(
            fs::read_to_string(&path).expect("read unchanged config"),
            "/* unterminated"
        );
        fs::remove_dir_all(directory).expect("cleanup");
    }
}
