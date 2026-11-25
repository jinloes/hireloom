import { useState } from "react";
import {
  Bot,
  Cpu,
  Github,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  COPILOT_MODELS,
  DEFAULT_MODELS_BY_PROVIDER,
  PROVIDER_LABELS,
  type AiSettings,
  type ProviderKind,
} from "../../model";
import {
  desktop,
  type CopilotStatus,
  type ProviderCredentialStatus,
} from "../../platform";
import { Field } from "../Editor";
import type { AiBusyKind } from "./ProposalPrimitives";

function mergeModelOptions(
  fetched: readonly string[] | undefined,
  currentModel: string,
  fallback: readonly string[] = [],
): string[] {
  const base = fetched && fetched.length > 0 ? [...fetched] : [...fallback];
  if (base.length === 0) return [];
  if (currentModel && !base.includes(currentModel)) {
    return [currentModel, ...base];
  }
  return base;
}

export function ProviderConnectionCard({
  status,
  aiSettings,
  providerStates,
  availableModelsByProvider = {},
  modelsLoading = {},
  modelsError = {},
  providerReady,
  busy,
  defaultExpanded = false,
  onRefresh,
  onRefreshModels,
  onLogin,
  onSaveAiSettings,
  onSaveApiKey,
  onClearApiKey,
}: {
  status: CopilotStatus | null;
  aiSettings: AiSettings;
  providerStates: ProviderCredentialStatus[];
  availableModelsByProvider?: Partial<Record<ProviderKind, string[]>>;
  modelsLoading?: Partial<Record<ProviderKind, boolean>>;
  modelsError?: Partial<Record<ProviderKind, string>>;
  providerReady: boolean;
  busy: AiBusyKind;
  defaultExpanded?: boolean;
  onRefresh: () => void;
  onRefreshModels?: (provider: ProviderKind, ollamaBaseUrl?: string) => void;
  onLogin: () => void;
  onSaveAiSettings?: (next: AiSettings) => void;
  onSaveApiKey?: (provider: ProviderKind, apiKey: string) => void;
  onClearApiKey?: (provider: ProviderKind) => void;
}) {
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [primaryModelDraft, setPrimaryModelDraft] = useState(
    aiSettings.primaryModel,
  );
  const [prevPrimaryModel, setPrevPrimaryModel] = useState(
    aiSettings.primaryModel,
  );
  if (aiSettings.primaryModel !== prevPrimaryModel) {
    setPrevPrimaryModel(aiSettings.primaryModel);
    setPrimaryModelDraft(aiSettings.primaryModel);
  }

  const [verifierModelDraft, setVerifierModelDraft] = useState(
    aiSettings.verifierModel,
  );
  const [prevVerifierModel, setPrevVerifierModel] = useState(
    aiSettings.verifierModel,
  );
  if (aiSettings.verifierModel !== prevVerifierModel) {
    setPrevVerifierModel(aiSettings.verifierModel);
    setVerifierModelDraft(aiSettings.verifierModel);
  }

  const [ollamaUrlDraft, setOllamaUrlDraft] = useState(
    aiSettings.ollamaBaseUrl,
  );
  const [prevOllamaUrl, setPrevOllamaUrl] = useState(aiSettings.ollamaBaseUrl);
  if (aiSettings.ollamaBaseUrl !== prevOllamaUrl) {
    setPrevOllamaUrl(aiSettings.ollamaBaseUrl);
    setOllamaUrlDraft(aiSettings.ollamaBaseUrl);
  }

  const activeProvider = aiSettings.primaryProvider;
  const activeProviderLabel = PROVIDER_LABELS[activeProvider];
  const activeProviderInfo = providerStates.find(
    (item) => item.provider === activeProvider,
  );
  const primaryModelOptions = mergeModelOptions(
    availableModelsByProvider[activeProvider],
    aiSettings.primaryModel,
    activeProvider === "copilot" ? COPILOT_MODELS : [],
  );
  const verifierModelOptions = mergeModelOptions(
    availableModelsByProvider[aiSettings.verifierProvider],
    aiSettings.verifierModel,
    aiSettings.verifierProvider === "copilot" ? COPILOT_MODELS : [],
  );
  const primaryModelsLoading = Boolean(modelsLoading[activeProvider]);
  const primaryModelsError = modelsError[activeProvider];
  const verifierModelsLoading = Boolean(
    modelsLoading[aiSettings.verifierProvider],
  );
  const verifierModelsError = modelsError[aiSettings.verifierProvider];

  const updateSettings = (patch: Partial<AiSettings>) => {
    if (!onSaveAiSettings) return;
    onSaveAiSettings({ ...aiSettings, ...patch });
  };

  const commitPrimaryModelDraft = () => {
    const trimmed = primaryModelDraft.trim();
    if (!trimmed) {
      setPrimaryModelDraft(aiSettings.primaryModel);
      return;
    }
    if (trimmed !== aiSettings.primaryModel) {
      updateSettings({ primaryModel: trimmed });
    }
  };

  const commitVerifierModelDraft = () => {
    const trimmed = verifierModelDraft.trim();
    if (!trimmed) {
      setVerifierModelDraft(aiSettings.verifierModel);
      return;
    }
    if (trimmed !== aiSettings.verifierModel) {
      updateSettings({ verifierModel: trimmed });
    }
  };

  const commitOllamaUrlDraft = () => {
    const trimmed = ollamaUrlDraft.trim();
    if (!trimmed) {
      setOllamaUrlDraft(aiSettings.ollamaBaseUrl);
      return;
    }
    if (trimmed !== aiSettings.ollamaBaseUrl) {
      updateSettings({ ollamaBaseUrl: trimmed });
    }
  };

  const switchPrimaryProvider = (provider: ProviderKind) => {
    setApiKeyDraft("");
    const fetched = availableModelsByProvider[provider];
    const nextModel =
      fetched && fetched.length > 0
        ? fetched.includes(DEFAULT_MODELS_BY_PROVIDER[provider])
          ? DEFAULT_MODELS_BY_PROVIDER[provider]
          : fetched[0]
        : DEFAULT_MODELS_BY_PROVIDER[provider];
    updateSettings({
      primaryProvider: provider,
      primaryModel: nextModel,
    });
  };

  const switchVerifierProvider = (provider: ProviderKind) => {
    const fetched = availableModelsByProvider[provider];
    const defaultModel =
      provider === "copilot"
        ? "gpt-6.1-terra"
        : DEFAULT_MODELS_BY_PROVIDER[provider];
    const nextModel =
      fetched && fetched.length > 0
        ? fetched.includes(defaultModel)
          ? defaultModel
          : fetched[0]
        : defaultModel;
    updateSettings({
      verifierProvider: provider,
      verifierModel: nextModel,
    });
  };

  return (
    <div className="connection-card">
      <div className="connection-heading">
        {activeProvider === "copilot" ? (
          <Github size={20} />
        ) : activeProvider === "ollama" ? (
          <Cpu size={20} />
        ) : (
          <Bot size={20} />
        )}
        <strong>{activeProviderLabel}</strong>
        <code className="model-pill">{aiSettings.primaryModel}</code>
        <span
          className={`status-dot ${providerReady ? "available" : ""}`}
          role="img"
          aria-label={
            providerReady ? "Provider ready" : "Provider not configured"
          }
        />
      </div>

      {activeProvider === "copilot" ? (
        <>
          <p>{status?.detail ?? "Checking the local Copilot CLI…"}</p>
          {status?.version && (
            <code className="cli-version">{status.version}</code>
          )}
          <div className="button-row">
            <button
              type="button"
              className="button secondary small"
              disabled={!desktop || !status?.available || Boolean(busy)}
              onClick={onLogin}
            >
              {busy === "login" ? (
                <LoaderCircle className="spin" size={14} />
              ) : (
                <Github size={14} />
              )}
              {busy === "login"
                ? "Waiting for sign-in…"
                : "Sign in with GitHub"}
            </button>
            <button
              type="button"
              className="text-button"
              disabled={Boolean(busy)}
              onClick={onRefresh}
            >
              Refresh
            </button>
          </div>
          <p className="fine-print">
            CLI installed does not mean signed in. A Copilot-enabled account and
            available usage are required.
          </p>
        </>
      ) : (
        <p>
          {!desktop
            ? "AI providers are available in the desktop app. Run npm run tauri dev to connect."
            : activeProvider === "ollama"
              ? `Connected to ${aiSettings.ollamaBaseUrl}. Local Ollama runs offline on your machine without requiring an API key.`
              : activeProviderInfo?.hasStoredKey
                ? "API key stored in your OS credential store."
                : activeProviderInfo?.hasEnvKey
                  ? "API key detected via environment variable."
                  : "Save an API key in Provider & model settings below (stored in your OS credential store, never in workspace backups)."}
        </p>
      )}

      <details className="provider-settings-details" open={defaultExpanded}>
        <summary>
          <Settings2 size={14} /> Provider, model &amp; 2-model verification
        </summary>
        <div className="provider-settings-body">
          <div className="field">
            <label htmlFor="primary-provider-select">Primary AI provider</label>
            <select
              id="primary-provider-select"
              value={aiSettings.primaryProvider}
              disabled={!desktop || Boolean(busy)}
              onChange={(e) =>
                switchPrimaryProvider(e.target.value as ProviderKind)
              }
            >
              {(Object.keys(PROVIDER_LABELS) as ProviderKind[]).map((key) => (
                <option key={key} value={key}>
                  {PROVIDER_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <div className="model-field-header">
              <label htmlFor="primary-model-select">Primary AI model</label>
              {onRefreshModels && (
                <button
                  type="button"
                  className="text-button model-refresh-btn"
                  disabled={!desktop || Boolean(busy) || primaryModelsLoading}
                  onClick={() =>
                    onRefreshModels(
                      activeProvider,
                      activeProvider === "ollama"
                        ? ollamaUrlDraft.trim() || aiSettings.ollamaBaseUrl
                        : undefined,
                    )
                  }
                >
                  {primaryModelsLoading ? (
                    <LoaderCircle className="spin" size={12} />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  {primaryModelsLoading ? "Loading…" : "Refresh models"}
                </button>
              )}
            </div>
            {primaryModelOptions.length > 0 ? (
              <select
                id="primary-model-select"
                value={aiSettings.primaryModel}
                disabled={!desktop || Boolean(busy)}
                onChange={(e) =>
                  updateSettings({ primaryModel: e.target.value })
                }
              >
                {primaryModelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="primary-model-select"
                type="text"
                value={primaryModelDraft}
                disabled={!desktop || Boolean(busy)}
                maxLength={100}
                placeholder={
                  DEFAULT_MODELS_BY_PROVIDER[aiSettings.primaryProvider]
                }
                onChange={(e) => setPrimaryModelDraft(e.target.value)}
                onBlur={commitPrimaryModelDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitPrimaryModelDraft();
                  }
                }}
              />
            )}
            {primaryModelsError && (
              <p className="fine-print" role="status">
                Could not refresh models: {primaryModelsError}
              </p>
            )}
          </div>

          {aiSettings.primaryProvider === "ollama" && (
            <div className="field">
              <label htmlFor="ollama-base-url-input">
                Compatible endpoint URL
              </label>
              <input
                id="ollama-base-url-input"
                type="text"
                value={ollamaUrlDraft}
                disabled={!desktop || Boolean(busy)}
                maxLength={300}
                placeholder="http://127.0.0.1:11434/v1"
                onChange={(e) => setOllamaUrlDraft(e.target.value)}
                onBlur={commitOllamaUrlDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitOllamaUrlDraft();
                  }
                }}
              />
              <span className="field-hint">
                HTTP is allowed for localhost/127.0.0.1; remote endpoints
                require HTTPS.
              </span>
            </div>
          )}

          {aiSettings.primaryProvider !== "copilot" && (
            <div className="api-key-box">
              <Field
                label={`${PROVIDER_LABELS[aiSettings.primaryProvider]} key${aiSettings.primaryProvider === "ollama" ? " (optional)" : ""}`}
                type="password"
                value={apiKeyDraft}
                onChange={setApiKeyDraft}
                maxLength={512}
                placeholder={
                  activeProviderInfo?.hasStoredKey
                    ? "•••••••• (saved in OS credential store)"
                    : "Paste API key"
                }
              />
              <div className="button-row">
                <button
                  type="button"
                  className="button secondary small"
                  disabled={
                    !desktop ||
                    !apiKeyDraft.trim() ||
                    Boolean(busy) ||
                    !onSaveApiKey
                  }
                  onClick={() => {
                    onSaveApiKey?.(
                      aiSettings.primaryProvider,
                      apiKeyDraft.trim(),
                    );
                    setApiKeyDraft("");
                  }}
                >
                  <KeyRound size={13} /> Save key
                </button>
                {activeProviderInfo?.hasStoredKey && onClearApiKey && (
                  <button
                    type="button"
                    className="text-button danger-text"
                    disabled={!desktop || Boolean(busy)}
                    onClick={() => onClearApiKey(aiSettings.primaryProvider)}
                  >
                    <Trash2 size={12} /> Remove saved key
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="verifier-settings-block">
            <div className="proposal-item-header">
              <strong>Second-model factual grounding check</strong>
              <button
                type="button"
                className="pill-toggle"
                aria-pressed={aiSettings.verifierEnabled}
                aria-label="Second-model factual grounding check"
                disabled={!desktop || Boolean(busy)}
                onClick={() =>
                  updateSettings({
                    verifierEnabled: !aiSettings.verifierEnabled,
                  })
                }
              >
                {aiSettings.verifierEnabled ? "Enabled" : "Off"}
              </button>
            </div>
            <p className="fine-print">
              Audits every suggested rewrite with an independent model to flag
              inferred or unsupported claims. Degrades gracefully if the
              verifier is unavailable.
            </p>
            {aiSettings.verifierEnabled && (
              <div className="field-grid">
                <div className="field">
                  <label htmlFor="verifier-provider-select">
                    Verifier provider
                  </label>
                  <select
                    id="verifier-provider-select"
                    value={aiSettings.verifierProvider}
                    disabled={!desktop || Boolean(busy)}
                    onChange={(e) =>
                      switchVerifierProvider(e.target.value as ProviderKind)
                    }
                  >
                    {(Object.keys(PROVIDER_LABELS) as ProviderKind[]).map(
                      (key) => (
                        <option key={key} value={key}>
                          {PROVIDER_LABELS[key]}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div className="field">
                  <div className="model-field-header">
                    <label htmlFor="verifier-model-select">
                      Verifier model
                    </label>
                    {onRefreshModels && (
                      <button
                        type="button"
                        className="text-button model-refresh-btn"
                        aria-label="Refresh verifier models"
                        disabled={
                          !desktop || Boolean(busy) || verifierModelsLoading
                        }
                        onClick={() =>
                          onRefreshModels(
                            aiSettings.verifierProvider,
                            aiSettings.verifierProvider === "ollama"
                              ? ollamaUrlDraft.trim() ||
                                  aiSettings.ollamaBaseUrl
                              : undefined,
                          )
                        }
                      >
                        {verifierModelsLoading ? (
                          <LoaderCircle className="spin" size={12} />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                      </button>
                    )}
                  </div>
                  {verifierModelOptions.length > 0 ? (
                    <select
                      id="verifier-model-select"
                      value={aiSettings.verifierModel}
                      disabled={!desktop || Boolean(busy)}
                      onChange={(e) =>
                        updateSettings({ verifierModel: e.target.value })
                      }
                    >
                      {verifierModelOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="verifier-model-select"
                      type="text"
                      value={verifierModelDraft}
                      disabled={!desktop || Boolean(busy)}
                      maxLength={100}
                      placeholder={
                        DEFAULT_MODELS_BY_PROVIDER[aiSettings.verifierProvider]
                      }
                      onChange={(e) => setVerifierModelDraft(e.target.value)}
                      onBlur={commitVerifierModelDraft}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitVerifierModelDraft();
                        }
                      }}
                    />
                  )}
                  {verifierModelsError && (
                    <p className="fine-print" role="status">
                      Could not refresh verifier models: {verifierModelsError}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
