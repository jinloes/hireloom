import type { Education, Experience, HighlightReview } from "../../model";

export type HighlightReviewController = {
  reviewFor: (
    experienceId: string,
    bulletIndex: number,
  ) => HighlightReview | null;
  hasReviews: boolean;
  consent: boolean;
  onConsent: (value: boolean) => void;
  onReview: () => void;
  status: { available: boolean } | null;
  busy:
    | "status"
    | "login"
    | "generate"
    | "analyze"
    | "refine"
    | "review"
    | "draft"
    | null;
};

export type HighlightDraftOwner = { resumeId: string; experienceId: string };

export type HighlightDraftsController = {
  owner: HighlightDraftOwner | null;
  onToggle: (owner: HighlightDraftOwner) => void;
  onDiscard: () => void;
  notes: string;
  onNotes: (value: string) => void;
  consent: boolean;
  onConsent: (value: boolean) => void;
  onDraft: () => void;
  bullets: string[] | null;
  selected: number[];
  onSelect: (index: number, checked: boolean) => void;
  stale: boolean;
  onApply: () => void;
  status: { available: boolean } | null;
  busy: HighlightReviewController["busy"];
};

export type ContentSection =
  "personal" | "summary" | "experience" | "education" | "skills" | "additional";

export type ContentViewState = {
  section: ContentSection;
  selectedExperienceId: string | null;
};

export type ContentRemovalRequest =
  | {
      kind: "experience";
      item: Experience;
      index: number;
      label: string;
    }
  | {
      kind: "education";
      item: Education;
      index: number;
      label: string;
    }
  | {
      kind: "highlight";
      item: string;
      index: number;
      parentExperienceId: string;
      label: string;
    };
