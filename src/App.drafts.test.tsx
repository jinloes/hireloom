import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as platform from "./platform";
import App from "./App";
import { createResume } from "./model";
import type { HighlightDraftTarget } from "./highlightDrafts";
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

const DRAFTS = [
  "Migrated billing to a new payment provider.",
  "Reduced failed charges by retrying declined payments.",
  "Documented the payment rollout for support teams.",
];

beforeEach(() => {
  setupAppHarness(platform);
  vi.mocked(platform.draftHighlights).mockImplementation(
    async (target: HighlightDraftTarget) => ({ target, bullets: DRAFTS }),
  );
});

async function openDrafts() {
  render(<App />);
  await screen.findByLabelText("Full name");
  openContentSection("Experience");
  const toggle = screen.getByRole("button", {
    name: "Draft highlights from notes",
  });
  fireEvent.click(toggle);
  return toggle;
}

const notesField = () => screen.getByLabelText("Rough notes about this job");
const consentBox = () =>
  screen.getByRole("checkbox", { name: /Send these notes and job title/ });
const draftButton = () =>
  screen.getByRole("button", { name: "Draft highlights" });
const addButton = () =>
  screen.getByRole("button", { name: "Add selected highlights" });
const highlightValues = () =>
  screen
    .getAllByLabelText(/^Highlight 1\.\d+$/)
    .map((field) => (field as HTMLTextAreaElement).value);

async function requestDrafts(notes = "migrated billing; fewer failed charges") {
  fireEvent.change(notesField(), { target: { value: notes } });
  fireEvent.click(consentBox());
  fireEvent.click(draftButton());
  await screen.findByRole("checkbox", { name: DRAFTS[0] });
}

function expectPanelCleared() {
  expect(
    screen.queryByRole("region", { name: "Draft highlights from notes" }),
  ).toBeNull();
  expect(screen.queryByLabelText("Rough notes about this job")).toBeNull();
  expect(screen.queryByRole("checkbox", { name: DRAFTS[0] })).toBeNull();
}

describe("draft highlights from notes", () => {
  it("requires consent and nonblank notes before sending only the target", async () => {
    const original = workspace.resumes[0];
    const toggle = await openDrafts();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("region", { name: "Draft highlights from notes" }),
    ).toHaveAttribute("id", toggle.getAttribute("aria-controls"));
    expect(notesField()).toHaveAttribute("maxLength", "4000");
    expect(
      screen.getByText(/sends only these notes and the job title/),
    ).toBeVisible();
    expect(consentBox()).not.toBeChecked();
    expect(draftButton()).toBeDisabled();

    fireEvent.click(consentBox());
    expect(draftButton()).toBeDisabled();
    fireEvent.click(draftButton());
    expect(platform.draftHighlights).not.toHaveBeenCalled();

    fireEvent.change(notesField(), { target: { value: "shipped billing" } });
    expect(consentBox()).not.toBeChecked();
    fireEvent.click(consentBox());
    expect(draftButton()).toBeEnabled();
    fireEvent.click(draftButton());
    await screen.findByRole("checkbox", { name: DRAFTS[0] });

    expect(platform.draftHighlights).toHaveBeenCalledTimes(1);
    expect(platform.draftHighlights).toHaveBeenCalledWith(
      {
        resumeId: original.id,
        experienceId: original.experience[0].id,
        role: original.experience[0].role,
        notes: "shipped billing",
      },
      true,
    );
    expect(consentBox()).not.toBeChecked();
  });

  it("never sends without consent", async () => {
    await openDrafts();
    fireEvent.change(notesField(), { target: { value: "shipped billing" } });
    fireEvent.click(draftButton());
    expect(platform.draftHighlights).not.toHaveBeenCalled();
  });

  it("adds only selected drafts in order, and AI undo restores them", async () => {
    await openDrafts();
    const before = highlightValues();
    await requestDrafts();
    for (const draft of DRAFTS) {
      expect(screen.getByRole("checkbox", { name: draft })).not.toBeChecked();
    }
    expect(screen.getByText(/Review every claim/)).toBeVisible();

    fireEvent.click(screen.getByRole("checkbox", { name: DRAFTS[2] }));
    fireEvent.click(screen.getByRole("checkbox", { name: DRAFTS[0] }));
    fireEvent.click(addButton());

    expect(highlightValues()).toEqual([...before, DRAFTS[0], DRAFTS[2]]);
    expect(screen.getByText(/Added 2 highlights/)).toBeVisible();
    expectPanelCleared();

    fireEvent.click(screen.getByRole("button", { name: "Undo AI changes" }));
    expect(highlightValues()).toEqual(before);
  });

  it("requires a selection before adding", async () => {
    await openDrafts();
    const before = highlightValues();
    await requestDrafts();
    fireEvent.click(addButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Select at least one drafted highlight to add.",
    );
    expect(highlightValues()).toEqual(before);
  });

  it("keeps exact notes with a trailing newline fresh", async () => {
    await openDrafts();
    const before = highlightValues();
    await requestDrafts("migrated billing\n");
    expect(vi.mocked(platform.draftHighlights).mock.calls[0][0].notes).toBe(
      "migrated billing\n",
    );
    expect(screen.queryByText(/changed after drafting/)).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: DRAFTS[1] }));
    fireEvent.click(addButton());
    expect(highlightValues()).toEqual([...before, DRAFTS[1]]);
  });

  it("blocks stale drafts after a notes edit", async () => {
    await openDrafts();
    const before = highlightValues();
    await requestDrafts();
    fireEvent.change(notesField(), { target: { value: "different notes" } });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your notes or this job changed after drafting.",
    );
    expect(addButton()).toBeDisabled();
    expect(highlightValues()).toEqual(before);
  });

  it("blocks stale drafts after a job title edit", async () => {
    await openDrafts();
    const before = highlightValues();
    await requestDrafts();
    fireEvent.change(screen.getByLabelText("Job title 1"), {
      target: { value: "Design Lead" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your notes or this job changed after drafting.",
    );
    expect(addButton()).toBeDisabled();
    expect(highlightValues()).toEqual(before);
  });

  it("shows a platform error and leaves the resume unchanged", async () => {
    vi.mocked(platform.draftHighlights).mockRejectedValue(
      new Error("Copilot returned unreadable drafts."),
    );
    await openDrafts();
    const before = highlightValues();
    fireEvent.change(notesField(), { target: { value: "shipped billing" } });
    fireEvent.click(consentBox());
    fireEvent.click(draftButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Copilot returned unreadable drafts.",
    );
    expect(highlightValues()).toEqual(before);
    expect(consentBox()).not.toBeChecked();
  });

  it("reports the notes byte limit before sending", async () => {
    await openDrafts();
    fireEvent.change(notesField(), { target: { value: "é".repeat(2_001) } });
    fireEvent.click(consentBox());
    fireEvent.click(draftButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Notes must be at most 4,000 UTF-8 bytes.",
    );
    expect(platform.draftHighlights).not.toHaveBeenCalled();
  });

  it("discards drafts without editing the resume", async () => {
    await openDrafts();
    const before = highlightValues();
    await requestDrafts();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expectPanelCleared();
    expect(highlightValues()).toEqual(before);
  });

  it("clears the panel when switching jobs", async () => {
    await openDrafts();
    await requestDrafts();
    fireEvent.click(
      document.getElementById(
        `experience-summary-${workspace.resumes[0].experience[1].id}`,
      )!,
    );
    expectPanelCleared();
    fireEvent.click(
      document.getElementById(
        `experience-summary-${workspace.resumes[0].experience[0].id}`,
      )!,
    );
    expectPanelCleared();
  });

  it("clears the panel when the owning job is removed", async () => {
    await openDrafts();
    await requestDrafts();
    fireEvent.click(screen.getByRole("button", { name: "Remove position 1" }));
    expectPanelCleared();
  });

  it("clears the panel when switching resumes", async () => {
    const second = { ...createResume(), title: "Second resume" };
    workspace.resumes.push(second);
    await openDrafts();
    await requestDrafts();
    fireEvent.click(screen.getByRole("button", { name: /Second resume/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Product designer · example/ }),
    );
    openContentSection("Experience");
    expectPanelCleared();
  });

  it("clears the panel when adding a resume", async () => {
    await openDrafts();
    await requestDrafts();
    fireEvent.click(screen.getByRole("button", { name: /New resume/ }));
    expectPanelCleared();
  });

  it("clears the panel after importing a backup", async () => {
    await openDrafts();
    await requestDrafts();
    const backup = JSON.stringify({
      version: 2,
      activeResumeId: workspace.resumes[0].id,
      resumes: [workspace.resumes[0]],
    });
    fireEvent.change(screen.getByLabelText("Import Hireloom backup"), {
      target: {
        // jsdom's File does not implement text().
        files: [
          Object.assign(
            new File([backup], "backup.json", { type: "application/json" }),
            { text: async () => backup },
          ),
        ],
      },
    });
    await screen.findByText(/Imported 1 resume/);
    expectPanelCleared();
  });

  it("disables drafting when Copilot is unavailable", async () => {
    vi.mocked(platform.copilotStatus).mockResolvedValue({
      available: false,
      version: null,
      detail: "Not installed.",
    });
    await openDrafts();
    fireEvent.change(notesField(), { target: { value: "shipped billing" } });
    fireEvent.click(consentBox());
    await waitFor(() => expect(draftButton()).toBeDisabled());
    expect(screen.getByText(/keeping this job editable/)).toBeVisible();
  });

  it("disables drafting while another AI request is busy", async () => {
    vi.mocked(platform.reviewHighlights).mockReturnValue(
      new Promise(() => undefined),
    );
    await openDrafts();
    fireEvent.change(notesField(), { target: { value: "shipped billing" } });
    fireEvent.click(consentBox());
    expect(draftButton()).toBeEnabled();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Send every highlight and role in this resume/,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review all highlights" }),
    );
    await waitFor(() => expect(draftButton()).toBeDisabled());
    expect(platform.draftHighlights).not.toHaveBeenCalled();
  });
});
