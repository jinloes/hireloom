import { fireEvent, screen } from "@testing-library/react";
import { vi } from "vitest";
import {
  exampleResume,
  type AprAnalysis,
  type AprTarget,
  type Workspace,
} from "../model";

export function platformMock() {
  return {
    desktop: true,
    loadWorkspace: vi.fn(),
    saveWorkspace: vi.fn().mockResolvedValue(undefined),
    copilotStatus: vi.fn().mockResolvedValue({
      available: true,
      version: "test-cli",
      detail: "CLI installed; sign-in not verified.",
    }),
    analyzeAccomplishment: vi.fn(),
    refineAccomplishment: vi.fn(),
    reviewHighlights: vi.fn(),
    generateResume: vi.fn(),
    loginToCopilot: vi.fn(),
  };
}

export function tauriWindowMock() {
  return {
    getCurrentWindow: () => ({
      onCloseRequested: vi.fn().mockResolvedValue(() => undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

export let workspace: Workspace;

export function setupAppHarness(platform: typeof import("../platform")) {
  vi.clearAllMocks();
  const resume = exampleResume();
  workspace = { version: 2, activeResumeId: resume.id, resumes: [resume] };
  vi.mocked(platform.loadWorkspace).mockResolvedValue(workspace);
  vi.mocked(platform.saveWorkspace).mockResolvedValue(undefined);
  vi.mocked(platform.copilotStatus).mockResolvedValue({
    available: true,
    version: "test-cli",
    detail: "CLI installed; sign-in not verified.",
  });
}

export function openContentSection(name: string) {
  const tabName =
    name === "Personal details"
      ? "Personal"
      : name === "Professional summary"
        ? "Summary"
        : name;
  fireEvent.click(screen.getByRole("tab", { name: tabName }));
}

export function aprResult(
  target: AprTarget,
  overrides: Partial<Omit<AprAnalysis, "target">> = {},
): AprAnalysis {
  return {
    target,
    action: { status: "clear", feedback: "Specific action." },
    project: { status: "partial", feedback: "Add project context." },
    result: { status: "missing", feedback: "Add supported impact." },
    options: [
      { id: "concise", bullets: ["Led a focused onboarding redesign."] },
      {
        id: "detail-forward",
        bullets: ["Led a focused onboarding redesign through user research."],
      },
    ],
    ...overrides,
  };
}
