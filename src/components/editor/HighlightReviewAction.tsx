import { LoaderCircle, Sparkles } from "lucide-react";
import { desktop } from "../../platform";
import type { Resume } from "../../model";
import type { HighlightReviewController } from "./types";

type HighlightReviewActionProps = {
  resume: Resume;
  highlightReview: HighlightReviewController;
};

export function HighlightReviewAction({
  resume,
  highlightReview,
}: HighlightReviewActionProps) {
  return (
    <>
      {resume.experience.length > 0 && (
        <div className="highlight-review-action">
          <p className="highlight-review-intro">
            Ask GitHub Copilot to read every highlight in this resume and say
            which ones are missing a clear action, project, or result. Nothing
            is rewritten and nothing is changed.
          </p>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={highlightReview.consent}
              onChange={(event) =>
                highlightReview.onConsent(event.target.checked)
              }
              disabled={highlightReview.busy === "review" || !desktop}
            />
            <span>
              Send every highlight and role in this resume to GitHub Copilot for
              this request.
            </span>
          </label>
          <button
            className="button primary"
            disabled={
              !desktop ||
              !highlightReview.status?.available ||
              !highlightReview.consent ||
              Boolean(highlightReview.busy)
            }
            onClick={highlightReview.onReview}
          >
            {highlightReview.busy === "review" ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Sparkles size={16} />
            )}
            {highlightReview.busy === "review"
              ? "Reviewing every highlight…"
              : highlightReview.hasReviews
                ? "Review all highlights again"
                : "Review all highlights"}
          </button>
          {!desktop && (
            <p className="highlight-guidance-status" role="status">
              Reviewing every highlight is available only in the desktop app.
              You can keep editing locally.
            </p>
          )}
          {desktop && !highlightReview.status?.available && (
            <p className="highlight-guidance-status" role="status">
              GitHub Copilot is unavailable. Check the Copilot tab while keeping
              your highlights editable.
            </p>
          )}
        </div>
      )}
    </>
  );
}
