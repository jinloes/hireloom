import { afterEach, describe, expect, it, vi } from "vitest";
import { exampleResume, type Resume } from "./model";
import {
  appendDraftedHighlights,
  highlightDraftTargetSchema,
  validateHighlightDraft,
  validateHighlightDraftTarget,
  type HighlightDraft,
  type HighlightDraftTarget,
} from "./highlightDrafts";

const tauri = vi.hoisted(() => ({
  desktop: false,
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => tauri.desktop,
  invoke: tauri.invoke,
}));

function targetFor(
  resume: Resume,
  notes = "migrated billing",
): HighlightDraftTarget {
  const experience = resume.experience[0];
  return {
    resumeId: resume.id,
    experienceId: experience.id,
    role: experience.role,
    notes,
  };
}

function draftFor(
  resume: Resume,
  bullets = ["Led A.", "Built B.", "Shipped C."],
) {
  return { target: targetFor(resume), bullets } satisfies HighlightDraft;
}

describe("highlight draft schemas", () => {
  it("enforces UTF-8 byte limits on notes", () => {
    const resume = exampleResume();
    const multibyte = "é".repeat(2_001);
    expect(multibyte.length).toBeLessThan(4_000);
    expect(() =>
      highlightDraftTargetSchema.parse(targetFor(resume, multibyte)),
    ).toThrow("Notes must be at most 4,000 UTF-8 bytes.");
    expect(() =>
      highlightDraftTargetSchema.parse(targetFor(resume, "a".repeat(4_000))),
    ).not.toThrow();
    expect(() =>
      highlightDraftTargetSchema.parse(targetFor(resume, " \n ")),
    ).toThrow();
  });

  it("binds a target to the current resume and exact role", () => {
    const resume = exampleResume();
    const target = targetFor(resume);
    expect(validateHighlightDraftTarget(target, resume)).toEqual(target);
    expect(() =>
      validateHighlightDraftTarget({ ...target, role: "Changed" }, resume),
    ).toThrow("no longer match");
    expect(() =>
      validateHighlightDraftTarget({ ...target, experienceId: "gone" }, resume),
    ).toThrow("no longer match");
    expect(() =>
      validateHighlightDraftTarget({ ...target, resumeId: "other" }, resume),
    ).toThrow("no longer match");
  });

  it("rejects drafts for a different target or with invalid bullets", () => {
    const resume = exampleResume();
    const draft = draftFor(resume);
    expect(validateHighlightDraft(draft, draft.target)).toEqual(draft);
    expect(() =>
      validateHighlightDraft(draft, { ...draft.target, notes: "other" }),
    ).toThrow("different notes");
    for (const bullets of [
      [],
      ["A.", "B.", "C.", "D.", "E.", "F."],
      ["Built B.", " Built B. "],
      ["Built B.\nShipped C."],
      [" "],
      ["migrated billing"],
    ]) {
      expect(() =>
        validateHighlightDraft({ ...draft, bullets }, draft.target),
      ).toThrow();
    }
    expect(() =>
      validateHighlightDraft({ ...draft, extra: true }, draft.target),
    ).toThrow();
  });
});

describe("appendDraftedHighlights", () => {
  it("appends only selected drafts in displayed order", () => {
    const resume = exampleResume();
    const before = resume.experience[0].bullets;
    const next = appendDraftedHighlights(resume, draftFor(resume), [2, 0]);
    expect(next.experience[0].bullets).toEqual([
      ...before,
      "Led A.",
      "Shipped C.",
    ]);
    expect(next.experience.slice(1)).toEqual(resume.experience.slice(1));
    expect(next.updatedAt).not.toBe("");
  });

  it("rejects empty, duplicate, or out-of-range selections", () => {
    const resume = exampleResume();
    const draft = draftFor(resume);
    expect(() => appendDraftedHighlights(resume, draft, [])).toThrow(
      "Select at least one",
    );
    expect(() => appendDraftedHighlights(resume, draft, [1, 1])).toThrow();
    expect(() => appendDraftedHighlights(resume, draft, [3])).toThrow();
    expect(() => appendDraftedHighlights(resume, draft, [-1])).toThrow();
  });

  it("enforces the 30-highlight limit", () => {
    const resume = exampleResume();
    const withCount = (count: number): Resume => ({
      ...resume,
      experience: resume.experience.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              bullets: Array.from({ length: count }, (_, n) => `B${n}`),
            }
          : entry,
      ),
    });
    expect(() =>
      appendDraftedHighlights(withCount(29), draftFor(resume), [0, 1]),
    ).toThrow("30-highlight limit");
    expect(
      appendDraftedHighlights(withCount(28), draftFor(resume), [0, 1])
        .experience[0].bullets,
    ).toHaveLength(30);
  });

  it("rejects a draft whose job title changed", () => {
    const resume = exampleResume();
    const draft = draftFor(resume);
    const renamed = {
      ...resume,
      experience: resume.experience.map((entry, index) =>
        index === 0 ? { ...entry, role: "Renamed" } : entry,
      ),
    };
    expect(() => appendDraftedHighlights(renamed, draft, [0])).toThrow(
      "no longer match",
    );
  });
});

describe("platform.draftHighlights", () => {
  afterEach(() => {
    tauri.invoke.mockReset();
    vi.resetModules();
  });

  it("never invokes outside the desktop app", async () => {
    tauri.desktop = false;
    const { draftHighlights } = await import("./platform");
    await expect(
      draftHighlights(targetFor(exampleResume()), true),
    ).rejects.toThrow("desktop app");
    expect(tauri.invoke).not.toHaveBeenCalled();
  });

  it("never invokes without consent", async () => {
    tauri.desktop = true;
    const { draftHighlights } = await import("./platform");
    await expect(
      draftHighlights(targetFor(exampleResume()), false),
    ).rejects.toThrow("Confirm");
    expect(tauri.invoke).not.toHaveBeenCalled();
  });

  it("sends only the target and consent, then validates the binding", async () => {
    tauri.desktop = true;
    const resume = exampleResume();
    const draft = draftFor(resume);
    tauri.invoke.mockResolvedValueOnce(draft);
    const { draftHighlights } = await import("./platform");
    await expect(draftHighlights(draft.target, true)).resolves.toEqual(draft);
    expect(tauri.invoke).toHaveBeenCalledWith("draft_highlights", {
      ...draft.target,
      consent: true,
    });
  });
});
