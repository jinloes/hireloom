import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  FileCheck2,
  LoaderCircle,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { desktop } from "../../platform";
import type { ImportedResumeDraft } from "../../resumeImport";
import fontLicense from "../../assets/fonts/OFL.txt?raw";

export function LicenseDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog license-dialog"
      onCancel={onClose}
      aria-labelledby="license-title"
    >
      <div className="card-heading">
        <h2 id="license-title">Noto font licenses</h2>
        <button
          autoFocus
          className="icon-button"
          aria-label="Close font licenses"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <p>
        Noto Sans and Noto Serif are bundled locally and used in your exported
        PDFs.
      </p>
      <pre>{fontLicense}</pre>
    </dialog>
  );
}

export function DeleteDialog({
  title,
  onCancel,
  onDelete,
}: {
  title: string;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog"
      onCancel={onCancel}
      aria-labelledby="delete-title"
    >
      <span className="dialog-icon">
        <Trash2 size={23} />
      </span>
      <h2 id="delete-title">Delete this chapter?</h2>
      <p>
        “{title}” will be removed from this device. This cannot be undone.
        Export a backup first if you want to keep a copy.
      </p>
      <div className="button-row">
        <button autoFocus className="button secondary" onClick={onCancel}>
          <ArrowLeft size={15} /> Keep resume
        </button>
        <button className="button destructive" onClick={onDelete}>
          Delete resume
        </button>
      </div>
    </dialog>
  );
}

export function ImportReviewDialog({
  draft,
  providerLabel,
  providerReady,
  cleaningUp,
  onCleanUpWithAi,
  onCancel,
  onConfirm,
}: {
  draft: ImportedResumeDraft;
  providerLabel: string;
  providerReady: boolean;
  cleaningUp: boolean;
  onCleanUpWithAi: (consent: boolean) => void;
  onCancel: () => void;
  onConfirm: (title: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(draft.resume.title);
  const [importConsent, setImportConsent] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog import-review-dialog"
      onCancel={onCancel}
      aria-labelledby="import-review-title"
    >
      <span className="dialog-icon success-icon">
        <FileCheck2 size={23} />
      </span>
      <h2 id="import-review-title">Review imported resume</h2>
      <p>
        Parsed locally from <strong>{draft.sourceFormat.toUpperCase()}</strong>{" "}
        without uploading your file. Your existing resumes will not be modified.
      </p>
      <div className="import-stats-grid">
        <span>
          <strong>{draft.resume.basics.name || "Not detected"}</strong>
          <small>Candidate name</small>
        </span>
        <span>
          <strong>{draft.stats.experiences}</strong>
          <small>Experience roles</small>
        </span>
        <span>
          <strong>{draft.stats.projects}</strong>
          <small>Projects</small>
        </span>
        <span>
          <strong>{draft.stats.education}</strong>
          <small>Education</small>
        </span>
        <span>
          <strong>{draft.stats.skills}</strong>
          <small>Skills</small>
        </span>
      </div>
      <div className="field">
        <label htmlFor="imported-resume-title">Resume title</label>
        <input
          id="imported-resume-title"
          value={title}
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      {draft.warnings.length > 0 && (
        <ul className="import-warnings">
          {draft.warnings.map((warning, idx) => (
            <li key={idx}>{warning}</li>
          ))}
        </ul>
      )}
      {draft.rawLines.length > 0 && (
        <div className="import-ai-cleanup">
          <div className="import-ai-heading">
            <Sparkles size={14} />
            <strong>Optional AI structure cleanup</strong>
          </div>
          <p className="fine-print">
            Emails, phone numbers, and personal URLs are redacted locally before
            sending up to 600 text lines to {providerLabel}. Locally detected
            contact fields remain on this device.
          </p>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={importConsent}
              disabled={!desktop || cleaningUp}
              onChange={(event) => setImportConsent(event.target.checked)}
            />
            <span>
              Send redacted text lines from this{" "}
              {draft.sourceFormat.toUpperCase()} import to {providerLabel} to
              organize sections and bullets.
            </span>
          </label>
          <button
            type="button"
            className="button secondary small"
            disabled={!providerReady || !importConsent || cleaningUp}
            onClick={() => {
              onCleanUpWithAi(importConsent);
              setImportConsent(false);
            }}
          >
            {cleaningUp ? (
              <LoaderCircle size={14} className="spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {cleaningUp
              ? "Organizing imported lines…"
              : "Clean up structure with AI"}
          </button>
          {!desktop && (
            <p className="fine-print">
              AI import cleanup is available in the desktop app.
            </p>
          )}
        </div>
      )}
      <div className="button-row">
        <button
          className="button secondary"
          disabled={cleaningUp}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          autoFocus
          className="button primary"
          disabled={cleaningUp}
          onClick={() => onConfirm(title)}
        >
          Add imported resume
        </button>
      </div>
    </dialog>
  );
}
