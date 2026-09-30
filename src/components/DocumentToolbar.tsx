import {
  ArrowDownToLine,
  Check,
  Circle,
  Copy,
  FileText,
  LoaderCircle,
  MoreHorizontal,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import type { Resume } from "../model";
import { desktop } from "../platform";

export function DocumentToolbar({
  resume,
  onChange,
  blocked,
  allBusy,
  saving,
  dirty,
  saveError,
  canUndo,
  onUndo,
  showTools,
  onShowTools,
  onDuplicate,
  onBackup,
  onImport,
  onDelete,
  exporting,
  onExportPdf,
}: {
  resume: Resume;
  onChange: (resume: Resume) => void;
  blocked: boolean;
  allBusy: boolean;
  saving: boolean;
  dirty: boolean;
  saveError: string | null;
  canUndo: boolean;
  onUndo: () => void;
  showTools: boolean;
  onShowTools: (show: boolean) => void;
  onDuplicate: () => void;
  onBackup: () => void;
  onImport: () => void;
  onDelete: () => void;
  exporting: boolean;
  onExportPdf: () => void;
}) {
  return (
    <div className="document-toolbar">
      <div className="document-title">
        <span className="document-icon">
          <FileText size={20} />
        </span>
        <div>
          <input
            aria-label="Resume title"
            maxLength={120}
            value={resume.title}
            disabled={blocked}
            onChange={(event) =>
              onChange({ ...resume, title: event.target.value })
            }
            onBlur={() => {
              if (!resume.title.trim())
                onChange({ ...resume, title: "Untitled resume" });
            }}
          />
          <span
            className={saveError ? "unsaved-label" : "saved-label"}
            aria-live="polite"
          >
            {saving || dirty ? (
              <LoaderCircle size={11} className="spin" />
            ) : saveError ? (
              <Circle size={10} />
            ) : (
              <Check size={12} />
            )}
            {saveError
              ? "Not saved"
              : saving || dirty
                ? "Saving…"
                : desktop
                  ? "Autosaved on this device"
                  : "Autosaved in this browser"}
          </span>
        </div>
      </div>
      <div className="document-actions">
        {canUndo && (
          <button
            className="icon-button"
            aria-label="Undo AI changes"
            onClick={onUndo}
          >
            <RotateCcw size={17} />
          </button>
        )}
        <div className="more-container">
          <button
            className="icon-button"
            aria-label="Document actions"
            aria-expanded={showTools}
            onClick={() => onShowTools(!showTools)}
            disabled={blocked}
          >
            <MoreHorizontal size={21} />
          </button>
          {showTools && (
            <div className="tools-menu">
              <button
                onClick={() => {
                  onDuplicate();
                  onShowTools(false);
                }}
              >
                <Copy size={14} /> Duplicate resume
              </button>
              <button
                onClick={() => {
                  onBackup();
                  onShowTools(false);
                }}
              >
                <ArrowDownToLine size={14} /> Back up workspace
              </button>
              <button
                onClick={() => {
                  onImport();
                  onShowTools(false);
                }}
              >
                <Upload size={14} /> Import JSON backup
              </button>
              <button
                onClick={() => {
                  onDelete();
                  onShowTools(false);
                }}
              >
                <Trash2 size={14} /> Delete resume
              </button>
            </div>
          )}
        </div>
        <button
          className="button primary export-button"
          disabled={allBusy}
          onClick={onExportPdf}
        >
          {exporting ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <ArrowDownToLine size={16} />
          )}
          {exporting ? "Creating PDF…" : "Export PDF"}
        </button>
      </div>
    </div>
  );
}
