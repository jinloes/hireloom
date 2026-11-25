import { invoke, isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import {
  aiSettingsSchema,
  COPILOT_MODELS,
  DEFAULT_MODELS_BY_PROVIDER,
  defaultAiSettings,
  importedStructureProposalSchema,
  MAX_WORKSPACE_BYTES,
  parseWorkspace,
  summaryOptionsProposalSchema,
  upgradeWorkspace,
  validateAprAnalysis,
  validateAprQuestionAnswers,
  validateAprRefinement,
  validateAprTarget,
  validateProposal,
  validateRoleTailorProposal,
  workspaceSchema,
  type AiProposal,
  type AiSettings,
  type AprAnalysis,
  type AprQuestionAnswer,
  type AprRefinement,
  type AprTarget,
  type ImportedStructureProposal,
  type ProviderKind,
  type Resume,
  type RoleTailorProposal,
  type SummaryOptionsProposal,
  type Workspace,
} from "./model";

export const desktop = isTauri();
export const STORAGE_KEY = "hireloom.workspace.v1";
export const AI_CANCELLED_MESSAGE = "AI request cancelled.";

export function isAiCancelledError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return message.trim() === AI_CANCELLED_MESSAGE;
}

export type CopilotStatus = {
  available: boolean;
  version: string | null;
  detail: string;
};

export type ProviderCredentialStatus = {
  provider: ProviderKind;
  configured: boolean;
  hasStoredKey: boolean;
  hasEnvKey: boolean;
};

export type AiProviderStatusResponse = {
  settings: AiSettings;
  copilot: CopilotStatus;
  providers: ProviderCredentialStatus[];
};

export async function loadWorkspace(): Promise<Workspace | null> {
  if (desktop) {
    const workspace = await invoke<unknown>("load_workspace");
    return workspace === null ? null : upgradeWorkspace(workspace);
  }
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === null ? null : parseWorkspace(saved);
}

export async function saveWorkspace(workspace: Workspace): Promise<void> {
  const data = workspaceSchema.parse(workspace);
  const text = JSON.stringify(data);
  if (new TextEncoder().encode(text).length > MAX_WORKSPACE_BYTES) {
    throw new Error(
      "Your workspace exceeds 2 MB. Export a backup and remove unused resumes.",
    );
  }
  if (desktop) {
    await invoke("save_workspace", { workspace: data });
  } else {
    localStorage.setItem(STORAGE_KEY, text);
  }
}

export async function exportDocument(
  blob: Blob,
  filename: string,
  kind: "pdf" | "docx" | "json",
): Promise<boolean> {
  if (desktop) {
    const contents = Array.from(new Uint8Array(await blob.arrayBuffer()));
    return invoke<boolean>("export_document", { filename, contents, kind });
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Keep the object URL alive long enough for WebKit to start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return true;
}

export async function aiProviderStatus(): Promise<AiProviderStatusResponse> {
  if (!desktop) {
    return {
      settings: defaultAiSettings(),
      copilot: {
        available: false,
        version: null,
        detail:
          "Copilot is available in the desktop app. Run npm run tauri dev to connect.",
      },
      providers: [
        {
          provider: "copilot",
          configured: false,
          hasStoredKey: false,
          hasEnvKey: false,
        },
        {
          provider: "openai",
          configured: false,
          hasStoredKey: false,
          hasEnvKey: false,
        },
        {
          provider: "anthropic",
          configured: false,
          hasStoredKey: false,
          hasEnvKey: false,
        },
        {
          provider: "gemini",
          configured: false,
          hasStoredKey: false,
          hasEnvKey: false,
        },
        {
          provider: "ollama",
          configured: false,
          hasStoredKey: false,
          hasEnvKey: false,
        },
      ],
    };
  }
  const raw = await invoke<AiProviderStatusResponse>("ai_provider_status");
  return {
    ...raw,
    settings: aiSettingsSchema.parse(raw.settings),
  };
}

export async function saveAiSettings(
  settings: AiSettings,
): Promise<AiSettings> {
  if (!desktop) {
    throw new Error("Open the desktop app to configure AI providers.");
  }
  const valid = aiSettingsSchema.parse(settings);
  return aiSettingsSchema.parse(
    await invoke<unknown>("save_ai_settings", { settings: valid }),
  );
}

export async function setProviderApiKey(
  provider: ProviderKind,
  apiKey: string,
): Promise<void> {
  if (!desktop) {
    throw new Error("Open the desktop app to save provider API keys.");
  }
  await invoke("set_provider_api_key", { provider, apiKey });
}

export async function clearProviderApiKey(
  provider: ProviderKind,
): Promise<void> {
  if (!desktop) {
    throw new Error("Open the desktop app to manage provider API keys.");
  }
  await invoke("clear_provider_api_key", { provider });
}

export async function listProviderModels(
  provider: ProviderKind,
  ollamaBaseUrl?: string,
): Promise<string[]> {
  if (!desktop) {
    return provider === "copilot"
      ? [...COPILOT_MODELS]
      : [DEFAULT_MODELS_BY_PROVIDER[provider]];
  }
  const raw = await invoke<unknown>("list_provider_models", {
    provider,
    ollamaBaseUrl: ollamaBaseUrl?.trim() ? ollamaBaseUrl.trim() : null,
  });
  return z.array(z.string().min(1).max(100)).parse(raw);
}

export async function copilotStatus(): Promise<CopilotStatus> {
  if (!desktop) {
    return {
      available: false,
      version: null,
      detail:
        "Copilot is available in the desktop app. Run npm run tauri dev to connect.",
    };
  }
  return invoke<CopilotStatus>("copilot_status");
}

export async function cancelAiRequest(): Promise<boolean> {
  if (!desktop) return false;
  return invoke<boolean>("cancel_ai_request");
}

export async function loginToCopilot(): Promise<void> {
  if (!desktop)
    throw new Error("Open the desktop app to sign in to GitHub Copilot.");
  await invoke("copilot_login");
}

export async function generateResume(
  resume: Resume,
  consent: boolean,
): Promise<AiProposal> {
  if (!desktop) throw new Error("AI generation requires the desktop app.");
  if (!consent)
    throw new Error(
      "Confirm that you want to send this content to your AI provider.",
    );
  return validateProposal(
    await invoke<unknown>("generate_resume", { resume, consent }),
    resume,
  );
}

export async function generateSummaryOptions(
  resume: Resume,
  consent: boolean,
): Promise<SummaryOptionsProposal> {
  if (!desktop) throw new Error("Summary generation requires the desktop app.");
  if (!consent)
    throw new Error(
      "Confirm that you want to send this content to your AI provider.",
    );
  return summaryOptionsProposalSchema.parse(
    await invoke<unknown>("generate_summary_options", { resume, consent }),
  );
}

export async function tailorExperienceRole(
  resume: Resume,
  entryId: string,
  consent: boolean,
): Promise<RoleTailorProposal> {
  if (!desktop) throw new Error("Role tailoring requires the desktop app.");
  if (!consent)
    throw new Error(
      "Confirm that you want to send this role to your AI provider.",
    );
  return validateRoleTailorProposal(
    await invoke<unknown>("tailor_experience_role", {
      resume,
      entryId,
      consent,
    }),
    resume,
    entryId,
  );
}

export async function structureImportedResume(
  redactedLines: string[],
  consent: boolean,
): Promise<ImportedStructureProposal> {
  if (!desktop) throw new Error("AI import cleanup requires the desktop app.");
  if (!consent)
    throw new Error(
      "Confirm that you want to send redacted text lines to your AI provider.",
    );
  return importedStructureProposalSchema.parse(
    await invoke<unknown>("structure_imported_resume", {
      redactedLines,
      consent,
    }),
  );
}

export async function analyzeAccomplishment(
  target: AprTarget,
  consent: boolean,
): Promise<AprAnalysis> {
  if (!desktop) throw new Error("APR analysis requires the desktop app.");
  if (!consent)
    throw new Error(
      "Confirm that you want to send this accomplishment to your AI provider.",
    );
  const validTarget = validateAprTarget(target);
  return validateAprAnalysis(
    await invoke<unknown>("analyze_accomplishment", {
      ...validTarget,
      consent,
    }),
    validTarget,
  );
}

export async function refineAccomplishment(
  target: AprTarget,
  questions: string[],
  answers: AprQuestionAnswer[],
  consent: boolean,
): Promise<AprRefinement> {
  if (!desktop) throw new Error("APR refinement requires the desktop app.");
  if (!consent)
    throw new Error(
      "Confirm that you want to send these answers to your AI provider.",
    );
  const validTarget = validateAprTarget(target);
  const validAnswers = validateAprQuestionAnswers(questions, answers);
  return validateAprRefinement(
    await invoke<unknown>("refine_accomplishment", {
      target: validTarget,
      questions,
      answers: validAnswers,
      consent,
    }),
    validTarget,
    validAnswers,
  );
}
