pub use crate::provider_http::{run_http_provider_prompt, HttpEndpoints};
use reqwest::Url;
use serde::{Deserialize, Serialize};
use std::{env, path::Path};

pub const AI_SETTINGS_FILE: &str = "ai-settings.json";
pub const KEYRING_SERVICE: &str = "app.hireloom.desktop";
pub const DEFAULT_COPILOT_MODEL: &str = "claude-sonnet-5.5";
pub const DEFAULT_VERIFIER_MODEL: &str = "gpt-6.1-terra";
pub const DEFAULT_OLLAMA_BASE_URL: &str = "http://127.0.0.1:11434/v1";

pub const COPILOT_ALLOWED_MODELS: &[&str] = &[
    "claude-sonnet-5.5",
    "gpt-6.1-terra",
    "gpt-6.2-sol",
    "gpt-6-luna",
    "claude-haiku-5.5",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderKind {
    Copilot,
    Openai,
    Anthropic,
    Gemini,
    Ollama,
}

impl ProviderKind {
    pub const ALL: [ProviderKind; 5] = [
        ProviderKind::Copilot,
        ProviderKind::Openai,
        ProviderKind::Anthropic,
        ProviderKind::Gemini,
        ProviderKind::Ollama,
    ];

    pub const fn as_id(self) -> &'static str {
        match self {
            Self::Copilot => "copilot",
            Self::Openai => "openai",
            Self::Anthropic => "anthropic",
            Self::Gemini => "gemini",
            Self::Ollama => "ollama",
        }
    }

    pub const fn default_model(self) -> &'static str {
        match self {
            Self::Copilot => DEFAULT_COPILOT_MODEL,
            Self::Openai => "gpt-4.1",
            Self::Anthropic => "claude-sonnet-4-6",
            Self::Gemini => "gemini-2.5-pro",
            Self::Ollama => "llama3.3",
        }
    }

    pub const fn env_var_name(self) -> Option<&'static str> {
        match self {
            Self::Copilot => None,
            Self::Openai => Some("OPENAI_API_KEY"),
            Self::Anthropic => Some("ANTHROPIC_API_KEY"),
            Self::Gemini => Some("GEMINI_API_KEY"),
            Self::Ollama => Some("HIRELOOM_COMPATIBLE_API_KEY"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AiSettings {
    pub primary_provider: ProviderKind,
    pub primary_model: String,
    #[serde(default = "default_ollama_url")]
    pub ollama_base_url: String,
    #[serde(default)]
    pub verifier_enabled: bool,
    #[serde(default = "default_verifier_provider")]
    pub verifier_provider: ProviderKind,
    #[serde(default = "default_verifier_model")]
    pub verifier_model: String,
}

fn default_ollama_url() -> String {
    DEFAULT_OLLAMA_BASE_URL.to_string()
}

const fn default_verifier_provider() -> ProviderKind {
    ProviderKind::Copilot
}

fn default_verifier_model() -> String {
    DEFAULT_VERIFIER_MODEL.to_string()
}

impl Default for AiSettings {
    fn default() -> Self {
        Self {
            primary_provider: ProviderKind::Copilot,
            primary_model: DEFAULT_COPILOT_MODEL.to_string(),
            ollama_base_url: DEFAULT_OLLAMA_BASE_URL.to_string(),
            verifier_enabled: false,
            verifier_provider: ProviderKind::Copilot,
            verifier_model: DEFAULT_VERIFIER_MODEL.to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCredentialStatus {
    pub provider: ProviderKind,
    pub configured: bool,
    pub has_stored_key: bool,
    pub has_env_key: bool,
}

pub trait CredentialStore: Send + Sync {
    fn get_key(&self, provider: ProviderKind) -> Result<Option<String>, String>;
    fn set_key(&self, provider: ProviderKind, key: &str) -> Result<(), String>;
    fn clear_key(&self, provider: ProviderKind) -> Result<(), String>;
}

pub struct OsKeyringStore;

impl OsKeyringStore {
    fn account_name(provider: ProviderKind) -> String {
        format!("provider:{}", provider.as_id())
    }
}

impl CredentialStore for OsKeyringStore {
    fn get_key(&self, provider: ProviderKind) -> Result<Option<String>, String> {
        if provider == ProviderKind::Copilot {
            return Ok(None);
        }
        let entry = keyring::Entry::new(KEYRING_SERVICE, &Self::account_name(provider))
            .map_err(|error| format!("Unable to open OS credential store: {error}"))?;
        match entry.get_password() {
            Ok(secret) if !secret.trim().is_empty() => Ok(Some(secret)),
            Ok(_) => Ok(None),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(format!("Unable to read OS credential store: {error}")),
        }
    }

    fn set_key(&self, provider: ProviderKind, key: &str) -> Result<(), String> {
        if provider == ProviderKind::Copilot {
            return Err("GitHub Copilot uses CLI web sign-in rather than an API key".to_string());
        }
        let trimmed = key.trim();
        if trimmed.is_empty() || trimmed.len() > 512 {
            return Err("API key must be between 1 and 512 characters".to_string());
        }
        if trimmed.chars().any(char::is_control) {
            return Err("API key contains unsupported control characters".to_string());
        }
        let entry = keyring::Entry::new(KEYRING_SERVICE, &Self::account_name(provider))
            .map_err(|error| format!("Unable to open OS credential store: {error}"))?;
        entry
            .set_password(trimmed)
            .map_err(|error| format!("Unable to save API key to OS credential store: {error}"))
    }

    fn clear_key(&self, provider: ProviderKind) -> Result<(), String> {
        if provider == ProviderKind::Copilot {
            return Ok(());
        }
        let entry = keyring::Entry::new(KEYRING_SERVICE, &Self::account_name(provider))
            .map_err(|error| format!("Unable to open OS credential store: {error}"))?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(format!(
                "Unable to remove API key from OS credential store: {error}"
            )),
        }
    }
}

pub fn resolve_api_key(
    store: &dyn CredentialStore,
    provider: ProviderKind,
) -> Result<Option<String>, String> {
    if let Ok(Some(stored)) = store.get_key(provider) {
        if !stored.trim().is_empty() {
            return Ok(Some(stored));
        }
    }
    if let Some(var_name) = provider.env_var_name() {
        if let Ok(env_val) = env::var(var_name) {
            let trimmed = env_val.trim().to_string();
            if !trimmed.is_empty() {
                return Ok(Some(trimmed));
            }
        }
    }
    Ok(None)
}

pub fn provider_credential_statuses(
    store: &dyn CredentialStore,
    copilot_available: bool,
) -> Vec<ProviderCredentialStatus> {
    ProviderKind::ALL
        .into_iter()
        .map(|provider| {
            if provider == ProviderKind::Copilot {
                return ProviderCredentialStatus {
                    provider,
                    configured: copilot_available,
                    has_stored_key: false,
                    has_env_key: false,
                };
            }
            let has_stored_key = store
                .get_key(provider)
                .ok()
                .flatten()
                .is_some_and(|k| !k.trim().is_empty());
            let has_env_key = provider
                .env_var_name()
                .and_then(|name| env::var(name).ok())
                .is_some_and(|v| !v.trim().is_empty());
            let configured = match provider {
                ProviderKind::Ollama => true,
                _ => has_stored_key || has_env_key,
            };
            ProviderCredentialStatus {
                provider,
                configured,
                has_stored_key,
                has_env_key,
            }
        })
        .collect()
}

pub fn validate_model_id(provider: ProviderKind, model: &str) -> Result<(), String> {
    let trimmed = model.trim();
    if trimmed.is_empty() || trimmed.len() > 100 || trimmed != model {
        return Err("Model identifier must be a trimmed 1–100 character name".to_string());
    }
    match provider {
        ProviderKind::Copilot => {
            if !COPILOT_ALLOWED_MODELS.contains(&trimmed) {
                return Err(format!(
                    "Unsupported Copilot CLI model \"{trimmed}\". Choose one of: {}",
                    COPILOT_ALLOWED_MODELS.join(", ")
                ));
            }
        }
        ProviderKind::Gemini => {
            if !trimmed
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
            {
                return Err(
                    "Gemini model identifier may contain only letters, digits, '.', '_', or '-'"
                        .to_string(),
                );
            }
        }
        ProviderKind::Openai | ProviderKind::Anthropic | ProviderKind::Ollama => {
            if !trimmed
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | ':' | '/'))
                || trimmed.contains("..")
            {
                return Err("Model identifier contains unsupported characters".to_string());
            }
        }
    }
    Ok(())
}

pub fn validate_compatible_base_url(raw: &str) -> Result<Url, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.len() > 300 || trimmed != raw {
        return Err("Endpoint URL must be a trimmed URL up to 300 characters".to_string());
    }
    let parsed = Url::parse(trimmed).map_err(|error| format!("Invalid endpoint URL: {error}"))?;
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("Endpoint URL must not embed credentials".to_string());
    }
    if parsed.query().is_some() || parsed.fragment().is_some() {
        return Err("Endpoint URL must not include query parameters or fragments".to_string());
    }
    let host = parsed
        .host_str()
        .ok_or_else(|| "Endpoint URL must specify a host".to_string())?;
    let is_loopback = matches!(host, "localhost" | "127.0.0.1" | "::1" | "[::1]");
    match parsed.scheme() {
        "https" => Ok(parsed),
        "http" if is_loopback => Ok(parsed),
        "http" => Err(
            "Plain HTTP is permitted only for localhost/127.0.0.1; remote endpoints must use HTTPS"
                .to_string(),
        ),
        other => Err(format!("Unsupported endpoint URL scheme \"{other}\"")),
    }
}

pub fn validate_ai_settings(settings: &AiSettings) -> Result<(), String> {
    validate_model_id(settings.primary_provider, &settings.primary_model)?;
    validate_model_id(settings.verifier_provider, &settings.verifier_model)?;
    validate_compatible_base_url(&settings.ollama_base_url)?;
    Ok(())
}

pub fn load_ai_settings_from_path(path: &Path) -> Result<AiSettings, String> {
    let bytes = match std::fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(AiSettings::default())
        }
        Err(error) => return Err(format!("Unable to read AI settings: {error}")),
    };
    if bytes.len() > 32 * 1024 {
        return Err("AI settings file exceeds 32 KB".to_string());
    }
    let settings: AiSettings = serde_json::from_slice(&bytes)
        .map_err(|error| format!("AI settings file is malformed: {error}"))?;
    validate_ai_settings(&settings)?;
    Ok(settings)
}
