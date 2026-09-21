import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  type AprAnalysis,
  type AprRefinement,
  type AprTarget,
  type AiProposal,
  type HighlightReview,
  type HighlightReviews,
  type Resume,
  type Workspace,
  MAX_WORKSPACE_BYTES,
  parseWorkspace,
  validateAprAnalysis,
  validateAprTarget,
  highlightReviewSchema,
  validateHighlightReviews,
  validateProposal,
  aprRefinementSchema,
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
  review: HighlightReview | null = null,
): Promise<AprAnalysis> {
  if (!desktop) throw new Error("APR analysis requires the desktop app.");
  if (!consent)
    throw new Error(
      "Confirm that you want to send this accomplishment to Copilot.",
    );
  const validTarget = validateAprTarget(target);
  const validReview =
    review === null ? null : highlightReviewSchema.parse(review);
  if (
    validReview &&
    (validReview.target.resumeId !== validTarget.resumeId ||
      validReview.target.experienceId !== validTarget.experienceId ||
      validReview.target.bulletIndex !== validTarget.bulletIndex ||
      validReview.target.role !== validTarget.role ||
      validReview.target.bullet !== validTarget.bullet)
  ) {
    throw new Error(
      "Highlight review does not match the selected accomplishment.",
    );
  }
  if (
    validReview &&
    validReview.action === "clear" &&
    validReview.project === "clear" &&
    validReview.result === "clear"
  ) {
    throw new Error(
      "Highlight review must identify at least one weak dimension.",
    );
  }
  return validateAprAnalysis(
    await invoke<unknown>("analyze_accomplishment", {
      ...validTarget,
      ...(validReview ? { review: validReview } : {}),
      consent,
    }),
    validTarget,
  );
}

export async function reviewHighlights(
  targets: AprTarget[],
  consent: boolean,
): Promise<HighlightReviews> {
  if (!desktop) throw new Error("Highlight review requires the desktop app.");
  if (!consent)
    throw new Error(
      "Confirm that you want to send these highlights to GitHub Copilot.",
    );
  const validTargets = targets.map((target) => validateAprTarget(target));
  if (validTargets.length === 0)
    throw new Error("Add at least one highlight before requesting a review.");
  return validateHighlightReviews(
    await invoke<unknown>("review_highlights", {
      targets: validTargets,
      consent,
    }),
    validTargets,
  );
}

export async function refineAccomplishment(
  refinement: AprRefinement,
  consent: boolean,
): Promise<AprAnalysis> {
  if (!desktop) throw new Error("APR refinement requires the desktop app.");
  if (!consent)
    throw new Error(
      "Confirm that you want to send this feedback to GitHub Copilot.",
    );
  const valid = aprRefinementSchema.parse(refinement);
  return validateAprAnalysis(
    await invoke<unknown>("refine_accomplishment", {
      ...valid.target,
      options: valid.options,
      feedback: valid.feedback,
      consent,
    }),
    valid.target,
  );
}
