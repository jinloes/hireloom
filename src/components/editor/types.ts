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
    "status" | "login" | "generate" | "analyze" | "refine" | "review" | null;
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
