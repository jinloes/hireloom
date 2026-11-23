import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  BookMarked,
  Check,
  Circle,
  Copy,
  FileSpreadsheet,
  FileText,
  FileUp,
  LoaderCircle,
  Moon,
  MoreHorizontal,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import type { Resume } from "../../model";
import { desktop } from "../../platform";
import type { StudioTheme } from "../../uiPreferences";
import type { ChangeMeta } from "../Editor";

export function StudioDocumentToolbar({
  resume,
  theme,
  blocked,
  allBusy,
  saving,
  dirty,
  saveError,
  exporting,
  topUndoSource,
  hasRedo,
  onToggleTheme,
  onChangeResume,
  onUndo,
  onRedo,
  onDuplicateResume,
  onTriggerResumeImport,
  onSaveToCareerLibrary,
  onExportBackup,
  onTriggerBackupImport,
  onRequestDeleteResume,
  onExportDocx,
  onExportPdf,
}: {
  resume: Resume;
  theme: StudioTheme;
  blocked: boolean;
  allBusy: boolean;
  saving: boolean;
  dirty: boolean;
  saveError: string | null;
  exporting: "pdf" | "docx" | null;
  topUndoSource: "ai" | "edit" | "delete" | null;
  hasRedo: boolean;
  onToggleTheme: () => void;
  onChangeResume: (next: Resume, meta?: ChangeMeta) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicateResume: () => void;
  onTriggerResumeImport: () => void;
  onSaveToCareerLibrary: () => void;
  onExportBackup: () => void;
  onTriggerBackupImport: () => void;
  onRequestDeleteResume: () => void;
  onExportDocx: () => void;
  onExportPdf: () => void;
}) {
  const [showTools, setShowTools] = useState(false);
  const toolsContainerRef = useRef<HTMLDivElement>(null);
  const toolsTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showTools) return;
    const onPointerDown = (event: PointerEvent) => {
      if (
        toolsContainerRef.current &&
        !toolsContainerRef.current.contains(event.target as Node)
      ) {
        setShowTools(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setShowTools(false);
        toolsTriggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showTools]);

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
              onChangeResume({ ...resume, title: event.target.value })
            }
            onBlur={() => {
              if (!resume.title.trim())
                onChangeResume({ ...resume, title: "Untitled resume" });
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
        <span className="private-badge studio-private-badge">
          <ShieldCheck size={13} /> Private by default
        </span>
        <button
          type="button"
          className="icon-button theme-toggle"
          aria-label={
            theme === "dark"
              ? "Switch to light studio theme"
              : "Switch to dark studio theme"
          }
          aria-pressed={theme === "dark"}
          onClick={onToggleTheme}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        {topUndoSource && (
          <button
            type="button"
            className="icon-button"
            aria-label={
              topUndoSource === "ai" ? "Undo AI changes" : "Undo last change"
            }
            title="Undo (Ctrl+Z)"
            disabled={blocked}
            onClick={onUndo}
          >
            <RotateCcw size={17} />
          </button>
        )}
        {hasRedo && (
          <button
            type="button"
            className="icon-button"
            aria-label="Redo change"
            title="Redo (Ctrl+Shift+Z)"
            disabled={blocked}
            onClick={onRedo}
          >
            <RotateCw size={17} />
          </button>
        )}
        <button
          className="button secondary export-button"
          disabled={allBusy}
          onClick={onExportDocx}
        >
          {exporting === "docx" ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <FileSpreadsheet size={16} />
          )}
          {exporting === "docx" ? "Creating DOCX…" : "Export DOCX"}
        </button>
        <button
          className="button primary export-button"
          disabled={allBusy}
          onClick={onExportPdf}
        >
          {exporting === "pdf" ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <ArrowDownToLine size={16} />
          )}
          {exporting === "pdf" ? "Creating PDF…" : "Export PDF"}
        </button>
        <div className="more-container" ref={toolsContainerRef}>
          <button
            ref={toolsTriggerRef}
            type="button"
            className="icon-button"
            aria-label="Document actions"
            aria-expanded={showTools}
            aria-controls="document-actions-menu"
            onClick={() => setShowTools((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && !showTools) {
                event.preventDefault();
                setShowTools(true);
                window.setTimeout(() => {
                  toolsContainerRef.current
                    ?.querySelector<HTMLButtonElement>(
                      "#document-actions-menu button",
                    )
                    ?.focus();
                }, 0);
              }
            }}
            disabled={blocked}
          >
            <MoreHorizontal size={21} />
          </button>
          {showTools && (
            <>
              <div
                className="menu-backdrop"
                aria-hidden="true"
                onClick={() => setShowTools(false)}
              />
              <div
                id="document-actions-menu"
                className="tools-menu"
                role="group"
                aria-label="Document actions"
                onKeyDown={(event) => {
                  const items = Array.from(
                    event.currentTarget.querySelectorAll<HTMLButtonElement>(
                      "button",
                    ),
                  );
                  if (!items.length) return;
                  const currentIdx = items.indexOf(
                    document.activeElement as HTMLButtonElement,
                  );
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    items[
                      (currentIdx + 1 + items.length) % items.length
                    ]?.focus();
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    items[
                      (currentIdx - 1 + items.length) % items.length
                    ]?.focus();
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    items[0]?.focus();
                  } else if (event.key === "End") {
                    event.preventDefault();
                    items[items.length - 1]?.focus();
                  }
                }}
              >
                <button
                  onClick={() => {
                    onDuplicateResume();
                    setShowTools(false);
                  }}
                >
                  <Copy size={14} /> Duplicate resume
                </button>
                <button
                  onClick={() => {
                    onTriggerResumeImport();
                    setShowTools(false);
                  }}
                >
                  <FileUp size={14} /> Import PDF or DOCX resume
                </button>
                <button
                  onClick={() => {
                    onSaveToCareerLibrary();
                    setShowTools(false);
                  }}
                >
                  <BookMarked size={14} /> Save to Career Library
                </button>
                <button
                  onClick={() => {
                    onExportBackup();
                    setShowTools(false);
                  }}
                >
                  <ArrowDownToLine size={14} /> Back up workspace
                </button>
                <button
                  onClick={() => {
                    onTriggerBackupImport();
                    setShowTools(false);
                  }}
                >
                  <Upload size={14} /> Import JSON backup
                </button>
                <button
                  onClick={() => {
                    onRequestDeleteResume();
                    setShowTools(false);
                  }}
                >
                  <Trash2 size={14} /> Delete resume
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
