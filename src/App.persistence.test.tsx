import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as platform from "./platform";
import App from "./App";
import { setupAppHarness } from "./test/appHarness";

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
