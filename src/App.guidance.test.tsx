import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as platform from "./platform";
import App from "./App";
import {
  aprResult,
  openContentSection,
  setupAppHarness,
  workspace,
} from "./test/appHarness";

vi.mock("@tauri-apps/api/window", async () =>
  (await import("./test/appHarness")).tauriWindowMock(),
);

vi.mock("./platform", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./platform")>();
  return {
    ...actual,
    ...(await import("./test/appHarness")).platformMock(),
  };
});

beforeEach(() => setupAppHarness(platform));

describe("resume studio", () => {
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
  }, 10_000);

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
});
