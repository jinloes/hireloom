use crate::{
    contract::{AiCancelFlag, AI_CANCELLED_MESSAGE},
    providers::{validate_compatible_base_url, validate_model_id, ProviderKind},
};
use reqwest::{blocking::Client, redirect::Policy};
use serde_json::json;
use std::{
    io::Read,
    sync::{mpsc, OnceLock},
    thread,
    time::Duration,
};

static SHARED_HTTP_CLIENT: OnceLock<Result<Client, String>> = OnceLock::new();

fn shared_http_client() -> Result<&'static Client, String> {
    SHARED_HTTP_CLIENT
        .get_or_init(|| {
            Client::builder()
                .redirect(Policy::none())
                .user_agent("Hireloom/0.2")
                .build()
                .map_err(|error| format!("Unable to initialize HTTP client: {error}"))
        })
        .as_ref()
        .map_err(Clone::clone)
}

#[derive(Debug, Clone)]
pub struct HttpEndpoints {
    pub openai_base: String,
    pub anthropic_base: String,
    pub gemini_base: String,
}

impl Default for HttpEndpoints {
    fn default() -> Self {
        Self {
            openai_base: "https://api.openai.com/v1".to_string(),
            anthropic_base: "https://api.anthropic.com/v1".to_string(),
            gemini_base: "https://generativelanguage.googleapis.com/v1beta".to_string(),
        }
    }
}

fn read_response_capped(
    mut response: reqwest::blocking::Response,
    max_bytes: usize,
) -> Result<(reqwest::StatusCode, Vec<u8>), String> {
    let status = response.status();
    let mut buffer = Vec::with_capacity(8 * 1024);
    let mut chunk = [0_u8; 8 * 1024];
    loop {
        let count = response
            .read(&mut chunk)
            .map_err(|error| format!("Failed while reading provider response: {error}"))?;
        if count == 0 {
            break;
        }
        if buffer.len() + count > max_bytes {
            return Err("AI provider response exceeds the 128 KB limit".to_string());
        }
        buffer.extend_from_slice(&chunk[..count]);
    }
    Ok((status, buffer))
}

fn summarize_http_error(
    provider: ProviderKind,
    status: reqwest::StatusCode,
    body: &[u8],
) -> String {
    let preview: String = String::from_utf8_lossy(body)
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(240)
        .collect();
    if preview.is_empty() {
        format!(
            "{} request failed with HTTP {}",
            provider.as_id(),
            status.as_u16()
        )
    } else {
        format!(
            "{} request failed (HTTP {}): {}",
            provider.as_id(),
            status.as_u16(),
            preview
        )
    }
}

#[cfg(test)]
#[allow(clippy::too_many_arguments)]
pub fn run_http_provider_prompt(
    provider: ProviderKind,
    model: &str,
    prompt: &str,
    api_key: Option<&str>,
    ollama_base_url: &str,
    endpoints: &HttpEndpoints,
    timeout: Duration,
    max_output_bytes: usize,
) -> Result<Vec<u8>, String> {
    run_http_provider_prompt_cancellable(
        provider,
        model,
        prompt,
        api_key,
        ollama_base_url,
        endpoints,
        timeout,
        max_output_bytes,
        None,
    )
}

#[allow(clippy::too_many_arguments)]
pub fn run_http_provider_prompt_cancellable(
    provider: ProviderKind,
    model: &str,
    prompt: &str,
    api_key: Option<&str>,
    ollama_base_url: &str,
    endpoints: &HttpEndpoints,
    timeout: Duration,
    max_output_bytes: usize,
    cancel: Option<&AiCancelFlag>,
) -> Result<Vec<u8>, String> {
    if let Some(flag) = cancel {
        flag.ensure_not_cancelled()?;
        let model = model.to_string();
        let prompt = prompt.to_string();
        let api_key = api_key.map(ToOwned::to_owned);
        let ollama_base_url = ollama_base_url.to_string();
        let endpoints = endpoints.clone();
        let (tx, rx) = mpsc::channel();
        thread::spawn(move || {
            let result = execute_http_provider_prompt(
                provider,
                &model,
                &prompt,
                api_key.as_deref(),
                &ollama_base_url,
                &endpoints,
                timeout,
                max_output_bytes,
            );
            let _ = tx.send(result);
        });
        loop {
            if flag.is_cancelled() {
                return Err(AI_CANCELLED_MESSAGE.to_string());
            }
            match rx.recv_timeout(Duration::from_millis(25)) {
                Ok(result) => {
                    flag.ensure_not_cancelled()?;
                    return result;
                }
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    return Err("AI HTTP worker exited unexpectedly".to_string());
                }
            }
        }
    }

    execute_http_provider_prompt(
        provider,
        model,
        prompt,
        api_key,
        ollama_base_url,
        endpoints,
        timeout,
        max_output_bytes,
    )
}

#[allow(clippy::too_many_arguments)]
fn execute_http_provider_prompt(
    provider: ProviderKind,
    model: &str,
    prompt: &str,
    api_key: Option<&str>,
    ollama_base_url: &str,
    endpoints: &HttpEndpoints,
    timeout: Duration,
    max_output_bytes: usize,
) -> Result<Vec<u8>, String> {
    validate_model_id(provider, model)?;
    let client = shared_http_client()?;

    let system_msg = "Return valid JSON only matching the requested schema, with no extra keys or surrounding prose.";

    match provider {
        ProviderKind::Copilot => {
            Err("Copilot requests must use the isolated CLI runner".to_string())
        }
        ProviderKind::Openai | ProviderKind::Ollama => {
            let base = if provider == ProviderKind::Openai {
                endpoints.openai_base.trim_end_matches('/').to_string()
            } else {
                validate_compatible_base_url(ollama_base_url)?;
                ollama_base_url.trim_end_matches('/').to_string()
            };
            let url = format!("{base}/chat/completions");
            let mut request = client.post(&url).timeout(timeout).json(&json!({
                "model": model,
                "temperature": 0.2,
                "messages": [
                    { "role": "system", "content": system_msg },
                    { "role": "user", "content": prompt }
                ]
            }));
            if provider == ProviderKind::Openai {
                let key = api_key.ok_or_else(|| {
                    "Configure your OpenAI API key in AI settings or set OPENAI_API_KEY."
                        .to_string()
                })?;
                request = request.bearer_auth(key);
            } else if let Some(key) = api_key {
                if !key.trim().is_empty() {
                    request = request.bearer_auth(key);
                }
            }

            let response = request.send().map_err(|error| {
                format!(
                    "Unable to reach {} endpoint: {}",
                    provider.as_id(),
                    error.without_url()
                )
            })?;
            let (status, body) = read_response_capped(response, max_output_bytes)?;
            if !status.is_success() {
                return Err(summarize_http_error(provider, status, &body));
            }
            let parsed: serde_json::Value = serde_json::from_slice(&body).map_err(|error| {
                format!("Invalid JSON envelope from {}: {error}", provider.as_id())
            })?;
            let text = parsed
                .pointer("/choices/0/message/content")
                .and_then(serde_json::Value::as_str)
                .ok_or_else(|| {
                    format!("{} response did not contain message text", provider.as_id())
                })?;
            Ok(text.as_bytes().to_vec())
        }
        ProviderKind::Anthropic => {
            let key = api_key.ok_or_else(|| {
                "Configure your Anthropic API key in AI settings or set ANTHROPIC_API_KEY."
                    .to_string()
            })?;
            let url = format!(
                "{}/messages",
                endpoints.anthropic_base.trim_end_matches('/')
            );
            let response = client
                .post(&url)
                .timeout(timeout)
                .header("x-api-key", key)
                .header("anthropic-version", "2023-06-01")
                .json(&json!({
                    "model": model,
                    "max_tokens": 4096,
                    "temperature": 0.2,
                    "system": system_msg,
                    "messages": [
                        { "role": "user", "content": prompt }
                    ]
                }))
                .send()
                .map_err(|error| {
                    format!(
                        "Unable to reach Anthropic endpoint: {}",
                        error.without_url()
                    )
                })?;
            let (status, body) = read_response_capped(response, max_output_bytes)?;
            if !status.is_success() {
                return Err(summarize_http_error(provider, status, &body));
            }
            let parsed: serde_json::Value = serde_json::from_slice(&body)
                .map_err(|error| format!("Invalid JSON envelope from Anthropic: {error}"))?;
            let blocks = parsed
                .get("content")
                .and_then(serde_json::Value::as_array)
                .ok_or_else(|| "Anthropic response did not contain content blocks".to_string())?;
            let mut combined = String::new();
            for block in blocks {
                if block.get("type").and_then(serde_json::Value::as_str) == Some("text") {
                    if let Some(piece) = block.get("text").and_then(serde_json::Value::as_str) {
                        combined.push_str(piece);
                    }
                }
            }
            if combined.trim().is_empty() {
                return Err("Anthropic response did not contain text output".to_string());
            }
            Ok(combined.into_bytes())
        }
        ProviderKind::Gemini => {
            let key = api_key.ok_or_else(|| {
                "Configure your Google Gemini API key in AI settings or set GEMINI_API_KEY."
                    .to_string()
            })?;
            let url = format!(
                "{}/models/{}:generateContent",
                endpoints.gemini_base.trim_end_matches('/'),
                model
            );
            let response = client
                .post(&url)
                .timeout(timeout)
                .header("x-goog-api-key", key)
                .json(&json!({
                    "systemInstruction": {
                        "parts": [{ "text": system_msg }]
                    },
                    "contents": [
                        {
                            "role": "user",
                            "parts": [{ "text": prompt }]
                        }
                    ],
                    "generationConfig": {
                        "temperature": 0.2,
                        "responseMimeType": "application/json"
                    }
                }))
                .send()
                .map_err(|error| {
                    format!("Unable to reach Gemini endpoint: {}", error.without_url())
                })?;
            let (status, body) = read_response_capped(response, max_output_bytes)?;
            if !status.is_success() {
                return Err(summarize_http_error(provider, status, &body));
            }
            let parsed: serde_json::Value = serde_json::from_slice(&body)
                .map_err(|error| format!("Invalid JSON envelope from Gemini: {error}"))?;
            let text = parsed
                .pointer("/candidates/0/content/parts/0/text")
                .and_then(serde_json::Value::as_str)
                .ok_or_else(|| "Gemini response did not contain candidate text".to_string())?;
            Ok(text.as_bytes().to_vec())
        }
    }
}

const MAX_MODEL_LIST_BYTES: usize = 1024 * 1024;

pub fn list_http_provider_models(
    provider: ProviderKind,
    api_key: Option<&str>,
    ollama_base_url: &str,
    endpoints: &HttpEndpoints,
    timeout: Duration,
) -> Result<Vec<String>, String> {
    let client = shared_http_client()?;

    let (status, body) = match provider {
        ProviderKind::Copilot => {
            return Err("Copilot models are managed via the Copilot CLI allowlist".to_string());
        }
        ProviderKind::Openai | ProviderKind::Ollama => {
            let base = if provider == ProviderKind::Openai {
                endpoints.openai_base.trim_end_matches('/').to_string()
            } else {
                validate_compatible_base_url(ollama_base_url)?;
                ollama_base_url.trim_end_matches('/').to_string()
            };
            let url = format!("{base}/models");
            let mut request = client.get(&url).timeout(timeout);
            if provider == ProviderKind::Openai {
                let key = api_key.ok_or_else(|| {
                    "Configure your OpenAI API key in AI settings or set OPENAI_API_KEY."
                        .to_string()
                })?;
                request = request.bearer_auth(key);
            } else if let Some(key) = api_key {
                if !key.trim().is_empty() {
                    request = request.bearer_auth(key);
                }
            }
            let response = request.send().map_err(|error| {
                format!(
                    "Unable to reach {} endpoint: {}",
                    provider.as_id(),
                    error.without_url()
                )
            })?;
            read_response_capped(response, MAX_MODEL_LIST_BYTES)?
        }
        ProviderKind::Anthropic => {
            let key = api_key.ok_or_else(|| {
                "Configure your Anthropic API key in AI settings or set ANTHROPIC_API_KEY."
                    .to_string()
            })?;
            let url = format!("{}/models", endpoints.anthropic_base.trim_end_matches('/'));
            let response = client
                .get(&url)
                .timeout(timeout)
                .header("x-api-key", key)
                .header("anthropic-version", "2023-06-01")
                .send()
                .map_err(|error| {
                    format!(
                        "Unable to reach Anthropic endpoint: {}",
                        error.without_url()
                    )
                })?;
            read_response_capped(response, MAX_MODEL_LIST_BYTES)?
        }
        ProviderKind::Gemini => {
            let key = api_key.ok_or_else(|| {
                "Configure your Google Gemini API key in AI settings or set GEMINI_API_KEY."
                    .to_string()
            })?;
            let url = format!("{}/models", endpoints.gemini_base.trim_end_matches('/'));
            let response = client
                .get(&url)
                .timeout(timeout)
                .header("x-goog-api-key", key)
                .send()
                .map_err(|error| {
                    format!("Unable to reach Gemini endpoint: {}", error.without_url())
                })?;
            read_response_capped(response, MAX_MODEL_LIST_BYTES)?
        }
    };

    if !status.is_success() {
        return Err(summarize_http_error(provider, status, &body));
    }

    let parsed: serde_json::Value = serde_json::from_slice(&body)
        .map_err(|error| format!("Invalid JSON model list from {}: {error}", provider.as_id()))?;
    Ok(extract_provider_model_ids(provider, &parsed))
}

fn extract_provider_model_ids(provider: ProviderKind, parsed: &serde_json::Value) -> Vec<String> {
    let mut ids = Vec::new();
    match provider {
        ProviderKind::Gemini => {
            if let Some(models) = parsed.get("models").and_then(serde_json::Value::as_array) {
                for entry in models {
                    let supports_generate = entry
                        .get("supportedGenerationMethods")
                        .and_then(serde_json::Value::as_array)
                        .is_none_or(|methods| {
                            methods
                                .iter()
                                .any(|m| m.as_str() == Some("generateContent"))
                        });
                    if !supports_generate {
                        continue;
                    }
                    if let Some(raw_name) = entry.get("name").and_then(serde_json::Value::as_str) {
                        let candidate = raw_name.strip_prefix("models/").unwrap_or(raw_name).trim();
                        if validate_model_id(provider, candidate).is_ok() {
                            ids.push(candidate.to_string());
                        }
                    }
                }
            }
        }
        ProviderKind::Openai | ProviderKind::Anthropic | ProviderKind::Ollama => {
            if let Some(data) = parsed.get("data").and_then(serde_json::Value::as_array) {
                for entry in data {
                    if let Some(id) = entry.get("id").and_then(serde_json::Value::as_str) {
                        let candidate = id.trim();
                        if validate_model_id(provider, candidate).is_ok() {
                            ids.push(candidate.to_string());
                        }
                    }
                }
            } else if let Some(models) = parsed.get("models").and_then(serde_json::Value::as_array)
            {
                for entry in models {
                    if let Some(name) = entry
                        .get("name")
                        .or_else(|| entry.get("model"))
                        .and_then(serde_json::Value::as_str)
                    {
                        let candidate = name.trim();
                        if validate_model_id(provider, candidate).is_ok() {
                            ids.push(candidate.to_string());
                        }
                    }
                }
            }
        }
        ProviderKind::Copilot => {}
    }
    ids.sort();
    ids.dedup();
    ids
}
