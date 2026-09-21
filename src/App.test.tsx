import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  exampleResume,
  type AprAnalysis,
  type AprTarget,
  type HighlightReviews,
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
});

let workspace: Workspace;

function openContentSection(name: string) {
  const tabName =
    name === "Personal details"
      ? "Personal"
      : name === "Professional summary"
        ? "Summary"
        : name;
  fireEvent.click(screen.getByRole("tab", { name: tabName }));
}

function aprResult(
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
    expect(
      screen.queryByText("Analyze accomplishments"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Analyze with APR" }),
    ).not.toBeInTheDocument();
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

  it("guides one highlight, requires consent, and applies and undoes only its suggestion", async () => {
    const original = workspace.resumes[0];
    const originalBullet = original.experience[0].bullets[0];
    const rewrite =
      "Led an onboarding redesign using research, prototypes, and usability testing.";
    const refinedRewrite =
      "Spearheaded a cross-functional onboarding redesign through research, prototyping, and usability testing.";
    vi.mocked(platform.analyzeAccomplishment).mockImplementation(
      async (target) =>
        aprResult(target, {
          action: { status: "clear", feedback: "Uses a specific action verb." },
          project: {
            status: "clear",
            feedback: "Names the onboarding redesign.",
          },
          result: {
            status: "missing",
            feedback: "Add a supported outcome if one is known.",
          },
          options: [
            { id: "concise", bullets: [rewrite] },
            {
              id: "detail-forward",
              bullets: [
                "Led an onboarding redesign through research, prototyping, and usability testing.",
              ],
            },
          ],
        }),
    );
    vi.mocked(platform.refineAccomplishment).mockImplementation(
      async ({ target }) =>
        aprResult(target, {
          options: [{ id: "detail-forward", bullets: [refinedRewrite] }],
        }),
    );
    render(<App />);
    await waitFor(() =>
      expect(
        screen.queryByText("Loading your studio…"),
      ).not.toBeInTheDocument(),
    );
    openContentSection("Experience");
    const help = screen.getAllByRole("button", {
      name: "Help me strengthen this highlight",
    })[0];
    expect(help).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(help);
    expect(help).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("region", { name: "Highlight guidance" }),
    ).toHaveAttribute("id", help.getAttribute("aria-controls"));
    expect(
      screen.getAllByText(originalBullet, { exact: true }).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText(/Initial guidance sends only this highlight/),
    ).toBeVisible();

    const aprConsent = screen.getByRole("checkbox", {
      name: /Send this highlight and role/,
    });
    const confirm = screen.getByRole("button", {
      name: "Send for guidance",
    });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(platform.analyzeAccomplishment).not.toHaveBeenCalled();
    fireEvent.click(aprConsent);
    fireEvent.click(confirm);

    await screen.findByText(rewrite);
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
    expect(screen.getByText("What you did")).toBeVisible();
    expect(screen.getByText("Product or project")).toBeVisible();
    expect(screen.getByText("Impact")).toBeVisible();
    const feedback = screen.getByLabelText("Tell Gemini what to change");
    const refine = screen.getByRole("button", {
      name: "Refine rewrite options",
    });
    expect(refine).toBeDisabled();
    fireEvent.change(feedback, {
      target: { value: "Emphasize cross-functional leadership." },
    });
    expect(refine).toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Send this feedback, the original highlight and role/,
      }),
    );
    fireEvent.click(refine);
    await screen.findByText(refinedRewrite);
    expect(platform.refineAccomplishment).toHaveBeenCalledWith(
      {
        target: {
          resumeId: original.id,
          experienceId: original.experience[0].id,
          bulletIndex: 0,
          role: original.experience[0].role,
          bullet: originalBullet,
        },
        options: [
          { id: "concise", bullets: [rewrite] },
          {
            id: "detail-forward",
            bullets: [
              "Led an onboarding redesign through research, prototyping, and usability testing.",
            ],
          },
        ],
        feedback: "Emphasize cross-functional leadership.",
      },
      true,
    );
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      originalBullet,
    );

    openContentSection("Personal details");
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "A changed unsent name" },
    });
    openContentSection("Experience");
    const apply = screen.getByRole("button", {
      name: "Apply selected option",
    });
    expect(apply).toBeDisabled();
    fireEvent.click(
      screen.getByRole("radio", { name: /Detail-forward · unified/ }),
    );
    expect(apply).toBeEnabled();
    fireEvent.click(apply);
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      refinedRewrite,
    );
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      original.experience[0].bullets[1],
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo AI changes" }));
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      originalBullet,
    );
  });

  it("moves highlights within an experience and closes guidance before reindexing", async () => {
    const original = workspace.resumes[0];
    const firstHighlight = original.experience[0].bullets[0];
    const secondHighlight = original.experience[0].bullets[1];

    render(<App />);
    await screen.findByLabelText("Full name");
    openContentSection("Experience");

    expect(
      screen.getByRole("button", { name: "Move highlight 1.1 up" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move highlight 1.3 down" }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Help me strengthen this highlight",
      })[0],
    );
    expect(
      screen.getByRole("region", { name: "Highlight guidance" }),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Move highlight 1.1 down" }),
    );

    expect(
      screen.queryByRole("region", { name: "Highlight guidance" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Highlight 1.1")).toHaveValue(secondHighlight);
    expect(screen.getByLabelText("Highlight 1.2")).toHaveValue(firstHighlight);
    expect(
      screen.getByRole("button", { name: "Move highlight 1.1 up" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move highlight 1.2 up" }),
    ).toBeEnabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Move highlight 1.2 up" }),
    );
    expect(screen.getByLabelText("Highlight 1.1")).toHaveValue(firstHighlight);
    expect(screen.getByLabelText("Highlight 1.2")).toHaveValue(secondHighlight);
  });

  it("adds experience entries to the top or end of the list", async () => {
    render(<App />);
    await screen.findByLabelText("Full name");
    openContentSection("Experience");

    fireEvent.click(
      screen.getByRole("button", { name: "Add experience to top" }),
    );
    expect(screen.getByLabelText("Job title 1")).toHaveValue("");
    fireEvent.click(
      screen.getByRole("button", {
        name: /Senior Product Designer — Morrow Studio/,
      }),
    );
    expect(screen.getByLabelText("Job title 2")).toHaveValue(
      "Senior Product Designer",
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Product Designer — Forma/,
      }),
    );
    expect(screen.getByLabelText("Job title 3")).toHaveValue(
      "Product Designer",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add experience to end" }),
    );
    expect(screen.getByLabelText("Job title 4")).toHaveValue("");
  });

  it("navigates workspace modes and Content sections with tabs while preserving values", async () => {
    render(<App />);
    await screen.findByLabelText("Full name");

    const workspaceTabs = screen.getByRole("tablist", {
      name: "Resume workspace",
    });
    const primaryTabs = within(workspaceTabs).getAllByRole("tab");
    expect(primaryTabs).toHaveLength(4);
    expect(primaryTabs.map((item) => item.textContent)).toEqual([
      "Content",
      "Copilot",
      "Design",
      "Preview",
    ]);
    for (const primaryTab of primaryTabs) {
      expect(primaryTab).toHaveAttribute("aria-controls");
    }
    expect(
      document.querySelectorAll(".workspace-panel:not([hidden])"),
    ).toHaveLength(1);

    const contentTabs = screen.getByRole("tablist", {
      name: "Content sections",
    });
    expect(within(contentTabs).getAllByRole("tab")).toHaveLength(5);
    const personalTab = within(contentTabs).getByRole("tab", {
      name: "Personal",
    });
    expect(personalTab).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("region", { name: "Personal details" }),
    ).toBeVisible();
    expect(
      screen.queryByLabelText("Your story, in a few lines"),
    ).not.toBeInTheDocument();

    personalTab.focus();
    fireEvent.keyDown(personalTab, { key: "ArrowRight" });
    const summaryTab = within(contentTabs).getByRole("tab", {
      name: "Summary",
    });
    expect(summaryTab).toHaveFocus();
    expect(summaryTab).toHaveAttribute("aria-selected", "true");
    fireEvent.change(screen.getByLabelText("Your story, in a few lines"), {
      target: { value: "A focused product story." },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Design" }));
    fireEvent.click(screen.getByRole("tab", { name: "Content" }));
    expect(screen.getByLabelText("Your story, in a few lines")).toHaveValue(
      "A focused product story.",
    );
    expect(
      screen.getByRole("region", { name: "Professional summary" }),
    ).toBeVisible();

    fireEvent.keyDown(summaryTab, { key: "End" });
    expect(
      within(contentTabs).getByRole("tab", { name: "Skills" }),
    ).toHaveFocus();
    fireEvent.keyDown(
      within(contentTabs).getByRole("tab", { name: "Skills" }),
      { key: "Home" },
    );
    expect(personalTab).toHaveFocus();

    const contentTab = within(workspaceTabs).getByRole("tab", {
      name: "Content",
    });
    contentTab.focus();
    fireEvent.keyDown(contentTab, { key: "End" });
    expect(
      within(workspaceTabs).getByRole("tab", { name: "Preview" }),
    ).toHaveFocus();
    expect(
      within(workspaceTabs).getByRole("tab", { name: "Preview" }),
    ).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(
      within(workspaceTabs).getByRole("tab", { name: "Preview" }),
      { key: "Home" },
    );
    expect(contentTab).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Sections" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });

  it("keeps Preview current and focuses explicit cross-mode destinations", async () => {
    render(<App />);
    await screen.findByLabelText("Full name");

    openContentSection("Professional summary");
    fireEvent.change(screen.getByLabelText("Your story, in a few lines"), {
      target: { value: "Visible in the current preview." },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Find the right words with Copilot",
      }),
    );
    expect(screen.getByRole("tab", { name: "Copilot" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Copilot" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      "Visible in the current preview.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByRole("tab", { name: "Design" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Design" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("restores Content section state independently for each resume", async () => {
    const first = workspace.resumes[0];
    first.title = "First application";
    const second = {
      ...structuredClone(first),
      id: "second-resume",
      title: "Second application",
    };
    workspace.resumes.push(second);

    render(<App />);
    await screen.findByLabelText("Full name");
    openContentSection("Professional summary");

    fireEvent.click(screen.getByRole("button", { name: "Second application" }));
    expect(
      screen.getByRole("region", { name: "Personal details" }),
    ).toBeVisible();
    openContentSection("Skills");

    fireEvent.click(screen.getByRole("button", { name: "First application" }));
    expect(
      screen.getByRole("region", { name: "Professional summary" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Second application" }));
    expect(screen.getByRole("region", { name: "Skills" })).toBeVisible();
  });

  it("shows eight scannable Experience summaries with one stable selected editor", async () => {
    const original = workspace.resumes[0].experience[0];
    workspace.resumes[0].experience = Array.from({ length: 8 }, (_, index) => ({
      ...structuredClone(original),
      id: `experience-${index + 1}`,
      role: `Role ${index + 1}`,
      company: `Company ${index + 1}`,
    }));

    render(<App />);
    await screen.findByLabelText("Full name");
    openContentSection("Experience");

    const list = screen.getByRole("list", { name: "Experience" });
    expect(within(list).getAllByRole("button")).toHaveLength(8);
    expect(screen.getAllByLabelText(/^Job title \d+$/)).toHaveLength(1);

    const roleSix = within(list).getByRole("button", {
      name: /Role 6 — Company 6/,
    });
    fireEvent.click(roleSix);
    expect(roleSix).toHaveAttribute("aria-current", "true");
    expect(screen.getByLabelText("Job title 6")).toHaveValue("Role 6");
    fireEvent.click(screen.getByRole("button", { name: "Move position 6 up" }));
    expect(
      within(list).getByRole("button", { name: /Role 6 — Company 6/ }),
    ).toHaveAttribute("aria-current", "true");
    expect(screen.getByLabelText("Job title 5")).toHaveValue("Role 6");
    expect(screen.getAllByLabelText(/^Job title \d+$/)).toHaveLength(1);
  });

  it("restores removed jobs, highlights, and education without overwriting current data", async () => {
    const original = structuredClone(workspace.resumes[0]);
    render(<App />);
    await screen.findByLabelText("Full name");
    openContentSection("Experience");
    vi.mocked(platform.saveWorkspace).mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Remove position 1" }));
    expect(
      screen.getByRole("button", { name: "Undo" }).parentElement,
    ).toHaveTextContent("Removed Senior Product Designer");
    await waitFor(() => expect(platform.saveWorkspace).toHaveBeenCalled(), {
      timeout: 2_000,
    });
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    expect(screen.getByRole("button", { name: "Undo" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("tab", { name: "Content" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const restoredJob = screen.getByRole("button", {
      name: /Senior Product Designer — Morrow Studio/,
    });
    expect(restoredJob).toHaveFocus();
    expect(screen.getByLabelText("Job title 1")).toHaveValue(
      original.experience[0].role,
    );

    const firstHighlight = original.experience[0].bullets[0];
    fireEvent.click(
      screen.getByRole("button", { name: "Remove highlight 1.1" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByLabelText("Highlight 1.1")).toHaveValue(firstHighlight);
    expect(screen.getByLabelText("Highlight 1.1")).toHaveFocus();

    openContentSection("Education");
    const education = original.education[0];
    fireEvent.click(screen.getByRole("button", { name: "Remove education 1" }));
    expect(
      screen.getByRole("button", { name: "Undo" }).parentElement,
    ).toHaveTextContent(`Removed ${education.school}`);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByLabelText("School 1")).toHaveValue(education.school);
    expect(screen.getByLabelText("School 1")).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Remove education 1" }));
    openContentSection("Personal details");
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Current data survives" },
    });
    expect(
      screen.queryByRole("button", { name: "Undo" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue(
      "Current data survives",
    );
  });

  it("expires item Undo after eight seconds", async () => {
    render(<App />);
    await screen.findByLabelText("Full name");
    openContentSection("Education");
    vi.useFakeTimers();
    try {
      fireEvent.click(
        screen.getByRole("button", { name: "Remove education 1" }),
      );
      expect(screen.getByRole("button", { name: "Undo" })).toBeVisible();
      act(() => vi.advanceTimersByTime(8_000));
      expect(
        screen.queryByRole("button", { name: "Undo" }),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("updates the live region for consecutive removals with identical labels", async () => {
    const education = workspace.resumes[0].education[0];
    workspace.resumes[0].education = [
      education,
      { ...structuredClone(education), id: "education-duplicate" },
    ];

    render(<App />);
    await screen.findByLabelText("Full name");
    openContentSection("Education");

    const status = screen.getByRole("status");
    const updates: string[] = [];
    const observer = new MutationObserver(() => {
      updates.push(status.textContent ?? "");
    });
    observer.observe(status, { childList: true, subtree: true });

    try {
      fireEvent.click(
        screen.getByRole("button", { name: "Remove education 1" }),
      );
      await waitFor(() => expect(updates).toHaveLength(1));

      fireEvent.click(
        screen.getByRole("button", { name: "Remove education 1" }),
      );
      await waitFor(() => expect(updates).toHaveLength(2));

      expect(updates).toEqual([
        `Removed ${education.school}.`,
        `Removed ${education.school}.`,
      ]);
    } finally {
      observer.disconnect();
    }
  });

  it("marks sent highlight changes stale and preserves content on guidance failure", async () => {
    const original = workspace.resumes[0];
    vi.mocked(platform.analyzeAccomplishment).mockImplementation(
      async (target) =>
        aprResult(target, {
          action: { status: "clear", feedback: "Specific action." },
          project: { status: "partial", feedback: "Needs more context." },
          result: { status: "missing", feedback: "Needs supported impact." },
          options: [
            { id: "concise", bullets: ["A changed rewrite."] },
            { id: "detail-forward", bullets: ["A changed detailed rewrite."] },
          ],
        }),
    );
    render(<App />);
    await screen.findByLabelText("Full name");
    openContentSection("Experience");
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Help me strengthen this highlight",
      })[0],
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Send this highlight and role/,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Send for guidance" }));
    await screen.findByText("A changed rewrite.");
    fireEvent.click(screen.getByRole("radio", { name: /Concise · unified/ }));

    vi.mocked(platform.refineAccomplishment).mockRejectedValueOnce(
      new Error("Refinement unavailable"),
    );
    fireEvent.change(screen.getByLabelText("Tell Gemini what to change"), {
      target: { value: "Make it more direct." },
    });
    const refineConsent = screen.getByRole("checkbox", {
      name: /Send this feedback, the original highlight and role/,
    });
    fireEvent.click(refineConsent);
    fireEvent.click(
      screen.getByRole("button", { name: "Refine rewrite options" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Refinement unavailable",
    );
    expect(screen.getByText("A changed rewrite.")).toBeVisible();
    expect(
      screen.getByRole("radio", { name: /Concise · unified/ }),
    ).toBeChecked();
    expect(screen.getByLabelText("Tell Gemini what to change")).toHaveValue(
      "Make it more direct.",
    );
    expect(refineConsent).not.toBeChecked();

    vi.mocked(platform.analyzeAccomplishment).mockRejectedValueOnce(
      new Error("APR service unavailable"),
    );
    const aprConsent = screen.getByRole("checkbox", {
      name: /Send this highlight and role/,
    });
    fireEvent.click(aprConsent);
    fireEvent.click(
      screen.getByRole("button", { name: "Request fresh guidance" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "APR service unavailable",
    );
    expect(screen.getByText("A changed rewrite.")).toBeVisible();
    expect(aprConsent).not.toBeChecked();

    fireEvent.change(screen.getByLabelText("Job title 1"), {
      target: { value: "Changed role" },
    });
    expect(
      screen.getByRole("button", { name: "Apply selected option" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/changed after guidance was requested/),
    ).toBeVisible();
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      original.experience[0].bullets[0],
    );
  });

  it("refuses a split option that would exceed the experience highlight cap", async () => {
    const original = workspace.resumes[0];
    original.experience[0].bullets = Array.from(
      { length: 30 },
      (_, index) => `Existing highlight ${index + 1}.`,
    );
    vi.mocked(platform.analyzeAccomplishment).mockImplementation(
      async (target) =>
        aprResult(target, {
          options: [
            { id: "concise", bullets: ["Changed unified highlight."] },
            {
              id: "detail-forward",
              bullets: ["Changed detail-forward unified highlight."],
            },
            {
              id: "split",
              bullets: ["First split highlight.", "Second split highlight."],
            },
          ],
        }),
    );

    render(<App />);
    await screen.findByLabelText("Full name");
    openContentSection("Experience");
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Help me strengthen this highlight",
      })[0],
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Send this highlight and role/,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Send for guidance" }));
    await screen.findByText("First split highlight.");
    fireEvent.click(
      screen.getByRole("radio", { name: /Split · two highlights/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Apply selected option" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "30-highlight limit",
    );
    expect(screen.getByLabelText("Highlight 1.30")).toHaveValue(
      "Existing highlight 30.",
    );
    expect(
      screen.getByRole("region", { name: "Highlight guidance" }),
    ).toBeVisible();
  }, 30_000);

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

  describe("batch highlight review", () => {
    function reviewsFor(
      resume = workspace.resumes[0],
      weak: Array<[number, number]> = [[0, 1]],
    ): HighlightReviews {
      return resume.experience.flatMap((entry, entryIndex) =>
        entry.bullets.map((bullet, bulletIndex) => {
          const isWeak = weak.some(
            ([e, b]) => e === entryIndex && b === bulletIndex,
          );
          return {
            target: {
              resumeId: resume.id,
              experienceId: entry.id,
              bulletIndex,
              role: entry.role,
              bullet,
            },
            action: "clear" as const,
            project: isWeak ? ("partial" as const) : ("clear" as const),
            result: isWeak ? ("missing" as const) : ("clear" as const),
          };
        }),
      );
    }

    async function openExperience() {
      render(<App />);
      await screen.findByLabelText("Full name");
      openContentSection("Experience");
    }

    function reviewButton() {
      return screen.getByRole("button", { name: "Review all highlights" });
    }

    function reviewConsent() {
      return screen.getByRole("checkbox", {
        name: /Send every highlight and role in this resume/,
      });
    }

    it("keeps the review disabled until consent is given", async () => {
      await openExperience();

      expect(reviewButton()).toBeDisabled();
      fireEvent.click(reviewConsent());
      expect(reviewButton()).toBeEnabled();
      expect(platform.reviewHighlights).not.toHaveBeenCalled();
    });

    it("flags weak highlights by name and leaves the resume unchanged", async () => {
      vi.mocked(platform.reviewHighlights).mockResolvedValue(reviewsFor());
      await openExperience();
      const originalBullet = workspace.resumes[0].experience[0].bullets[1];

      fireEvent.click(reviewConsent());
      fireEvent.click(reviewButton());

      expect(await screen.findByText("Weak project, result")).toBeVisible();
      expect(screen.getAllByText(/^Weak /)).toHaveLength(1);
      expect(screen.getByLabelText("Highlight 1.2")).toHaveValue(
        originalBullet,
      );
      const sent = vi.mocked(platform.reviewHighlights).mock.calls[0][0];
      expect(sent).toHaveLength(5);
      expect(Object.keys(sent[0]).sort()).toEqual([
        "bullet",
        "bulletIndex",
        "experienceId",
        "resumeId",
        "role",
      ]);
      expect(vi.mocked(platform.reviewHighlights).mock.calls[0][1]).toBe(true);
    });

    it("clears a badge once its highlight is edited", async () => {
      vi.mocked(platform.reviewHighlights).mockResolvedValue(reviewsFor());
      await openExperience();

      fireEvent.click(reviewConsent());
      fireEvent.click(reviewButton());
      await screen.findByText("Weak project, result");

      fireEvent.change(screen.getByLabelText("Highlight 1.2"), {
        target: { value: "Rewrote the design system rollout myself." },
      });

      await waitFor(() =>
        expect(screen.queryByText("Weak project, result")).toBeNull(),
      );
    });

    it("clears badges when the active resume changes", async () => {
      vi.mocked(platform.reviewHighlights).mockResolvedValue(reviewsFor());
      await openExperience();

      fireEvent.click(reviewConsent());
      fireEvent.click(reviewButton());
      await screen.findByText("Weak project, result");

      fireEvent.click(screen.getByRole("button", { name: /New resume/ }));

      await waitFor(() =>
        expect(screen.queryByText("Weak project, result")).toBeNull(),
      );
    });

    it("shows a visible error and no badges when the review fails", async () => {
      vi.mocked(platform.reviewHighlights).mockRejectedValue(
        new Error("Copilot returned an unreadable review."),
      );
      await openExperience();

      fireEvent.click(reviewConsent());
      fireEvent.click(reviewButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Copilot returned an unreadable review.",
      );
      expect(screen.queryByText(/^Weak /)).toBeNull();
    });
  });
});
