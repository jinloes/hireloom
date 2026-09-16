import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { exampleResume, type Workspace } from "./model";
import * as platform from "./platform";
import App from "./App";

vi.mock("./platform", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./platform")>();
  return {
    ...actual,
    desktop: false,
    loadWorkspace: vi.fn(),
    saveWorkspace: vi.fn().mockResolvedValue(undefined),
    copilotStatus: vi.fn().mockResolvedValue({
      available: true,
      version: "test-cli",
      detail: "CLI installed; sign-in not verified.",
    }),
    generateResume: vi.fn(),
    loginToCopilot: vi.fn(),
  };
});

let workspace: Workspace;

beforeEach(() => {
  const resume = exampleResume();
  workspace = { version: 1, activeResumeId: resume.id, resumes: [resume] };
  vi.mocked(platform.loadWorkspace).mockResolvedValue(workspace);
  vi.mocked(platform.saveWorkspace).mockResolvedValue(undefined);
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
      screen.queryByText("Autosaved in this browser"),
    ).not.toBeInTheDocument();
    finishFirstSave?.();
    await waitFor(() =>
      expect(platform.saveWorkspace).toHaveBeenCalledTimes(2),
    );
    expect(
      vi.mocked(platform.saveWorkspace).mock.calls[1][0].resumes[0].basics.name,
    ).toBe("Latest revision");
    expect(await screen.findByText("Autosaved in this browser")).toBeVisible();
  });
});
