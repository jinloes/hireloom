import type { Resume } from "./model";
import type {
  ContentRemovalRequest,
  ContentViewState,
} from "./components/Editor";

export type ContentRemoval = ContentRemovalRequest & {
  resumeId: string;
  expiresAt: number;
};

/** Resume edit produced by removing or restoring one Content item. */
export type ContentChange = {
  next: Resume;
  /** Overrides applied on top of the reconciled stored view for the resume. */
  view: Partial<ContentViewState> | null;
  focusTarget: string;
  resetsGuidance: boolean;
};

const CONTENT_UNDO_MS = 8_000;

/** Records one removed item for the time-limited Undo action. */
export function contentRemovalRecord(
  request: ContentRemovalRequest,
  resumeId: string,
): ContentRemoval {
  return { ...request, resumeId, expiresAt: Date.now() + CONTENT_UNDO_MS };
}

export function defaultContentView(resume: Resume): ContentViewState {
  return {
    section: "personal",
    selectedExperienceId: resume.experience[0]?.id ?? null,
  };
}

export function reconcileContentView(
  resume: Resume,
  stored: ContentViewState | undefined,
): ContentViewState {
  const fallback = defaultContentView(resume);
  if (!stored) return fallback;
  return {
    ...stored,
    selectedExperienceId: resume.experience.some(
      (entry) => entry.id === stored.selectedExperienceId,
    )
      ? stored.selectedExperienceId
      : fallback.selectedExperienceId,
  };
}

/** Returns null when a highlight's parent experience no longer exists. */
export function removeContentItem(
  resume: Resume,
  request: ContentRemovalRequest,
): ContentChange | null {
  if (request.kind === "experience") {
    const experience = resume.experience.filter(
      (entry) => entry.id !== request.item.id,
    );
    const selected =
      experience[Math.min(request.index, experience.length - 1)] ?? null;
    return {
      next: { ...resume, experience },
      view: {
        section: "experience",
        selectedExperienceId: selected?.id ?? null,
      },
      focusTarget: selected
        ? `experience-summary-${selected.id}`
        : "add-experience",
      resetsGuidance: true,
    };
  }
  if (request.kind === "education") {
    const education = resume.education.filter(
      (entry) => entry.id !== request.item.id,
    );
    const nextEntry =
      education[Math.min(request.index, education.length - 1)] ?? null;
    return {
      next: { ...resume, education },
      view: null,
      focusTarget: nextEntry ? `education-${nextEntry.id}` : "add-education",
      resetsGuidance: false,
    };
  }
  const parent = resume.experience.find(
    (entry) => entry.id === request.parentExperienceId,
  );
  if (!parent) return null;
  const bullets = parent.bullets.filter((_, index) => index !== request.index);
  const nextIndex =
    bullets.length > 0 ? Math.min(request.index, bullets.length - 1) : -1;
  return {
    next: {
      ...resume,
      experience: resume.experience.map((entry) =>
        entry.id === parent.id ? { ...entry, bullets } : entry,
      ),
    },
    view: null,
    focusTarget:
      nextIndex >= 0
        ? `highlight-${parent.id}-${nextIndex}`
        : `add-highlight-${parent.id}`,
    resetsGuidance: true,
  };
}

/** Returns null when a highlight's parent experience no longer exists. */
export function restoreContentItem(
  resume: Resume,
  removal: ContentRemoval,
): ContentChange | null {
  if (removal.kind === "experience") {
    const experience = [...resume.experience];
    experience.splice(
      Math.min(removal.index, experience.length),
      0,
      removal.item,
    );
    return {
      next: { ...resume, experience },
      view: { section: "experience", selectedExperienceId: removal.item.id },
      focusTarget: `experience-summary-${removal.item.id}`,
      resetsGuidance: false,
    };
  }
  if (removal.kind === "education") {
    const education = [...resume.education];
    education.splice(
      Math.min(removal.index, education.length),
      0,
      removal.item,
    );
    return {
      next: { ...resume, education },
      view: { section: "education" },
      focusTarget: `education-${removal.item.id}`,
      resetsGuidance: false,
    };
  }
  const parent = resume.experience.find(
    (entry) => entry.id === removal.parentExperienceId,
  );
  if (!parent) return null;
  const bullets = [...parent.bullets];
  const restoredIndex = Math.min(removal.index, bullets.length);
  bullets.splice(restoredIndex, 0, removal.item);
  return {
    next: {
      ...resume,
      experience: resume.experience.map((entry) =>
        entry.id === parent.id ? { ...entry, bullets } : entry,
      ),
    },
    view: { section: "experience", selectedExperienceId: parent.id },
    focusTarget: `highlight-${parent.id}-${restoredIndex}`,
    resetsGuidance: false,
  };
}
