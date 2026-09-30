import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as platform from "./platform";
import App from "./App";
import {
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
  }, 10_000);

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
});
