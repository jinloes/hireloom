import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as platform from "./platform";
import App from "./App";
import { setupAppHarness, workspace } from "./test/appHarness";

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
});
