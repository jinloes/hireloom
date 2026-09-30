import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
    expect(within(contentTabs).getAllByRole("tab")).toHaveLength(6);
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
      within(contentTabs).getByRole("tab", { name: "More" }),
    ).toHaveFocus();
    fireEvent.keyDown(within(contentTabs).getByRole("tab", { name: "More" }), {
      key: "Home",
    });
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
});
