import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  type AprAnalysis,
  type AprQuestionAnswer,
  type AprRefinement,
  type AprTarget,
  type AiProposal,
  type Resume,
  type Workspace,
  MAX_WORKSPACE_BYTES,
  parseWorkspace,
  validateAprAnalysis,
  validateAprQuestionAnswers,
  validateAprRefinement,
  validateAprTarget,
  validateProposal,
  workspaceSchema,
} from "./model";

export const desktop = isTauri();
export const STORAGE_KEY = "hireloom.workspace.v1";

export type CopilotStatus = {
  available: boolean;
  version: string | null;
  detail: string;
};

export async function loadWorkspace(): Promise<Workspace | null> {
  if (desktop) {
    const workspace = await invoke<unknown>("load_workspace");
    return workspace === null ? null : workspaceSchema.parse(workspace);
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
  kind: "pdf" | "json",
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

export async function loginToCopilot(): Promise<void> {
  if (!desktop)
    throw new Error("Open the desktop app to sign in to GitHub Copilot.");
  await invoke("copilot_login");
}

export async function generateResume(
  resume: Resume,
  consent: boolean,
): Promise<AiProposal> {
  if (!desktop) throw new Error("Copilot generation requires the desktop app.");
  if (!consent)
    throw new Error("Confirm that you want to send this content to Copilot.");
  return validateProposal(
    await invoke<unknown>("generate_resume", { resume, consent }),
    resume,
  );
}

export async function analyzeAccomplishment(
  target: AprTarget,
  consent: boolean,
): Promise<AprAnalysis> {
  if (!desktop) throw new Error("APR analysis requires the desktop app.");
  if (!consent)
    throw new Error(
      "Confirm that you want to send this accomplishment to Copilot.",
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
    throw new Error("Confirm that you want to send these answers to Copilot.");
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
