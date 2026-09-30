import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { HighlightReviews } from "./model";
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

    it("sends matching weak review statuses with initial guidance", async () => {
      vi.mocked(platform.reviewHighlights).mockResolvedValue(reviewsFor());
      vi.mocked(platform.analyzeAccomplishment).mockImplementation(
        async (target) => aprResult(target),
      );
      await openExperience();

      fireEvent.click(reviewConsent());
      fireEvent.click(reviewButton());
      await screen.findByText("Weak project, result");

      fireEvent.click(
        screen.getAllByRole("button", {
          name: "Help me strengthen this highlight",
        })[1],
      );
      expect(
        screen.getByText(
          /current review statuses: Action clear, Project partial, Impact missing/,
        ),
      ).toBeVisible();
      expect(
        screen.getByRole("checkbox", {
          name: /plus its current review statuses/,
        }),
      ).toBeVisible();

      fireEvent.click(
        screen.getByRole("checkbox", {
          name: /plus its current review statuses/,
        }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Send for guidance" }),
      );
      await screen.findByText("Specific action.");

      expect(platform.analyzeAccomplishment).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeId: workspace.resumes[0].id,
          experienceId: workspace.resumes[0].experience[0].id,
          bulletIndex: 1,
          bullet: workspace.resumes[0].experience[0].bullets[1],
        }),
        true,
        expect.objectContaining({
          action: "clear",
          project: "partial",
          result: "missing",
        }),
      );
    });
  });
});
