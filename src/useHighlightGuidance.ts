import { useState, type ComponentProps } from "react";
import {
  analyzeAccomplishment,
  refineAccomplishment,
  reviewHighlights,
  type CopilotStatus,
} from "./platform";
import {
  applyAprOption,
  type AprAnalysis,
  type AprOptionId,
  type AprTarget,
  type HighlightReview,
  type HighlightReviews,
  type Resume,
} from "./model";
import type { Editor } from "./components/Editor";
import type { Notice } from "./components/WorkspaceHeader";

type EditorProps = ComponentProps<typeof Editor>;
type AprSuggestion = { value: AprAnalysis; source: AprTarget };
type GuidanceBusy = "analyze" | "refine" | "review" | null;

/**
 * Transient inline highlight guidance and resume-wide highlight review state.
 * Nothing here is persisted; results are bound to exact local targets.
 */
export function useHighlightGuidance({
  resume,
  status,
  busy,
  panelBusy,
  setBusy,
  report,
  notify,
  changeResume,
  setUndo,
  announce,
}: {
  resume: Resume | undefined;
  status: CopilotStatus | null;
  busy: EditorProps["highlightReview"]["busy"];
  panelBusy: EditorProps["highlightGuidance"]["busy"];
  setBusy: (busy: GuidanceBusy) => void;
  report: (error: unknown) => void;
  notify: (notice: Notice) => void;
  changeResume: (next: Resume) => void;
  setUndo: (resume: Resume) => void;
  announce: (message: string) => void;
}) {
  const [aprTarget, setAprTarget] = useState<AprTarget | null>(null);
  const [aprConsent, setAprConsent] = useState(false);
  const [aprSuggestion, setAprSuggestion] = useState<AprSuggestion | null>(
    null,
  );
  const [aprSelectedOption, setAprSelectedOption] =
    useState<AprOptionId | null>(null);
  const [aprFeedback, setAprFeedback] = useState("");
  const [aprRefineConsent, setAprRefineConsent] = useState(false);
  // Batch review verdicts are transient session state and are never persisted.
  const [reviewConsent, setReviewConsent] = useState(false);
  const [highlightReviews, setHighlightReviews] =
    useState<HighlightReviews | null>(null);

  function resetApr() {
    setAprTarget(null);
    setAprConsent(false);
    setAprSuggestion(null);
    setAprSelectedOption(null);
    setAprFeedback("");
    setAprRefineConsent(false);
  }

  function resetHighlightReviews() {
    setHighlightReviews(null);
    setReviewConsent(false);
  }

  function selectAccomplishment(target: AprTarget) {
    setAprTarget(target);
    setAprConsent(false);
    setAprSuggestion(null);
    setAprSelectedOption(null);
    setAprFeedback("");
    setAprRefineConsent(false);
  }

  async function refineApr() {
    if (!aprSuggestion) return;
    if (!aprSourceIsCurrent(aprSuggestion.source)) {
      setAprRefineConsent(false);
      report(
        new Error(
          "This accomplishment changed. Request fresh guidance before refining.",
        ),
      );
      return;
    }
    setBusy("refine");
    try {
      const value = await refineAccomplishment(
        {
          target: aprSuggestion.source,
          options: aprSuggestion.value.options,
          feedback: aprFeedback.trim(),
        },
        aprRefineConsent,
      );
      setAprSuggestion({ value, source: aprSuggestion.source });
      setAprSelectedOption(null);
      setAprFeedback("");
      notify({
        kind: "success",
        text: "Your refined rewrite options are ready. Your resume has not been changed.",
      });
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
      setAprRefineConsent(false);
    }
  }

  async function analyzeApr() {
    if (!resume || !aprTarget) return;
    if (!aprSourceIsCurrent(aprTarget)) {
      setAprConsent(false);
      report(
        new Error(
          "This accomplishment changed. Select it again before sending it to Copilot.",
        ),
      );
      return;
    }
    setBusy("analyze");
    try {
      const review = eligibleAprReview(aprTarget);
      const value = review
        ? await analyzeAccomplishment(aprTarget, aprConsent, review)
        : await analyzeAccomplishment(aprTarget, aprConsent);
      setAprSuggestion({ value, source: aprTarget });
      setAprSelectedOption(null);
      setAprFeedback("");
      setAprRefineConsent(false);
      notify({
        kind: "success",
        text: "Your highlight guidance is ready to review. Your resume has not been changed.",
      });
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
      setAprConsent(false);
    }
  }

  function aprSourceIsCurrent(source: AprTarget): boolean {
    if (!resume || resume.id !== source.resumeId) return false;
    const experience = resume.experience.find(
      (entry) => entry.id === source.experienceId,
    );
    return Boolean(
      experience &&
      experience.role === source.role &&
      experience.bullets[source.bulletIndex] === source.bullet,
    );
  }

  function highlightReviewFor(
    experienceId: string,
    bulletIndex: number,
  ): HighlightReview | null {
    if (!highlightReviews) return null;
    const review = highlightReviews.find(
      (entry) =>
        entry.target.experienceId === experienceId &&
        entry.target.bulletIndex === bulletIndex,
    );
    // A badge only survives while its exact source highlight is unchanged.
    return review && aprSourceIsCurrent(review.target) ? review : null;
  }

  function eligibleAprReview(target: AprTarget): HighlightReview | null {
    const review = highlightReviewFor(target.experienceId, target.bulletIndex);
    return review &&
      (review.action !== "clear" ||
        review.project !== "clear" ||
        review.result !== "clear")
      ? review
      : null;
  }

  async function reviewAllHighlights() {
    if (!resume) return;
    const targets: AprTarget[] = resume.experience.flatMap((entry) =>
      entry.bullets
        .map((bullet, bulletIndex) => ({
          resumeId: resume.id,
          experienceId: entry.id,
          bulletIndex,
          role: entry.role,
          bullet,
        }))
        .filter((target) => target.bullet.trim().length > 0),
    );
    if (targets.length === 0) {
      report(
        new Error("Add at least one highlight before requesting a review."),
      );
      return;
    }
    setBusy("review");
    try {
      const reviews = await reviewHighlights(targets, reviewConsent);
      setHighlightReviews(reviews);
      const weak = reviews.filter(
        (review) =>
          review.action !== "clear" ||
          review.project !== "clear" ||
          review.result !== "clear",
      ).length;
      const summary = `Reviewed ${reviews.length} highlight${
        reviews.length === 1 ? "" : "s"
      }. ${weak} need${weak === 1 ? "s" : ""} work. Your resume has not been changed.`;
      notify({ kind: "success", text: summary });
      announce(summary);
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
      setReviewConsent(false);
    }
  }

  function applyAprSuggestion() {
    if (!resume || !aprSuggestion) return;
    if (!aprSourceIsCurrent(aprSuggestion.source)) {
      report(
        new Error(
          "This accomplishment changed. Analyze it again before applying.",
        ),
      );
      return;
    }
    const option = aprSuggestion.value.options.find(
      (candidate) => candidate.id === aprSelectedOption,
    );
    if (!option) {
      report(new Error("Select a fresh rewrite option before applying."));
      return;
    }
    try {
      changeResume(applyAprOption(resume, aprSuggestion.source, option));
      setUndo(resume);
      resetApr();
      notify({
        kind: "success",
        text: "Selected highlight option applied. You can undo this until your next edit.",
      });
    } catch (error) {
      report(error);
    }
  }

  const guidance: EditorProps["highlightGuidance"] = {
    target: aprTarget,
    onSelect: selectAccomplishment,
    consent: aprConsent,
    onConsent: setAprConsent,
    onAnalyze: () => void analyzeApr(),
    review: aprTarget ? eligibleAprReview(aprTarget) : null,
    analysis: aprSuggestion?.value ?? null,
    stale: aprTarget !== null && !aprSourceIsCurrent(aprTarget),
    onApply: applyAprSuggestion,
    selectedOption: aprSelectedOption,
    onSelectOption: setAprSelectedOption,
    onKeep: resetApr,
    feedback: aprFeedback,
    onFeedback: (value) => {
      setAprFeedback(value);
      setAprRefineConsent(false);
    },
    refineConsent: aprRefineConsent,
    onRefineConsent: setAprRefineConsent,
    onRefine: () => void refineApr(),
    status,
    busy: panelBusy,
  };

  const review: EditorProps["highlightReview"] = {
    reviewFor: highlightReviewFor,
    hasReviews: highlightReviews !== null,
    consent: reviewConsent,
    onConsent: setReviewConsent,
    onReview: () => void reviewAllHighlights(),
    status,
    busy,
  };

  return {
    guidance,
    review,
    resetApr,
    resetHighlightReviews,
    clearAprConsent: () => setAprConsent(false),
  };
}
