import {
  Check,
  CheckCheck,
  Github,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  jobKeywords,
  type AiProposal,
  type AprAnalysis,
  type AprTarget,
  type Resume,
} from "../model";
import { desktop, type CopilotStatus } from "../platform";
import { Field } from "./Editor";

export function CopilotPanel({
  resume,
  onChange,
  status,
  busy,
  consent,
  onConsent,
  onRefresh,
  onLogin,
  onGenerate,
  proposal,
  stale,
  onApply,
  onDiscard,
  aprTarget,
  onSelectApr,
  aprConsent,
  onAprConsent,
  onAnalyzeApr,
  aprAnalysis,
  aprStale,
  onApplyApr,
  onDiscardApr,
}: {
  resume: Resume;
  onChange: (resume: Resume) => void;
  status: CopilotStatus | null;
  busy: "login" | "generate" | "analyze" | "status" | null;
  consent: boolean;
  onConsent: (value: boolean) => void;
  onRefresh: () => void;
  onLogin: () => void;
  onGenerate: () => void;
  proposal: AiProposal | null;
  stale: boolean;
  onApply: () => void;
  onDiscard: () => void;
  aprTarget: AprTarget | null;
  onSelectApr: (target: AprTarget) => void;
  aprConsent: boolean;
  onAprConsent: (value: boolean) => void;
  onAnalyzeApr: () => void;
  aprAnalysis: AprAnalysis | null;
  aprStale: boolean;
  onApplyApr: () => void;
  onDiscardApr: () => void;
}) {
  const keywords = jobKeywords(resume);
  return (
    <div className="assistant-content">
      <div className="assistant-intro">
        <span className="assistant-orb">
          <Sparkles size={26} />
        </span>
        <span className="eyebrow">
          YOUR EXPERIENCE. A LITTLE EXTRA CLARITY.
        </span>
        <h2>Find your best words.</h2>
        <p>
          Turn your real experience into a focused story for the role you want.
          Powered by GitHub Copilot.
        </p>
      </div>
      <div className="connection-card">
        <div className="connection-heading">
          <Github size={20} />
          <strong>GitHub Copilot</strong>
          <span
            className={`status-dot ${status?.available ? "available" : ""}`}
          />
        </div>
        <p>{status?.detail ?? "Checking the local Copilot CLI…"}</p>
        {status?.version && (
          <code className="cli-version">{status.version}</code>
        )}
        <div className="button-row">
          <button
            className="button secondary small"
            disabled={!desktop || !status?.available || Boolean(busy)}
            onClick={onLogin}
          >
            {busy === "login" ? (
              <LoaderCircle className="spin" size={14} />
            ) : (
              <Github size={14} />
            )}
            {busy === "login" ? "Waiting for sign-in…" : "Sign in with GitHub"}
          </button>
          <button
            className="text-button"
            disabled={Boolean(busy)}
            onClick={onRefresh}
          >
            Refresh
          </button>
        </div>
        <p className="fine-print">
          CLI installed does not mean signed in. A Copilot-enabled account and
          available usage are required.
        </p>
      </div>
      <Field
        label="Job description"
        value={resume.jobDescription}
        onChange={(jobDescription) => onChange({ ...resume, jobDescription })}
        multiline
        rows={9}
        maxLength={20_000}
        placeholder="Paste the job description here to tailor your summary and experience highlights to the role…"
        hint="Optional. Leave this blank for a general resume polish."
      />
      {resume.jobDescription.trim() && (
        <div className="keyword-card">
          <div className="card-heading">
            <strong>Keyword overlap</strong>
            <span>
              {keywords.filter((keyword) => keyword.matched).length} of{" "}
              {keywords.length}
            </span>
          </div>
          {keywords.length ? (
            <div className="keyword-list">
              {keywords.map(({ term, matched }) => (
                <span
                  key={term}
                  className={matched ? "keyword matched" : "keyword"}
                >
                  {matched ? <Check size={11} /> : <PlusMark />}
                  {term}
                </span>
              ))}
            </div>
          ) : (
            <p>No terms from our small built-in keyword list were found.</p>
          )}
          <p className="fine-print">
            A local keyword check, not an ATS score or hiring prediction. Only
            add skills you actually have.
          </p>
        </div>
      )}
      <div className="privacy-note">
        <ShieldCheck size={19} />
        <p>
          Your contact fields stay out of the prompt. Summary, work history,
          education, skills, headline, and job description are sent only when
          you ask.
        </p>
      </div>
      <label className="consent-check">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => onConsent(event.target.checked)}
          disabled={busy === "generate"}
        />
        <span>
          Send this content to GitHub Copilot for this request. I understand
          this uses my Copilot allowance and may be retained under GitHub's
          policies.
        </span>
      </label>
      <button
        className="button primary generate-button"
        disabled={!status?.available || !consent || Boolean(busy)}
        onClick={onGenerate}
      >
        {busy === "generate" ? (
          <LoaderCircle className="spin" size={17} />
        ) : (
          <Sparkles size={17} />
        )}
        {busy === "generate"
          ? "Finding your best words…"
          : resume.jobDescription.trim()
            ? "Tailor to this role"
            : "Polish my resume"}
      </button>
      <p className="fine-print center">
        {busy === "generate"
          ? "This can take up to 3 minutes. No changes are applied automatically."
          : "No invented experience. No automatic edits. You're in control."}
      </p>
      {proposal && (
        <section className="proposal-card" aria-label="Copilot suggestions">
          <div className="card-heading">
            <strong>
              <Sparkles size={16} /> Your suggested rewrite
            </strong>
            <button
              className="icon-button"
              aria-label="Discard suggestions"
              onClick={onDiscard}
            >
              <X size={16} />
            </button>
          </div>
          <p className="fine-print">
            Check every claim before applying. AI can make mistakes, even when
            instructed to use only your facts.
          </p>
          <h3>Summary</h3>
          <p className="proposal-text">
            {proposal.summary || "(No summary suggested)"}
          </p>
          {proposal.experience.map((entry) => (
            <div key={entry.id}>
              <h3>
                {resume.experience.find((original) => original.id === entry.id)
                  ?.role || "Experience"}
              </h3>
              <ul>
                {entry.bullets.map((text, index) => (
                  <li key={index}>{text}</li>
                ))}
              </ul>
            </div>
          ))}
          {proposal.notes.length > 0 && (
            <div className="proposal-notes">
              <h3>Things to consider</h3>
              <ul>
                {proposal.notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </div>
          )}
          {stale && (
            <p className="inline-error">
              This resume changed after generation. Generate fresh suggestions
              to avoid replacing newer work.
            </p>
          )}
          <button
            className="button primary"
            disabled={stale || Boolean(busy)}
            onClick={onApply}
          >
            <CheckCheck size={16} /> Apply reviewed suggestions
          </button>
        </section>
      )}
      <section className="apr-section" aria-labelledby="apr-heading">
        <div className="card-heading">
          <div>
            <span className="eyebrow">ACTION · PROJECT · RESULT</span>
            <h2 id="apr-heading">Analyze accomplishments</h2>
          </div>
        </div>
        <p className="fine-print">
          Review one accomplishment at a time for a specific action, meaningful
          project, and supported result. Copilot may suggest improvements, but
          you decide whether to apply them.
        </p>
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
                        <button
                          className="button secondary small"
                          aria-pressed={selected}
                          onClick={() =>
                            onSelectApr({
                              resumeId: resume.id,
                              experienceId: experience.id,
                              bulletIndex,
                              role: experience.role,
                              bullet: text,
                            })
                          }
                        >
                          Analyze with APR
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {!resume.experience.some((experience) =>
            experience.bullets.some((text) => text.trim()),
          ) && (
            <p className="fine-print">
              Add a nonempty experience accomplishment to analyze it.
            </p>
          )}
        </div>
        {aprTarget && (
          <div className="apr-request-card">
            <h3>Selected accomplishment</h3>
            <blockquote>{aprTarget.bullet}</blockquote>
            <p className="privacy-note apr-disclosure">
              <ShieldCheck size={18} />
              <span>
                Only this bullet and the role “
                {aprTarget.role || "Untitled role"}” will be sent to GitHub
                Copilot. Resume IDs and the bullet position stay local.
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
                Send this selected bullet and role to GitHub Copilot for this
                APR request.
              </span>
            </label>
            <button
              className="button primary generate-button"
              disabled={
                !desktop || !status?.available || !aprConsent || Boolean(busy)
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
          </div>
        )}
        {aprAnalysis && (
          <section className="apr-analysis" aria-label="APR analysis">
            <div className="card-heading">
              <strong>
                <Sparkles size={16} /> APR review
              </strong>
              <button
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
              </div>
            )}
            {aprAnalysis.questions.length > 0 && (
              <div className="proposal-notes">
                <h3>Questions to strengthen the result</h3>
                <ul>
                  {aprAnalysis.questions.map((question, index) => (
                    <li key={index}>{question}</li>
                  ))}
                </ul>
              </div>
            )}
            {aprStale && (
              <p className="inline-error">
                This accomplishment or its role changed after analysis. Analyze
                it again before applying.
              </p>
            )}
            <button
              className="button primary"
              disabled={
                aprStale ||
                Boolean(busy) ||
                !aprAnalysis.rewrite?.trim() ||
                aprAnalysis.rewrite === aprAnalysis.target.bullet
              }
              onClick={onApplyApr}
            >
              <CheckCheck size={16} /> Apply this rewrite
            </button>
          </section>
        )}
      </section>
      <div className="setup-note">
        <strong>First-time setup</strong>
        <p>
          Install GitHub Copilot CLI, then sign in above. Hireloom keeps a
          separate Copilot profile from your coding sessions.
        </p>
        <code>npm install -g @github/copilot</code>
      </div>
    </div>
  );
}

function PlusMark() {
  return <span aria-hidden="true">+</span>;
}
