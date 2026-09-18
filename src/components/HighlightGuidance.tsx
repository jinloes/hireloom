import { useId } from "react";
import {
  CheckCheck,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type {
  AprAnalysis,
  AprOptionId,
  AprRefinement,
  AprTarget,
} from "../model";
import { desktop, type CopilotStatus } from "../platform";

export type HighlightGuidanceController = {
  target: AprTarget | null;
  onSelect: (target: AprTarget) => void;
  consent: boolean;
  onConsent: (value: boolean) => void;
  onAnalyze: () => void;
  analysis: AprAnalysis | null;
  stale: boolean;
  answers: string[];
  onAnswer: (index: number, value: string) => void;
  ideaAnswers: string[];
  onIdeaAnswer: (index: number, value: string) => void;
  additionalContext: string;
  onAdditionalContext: (value: string) => void;
  refinementConsent: boolean;
  onRefinementConsent: (value: boolean) => void;
  onRefine: () => void;
  refinement: AprRefinement | null;
  refinementStale: boolean;
  selectedOption: AprOptionId | null;
  onSelectOption: (value: AprOptionId) => void;
  onApply: () => void;
  onKeep: () => void;
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
    answers,
    onAnswer,
    ideaAnswers,
    onIdeaAnswer,
    additionalContext,
    onAdditionalContext,
    refinementConsent,
    onRefinementConsent,
    onRefine,
    refinement,
    refinementStale,
    selectedOption,
    onSelectOption,
    onApply,
    onKeep,
    status,
    busy,
  } = controller;

  if (!target) return null;

  const allClear =
    analysis?.action.status === "clear" &&
    analysis.project.status === "clear" &&
    analysis.result.status === "clear";
  const questions = allClear ? [] : (analysis?.questions ?? []);
  const ideasToVerify = analysis?.ideasToVerify ?? [];
  const selected =
    !refinementStale &&
    analysis?.options.find((option) => option.id === selectedOption);
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
          Only this highlight and the role “{target.role || "Untitled role"}”
          will be sent to GitHub Copilot. Resume IDs and the highlight position
          stay local.
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
            Review every claim. Missing details are optional and are never
            inferred.
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

          {allClear && (
            <p className="highlight-guidance-status" role="status">
              What you did, the product or project, and the impact are all
              clear. No follow-up questions are needed.
            </p>
          )}

          <div className="highlight-questions">
            <h4>Optional factual details</h4>
            <p className="fine-print">
              Answer only what you know, or add other factual context that would
              improve the suggestion. Blank fields stay local.
            </p>
            {questions.length > 0 &&
              questions.map((question, index) => (
                <div className="apr-answer" key={question}>
                  <p>{question}</p>
                  <GuidanceAnswerField
                    label={`Answer ${index + 1}`}
                    value={answers[index] ?? ""}
                    onChange={(value) => onAnswer(index, value)}
                    hint="Optional. Only nonblank answers are sent."
                  />
                </div>
              ))}
            {ideasToVerify.length > 0 && (
              <div
                className="highlight-ideas"
                aria-labelledby={`${regionId}-ideas-heading`}
              >
                <h4 id={`${regionId}-ideas-heading`}>Ideas to verify</h4>
                <p className="fine-print">
                  These ideas are unsupported until you confirm them. Answer
                  only with facts you know; otherwise leave them blank.
                </p>
                {ideasToVerify.map((question, index) => (
                  <div className="apr-answer" key={question}>
                    <p>{question}</p>
                    <GuidanceAnswerField
                      label={`Idea answer ${index + 1}`}
                      value={ideaAnswers[index] ?? ""}
                      onChange={(value) => onIdeaAnswer(index, value)}
                      hint="Optional. A nonblank answer is treated as a user-confirmed fact."
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="apr-answer">
              <GuidanceAnswerField
                label="Additional factual context"
                value={additionalContext}
                onChange={onAdditionalContext}
                hint="Optional. Add only facts you want Copilot to consider, such as the product area, audience, constraints, or supported impact."
                placeholder="Add relevant facts that the questions did not cover…"
              />
            </div>
            <div className="highlight-refinement-request">
              <p className="privacy-note highlight-disclosure">
                <ShieldCheck size={18} />
                <span>
                  A refinement sends only the role, original highlight, your
                  nonblank factual answers, confirmed idea answers, and
                  additional factual context. Unanswered questions and all other
                  resume data stay local.
                </span>
              </p>
              <label className="consent-check">
                <input
                  type="checkbox"
                  checked={refinementConsent}
                  onChange={(event) =>
                    onRefinementConsent(event.target.checked)
                  }
                  disabled={busy === "refine" || !desktop || stale}
                />
                <span>
                  Send these details with the selected role and highlight to
                  GitHub Copilot for this request.
                </span>
              </label>
              <button
                className="button primary generate-button"
                disabled={
                  !desktop ||
                  !status?.available ||
                  stale ||
                  (!answers.some((answer) => answer.trim()) &&
                    !ideaAnswers.some((answer) => answer.trim()) &&
                    !additionalContext.trim()) ||
                  !refinementConsent ||
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
                  ? "Refining suggestion…"
                  : "Refine with my details"}
              </button>
            </div>
          </div>

          {stale && (
            <p className="inline-error" role="status">
              This highlight, its role, position, experience, or active resume
              changed after guidance was requested. Request fresh guidance
              before applying.
            </p>
          )}
          {refinementStale && refinement && !stale && (
            <p className="inline-error" role="status">
              The answers or additional context changed after refinement. The
              refined options are stale until you refine again.
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
                disabled={stale || refinementStale || Boolean(busy)}
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
              Copilot did not provide truthful changed rewrite options. Keep the
              current highlight or add facts you know and request fresh
              guidance.
            </p>
          )}

          <div className="highlight-guidance-actions">
            <button
              className="button primary"
              disabled={!selected || stale || refinementStale || Boolean(busy)}
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

function GuidanceAnswerField({
  label,
  value,
  onChange,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        value={value}
        rows={3}
        maxLength={2_000}
        placeholder={placeholder}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="field-hint" id={`${id}-hint`}>
        {hint}
      </span>
    </div>
  );
}
