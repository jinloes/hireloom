import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  exampleResume,
  type AprAnalysis,
  type AprQuestionAnswer,
  type AprRefinement,
  type AprTarget,
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
    generateResume: vi.fn(),
    loginToCopilot: vi.fn(),
  };
});

let workspace: Workspace;

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
    questions: [],
    ideasToVerify: [],
    ...overrides,
  };
}

function refinementResult(
  target: AprTarget,
  answers: AprQuestionAnswer[],
  ideaAnswers: AprQuestionAnswer[],
  additionalContext: string,
  overrides: Partial<Omit<AprAnalysis, "target">> = {},
): AprRefinement {
  return {
    ...aprResult(target, overrides),
    answers,
    ideaAnswers,
    additionalContext,
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
          questions: ["What changed for customers after the redesign?"],
          ideasToVerify: ["Did onboarding completion improve?"],
        }),
    );
    render(<App />);
    await waitFor(() =>
      expect(
        screen.queryByText("Loading your studio…"),
      ).not.toBeInTheDocument(),
    );
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
    expect(screen.getByText(/Only this highlight and the role/)).toBeVisible();

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

    await screen.findByText("What changed for customers after the redesign?");
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
    expect(screen.getByText(/What changed for customers/)).toBeVisible();
    expect(screen.getByText("Ideas to verify")).toBeVisible();
    expect(screen.getByText(/unsupported until you confirm/)).toBeVisible();
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      originalBullet,
    );

    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "A changed unsent name" },
    });
    const apply = screen.getByRole("button", {
      name: "Apply selected option",
    });
    expect(apply).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /Concise · unified/ }));
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

  it("moves highlights within an experience and closes guidance before reindexing", async () => {
    const original = workspace.resumes[0];
    const firstHighlight = original.experience[0].bullets[0];
    const secondHighlight = original.experience[0].bullets[1];

    render(<App />);
    await screen.findByLabelText("Full name");

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

  it("suppresses questions for all-clear guidance and refines from additional context alone", async () => {
    const original = workspace.resumes[0];
    const originalBullet = original.experience[0].bullets[0];
    vi.mocked(platform.analyzeAccomplishment).mockImplementation(
      async (target) =>
        aprResult(target, {
          action: { status: "clear", feedback: "Specific action." },
          project: { status: "clear", feedback: "Specific project." },
          result: { status: "clear", feedback: "Supported impact." },
          questions: ["This backend question must be suppressed."],
        }),
    );
    vi.mocked(platform.refineAccomplishment).mockImplementation(
      async (
        target,
        _questions,
        answers,
        _ideas,
        ideaAnswers,
        additionalContext,
      ) =>
        refinementResult(target, answers, ideaAnswers, additionalContext, {
          options: [
            {
              id: "concise",
              bullets: [
                "Led the onboarding redesign for enterprise administrators across the setup flow.",
              ],
            },
            {
              id: "detail-forward",
              bullets: [
                "Led an enterprise administrator onboarding redesign across the full setup flow.",
              ],
            },
          ],
        }),
    );

    render(<App />);
    await screen.findByLabelText("Full name");
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
    expect(
      await screen.findByText(/No follow-up questions are needed/),
    ).toBeVisible();
    expect(
      screen.queryByText("This backend question must be suppressed."),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Additional factual context"), {
      target: {
        value: "  The product served enterprise administrators.  ",
      },
    });
    const refineConsent = screen.getByRole("checkbox", {
      name: /Send these details/,
    });
    fireEvent.click(refineConsent);
    fireEvent.click(
      screen.getByRole("button", { name: "Refine with my details" }),
    );
    await screen.findByText(
      "Led the onboarding redesign for enterprise administrators across the setup flow.",
    );
    expect(platform.refineAccomplishment).toHaveBeenCalledWith(
      expect.objectContaining({ bullet: originalBullet }),
      ["This backend question must be suppressed."],
      [],
      [],
      [],
      "The product served enterprise administrators.",
      true,
    );
    expect(
      screen.getByText(
        "Led the onboarding redesign for enterprise administrators across the setup flow.",
      ),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Keep current highlight" }),
    );
    expect(
      screen.queryByRole("region", { name: "Highlight guidance" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      originalBullet,
    );
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
  }, 15_000);

  it("refines from trimmed answers with separate consent, review, staleness, apply, and undo", async () => {
    const original = workspace.resumes[0];
    const originalBullet = original.experience[0].bullets[0];
    const initialRewrite = "Led a focused onboarding redesign.";
    const question = "What changed for customers?";
    const idea = "Did setup completion improve?";
    vi.mocked(platform.analyzeAccomplishment).mockImplementation(
      async (target) =>
        aprResult(target, {
          action: { status: "clear", feedback: "Specific action." },
          project: { status: "clear", feedback: "Specific project." },
          result: { status: "missing", feedback: "Needs a supported result." },
          options: [
            { id: "concise", bullets: [initialRewrite] },
            {
              id: "detail-forward",
              bullets: ["Led a focused customer onboarding redesign."],
            },
          ],
          questions: [question, "How did you validate the change?"],
          ideasToVerify: [idea],
        }),
    );
    vi.mocked(platform.refineAccomplishment)
      .mockImplementationOnce(
        async (
          target,
          _questions,
          answers,
          _ideas,
          ideaAnswers,
          additionalContext,
        ) =>
          refinementResult(target, answers, ideaAnswers, additionalContext, {
            options: [
              {
                id: "concise",
                bullets: [
                  "Led an onboarding redesign that made setup clearer for customers.",
                ],
              },
              {
                id: "detail-forward",
                bullets: [
                  "Led a customer onboarding redesign that made setup instructions clearer.",
                ],
              },
            ],
            questions: [question],
            ideasToVerify: [idea],
          }),
      )
      .mockImplementationOnce(
        async (
          target,
          _questions,
          answers,
          _ideas,
          ideaAnswers,
          additionalContext,
        ) =>
          refinementResult(target, answers, ideaAnswers, additionalContext, {
            options: [
              {
                id: "concise",
                bullets: [
                  "Led an onboarding redesign that reduced customer setup confusion.",
                ],
              },
              {
                id: "detail-forward",
                bullets: [
                  "Led a customer onboarding redesign that reduced setup confusion.",
                ],
              },
              {
                id: "split",
                bullets: [
                  "Led a customer onboarding redesign.",
                  "Reduced customer setup confusion with clearer guidance.",
                ],
              },
            ],
            questions: [],
            ideasToVerify: [],
          }),
      );

    render(<App />);
    await screen.findByLabelText("Full name");
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
    await screen.findByLabelText("Answer 1");

    const refine = screen.getByRole("button", {
      name: "Refine with my details",
    });
    const refinementConsent = screen.getByRole("checkbox", {
      name: /Send these details/,
    });
    expect(refine).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Answer 1"), {
      target: { value: "  Setup became clearer for customers.  " },
    });
    fireEvent.change(screen.getByLabelText("Idea answer 1"), {
      target: { value: "  Yes, completion improved by 4%.  " },
    });
    expect(refine).toBeDisabled();
    fireEvent.click(refinementConsent);
    expect(refine).toBeEnabled();
    fireEvent.click(refine);

    await screen.findByText(
      "Led an onboarding redesign that made setup clearer for customers.",
    );
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
      [idea],
      [{ question: idea, answer: "Yes, completion improved by 4%." }],
      "",
      true,
    );
    expect(refinementConsent).not.toBeChecked();
    expect(screen.queryByText(initialRewrite)).not.toBeInTheDocument();
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
      screen.getByText(
        /answers or additional context changed after refinement/,
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Led an onboarding redesign that made setup clearer for customers.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Apply selected option" }),
    ).toBeDisabled();

    fireEvent.click(refinementConsent);
    fireEvent.click(refine);
    await waitFor(() =>
      expect(
        screen.getByText(
          "Led an onboarding redesign that reduced customer setup confusion.",
        ),
      ).toBeVisible(),
    );
    fireEvent.click(
      screen.getByRole("radio", { name: /Split · two highlights/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Apply selected option" }),
    );
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      "Led a customer onboarding redesign.",
    );
    expect(screen.getByTestId("resume-preview")).toHaveTextContent(
      "Reduced customer setup confusion with clearer guidance.",
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
      async (target) =>
        aprResult(target, {
          action: { status: "clear", feedback: "Specific action." },
          project: { status: "partial", feedback: "Needs context." },
          result: { status: "missing", feedback: "Needs impact." },
          options: [
            { id: "concise", bullets: ["Initial rewrite."] },
            { id: "detail-forward", bullets: ["Initial detailed rewrite."] },
          ],
          questions: [question],
        }),
    );
    vi.mocked(platform.refineAccomplishment)
      .mockImplementationOnce(
        async (
          target,
          _questions,
          answers,
          _ideas,
          ideaAnswers,
          additionalContext,
        ) =>
          refinementResult(target, answers, ideaAnswers, additionalContext, {
            options: [
              { id: "concise", bullets: ["Prior refined rewrite."] },
              {
                id: "detail-forward",
                bullets: ["Prior detailed refined rewrite."],
              },
            ],
            questions: [question],
          }),
      )
      .mockRejectedValueOnce(new Error("Malformed Copilot response"));

    render(<App />);
    await screen.findByLabelText("Full name");
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
    await screen.findByLabelText("Answer 1");
    fireEvent.change(screen.getByLabelText("Answer 1"), {
      target: { value: "A supported result." },
    });
    const consent = screen.getByRole("checkbox", {
      name: /Send these details/,
    });
    const refine = screen.getByRole("button", {
      name: "Refine with my details",
    });
    fireEvent.click(consent);
    expect(refine).toBeEnabled();
    fireEvent.click(refine);
    await waitFor(() =>
      expect(platform.refineAccomplishment).toHaveBeenCalledTimes(1),
    );
    await screen.findByText("Prior refined rewrite.");
    fireEvent.change(screen.getByLabelText("Answer 1"), {
      target: { value: "Another supported result." },
    });
    fireEvent.click(consent);
    fireEvent.click(refine);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Malformed Copilot response",
    );
    expect(
      screen.getByRole("region", { name: "Highlight guidance" }),
    ).toBeVisible();
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
});
