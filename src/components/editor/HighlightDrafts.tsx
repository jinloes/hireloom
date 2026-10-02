import { CheckCheck, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { desktop } from "../../platform";
import { MAX_DRAFT_NOTES_BYTES } from "../../highlightDrafts";
import type { HighlightDraftsController } from "./types";

export function HighlightDrafts({
  controller,
  regionId,
  role,
}: {
  controller: HighlightDraftsController;
  regionId: string;
  role: string;
}) {
  const {
    notes,
    onNotes,
    consent,
    onConsent,
    onDraft,
    bullets,
    selected,
    onSelect,
    stale,
    onApply,
    onDiscard,
    status,
    busy,
  } = controller;
  const drafting = busy === "draft";

  return (
    <section
      className="highlight-guidance highlight-drafts"
      id={regionId}
      aria-label="Draft highlights from notes"
    >
      <div className="highlight-guidance-heading">
        <div>
          <span className="eyebrow">FACT-BOUND DRAFTING</span>
          <h3>Draft highlights from notes</h3>
        </div>
      </div>
      <label htmlFor={`${regionId}-notes`}>Rough notes about this job</label>
      <span className="field-hint" id={`${regionId}-notes-hint`}>
        Jot down what you worked on, how, and what changed. Drafts use only
        these facts.
      </span>
      <textarea
        id={`${regionId}-notes`}
        aria-describedby={`${regionId}-notes-hint`}
        value={notes}
        maxLength={MAX_DRAFT_NOTES_BYTES}
        rows={5}
        disabled={drafting}
        onChange={(event) => onNotes(event.target.value)}
      />
      <p className="privacy-note highlight-disclosure">
        <ShieldCheck size={18} />
        <span>
          Drafting sends only these notes and the job title “
          {role || "Untitled role"}” to GitHub Copilot. Remove contact details
          before sending. Notes are not saved.
        </span>
      </p>
      <label className="consent-check">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => onConsent(event.target.checked)}
          disabled={drafting || !desktop}
        />
        <span>
          Send these notes and job title to GitHub Copilot for this request.
        </span>
      </label>
      <button
        className="button primary generate-button"
        disabled={
          !desktop ||
          !status?.available ||
          !consent ||
          !notes.trim() ||
          Boolean(busy)
        }
        onClick={onDraft}
      >
        {drafting ? (
          <LoaderCircle className="spin" size={16} />
        ) : (
          <Sparkles size={16} />
        )}
        {drafting ? "Drafting highlights…" : "Draft highlights"}
      </button>
      {!desktop && (
        <p className="highlight-guidance-status" role="status">
          Drafting highlights is available only in the desktop app. You can keep
          editing locally.
        </p>
      )}
      {desktop && !status?.available && (
        <p className="highlight-guidance-status" role="status">
          GitHub Copilot is unavailable. Check the Copilot tab while keeping
          this job editable.
        </p>
      )}
      {drafting && (
        <p className="highlight-guidance-status" role="status">
          Drafting highlights from your notes. No changes are applied
          automatically.
        </p>
      )}

      {bullets && (
        <div className="highlight-analysis">
          {stale && (
            <p className="inline-error" role="alert">
              Your notes or this job changed after drafting. Draft again before
              adding highlights.
            </p>
          )}
          <fieldset
            className="highlight-option-group highlight-draft-list"
            disabled={stale || Boolean(busy)}
          >
            <legend>Drafted highlights</legend>
            <p className="fine-print">
              Review every claim before adding a draft. Nothing is selected or
              added automatically.
            </p>
            {bullets.map((bullet, index) => (
              <label
                className={`highlight-option-card${selected.includes(index) ? " selected" : ""}`}
                key={bullet}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(index)}
                  onChange={(event) => onSelect(index, event.target.checked)}
                />
                <span className="highlight-option-copy">{bullet}</span>
              </label>
            ))}
          </fieldset>
          <div className="highlight-guidance-actions">
            <button
              className="button primary"
              disabled={stale || Boolean(busy)}
              onClick={onApply}
            >
              <CheckCheck size={16} /> Add selected highlights
            </button>
            <button
              className="button secondary"
              disabled={Boolean(busy)}
              onClick={onDiscard}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
