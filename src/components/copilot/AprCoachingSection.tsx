import { useEffect, useRef } from "react";
import {
  CheckCheck,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  projectRoleLabel,
  type AprAnalysis,
  type AprRefinement,
  type AprTarget,
  type Resume,
} from "../../model";
import { desktop } from "../../platform";
import { Field } from "../Editor";
import type { KeywordEntry } from "./KeywordTriageCard";
import {
  findGroundingItem,
  GroundingBadge,
  type AiBusyKind,
} from "./ProposalPrimitives";

export function AprCoachingSection({
  sectionRef,
  resume,
  activeProviderLabel,
  providerReady,
  busy,
  missingKeywords,
  aprFocusKeyword,
  onSetAprFocusKeyword,
  aprTarget,
  onSelectApr,
  aprConsent,
  onAprConsent,
  onAnalyzeApr,
  aprAnalysis,
  aprStale,
  onApplyApr,
  onDiscardApr,
  aprAnswers,
  onAprAnswer,
  aprRefinementConsent,
  onAprRefinementConsent,
  onRefineApr,
  aprRefinement,
  aprRefinementStale,
  onApplyAprRefinement,
}: {
  sectionRef: React.RefObject<HTMLElement | null>;
  resume: Resume;
  activeProviderLabel: string;
  providerReady: boolean;
  busy: AiBusyKind;
  missingKeywords: KeywordEntry[];
  aprFocusKeyword: string;
  onSetAprFocusKeyword: (value: string) => void;
  aprTarget: AprTarget | null;
  onSelectApr: (target: AprTarget) => void;
  aprConsent: boolean;
  onAprConsent: (value: boolean) => void;
  onAnalyzeApr: () => void;
  aprAnalysis: AprAnalysis | null;
  aprStale: boolean;
  onApplyApr: () => void;
  onDiscardApr: () => void;
  aprAnswers: string[];
  onAprAnswer: (index: number, value: string) => void;
  aprRefinementConsent: boolean;
  onAprRefinementConsent: (value: boolean) => void;
  onRefineApr: () => void;
  aprRefinement: AprRefinement | null;
  aprRefinementStale: boolean;
  onApplyAprRefinement: () => void;
}) {
  const requestCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aprTarget) return;
    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestCardRef.current?.scrollIntoView?.({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "nearest",
    });
  }, [aprTarget]);

  return (
    <section
      ref={sectionRef}
      className="apr-section"
      aria-labelledby="apr-heading"
    >
      <div className="card-heading">
        <div>
          <span className="eyebrow">ACTION · PROJECT · RESULT</span>
          <h2 id="apr-heading">Analyze accomplishments</h2>
        </div>
      </div>
      <p className="fine-print">
        Review one accomplishment at a time for a specific action, meaningful
        project, and supported result. {activeProviderLabel} may suggest
        improvements, but you decide whether to apply them.
      </p>
      {aprFocusKeyword && (
        <div className="apr-keyword-banner">
          <span>
            Target skill focus: <strong>{aprFocusKeyword}</strong>
          </span>
          <button
            type="button"
            className="text-button"
            aria-label="Clear target skill focus"
            onClick={() => {
              onSetAprFocusKeyword("");
              if (aprTarget?.focusKeyword) {
                const clean = { ...aprTarget };
                delete clean.focusKeyword;
                onSelectApr(clean);
              }
            }}
          >
            <X size={12} /> Clear
          </button>
        </div>
      )}
      {aprTarget && (
        <div ref={requestCardRef} className="apr-request-card">
          <div className="card-heading">
            <h3>Selected accomplishment</h3>
            <button
              type="button"
              className="icon-button"
              aria-label="Clear selected accomplishment"
              onClick={onDiscardApr}
            >
              <X size={16} />
            </button>
          </div>
          <blockquote>{aprTarget.bullet}</blockquote>
          {missingKeywords.length > 0 && (
            <div className="field apr-keyword-picker">
              <label htmlFor="apr-focus-keyword-select">
                Optional target job keyword for follow-up questions
              </label>
              <select
                id="apr-focus-keyword-select"
                value={aprTarget.focusKeyword ?? ""}
                disabled={busy === "analyze" || !desktop}
                onChange={(e) => {
                  const kw = e.target.value.trim();
                  onSetAprFocusKeyword(kw);
                  const nextTarget: AprTarget = {
                    resumeId: aprTarget.resumeId,
                    experienceId: aprTarget.experienceId,
                    bulletIndex: aprTarget.bulletIndex,
                    role: aprTarget.role,
                    bullet: aprTarget.bullet,
                    ...(kw ? { focusKeyword: kw } : {}),
                  };
                  onSelectApr(nextTarget);
                }}
              >
                <option value="">None (general APR review)</option>
                {missingKeywords.map(({ term }) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="privacy-note apr-disclosure">
            <ShieldCheck size={18} />
            <span>
              {aprTarget.focusKeyword
                ? `Only this bullet, the role “${aprTarget.role || "Untitled role"}”, and target keyword “${aprTarget.focusKeyword}”`
                : `Only this bullet and the role “${aprTarget.role || "Untitled role"}”`}{" "}
              will be sent to {activeProviderLabel}. Resume IDs and the bullet
              position stay local.
            </span>
          </p>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={aprConsent}
              onChange={(event) => onAprConsent(event.target.checked)}
              disabled={busy === "analyze" || !desktop}
            />
            <span>
              Send this selected bullet and role
              {aprTarget.focusKeyword
                ? ` (with target keyword “${aprTarget.focusKeyword}”)`
                : ""}{" "}
              to {activeProviderLabel} for this APR request.
            </span>
          </label>
          <button
            type="button"
            className="button primary generate-button"
            disabled={
              !desktop || !providerReady || !aprConsent || Boolean(busy)
            }
            onClick={onAnalyzeApr}
          >
            {busy === "analyze" ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Sparkles size={17} />
            )}
            {busy === "analyze"
              ? "Analyzing accomplishment…"
              : "Confirm APR analysis"}
          </button>
          {!desktop && (
            <p className="fine-print" role="status">
              APR analysis is available only in the desktop app.
            </p>
          )}
          {desktop && !providerReady && (
            <p className="fine-print" role="status">
              Configure {activeProviderLabel} in Provider Setup before running
              APR analysis.
            </p>
          )}
        </div>
      )}
      {aprAnalysis && (
        <section className="apr-analysis" aria-label="APR analysis">
          <div className="card-heading">
            <strong>
              <Sparkles size={16} /> APR review
            </strong>
            <button
              type="button"
              className="icon-button"
              aria-label="Discard APR analysis"
              onClick={onDiscardApr}
            >
              <X size={16} />
            </button>
          </div>
          <p className="fine-print">
            Review every claim. Ask yourself the follow-up questions before
            adding facts or metrics.
          </p>
          {aprAnalysis.verificationWarning && (
            <p className="inline-error">{aprAnalysis.verificationWarning}</p>
          )}
          {(["action", "project", "result"] as const).map((dimension) => (
            <div className="apr-dimension" key={dimension}>
              <h3>{dimension}</h3>
              <span className={`apr-status ${aprAnalysis[dimension].status}`}>
                {aprAnalysis[dimension].status}
              </span>
              <p>{aprAnalysis[dimension].feedback}</p>
            </div>
          ))}
          {aprAnalysis.rewrite !== undefined && (
            <div className="apr-rewrite">
              <h3>Suggested rewrite</h3>
              <p>{aprAnalysis.rewrite || "(No rewrite suggested)"}</p>
              <GroundingBadge
                item={findGroundingItem(aprAnalysis.verification, "rewrite")}
              />
            </div>
          )}
          {aprAnalysis.questions.length > 0 && (
            <div className="proposal-notes apr-questions">
              <h3>Questions to strengthen the result</h3>
              {aprAnalysis.questions.map((question, index) => (
                <div className="apr-answer" key={question}>
                  <p>{question}</p>
                  <Field
                    label={`Answer ${index + 1}`}
                    value={aprAnswers[index] ?? ""}
                    onChange={(value) => onAprAnswer(index, value)}
                    multiline
                    rows={3}
                    maxLength={2_000}
                    hint="Optional. Only nonblank answers are sent."
                  />
                </div>
              ))}
              <div className="apr-refinement-request">
                <p className="privacy-note apr-disclosure">
                  <ShieldCheck size={18} />
                  <span>
                    A refinement sends only the role, original bullet, and your
                    nonblank question-and-answer pairs. Unanswered questions,
                    resume IDs, APR feedback, the initial rewrite, contact
                    details, and all other resume data stay local.
                  </span>
                </p>
                <label className="consent-check">
                  <input
                    type="checkbox"
                    checked={aprRefinementConsent}
                    onChange={(event) =>
                      onAprRefinementConsent(event.target.checked)
                    }
                    disabled={busy === "refine" || !desktop || aprStale}
                  />
                  <span>
                    Send these nonblank answers with the selected role and
                    bullet to {activeProviderLabel} for this refinement request.
                  </span>
                </label>
                <button
                  type="button"
                  className="button primary generate-button"
                  disabled={
                    !desktop ||
                    !providerReady ||
                    aprStale ||
                    !aprAnswers.some((answer) => answer.trim()) ||
                    !aprRefinementConsent ||
                    Boolean(busy)
                  }
                  onClick={onRefineApr}
                >
                  {busy === "refine" ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Sparkles size={17} />
                  )}
                  {busy === "refine"
                    ? "Refining rewrite…"
                    : "Refine rewrite with answers"}
                </button>
                {!desktop && (
                  <p className="fine-print" role="status">
                    APR refinement is available only in the desktop app.
                  </p>
                )}
                {desktop && !providerReady && (
                  <p className="fine-print" role="status">
                    Configure {activeProviderLabel} in Provider Setup before
                    refining this rewrite.
                  </p>
                )}
              </div>
            </div>
          )}
          {aprRefinement && (
            <section
              className="apr-refinement"
              aria-label="Latest refined rewrite"
            >
              <h3>Latest refined rewrite</h3>
              <p>{aprRefinement.rewrite}</p>
              {aprRefinement.verificationWarning && (
                <p className="inline-error">
                  {aprRefinement.verificationWarning}
                </p>
              )}
              <GroundingBadge
                item={findGroundingItem(aprRefinement.verification, "rewrite")}
              />
              {aprRefinementStale && (
                <p className="inline-error">
                  This accomplishment or its answers changed after refinement.
                  Restore the submitted answers or refine again before applying.
                </p>
              )}
              <button
                type="button"
                className="button primary"
                disabled={aprRefinementStale || Boolean(busy)}
                onClick={onApplyAprRefinement}
              >
                <CheckCheck size={16} /> Apply refined rewrite
              </button>
            </section>
          )}
          {aprStale && (
            <p className="inline-error">
              This accomplishment or its role changed after analysis. Analyze it
              again before applying.
            </p>
          )}
          <button
            type="button"
            className="button primary"
            disabled={
              aprStale ||
              Boolean(busy) ||
              !aprAnalysis.rewrite?.trim() ||
              aprAnalysis.rewrite === aprAnalysis.target.bullet
            }
            onClick={onApplyApr}
          >
            <CheckCheck size={16} /> Apply initial rewrite
          </button>
        </section>
      )}
      <div className="accomplishment-groups">
        {resume.experience.map((experience) => {
          const accomplishments = experience.bullets
            .map((text, bulletIndex) => ({ text, bulletIndex }))
            .filter(({ text }) => text.trim());
          if (!accomplishments.length) return null;
          return (
            <div className="accomplishment-group" key={experience.id}>
              <h3>{experience.role.trim() || "Untitled role"}</h3>
              <ul>
                {accomplishments.map(({ text, bulletIndex }) => {
                  const selected =
                    aprTarget?.resumeId === resume.id &&
                    aprTarget.experienceId === experience.id &&
                    aprTarget.bulletIndex === bulletIndex;
                  return (
                    <li key={bulletIndex}>
                      <p>{text}</p>
                      <div className="button-row">
                        <button
                          type="button"
                          className="button secondary small"
                          aria-pressed={selected}
                          onClick={() =>
                            onSelectApr({
                              resumeId: resume.id,
                              experienceId: experience.id,
                              bulletIndex,
                              role: experience.role,
                              bullet: text,
                              ...(aprFocusKeyword
                                ? { focusKeyword: aprFocusKeyword }
                                : {}),
                            })
                          }
                        >
                          Analyze with APR
                        </button>
                        {selected && (
                          <span className="apr-selected-badge">Selected</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {resume.projects.map((project) => {
          const accomplishments = project.bullets
            .map((text, bulletIndex) => ({ text, bulletIndex }))
            .filter(({ text }) => text.trim());
          if (!accomplishments.length) return null;
          const roleLabel = projectRoleLabel(project);
          return (
            <div className="accomplishment-group" key={project.id}>
              <h3>{project.name.trim() || "Untitled project"}</h3>
              <ul>
                {accomplishments.map(({ text, bulletIndex }) => {
                  const selected =
                    aprTarget?.resumeId === resume.id &&
                    aprTarget.experienceId === project.id &&
                    aprTarget.bulletIndex === bulletIndex;
                  return (
                    <li key={bulletIndex}>
                      <p>{text}</p>
                      <div className="button-row">
                        <button
                          type="button"
                          className="button secondary small"
                          aria-pressed={selected}
                          onClick={() =>
                            onSelectApr({
                              resumeId: resume.id,
                              experienceId: project.id,
                              bulletIndex,
                              role: roleLabel,
                              bullet: text,
                              ...(aprFocusKeyword
                                ? { focusKeyword: aprFocusKeyword }
                                : {}),
                            })
                          }
                        >
                          Analyze with APR
                        </button>
                        {selected && (
                          <span className="apr-selected-badge">Selected</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {!resume.experience.some((experience) =>
          experience.bullets.some((text) => text.trim()),
        ) &&
          !resume.projects.some((project) =>
            project.bullets.some((text) => text.trim()),
          ) && (
            <p className="fine-print">
              Add a nonempty experience or project accomplishment to analyze it.
            </p>
          )}
      </div>
    </section>
  );
}
