import {
  CheckCheck,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { AprAnalysis, AprOptionId, AprTarget } from "../model";
import { desktop, type CopilotStatus } from "../platform";

export type HighlightGuidanceController = {
  target: AprTarget | null;
  onSelect: (target: AprTarget) => void;
  consent: boolean;
  onConsent: (value: boolean) => void;
  onAnalyze: () => void;
  analysis: AprAnalysis | null;
  stale: boolean;
  selectedOption: AprOptionId | null;
  onSelectOption: (value: AprOptionId) => void;
  onApply: () => void;
  onKeep: () => void;
  feedback: string;
  onFeedback: (value: string) => void;
  refineConsent: boolean;
  onRefineConsent: (value: boolean) => void;
  onRefine: () => void;
  status: CopilotStatus | null;
  busy: "login" | "generate" | "analyze" | "refine" | "status" | null;
};

export function HighlightGuidance({
  controller,
  currentHighlight,
  regionId,
}: {
  controller: HighlightGuidanceController;
  currentHighlight: string;
  regionId: string;
}) {
  const {
    target,
    consent,
    onConsent,
    onAnalyze,
    analysis,
    stale,
    selectedOption,
    onSelectOption,
    onApply,
    onKeep,
    feedback,
    onFeedback,
    refineConsent,
    onRefineConsent,
    onRefine,
    status,
    busy,
  } = controller;

  if (!target) return null;

  const selected = analysis?.options.find(
    (option) => option.id === selectedOption,
  );
  const optionLabels: Record<AprOptionId, { title: string; tradeoff: string }> =
    {
      concise: {
        title: "Concise · unified",
        tradeoff:
          "Keeps the strongest supported facts in one compact highlight.",
      },
      "detail-forward": {
        title: "Detail-forward · unified",
        tradeoff: "Preserves more supported context in one highlight.",
      },
      split: {
        title: "Split · two highlights",
        tradeoff: "Separates two supported, nonredundant contributions.",
      },
    };

  return (
    <section
      className="highlight-guidance"
      id={regionId}
      aria-label="Highlight guidance"
      aria-live="polite"
    >
      <div className="highlight-guidance-heading">
        <div>
          <span className="eyebrow">FACT-BOUND GUIDANCE</span>
          <h3>Strengthen this highlight</h3>
        </div>
        <button
          className="icon-button"
          aria-label="Keep current highlight and close guidance"
          onClick={onKeep}
        >
          <X size={15} />
        </button>
      </div>

      <blockquote>{target.bullet}</blockquote>
      <p className="privacy-note highlight-disclosure">
        <ShieldCheck size={18} />
        <span>
          Initial guidance sends only this highlight and the role “
          {target.role || "Untitled role"}” to GitHub Copilot. Refinement also
          sends your feedback and the displayed options. Resume IDs and the
          highlight position stay local.
        </span>
      </p>
      <label className="consent-check">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => onConsent(event.target.checked)}
          disabled={busy === "analyze" || !desktop}
        />
        <span>
          Send this highlight and role to GitHub Copilot for this request.
        </span>
      </label>
      <button
        className="button primary generate-button"
        disabled={
          !desktop || !status?.available || !consent || Boolean(busy) || stale
        }
        onClick={onAnalyze}
      >
        {busy === "analyze" ? (
          <LoaderCircle className="spin" size={16} />
        ) : (
          <Sparkles size={16} />
        )}
        {busy === "analyze"
          ? "Reviewing highlight…"
          : analysis
            ? "Request fresh guidance"
            : "Send for guidance"}
      </button>
      {!desktop && (
        <p className="highlight-guidance-status" role="status">
          Highlight guidance is available only in the desktop app. You can keep
          editing locally.
        </p>
      )}
      {desktop && !status?.available && (
        <p className="highlight-guidance-status" role="status">
          GitHub Copilot is unavailable. Check the Copilot tab while keeping
          this highlight editable.
        </p>
      )}
      {busy === "analyze" && (
        <p className="highlight-guidance-status" role="status">
          Requesting fact-bound guidance. No changes are applied automatically.
        </p>
      )}

      {analysis && (
        <div className="highlight-analysis">
          <p className="fine-print">
            Copilot used only the selected role and highlight. Review every
            claim before applying an option.
          </p>
          {(
            [
              ["action", "What you did"],
              ["project", "Product or project"],
              ["result", "Impact"],
            ] as const
          ).map(([dimension, label]) => (
            <div className="highlight-dimension" key={dimension}>
              <h4>{label}</h4>
              <span className={`apr-status ${analysis[dimension].status}`}>
                {analysis[dimension].status}
              </span>
              <p>{analysis[dimension].feedback}</p>
            </div>
          ))}

          {stale && (
            <p className="inline-error" role="status">
              This highlight, its role, position, experience, or active resume
              changed after guidance was requested. Request fresh guidance
              before applying.
            </p>
          )}
          {analysis.options.length > 0 ? (
            <div className="highlight-options">
              <div className="highlight-current">
                <h4>Current highlight</h4>
                <p>{currentHighlight}</p>
              </div>
              <fieldset
                className="highlight-option-group"
                disabled={stale || Boolean(busy)}
              >
                <legend>Rewrite options</legend>
                <p className="fine-print">
                  Review every option, then select one. Nothing is selected or
                  applied automatically.
                </p>
                <div role="radiogroup" aria-label="Rewrite options">
                  {analysis.options.map((option) => (
                    <label
                      className={`highlight-option-card${selectedOption === option.id ? " selected" : ""}`}
                      key={option.id}
                    >
                      <input
                        type="radio"
                        name={`${regionId}-rewrite-option`}
                        value={option.id}
                        checked={selectedOption === option.id}
                        onChange={() => onSelectOption(option.id)}
                      />
                      <span className="highlight-option-copy">
                        <strong>{optionLabels[option.id].title}</strong>
                        <span>{optionLabels[option.id].tradeoff}</span>
                        <ul>
                          {option.bullets.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          ) : (
            <p className="highlight-guidance-status" role="status">
              Copilot did not return a usable rewrite. Your current highlight is
              unchanged; request fresh guidance to try again.
            </p>
          )}

          {!stale && analysis.options.length > 0 && (
            <div className="highlight-refinement">
              <label htmlFor={`${regionId}-feedback`}>
                Tell Gemini what to change
              </label>
              <span className="field-hint" id={`${regionId}-feedback-hint`}>
                For example: emphasize technical leadership, make the options
                punchier, or preserve more implementation detail.
              </span>
              <textarea
                id={`${regionId}-feedback`}
                aria-describedby={`${regionId}-feedback-hint`}
                value={feedback}
                maxLength={2000}
                rows={3}
                disabled={Boolean(busy)}
                onChange={(event) => onFeedback(event.target.value)}
              />
              <label className="consent-check">
                <input
                  type="checkbox"
                  checked={refineConsent}
                  onChange={(event) => onRefineConsent(event.target.checked)}
                  disabled={busy === "refine" || !desktop}
                />
                <span>
                  Send this feedback, the original highlight and role, and the
                  displayed options to GitHub Copilot for this request.
                </span>
              </label>
              <button
                className="button secondary"
                disabled={
                  !feedback.trim() ||
                  !refineConsent ||
                  !desktop ||
                  !status?.available ||
                  Boolean(busy)
                }
                onClick={onRefine}
              >
                {busy === "refine" ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Sparkles size={16} />
                )}
                {busy === "refine"
                  ? "Refining options…"
                  : "Refine rewrite options"}
              </button>
              {busy === "refine" && (
                <p className="highlight-guidance-status" role="status">
                  Refining the options from your feedback. The current options
                  remain available if this request fails.
                </p>
              )}
            </div>
          )}

          <div className="highlight-guidance-actions">
            <button
              className="button primary"
              disabled={!selected || stale || Boolean(busy)}
              onClick={onApply}
            >
              <CheckCheck size={16} /> Apply selected option
            </button>
            <button
              className="button secondary"
              disabled={Boolean(busy)}
              onClick={onKeep}
            >
              Keep current highlight
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
