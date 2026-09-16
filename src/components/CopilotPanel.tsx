import {
  Check,
  CheckCheck,
  Github,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { jobKeywords, type AiProposal, type Resume } from "../model";
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
}: {
  resume: Resume;
  onChange: (resume: Resume) => void;
  status: CopilotStatus | null;
  busy: "login" | "generate" | "status" | null;
  consent: boolean;
  onConsent: (value: boolean) => void;
  onRefresh: () => void;
  onLogin: () => void;
  onGenerate: () => void;
  proposal: AiProposal | null;
  stale: boolean;
  onApply: () => void;
  onDiscard: () => void;
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
