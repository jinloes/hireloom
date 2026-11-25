import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  defaultAiSettings,
  emptyCareerLibrary,
  exampleResume,
  WORKSPACE_VERSION,
  type Workspace,
} from "./model";
import * as platform from "./platform";
import App from "./App";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onCloseRequested: vi.fn().mockResolvedValue(() => undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("./platform", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./platform")>();
  return {
    ...actual,
    desktop: true,
    loadWorkspace: vi.fn(),
    saveWorkspace: vi.fn().mockResolvedValue(undefined),
    aiProviderStatus: vi.fn(),
    saveAiSettings: vi.fn(),
    setProviderApiKey: vi.fn(),
    clearProviderApiKey: vi.fn(),
    listProviderModels: vi.fn(),
    copilotStatus: vi.fn().mockResolvedValue({
      available: true,
      version: "test-cli",
      detail: "CLI installed; sign-in not verified.",
    }),
    analyzeAccomplishment: vi.fn(),
    refineAccomplishment: vi.fn(),
    generateResume: vi.fn(),
    generateSummaryOptions: vi.fn(),
    tailorExperienceRole: vi.fn(),
    structureImportedResume: vi.fn(),
    loginToCopilot: vi.fn(),
    cancelAiRequest: vi.fn().mockResolvedValue(undefined),
  };
});

let workspace: Workspace;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  const resume = exampleResume();
  workspace = {
    version: WORKSPACE_VERSION,
    activeResumeId: resume.id,
    resumes: [resume],
    careerLibrary: emptyCareerLibrary(),
  };
  vi.mocked(platform.loadWorkspace).mockResolvedValue(workspace);
  vi.mocked(platform.saveWorkspace).mockResolvedValue(undefined);
  vi.mocked(platform.listProviderModels).mockResolvedValue([
    "claude-sonnet-5.5",
    "gpt-6.1-terra",
    "gpt-6.2-sol",
    "gpt-6-luna",
    "claude-haiku-5.5",
  ]);
  const copilot = {
    available: true,
    version: "test-cli",
    detail: "CLI installed; sign-in not verified.",
  };
  vi.mocked(platform.copilotStatus).mockResolvedValue(copilot);
  vi.mocked(platform.aiProviderStatus).mockResolvedValue({
    settings: defaultAiSettings(),
    copilot,
    providers: [
      {
        provider: "copilot",
        configured: true,
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
        configured: true,
        hasStoredKey: false,
        hasEnvKey: false,
      },
    ],
  });
  vi.mocked(platform.saveAiSettings).mockImplementation(async (next) => next);
  vi.mocked(platform.setProviderApiKey).mockResolvedValue(undefined);
  vi.mocked(platform.clearProviderApiKey).mockResolvedValue(undefined);
});

describe("resume studio", () => {
  it("does not overwrite a failed load", async () => {
    vi.mocked(platform.loadWorkspace).mockRejectedValue(
      new Error("Corrupt workspace"),
    );
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Corrupt workspace",
    );
    expect(platform.saveWorkspace).not.toHaveBeenCalled();
  });

  it("persists edits and surfaces failed saves with recovery actions", async () => {
    vi.mocked(platform.saveWorkspace).mockRejectedValue(new Error("Disk full"));
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Full name"), {
      target: { value: "Taylor Example" },
    });
    expect(
      await screen.findByText("Your latest changes are not saved."),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Disk full");
    expect(
      screen.getByRole("button", { name: "Export recovery backup" }),
    ).toBeVisible();
    vi.mocked(platform.saveWorkspace).mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    await waitFor(() =>
      expect(
        screen.queryByText("Your latest changes are not saved."),
      ).not.toBeInTheDocument(),
    );
  });

  it("requires consent and review, detects stale proposals, and supports undo", async () => {
    const original = workspace.resumes[0];
    const proposal = {
      summary: "A reviewed, stronger summary.",
      experience: original.experience.map((entry) => ({
        id: entry.id,
        bullets: ["A truthful improvement."],
      })),
      notes: ["Check every claim."],
    };
    vi.mocked(platform.generateResume).mockResolvedValue(proposal);
    render(<App />);
    fireEvent.click(await screen.findByRole("tab", { name: "Tailor & Coach" }));
    const generate = screen.getByRole("button", { name: "Polish my resume" });
    await waitFor(() =>
      expect(
        screen.queryByText("Checking the local Copilot CLI…"),
      ).not.toBeInTheDocument(),
    );
    expect(generate).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(generate);
    await screen.findByRole("region", { name: "Copilot suggestions" });
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      original.summary,
    );
    expect(platform.generateResume).toHaveBeenCalledWith(original, true);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    fireEvent.change(screen.getByLabelText("Job description"), {
      target: { value: "A changed role" },
    });
    expect(
      screen.getByRole("button", { name: "Apply reviewed suggestions" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(
      screen.getByRole("button", { name: "Tailor to this role" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Apply reviewed suggestions" }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Apply reviewed suggestions" }),
    );
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      proposal.summary,
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo AI changes" }));
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      original.summary,
    );
  });

  it("keeps content intact when Copilot fails", async () => {
    vi.mocked(platform.generateResume).mockRejectedValue(
      new Error("Authentication required"),
    );
    render(<App />);
    fireEvent.click(await screen.findByRole("tab", { name: "Tailor & Coach" }));
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Polish my resume" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Polish my resume" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Authentication required",
    );
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      workspace.resumes[0].summary,
    );
  });

  it("analyzes one accomplishment, isolates consent, and applies and undoes only its rewrite", async () => {
    const original = workspace.resumes[0];
    const originalBullet = original.experience[0].bullets[0];
    const rewrite =
      "Led an onboarding redesign using research, prototypes, and usability testing.";
    vi.mocked(platform.analyzeAccomplishment).mockImplementation(
      async (target) => ({
        target,
        action: { status: "clear", feedback: "Uses a specific action verb." },
        project: {
          status: "clear",
          feedback: "Names the onboarding redesign.",
        },
        result: {
          status: "missing",
          feedback: "Add a supported outcome if one is known.",
        },
        rewrite,
        questions: ["What changed for customers after the redesign?"],
      }),
    );
    render(<App />);
    fireEvent.click(await screen.findByRole("tab", { name: "Tailor & Coach" }));
    await waitFor(() =>
      expect(
        screen.queryByText("Checking the local Copilot CLI…"),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /APR Bullet Coach/ }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Analyze with APR" })[0],
    );
    expect(
      screen.getAllByText(originalBullet, { exact: true }).length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Only this bullet and the role/)).toBeVisible();

    const aprConsent = screen.getByRole("checkbox", {
      name: /Send this selected bullet and role/,
    });
    const confirm = screen.getByRole("button", {
      name: "Confirm APR analysis",
    });
    expect(confirm).toBeDisabled();
    fireEvent.click(aprConsent);
    fireEvent.click(confirm);

    await screen.findByRole("region", { name: "APR analysis" });
    expect(platform.analyzeAccomplishment).toHaveBeenCalledWith(
      {
        resumeId: original.id,
        experienceId: original.experience[0].id,
        bulletIndex: 0,
        role: original.experience[0].role,
        bullet: originalBullet,
      },
      true,
    );
    expect(aprConsent).not.toBeChecked();
    expect(screen.getByText("missing", { exact: true })).toBeVisible();
    expect(screen.getByText(/What changed for customers/)).toBeVisible();
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      originalBullet,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Content" }));
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "A changed unsent name" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Tailor & Coach" }));
    const apply = screen.getByRole("button", { name: "Apply initial rewrite" });
    expect(apply).toBeEnabled();
    fireEvent.click(apply);
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(rewrite);
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      original.experience[0].bullets[1],
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo AI changes" }));
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      originalBullet,
    );
  });

  it("keeps a completed APR result visible and stale when switching resumes", async () => {
    const resumeA = workspace.resumes[0];
    const resumeB = {
      ...exampleResume(),
      id: "resume-b",
      title: "Resume B",
      basics: {
        ...exampleResume().basics,
        name: "Resume B Candidate",
      },
      experience: exampleResume().experience.map((experience, index) => ({
        ...experience,
        id: `resume-b-experience-${index}`,
        bullets:
          index === 0
            ? ["Resume B accomplishment that must remain unchanged."]
            : experience.bullets,
      })),
    };
    workspace = {
      ...workspace,
      resumes: [resumeA, resumeB],
    };
    vi.mocked(platform.loadWorkspace).mockResolvedValue(workspace);
    const rewrite = "APR rewrite for resume A.";
    vi.mocked(platform.analyzeAccomplishment).mockImplementation(
      async (target) => ({
        target,
        action: { status: "clear", feedback: "Specific action." },
        project: { status: "partial", feedback: "Needs more context." },
        result: { status: "missing", feedback: "Needs supported impact." },
        rewrite,
        questions: [],
      }),
    );

    render(<App />);
    fireEvent.click(await screen.findByRole("tab", { name: "Tailor & Coach" }));
    await waitFor(() =>
      expect(
        screen.queryByText("Checking the local Copilot CLI…"),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /APR Bullet Coach/ }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Analyze with APR" })[0],
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Send this selected bullet and role/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm APR analysis" }),
    );
    await screen.findByRole("region", { name: "APR analysis" });

    fireEvent.click(screen.getByRole("button", { name: "Resume B" }));
    expect(screen.getByRole("region", { name: "APR analysis" })).toBeVisible();
    expect(screen.getByText(rewrite)).toBeVisible();
    expect(screen.getByText(/changed after analysis/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Apply initial rewrite" }),
    ).toBeDisabled();
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      "Resume B accomplishment that must remain unchanged.",
    );
    expect(screen.getByTestId("resume-preview")).not.toHaveTextContent(rewrite);

    fireEvent.click(screen.getByRole("button", { name: resumeA.title }));
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      resumeA.experience[0].bullets[0],
    );
    expect(screen.getByTestId("resume-preview")).not.toHaveTextContent(rewrite);
  });

  it("marks sent APR target changes stale and preserves content on analysis failure", async () => {
    const original = workspace.resumes[0];
    vi.mocked(platform.analyzeAccomplishment).mockImplementation(
      async (target) => ({
        target,
        action: { status: "clear", feedback: "Specific action." },
        project: { status: "partial", feedback: "Needs more context." },
        result: { status: "missing", feedback: "Needs supported impact." },
        rewrite: "A changed rewrite.",
        questions: [],
      }),
    );
    render(<App />);
    fireEvent.click(await screen.findByRole("tab", { name: "Tailor & Coach" }));
    await waitFor(() =>
      expect(
        screen.queryByText("Checking the local Copilot CLI…"),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /APR Bullet Coach/ }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Analyze with APR" })[0],
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Send this selected bullet and role/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm APR analysis" }),
    );
    await screen.findByRole("region", { name: "APR analysis" });

    fireEvent.click(screen.getByRole("tab", { name: "Content" }));
    fireEvent.change(screen.getByLabelText("Job title 1"), {
      target: { value: "Changed role" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Tailor & Coach" }));
    expect(
      screen.getByRole("button", { name: "Apply initial rewrite" }),
    ).toBeDisabled();
    expect(screen.getByText(/changed after analysis/)).toBeVisible();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Analyze with APR" })[0],
    );
    vi.mocked(platform.analyzeAccomplishment).mockRejectedValueOnce(
      new Error("APR service unavailable"),
    );
    const aprConsent = screen.getByRole("checkbox", {
      name: /Send this selected bullet and role/,
    });
    fireEvent.click(aprConsent);
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm APR analysis" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "APR service unavailable",
    );
    expect(aprConsent).not.toBeChecked();
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      original.experience[0].bullets[0],
    );
  });

  it("refines from trimmed answers with separate consent, review, staleness, apply, and undo", async () => {
    const original = workspace.resumes[0];
    const originalBullet = original.experience[0].bullets[0];
    const initialRewrite = "Led a focused onboarding redesign.";
    const question = "What changed for customers?";
    vi.mocked(platform.analyzeAccomplishment).mockImplementation(
      async (target) => ({
        target,
        action: { status: "clear", feedback: "Specific action." },
        project: { status: "clear", feedback: "Specific project." },
        result: { status: "missing", feedback: "Needs a supported result." },
        rewrite: initialRewrite,
        questions: [question, "How did you validate the change?"],
      }),
    );
    vi.mocked(platform.refineAccomplishment)
      .mockImplementationOnce(async (target, _questions, answers) => ({
        target,
        answers,
        rewrite:
          "Led an onboarding redesign that made setup clearer for customers.",
      }))
      .mockImplementationOnce(async (target, _questions, answers) => ({
        target,
        answers,
        rewrite:
          "Led an onboarding redesign that reduced customer setup confusion.",
      }));

    render(<App />);
    fireEvent.click(await screen.findByRole("tab", { name: "Tailor & Coach" }));
    await waitFor(() =>
      expect(
        screen.queryByText("Checking the local Copilot CLI…"),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /APR Bullet Coach/ }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Analyze with APR" })[0],
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Send this selected bullet and role/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm APR analysis" }),
    );
    await screen.findByRole("region", { name: "APR analysis" });

    const refine = screen.getByRole("button", {
      name: "Refine rewrite with answers",
    });
    const refinementConsent = screen.getByRole("checkbox", {
      name: /Send these nonblank answers/,
    });
    expect(refine).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Answer 1"), {
      target: { value: "  Setup became clearer for customers.  " },
    });
    expect(refine).toBeDisabled();
    fireEvent.click(refinementConsent);
    expect(refine).toBeEnabled();
    fireEvent.click(refine);

    const latest = await screen.findByRole("region", {
      name: "Latest refined rewrite",
    });
    expect(platform.refineAccomplishment).toHaveBeenCalledWith(
      {
        resumeId: original.id,
        experienceId: original.experience[0].id,
        bulletIndex: 0,
        role: original.experience[0].role,
        bullet: originalBullet,
      },
      [question, "How did you validate the change?"],
      [{ question, answer: "Setup became clearer for customers." }],
      true,
    );
    expect(refinementConsent).not.toBeChecked();
    expect(latest).toHaveTextContent("made setup clearer");
    expect(screen.getByText(initialRewrite)).toBeVisible();
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      originalBullet,
    );

    fireEvent.click(refinementConsent);
    expect(refinementConsent).toBeChecked();
    fireEvent.change(screen.getByLabelText("Answer 1"), {
      target: { value: "A different supported answer." },
    });
    expect(refinementConsent).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Apply refined rewrite" }),
    ).toBeDisabled();
    expect(screen.getByText(/answers changed after refinement/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Apply initial rewrite" }),
    ).toBeEnabled();

    fireEvent.click(refinementConsent);
    fireEvent.click(refine);
    await waitFor(() =>
      expect(latest).toHaveTextContent("reduced customer setup confusion"),
    );
    expect(latest).not.toHaveTextContent("made setup clearer");
    fireEvent.click(
      screen.getByRole("button", { name: "Apply refined rewrite" }),
    );
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      "reduced customer setup confusion",
    );
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      original.experience[0].bullets[1],
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo AI changes" }));
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      originalBullet,
    );
  });

  it("preserves review and the prior refinement when another refinement fails", async () => {
    const original = workspace.resumes[0];
    const question = "What changed?";
    vi.mocked(platform.analyzeAccomplishment).mockImplementation(
      async (target) => ({
        target,
        action: { status: "clear", feedback: "Specific action." },
        project: { status: "partial", feedback: "Needs context." },
        result: { status: "missing", feedback: "Needs impact." },
        rewrite: "Initial rewrite.",
        questions: [question],
      }),
    );
    vi.mocked(platform.refineAccomplishment)
      .mockImplementationOnce(async (target, _questions, answers) => ({
        target,
        answers,
        rewrite: "Prior refined rewrite.",
      }))
      .mockRejectedValueOnce(new Error("Malformed Copilot response"));

    render(<App />);
    fireEvent.click(await screen.findByRole("tab", { name: "Tailor & Coach" }));
    await waitFor(() =>
      expect(
        screen.queryByText("Checking the local Copilot CLI…"),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /APR Bullet Coach/ }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Analyze with APR" })[0],
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Send this selected bullet and role/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm APR analysis" }),
    );
    await screen.findByLabelText("Answer 1");
    fireEvent.change(screen.getByLabelText("Answer 1"), {
      target: { value: "A supported result." },
    });
    const consent = screen.getByRole("checkbox", {
      name: /Send these nonblank answers/,
    });
    const refine = screen.getByRole("button", {
      name: "Refine rewrite with answers",
    });
    fireEvent.click(consent);
    fireEvent.click(refine);
    await screen.findByText("Prior refined rewrite.");
    fireEvent.click(consent);
    fireEvent.click(refine);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Malformed Copilot response",
    );
    expect(screen.getByRole("region", { name: "APR analysis" })).toBeVisible();
    expect(screen.getByText("Prior refined rewrite.")).toBeVisible();
    expect(consent).not.toBeChecked();
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      original.experience[0].bullets[0],
    );
  });

  it("finishes the newest save after an older write is delayed", async () => {
    let finishFirstSave: (() => void) | undefined;
    vi.mocked(platform.saveWorkspace)
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishFirstSave = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Full name"), {
      target: { value: "First revision" },
    });
    await waitFor(() =>
      expect(platform.saveWorkspace).toHaveBeenCalledTimes(1),
    );
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Latest revision" },
    });
    expect(
      screen.queryByText("Autosaved on this device"),
    ).not.toBeInTheDocument();
    finishFirstSave?.();
    await waitFor(() =>
      expect(platform.saveWorkspace).toHaveBeenCalledTimes(2),
    );
    expect(
      vi.mocked(platform.saveWorkspace).mock.calls[1][0].resumes[0].basics.name,
    ).toBe("Latest revision");
    expect(await screen.findByText("Autosaved on this device")).toBeVisible();
  });

  it("supports inline APR launch, selective proposal items, keyword triage, quality checks, and career library", async () => {
    const original = workspace.resumes[0];
    const proposal = {
      summary: "Selective summary rewrite.",
      experience: original.experience.map((entry, idx) => ({
        id: entry.id,
        bullets: entry.bullets.map((_, bIdx) => `Proposed ${idx}.${bIdx}`),
      })),
      notes: [],
    };
    vi.mocked(platform.generateResume).mockResolvedValue(proposal);

    render(<App />);
    // Launch APR directly from Editor bullet
    const inlineApr = (
      await screen.findAllByRole("button", {
        name: /Coach highlight 1\.1 with APR/,
      })
    )[0];
    fireEvent.click(inlineApr);
    expect(screen.getByText("Selected accomplishment")).toBeVisible();
    expect(screen.getByRole("tab", { name: "Tailor & Coach" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Interactive JD keyword triage
    fireEvent.click(screen.getByRole("button", { name: /Role Tailoring/ }));
    fireEvent.change(screen.getByLabelText("Job description"), {
      target: { value: "Experience with FastAPI, Kubernetes, and Figma." },
    });
    fireEvent.click(screen.getByLabelText("Skip kubernetes"));
    expect(screen.getByLabelText("Restore kubernetes")).toBeVisible();
    fireEvent.click(screen.getByLabelText("Add fastapi to skills"));
    expect(screen.getByTestId("resume-preview")).toHaveTextContent("fastapi");

    // Reset APR selection so only main consent checkbox is checked, then test selective proposal apply
    fireEvent.click(screen.getByRole("tab", { name: "Content" }));
    fireEvent.click(screen.getByRole("tab", { name: "Tailor & Coach" }));
    fireEvent.click(screen.getByRole("button", { name: /Role Tailoring/ }));
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Send this content to GitHub Copilot/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Tailor to this role" }),
    );
    await screen.findByRole("region", { name: "Copilot suggestions" });

    // Exclude summary rewrite, keep bullet rewrites
    fireEvent.click(screen.getByLabelText("Include summary suggestion"));
    fireEvent.click(
      screen.getByRole("button", { name: "Apply reviewed suggestions" }),
    );
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      original.summary,
    );
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      "Proposed 0.0",
    );

    // Quality checks drawer
    fireEvent.click(screen.getByRole("button", { name: /Quality checks/ }));
    expect(
      screen.getByRole("region", { name: "Resume quality checks" }),
    ).toBeVisible();

    // Career library sync & variant creation
    fireEvent.click(screen.getByRole("button", { name: /Career library/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Import from current resume/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Select all/ }));
    fireEvent.change(screen.getByLabelText("Variant resume title"), {
      target: { value: "Staff Design Variant" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create tailored resume" }),
    );
    expect(screen.getByLabelText("Resume title")).toHaveValue(
      "Staff Design Variant",
    );
  });

  it("supports undo/redo for destructive entry deletion, collapsible cards, skill chips, zoom, dark theme, and Escape menu dismissal", async () => {
    render(<App />);
    const roleTitle = workspace.resumes[0].experience[0].role;
    expect(await screen.findByTestId("resume-preview")).toHaveTextContent(
      roleTitle,
    );

    // Collapsible experience card
    fireEvent.click(screen.getByLabelText("Collapse position 1"));
    expect(screen.queryByLabelText("Job title 1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Expand position 1"));
    expect(screen.getByLabelText("Job title 1")).toBeVisible();

    // Destructive entry deletion + Undo + Redo
    fireEvent.click(screen.getByLabelText("Remove position 1"));
    expect(screen.getByRole("status")).toHaveTextContent(/Removed/);
    expect(screen.getByTestId("resume-preview")).not.toHaveTextContent(
      roleTitle,
    );
    fireEvent.click(screen.getByLabelText("Undo last change"));
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(roleTitle);
    fireEvent.click(screen.getByLabelText("Redo change"));
    expect(screen.getByTestId("resume-preview")).not.toHaveTextContent(
      roleTitle,
    );
    fireEvent.click(screen.getByLabelText("Undo last change"));
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(roleTitle);

    // Interactive skill chips
    const chipInput = screen.getByLabelText("Add skill tag");
    fireEvent.change(chipInput, { target: { value: "Design Tokens" } });
    fireEvent.keyDown(chipInput, { key: "Enter" });
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      "Design Tokens",
    );
    fireEvent.click(screen.getByLabelText("Remove skill Design Tokens"));
    expect(screen.getByTestId("resume-preview")).not.toHaveTextContent(
      "Design Tokens",
    );

    // Document actions Escape dismissal
    const menuTrigger = screen.getByLabelText("Document actions");
    fireEvent.click(menuTrigger);
    expect(
      screen.getByRole("group", { name: "Document actions" }),
    ).toBeVisible();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("group", { name: "Document actions" }),
    ).not.toBeInTheDocument();

    // Preview zoom & Dark theme toggle
    fireEvent.click(screen.getByLabelText("Zoom in preview"));
    expect(screen.getByText("125%")).toBeVisible();
    fireEvent.click(screen.getByLabelText("Switch to dark studio theme"));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("supports multi-provider switching, OS keychain keys, 2-model grounding badges, summary options, role tailoring, and keyword-aware APR", async () => {
    const original = workspace.resumes[0];
    render(<App />);
    fireEvent.click(await screen.findByRole("tab", { name: "Tailor & Coach" }));
    await waitFor(() =>
      expect(
        screen.queryByText("Checking the local Copilot CLI…"),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Provider Setup/ }));

    // Switch primary provider to OpenAI API and save an API key to OS credential store
    vi.mocked(platform.aiProviderStatus).mockResolvedValue({
      settings: {
        ...defaultAiSettings(),
        primaryProvider: "openai",
        primaryModel: "gpt-4.1",
        verifierEnabled: true,
        verifierProvider: "anthropic",
        verifierModel: "claude-sonnet-4-5",
      },
      copilot: {
        available: true,
        version: "test-cli",
        detail: "CLI installed; sign-in not verified.",
      },
      providers: [
        {
          provider: "copilot",
          configured: true,
          hasStoredKey: false,
          hasEnvKey: false,
        },
        {
          provider: "openai",
          configured: true,
          hasStoredKey: true,
          hasEnvKey: false,
        },
        {
          provider: "anthropic",
          configured: true,
          hasStoredKey: true,
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
          configured: true,
          hasStoredKey: false,
          hasEnvKey: false,
        },
      ],
    });

    fireEvent.change(screen.getByLabelText("Primary AI provider"), {
      target: { value: "openai" },
    });
    await waitFor(() =>
      expect(platform.saveAiSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          primaryProvider: "openai",
          primaryModel: "gpt-4.1",
        }),
      ),
    );

    fireEvent.change(screen.getByLabelText("OpenAI API key"), {
      target: { value: "sk-test-openai-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save key/ }));
    await waitFor(() =>
      expect(platform.setProviderApiKey).toHaveBeenCalledWith(
        "openai",
        "sk-test-openai-key",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /Role Tailoring/ }));

    // Suggest 3 summary angles & apply one
    vi.mocked(platform.generateSummaryOptions).mockResolvedValue({
      options: [
        { label: "Impact-focused", summary: "Impact-driven design leader." },
        { label: "Systems-focused", summary: "Design systems architect." },
        { label: "Leadership-focused", summary: "Cross-functional mentor." },
      ],
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Send this content to OpenAI API/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Suggest 3 summary angles" }),
    );
    await screen.findByRole("region", { name: "Summary options" });
    fireEvent.click(screen.getAllByRole("button", { name: /Use summary/ })[0]);
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      "Impact-driven design leader.",
    );

    // Single-role tailoring with 2-model factual grounding badges
    vi.mocked(platform.tailorExperienceRole).mockResolvedValue({
      entryId: original.experience[0].id,
      bullets: original.experience[0].bullets.map(
        (_, idx) => `Role tailored bullet ${idx}`,
      ),
      notes: [],
      verification: {
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        items: [
          {
            key: "bullet:0",
            status: "supported",
            note: "Directly grounded in source bullet.",
          },
          {
            key: "bullet:1",
            status: "inferred",
            note: "Scope phrasing inferred; verify before applying.",
          },
        ],
      },
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Send this content to OpenAI API/,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Tailor role" }));
    await screen.findByRole("region", { name: "Role suggestions" });
    expect(screen.getByText("Supported")).toBeVisible();
    expect(screen.getByText("Inferred — check")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Apply role suggestions" }),
    );
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      "Role tailored bullet 0",
    );

    // Keyword-aware APR ("Coach APR" from missing JD keyword)
    fireEvent.change(screen.getByLabelText("Job description"), {
      target: { value: "Requires GraphQL and design systems expertise." },
    });
    fireEvent.click(screen.getByLabelText("Coach accomplishment for graphql"));
    expect(screen.getByText(/Target skill focus:/)).toBeVisible();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Analyze with APR" })[0],
    );
    vi.mocked(platform.analyzeAccomplishment).mockResolvedValue({
      target: {
        resumeId: original.id,
        experienceId: original.experience[0].id,
        bulletIndex: 0,
        role: original.experience[0].role,
        bullet: "Role tailored bullet 0",
        focusKeyword: "graphql",
      },
      action: { status: "clear", feedback: "Clear verb." },
      project: { status: "clear", feedback: "Named system." },
      result: { status: "partial", feedback: "Add metric." },
      rewrite: "Delivered GraphQL-backed UI components.",
      questions: ["Did this role involve GraphQL schema design?"],
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Send this selected bullet and role \(with target keyword “graphql”\)/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm APR analysis" }),
    );
    await screen.findByRole("region", { name: "APR analysis" });
    expect(platform.analyzeAccomplishment).toHaveBeenCalledWith(
      expect.objectContaining({ focusKeyword: "graphql" }),
      true,
    );
  });

  it("cancels in-flight AI requests without blocking studio navigation or mutating the resume", async () => {
    const original = workspace.resumes[0];
    let rejectGenerate: ((reason?: unknown) => void) | undefined;
    vi.mocked(platform.generateResume).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectGenerate = reject;
        }),
    );

    render(<App />);
    fireEvent.click(await screen.findByRole("tab", { name: "Tailor & Coach" }));
    await waitFor(() =>
      expect(
        screen.queryByText("Checking the local Copilot CLI…"),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Polish my resume" }));

    const cancelBtn = await screen.findByRole("button", {
      name: "Cancel request",
    });
    // Navigation remains interactive while AI runs
    expect(screen.getByRole("button", { name: /My resumes/ })).toBeEnabled();

    fireEvent.click(cancelBtn);
    expect(platform.cancelAiRequest).toHaveBeenCalledTimes(1);
    rejectGenerate?.(new Error(platform.AI_CANCELLED_MESSAGE));

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Cancel request" }),
      ).not.toBeInTheDocument(),
    );
    expect(await screen.findByText(/AI request cancelled/)).toBeVisible();
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      original.summary,
    );
  });

  it("supports collapsible sidebar, persisted UI prefs, preview hyperlinks, and variant diff compare", async () => {
    const baseResume = workspace.resumes[0];
    const tailoredResume = {
      ...exampleResume(),
      id: "resume-tailored",
      title: "Staff Role Variant",
      summary: "Tailored summary highlighting distributed architecture.",
      skills: [...baseResume.skills, "Rust"],
    };
    workspace = {
      ...workspace,
      activeResumeId: tailoredResume.id,
      resumes: [baseResume, tailoredResume],
    };
    vi.mocked(platform.loadWorkspace).mockResolvedValue(workspace);

    render(<App />);
    await screen.findByDisplayValue("Staff Role Variant");

    // External URLs in basics render clickable normalized anchors
    const githubLink = screen
      .getByTestId("resume-preview")
      .querySelector('a[href="https://github.com/alexmorgan"]');
    expect(githubLink).not.toBeNull();

    // Ctrl+\ toggles collapsed sidebar and persists preference
    fireEvent.keyDown(window, { key: "\\", ctrlKey: true });
    expect(
      screen.getByRole("button", { name: /Expand workspace sidebar/ }),
    ).toBeVisible();
    expect(
      JSON.parse(window.localStorage.getItem("hireloom.ui-prefs.v1") ?? "{}"),
    ).toMatchObject({ sidebarCollapsed: true });

    // Compare mode shows word-level diffs against another variant
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    const compareSheet = await screen.findByTestId("variant-compare-view");
    fireEvent.change(screen.getByLabelText("Baseline"), {
      target: { value: baseResume.id },
    });
    expect(compareSheet).toHaveTextContent("2 tailored sections differ");
    expect(compareSheet).toHaveTextContent("Rust");
    expect(compareSheet).toHaveTextContent("distributed");
  });

  it("refreshes available provider models on provider switch and manual refresh, and surfaces APR selection above the bullet list", async () => {
    vi.mocked(platform.saveAiSettings).mockImplementation(async (s) => s);
    vi.mocked(platform.listProviderModels).mockImplementation(
      async (provider) => {
        if (provider === "ollama") {
          return ["llama3.3:latest", "qwen2.5:14b"];
        }
        return ["claude-sonnet-5.5", "gpt-6.1-terra"];
      },
    );

    render(<App />);
    fireEvent.click(await screen.findByRole("tab", { name: "Tailor & Coach" }));
    await waitFor(() =>
      expect(
        screen.queryByText("Checking the local Copilot CLI…"),
      ).not.toBeInTheDocument(),
    );

    // Switch to Ollama and verify available models populate the dropdown
    fireEvent.click(screen.getByRole("button", { name: /Provider Setup/ }));
    fireEvent.change(screen.getByLabelText("Primary AI provider"), {
      target: { value: "ollama" },
    });
    await waitFor(() =>
      expect(platform.listProviderModels).toHaveBeenCalledWith(
        "ollama",
        "http://127.0.0.1:11434/v1",
      ),
    );
    const modelSelect = await screen.findByLabelText("Primary AI model");
    expect(modelSelect.tagName).toBe("SELECT");
    expect(modelSelect).toHaveTextContent("qwen2.5:14b");

    // Manual refresh picks up newly added models
    vi.mocked(platform.listProviderModels).mockResolvedValueOnce([
      "llama3.3:latest",
      "mistral-small:24b",
      "qwen2.5:14b",
    ]);
    fireEvent.click(screen.getByRole("button", { name: /Refresh models/ }));
    await waitFor(() =>
      expect(screen.getByLabelText("Primary AI model")).toHaveTextContent(
        "mistral-small:24b",
      ),
    );

    // Selecting "Analyze with APR" surfaces the confirmation card above the list with a Selected badge
    fireEvent.click(screen.getByRole("button", { name: /APR Bullet Coach/ }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Analyze with APR" })[0],
    );
    const requestHeading = screen.getByRole("heading", {
      name: "Selected accomplishment",
    });
    const firstBulletBtn = screen.getAllByRole("button", {
      name: "Analyze with APR",
    })[0];
    expect(firstBulletBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Selected")).toBeVisible();
    expect(
      requestHeading.compareDocumentPosition(firstBulletBtn) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("filters sections via sticky section pills, collapses 2nd+ experience entries by default, and supports expand/collapse all", async () => {
    const resume = exampleResume();
    resume.experience.push({
      id: "experience-2",
      role: "Staff Engineer",
      company: "Acme Corp",
      location: "Remote",
      startDate: "2020-01",
      endDate: "2022-01",
      bullets: ["Scaled distributed ingestion pipeline by 4x."],
    });
    vi.mocked(platform.loadWorkspace).mockResolvedValue({
      ...workspace,
      activeResumeId: resume.id,
      resumes: [resume],
    });

    render(<App />);
    expect(await screen.findByLabelText("Job title 1")).toBeVisible();
    // 2nd position starts collapsed to reduce scrolling
    expect(screen.queryByLabelText("Job title 2")).not.toBeInTheDocument();

    // Clicking "Expand all" opens position 2
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryByLabelText("Job title 1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getByLabelText("Job title 1")).toBeVisible();
    expect(screen.getByLabelText("Job title 2")).toBeVisible();

    // Clicking a section pill focuses just that section
    const sectionNav = screen.getByRole("navigation", {
      name: "Resume sections",
    });
    fireEvent.click(
      within(sectionNav).getByRole("button", { name: /^Experience/ }),
    );
    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Job title 1")).toBeVisible();

    fireEvent.click(within(sectionNav).getByRole("button", { name: "All" }));
    expect(screen.getByLabelText("Full name")).toBeVisible();
  });
});
