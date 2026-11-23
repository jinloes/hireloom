import { useState } from "react";
import {
  Bot,
  Cpu,
  Github,
  KeyRound,
  LoaderCircle,
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

export function ProviderConnectionCard({
  status,
  aiSettings,
  providerStates,
  providerReady,
  busy,
  defaultExpanded = false,
  onRefresh,
  onLogin,
  onSaveAiSettings,
  onSaveApiKey,
  onClearApiKey,
}: {
  status: CopilotStatus | null;
  aiSettings: AiSettings;
  providerStates: ProviderCredentialStatus[];
  providerReady: boolean;
  busy: AiBusyKind;
  defaultExpanded?: boolean;
  onRefresh: () => void;
  onLogin: () => void;
  onSaveAiSettings?: (next: AiSettings) => void;
  onSaveApiKey?: (provider: ProviderKind, apiKey: string) => void;
  onClearApiKey?: (provider: ProviderKind) => void;
}) {
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const activeProvider = aiSettings.primaryProvider;
  const activeProviderLabel = PROVIDER_LABELS[activeProvider];
  const activeProviderInfo = providerStates.find(
    (item) => item.provider === activeProvider,
  );

  const updateSettings = (patch: Partial<AiSettings>) => {
    if (!onSaveAiSettings) return;
    onSaveAiSettings({ ...aiSettings, ...patch });
  };

  const switchPrimaryProvider = (provider: ProviderKind) => {
    setApiKeyDraft("");
    updateSettings({
      primaryProvider: provider,
      primaryModel: DEFAULT_MODELS_BY_PROVIDER[provider],
    });
  };

  const switchVerifierProvider = (provider: ProviderKind) => {
    updateSettings({
      verifierProvider: provider,
      verifierModel:
        provider === "copilot"
          ? "gpt-6.1-terra"
          : DEFAULT_MODELS_BY_PROVIDER[provider],
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

          {aiSettings.primaryProvider === "copilot" ? (
            <div className="field">
              <label htmlFor="primary-model-select">Primary AI model</label>
              <select
                id="primary-model-select"
                value={aiSettings.primaryModel}
                disabled={!desktop || Boolean(busy)}
                onChange={(e) =>
                  updateSettings({ primaryModel: e.target.value })
                }
              >
                {COPILOT_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <Field
              label="Primary AI model"
              value={aiSettings.primaryModel}
              onChange={(primaryModel) =>
                updateSettings({
                  primaryModel: primaryModel.trim() || aiSettings.primaryModel,
                })
              }
              maxLength={100}
              placeholder={
                DEFAULT_MODELS_BY_PROVIDER[aiSettings.primaryProvider]
              }
            />
          )}

          {aiSettings.primaryProvider === "ollama" && (
            <Field
              label="Compatible endpoint URL"
              value={aiSettings.ollamaBaseUrl}
              onChange={(ollamaBaseUrl) =>
                updateSettings({
                  ollamaBaseUrl:
                    ollamaBaseUrl.trim() || "http://127.0.0.1:11434/v1",
                })
              }
              maxLength={300}
              placeholder="http://127.0.0.1:11434/v1"
              hint="HTTP is allowed for localhost/127.0.0.1; remote endpoints require HTTPS."
            />
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
                {aiSettings.verifierProvider === "copilot" ? (
                  <div className="field">
                    <label htmlFor="verifier-model-select">
                      Verifier model
                    </label>
                    <select
                      id="verifier-model-select"
                      value={aiSettings.verifierModel}
                      disabled={!desktop || Boolean(busy)}
                      onChange={(e) =>
                        updateSettings({ verifierModel: e.target.value })
                      }
                    >
                      {COPILOT_MODELS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <Field
                    label="Verifier model"
                    value={aiSettings.verifierModel}
                    onChange={(verifierModel) =>
                      updateSettings({
                        verifierModel:
                          verifierModel.trim() || aiSettings.verifierModel,
                      })
                    }
                    maxLength={100}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
