import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { exampleResume, type Workspace } from "./model";
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
    copilotStatus: vi.fn().mockResolvedValue({
      available: true,
      version: "test-cli",
      detail: "CLI installed; sign-in not verified.",
    }),
    analyzeAccomplishment: vi.fn(),
    generateResume: vi.fn(),
    loginToCopilot: vi.fn(),
  };
});

let workspace: Workspace;

beforeEach(() => {
  vi.clearAllMocks();
  const resume = exampleResume();
  workspace = { version: 1, activeResumeId: resume.id, resumes: [resume] };
  vi.mocked(platform.loadWorkspace).mockResolvedValue(workspace);
  vi.mocked(platform.saveWorkspace).mockResolvedValue(undefined);
  vi.mocked(platform.copilotStatus).mockResolvedValue({
    available: true,
    version: "test-cli",
    detail: "CLI installed; sign-in not verified.",
  });
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
    fireEvent.click(await screen.findByRole("tab", { name: "Copilot" }));
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
    fireEvent.click(await screen.findByRole("tab", { name: "Copilot" }));
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
    fireEvent.click(await screen.findByRole("tab", { name: "Copilot" }));
    await waitFor(() =>
      expect(
        screen.queryByText("Checking the local Copilot CLI…"),
      ).not.toBeInTheDocument(),
    );
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
    fireEvent.click(screen.getByRole("tab", { name: "Copilot" }));
    const apply = screen.getByRole("button", { name: "Apply this rewrite" });
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
    fireEvent.click(await screen.findByRole("tab", { name: "Copilot" }));
    await waitFor(() =>
      expect(
        screen.queryByText("Checking the local Copilot CLI…"),
      ).not.toBeInTheDocument(),
    );
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
      screen.getByRole("button", { name: "Apply this rewrite" }),
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
    fireEvent.click(await screen.findByRole("tab", { name: "Copilot" }));
    await waitFor(() =>
      expect(
        screen.queryByText("Checking the local Copilot CLI…"),
      ).not.toBeInTheDocument(),
    );
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
    fireEvent.click(screen.getByRole("tab", { name: "Copilot" }));
    expect(
      screen.getByRole("button", { name: "Apply this rewrite" }),
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
});
