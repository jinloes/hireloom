import { z } from "zod";
import type { Resume } from "./model";

export const MAX_DRAFT_NOTES_BYTES = 4_000;
export const MAX_DRAFT_BULLETS = 5;
const MAX_HIGHLIGHTS = 30;

const utf8Length = (value: string) => new TextEncoder().encode(value).length;
const utf8String = (maxBytes: number, message: string) =>
  z.string().refine((value) => utf8Length(value) <= maxBytes, { message });
const nonblank = (schema: z.ZodType<string>, message: string) =>
  schema.refine((value) => value.trim().length > 0, { message });

export const highlightDraftTargetSchema = z.strictObject({
  resumeId: nonblank(
    utf8String(100, "ID must be at most 100 UTF-8 bytes."),
    "ID must not be blank.",
  ),
  experienceId: nonblank(
    utf8String(100, "ID must be at most 100 UTF-8 bytes."),
    "ID must not be blank.",
  ),
  role: utf8String(500, "Job title must be at most 500 UTF-8 bytes."),
  notes: nonblank(
    utf8String(
      MAX_DRAFT_NOTES_BYTES,
      "Notes must be at most 4,000 UTF-8 bytes.",
    ),
    "Add notes before drafting highlights.",
  ),
});

const draftedBullet = nonblank(
  utf8String(2_000, "Drafted highlights must be at most 2,000 UTF-8 bytes."),
  "Drafted highlights must not be blank.",
).refine((value) => !/[\r\n]/.test(value), {
  message: "Drafted highlights must each fit on one line.",
});

export const highlightDraftSchema = z
  .strictObject({
    target: highlightDraftTargetSchema,
    bullets: z.array(draftedBullet).min(1).max(MAX_DRAFT_BULLETS),
  })
  .superRefine((draft, context) => {
    const trimmed = draft.bullets.map((bullet) => bullet.trim());
    if (new Set(trimmed).size !== trimmed.length) {
      context.addIssue({
        code: "custom",
        message: "Copilot returned duplicate drafted highlights.",
        path: ["bullets"],
      });
    }
    if (trimmed.includes(draft.target.notes.trim())) {
      context.addIssue({
        code: "custom",
        message: "Copilot repeated the notes instead of drafting highlights.",
        path: ["bullets"],
      });
    }
  });

export type HighlightDraftTarget = z.infer<typeof highlightDraftTargetSchema>;
export type HighlightDraft = z.infer<typeof highlightDraftSchema>;

export function sameDraftTarget(
  left: HighlightDraftTarget,
  right: HighlightDraftTarget,
): boolean {
  return (
    left.resumeId === right.resumeId &&
    left.experienceId === right.experienceId &&
    left.role === right.role &&
    left.notes === right.notes
  );
}

export function validateHighlightDraftTarget(
  value: unknown,
  resume?: Resume,
): HighlightDraftTarget {
  const target = highlightDraftTargetSchema.parse(value);
  if (resume) {
    const experience = resume.experience.find(
      (entry) => entry.id === target.experienceId,
    );
    if (
      resume.id !== target.resumeId ||
      !experience ||
      experience.role !== target.role
    ) {
      throw new Error("These notes no longer match the selected job.");
    }
  }
  return target;
}

export function validateHighlightDraft(
  value: unknown,
  expected: HighlightDraftTarget,
): HighlightDraft {
  const draft = highlightDraftSchema.parse(value);
  if (!sameDraftTarget(draft.target, expected)) {
    throw new Error(
      "Copilot returned drafts for different notes. Nothing has been changed.",
    );
  }
  return draft;
}

export function appendDraftedHighlights(
  resume: Resume,
  draft: HighlightDraft,
  selectedIndexes: number[],
): Resume {
  const valid = highlightDraftSchema.parse(draft);
  const target = validateHighlightDraftTarget(valid.target, resume);
  if (selectedIndexes.length === 0) {
    throw new Error("Select at least one drafted highlight to add.");
  }
  if (
    new Set(selectedIndexes).size !== selectedIndexes.length ||
    selectedIndexes.some(
      (index) =>
        !Number.isInteger(index) || index < 0 || index >= valid.bullets.length,
    )
  ) {
    throw new Error("The selected drafted highlights are not valid.");
  }
  const experience = resume.experience.find(
    (entry) => entry.id === target.experienceId,
  )!;
  if (experience.bullets.length + selectedIndexes.length > MAX_HIGHLIGHTS) {
    throw new Error(
      "Adding these drafts would exceed the 30-highlight limit for this job.",
    );
  }
  const added = [...selectedIndexes]
    .sort((left, right) => left - right)
    .map((index) => valid.bullets[index]);
  return {
    ...resume,
    experience: resume.experience.map((entry) =>
      entry.id === target.experienceId
        ? { ...entry, bullets: [...entry.bullets, ...added] }
        : entry,
    ),
    updatedAt: new Date().toISOString(),
  };
}
