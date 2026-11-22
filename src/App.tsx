import { useEffect, useRef, useState } from "react";
import {
  createResume,
  errorMessage,
  PROVIDER_LABELS,
  syncResumeToCareerLibrary,
  type Resume,
  type SectionKey,
} from "./model";
import { desktop } from "./platform";
import { useWorkspace } from "./useWorkspace";
import { useResumeDocumentIo } from "./hooks/useResumeDocumentIo";
import {
  useStudioAiWorkflows,
  type StudioNotice,
} from "./hooks/useStudioAiWorkflows";
import { CareerLibraryView } from "./components/CareerLibraryView";
import type { ChangeMeta, EditorFocusRequest } from "./components/Editor";
import { ResumeLibraryView } from "./components/studio/ResumeLibraryView";
import {
  DeleteDialog,
  ImportReviewDialog,
  LicenseDialog,
} from "./components/studio/StudioDialogs";
import { StudioDocumentToolbar } from "./components/studio/StudioDocumentToolbar";
import { StudioEditPane } from "./components/studio/StudioEditPane";
import {
  StudioPreviewPane,
  type StudioTab,
} from "./components/studio/StudioPreviewPane";
import {
  LoadingScreen,
  NoticeBanner,
  SaveErrorBanner,
  StudioSidebar,
  StudioTopbar,
  WorkspaceHeading,
  type StudioTheme,
  type WorkspaceView,
} from "./components/studio/StudioShellChrome";
import "./App.css";

type HistoryEntry = {
  resume: Resume;
  source: "ai" | "edit" | "delete";
  timestamp: number;
};

function App() {
  const {
    workspace,
    update,
    loadError,
    saveError,
    saving,
    dirty,
    flush,
    reload,
  } = useWorkspace();
  const [tab, setTab] = useState<StudioTab>("content");
  const [view, setView] = useState<WorkspaceView>("studio");
  const [notice, setNotice] = useState<StudioNotice | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showLicense, setShowLicense] = useState(false);
  const [theme, setTheme] = useState<StudioTheme>(() =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  );
  const [editorWidthPct, setEditorWidthPct] = useState(40);
  const [previewZoom, setPreviewZoom] = useState<90 | 100 | 125>(100);
  const [focusRequest, setFocusRequest] = useState<EditorFocusRequest | null>(
    null,
  );
  const importInput = useRef<HTMLInputElement>(null);
  const resumeImportInput = useRef<HTMLInputElement>(null);
  const studioGridRef = useRef<HTMLDivElement>(null);

  const resume = workspace?.resumes.find(
    (item) => item.id === workspace.activeResumeId,
  );
  const report = (error: unknown) =>
    setNotice({ kind: "error", text: errorMessage(error) });

  function applyResumeDirect(next: Resume) {
    update((current) => ({
      ...current,
      resumes: current.resumes.map((item) =>
        item.id === next.id
          ? { ...next, updatedAt: new Date().toISOString() }
          : item,
      ),
    }));
  }

  function recordHistory(
    previous: Resume,
    source: HistoryEntry["source"],
    discrete = false,
  ) {
    const now = Date.now();
    setUndoStack((stack) => {
      const last = stack[stack.length - 1];
      if (
        !discrete &&
        source === "edit" &&
        last?.source === "edit" &&
        last.resume.id === previous.id &&
        now - last.timestamp < 700
      ) {
        return stack;
      }
      return [
        ...stack.slice(-39),
        { resume: structuredClone(previous), source, timestamp: now },
      ];
    });
    setRedoStack([]);
  }

  function clearHistory() {
    setUndoStack([]);
    setRedoStack([]);
  }

  const ai = useStudioAiWorkflows({
    resume,
    applyResumeDirect,
    recordAiHistory: (previous) => recordHistory(previous, "ai", true),
    setNotice,
    report,
  });

  function addResume(next = createResume()) {
    if (!workspace || workspace.resumes.length >= 50) {
      report(
        new Error(
          "You can keep up to 50 resumes. Export a backup before removing any.",
        ),
      );
      return;
    }
    update((current) => ({
      ...current,
      activeResumeId: next.id,
      resumes: [...current.resumes, next],
    }));
    setView("studio");
    setTab("content");
    ai.resetAiTransientForResumeSwitch(true);
    clearHistory();
  }

  const io = useResumeDocumentIo({
    workspace,
    resume,
    update,
    addResume,
    resetAiForImport: () => ai.resetAiTransientForResumeSwitch(true),
    clearHistory,
    setViewStudio: () => setView("studio"),
    setAiBusy: ai.setBusy,
    setNotice,
    report,
  });

  const blocked =
    ai.busy === "generate" ||
    ai.busy === "summaryOptions" ||
    ai.busy === "tailorRole" ||
    ai.busy === "importCleanup" ||
    ai.busy === "analyze" ||
    ai.busy === "refine" ||
    ai.busy === "login";
  const topUndo = undoStack[undoStack.length - 1] ?? null;
  const topRedo = redoStack[redoStack.length - 1] ?? null;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function changeResume(next: Resume, meta?: ChangeMeta) {
    if (resume && resume.id === next.id) {
      recordHistory(
        resume,
        meta?.deletedLabel ? "delete" : "edit",
        Boolean(meta?.discrete || meta?.deletedLabel),
      );
    }
    applyResumeDirect(next);
    if (meta?.deletedLabel) {
      setNotice({
        kind: "success",
        text: `Removed ${meta.deletedLabel}.`,
        canUndo: true,
      });
    }
  }

  function performUndo() {
    if (!resume || !topUndo || blocked) return;
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [
      ...stack.slice(-39),
      {
        resume: structuredClone(resume),
        source: topUndo.source,
        timestamp: Date.now(),
      },
    ]);
    applyResumeDirect(topUndo.resume);
    setNotice({
      kind: "success",
      text:
        topUndo.source === "ai"
          ? "Previous wording restored."
          : "Last change undone.",
    });
  }

  function performRedo() {
    if (!resume || !topRedo || blocked) return;
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [
      ...stack.slice(-39),
      {
        resume: structuredClone(resume),
        source: topRedo.source,
        timestamp: Date.now(),
      },
    ]);
    applyResumeDirect(topRedo.resume);
    setNotice({
      kind: "success",
      text: "Change restored.",
    });
  }

  useEffect(() => {
    const onGlobalKeyDown = (event: KeyboardEvent) => {
      if (blocked || view !== "studio") return;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const active = document.activeElement;
      const isTextControl =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement;
      if (isTextControl) return;

      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        if (topUndo) {
          event.preventDefault();
          performUndo();
        }
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        if (topRedo) {
          event.preventDefault();
          performRedo();
        }
      }
    };
    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  });

  function selectResume(id: string) {
    update((current) => ({ ...current, activeResumeId: id }));
    setView("studio");
    ai.resetAiTransientForResumeSwitch(false);
    clearHistory();
  }

  function removeResume() {
    if (!workspace || !deleteId) return;
    const remaining = workspace.resumes.filter((item) => item.id !== deleteId);
    if (!remaining.length) remaining.push(createResume());
    update({
      ...workspace,
      resumes: remaining,
      activeResumeId:
        workspace.activeResumeId === deleteId
          ? remaining[0].id
          : workspace.activeResumeId,
    });
    setDeleteId(null);
    ai.resetAiTransientForResumeSwitch(true);
    clearHistory();
  }

  if (!workspace || !resume) {
    return (
      <LoadingScreen loadError={loadError} onReload={() => void reload()} />
    );
  }

  const careerLibraryCount =
    workspace.careerLibrary.experiences.length +
    workspace.careerLibrary.projects.length +
    workspace.careerLibrary.education.length +
    workspace.careerLibrary.certifications.length +
    workspace.careerLibrary.skillGroups.length;
  const allBusy = blocked || Boolean(io.exporting) || io.importingFile;

  const jumpToEditorSection = (
    section: SectionKey | "basics",
    entryId?: string,
  ) => {
    setTab("content");
    setFocusRequest({ section, entryId, nonce: Date.now() });
  };

  const handleSplitterPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const grid = studioGridRef.current;
    if (!grid) return;
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    const onMove = (moveEvent: PointerEvent) => {
      const rect = grid.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pct = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setEditorWidthPct(Math.min(58, Math.max(28, pct)));
    };
    const onUp = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  };

  const duplicateResume = (item: Resume) =>
    addResume({
      ...structuredClone(item),
      id: crypto.randomUUID(),
      title: `${item.title.slice(0, 110)} (copy)`,
      updatedAt: new Date().toISOString(),
    });

  return (
    <div
      className={`app-shell ${view === "studio" ? "app-shell--studio" : ""}`}
    >
      <StudioSidebar
        workspace={workspace}
        resume={resume}
        view={view}
        careerLibraryCount={careerLibraryCount}
        allBusy={allBusy}
        blocked={blocked}
        onSetView={setView}
        onAddResume={() => addResume()}
        onSelectResume={selectResume}
        onOpenCopilotTab={() => {
          setTab("copilot");
          setView("studio");
        }}
      />
      <main className="main-content">
        <StudioTopbar
          view={view}
          theme={theme}
          candidateInitial={resume.basics.name.slice(0, 1).toUpperCase() || "H"}
          onToggleTheme={() =>
            setTheme((current) => (current === "dark" ? "light" : "dark"))
          }
        />
        {notice && (
          <NoticeBanner
            notice={notice}
            canUndo={Boolean(topUndo)}
            onUndo={performUndo}
            onDismiss={() => setNotice(null)}
          />
        )}
        {saveError && (
          <SaveErrorBanner
            saveError={saveError}
            onRetrySave={() => void flush().catch(report)}
            onExportBackup={() => void io.exportBackup()}
          />
        )}
        {view !== "studio" && <WorkspaceHeading view={view} />}
        {view === "careerLibrary" ? (
          <CareerLibraryView
            library={workspace.careerLibrary}
            activeResume={resume}
            resumeCount={workspace.resumes.length}
            onUpdateLibrary={(careerLibrary) =>
              update((current) => ({ ...current, careerLibrary }))
            }
            onSyncFromActiveResume={() => {
              try {
                update((current) =>
                  syncResumeToCareerLibrary(current, resume.id),
                );
                setNotice({
                  kind: "success",
                  text: "Saved roles, projects, education, certifications, and skill groups to your Career Library.",
                });
              } catch (error) {
                report(error);
              }
            }}
            onCreateTailoredResume={(variant) => {
              addResume(variant);
              setNotice({
                kind: "success",
                text: `Created tailored resume “${variant.title}” from your Career Library.`,
              });
            }}
          />
        ) : view === "resumes" ? (
          <ResumeLibraryView
            resumes={workspace.resumes}
            allBusy={allBusy}
            onSelectResume={selectResume}
            onAddResume={() => addResume()}
            onDuplicateResume={duplicateResume}
            onRequestDeleteResume={setDeleteId}
            onTriggerResumeImport={() => resumeImportInput.current?.click()}
            onTriggerBackupImport={() => importInput.current?.click()}
            onExportBackup={() => void io.exportBackup()}
          />
        ) : (
          <section className="studio-frame" aria-label="Resume studio">
            <StudioDocumentToolbar
              resume={resume}
              blocked={blocked}
              allBusy={allBusy}
              saving={saving}
              dirty={dirty}
              saveError={saveError}
              exporting={io.exporting}
              topUndoSource={topUndo?.source ?? null}
              hasRedo={Boolean(topRedo)}
              onChangeResume={changeResume}
              onUndo={performUndo}
              onRedo={performRedo}
              onDuplicateResume={() => duplicateResume(resume)}
              onTriggerResumeImport={() => resumeImportInput.current?.click()}
              onSaveToCareerLibrary={() => {
                try {
                  update((current) =>
                    syncResumeToCareerLibrary(current, resume.id),
                  );
                  setNotice({
                    kind: "success",
                    text: "Synced current resume items to your Career Library.",
                  });
                } catch (error) {
                  report(error);
                }
              }}
              onExportBackup={() => void io.exportBackup()}
              onTriggerBackupImport={() => importInput.current?.click()}
              onRequestDeleteResume={() => setDeleteId(resume.id)}
              onExportDocx={() => void io.exportDocx()}
              onExportPdf={() => void io.exportPdf()}
            />
            <div
              className="studio"
              ref={studioGridRef}
              style={
                {
                  "--editor-pane-width": `${editorWidthPct}%`,
                } as React.CSSProperties
              }
            >
              <StudioEditPane
                resume={resume}
                careerLibrary={workspace.careerLibrary}
                tab={tab}
                blocked={blocked}
                focusRequest={focusRequest}
                ai={ai}
                onSetTab={setTab}
                onChangeResume={changeResume}
                onAddResume={addResume}
                onTriggerResumeImport={() => resumeImportInput.current?.click()}
                onUpdateWorkspace={update}
                onSetNotice={setNotice}
                onReport={report}
                onShowLicense={() => setShowLicense(true)}
              />
              <div
                className="pane-resizer"
                role="separator"
                aria-label="Resize editor and preview panes"
                aria-orientation="vertical"
                aria-valuemin={28}
                aria-valuemax={58}
                aria-valuenow={Math.round(editorWidthPct)}
                tabIndex={0}
                onPointerDown={handleSplitterPointerDown}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    setEditorWidthPct((w) => Math.max(28, w - 3));
                  } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    setEditorWidthPct((w) => Math.min(58, w + 3));
                  }
                }}
              />
              <StudioPreviewPane
                resume={resume}
                blocked={blocked}
                previewZoom={previewZoom}
                showAudit={showAudit}
                onSetPreviewZoom={setPreviewZoom}
                onSetShowAudit={setShowAudit}
                onSetTab={setTab}
                onSelectSection={jumpToEditorSection}
              />
            </div>
          </section>
        )}
        {view !== "studio" && (
          <footer className="page-footer">
            <span>Thoughtfully crafted. Authentically you.</span>
            <button
              className="text-button"
              onClick={() => setShowLicense(true)}
            >
              Font licenses
            </button>
            <span>HIRING IS HUMAN. YOUR RESUME SHOULD BE, TOO.</span>
          </footer>
        )}
      </main>
      <input
        className="visually-hidden"
        ref={importInput}
        type="file"
        accept=".json,application/json"
        aria-label="Import Hireloom backup"
        onChange={(event) => void io.importBackup(event)}
        tabIndex={-1}
      />
      <input
        className="visually-hidden"
        ref={resumeImportInput}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        aria-label="Import PDF or DOCX resume"
        onChange={(event) => void io.importResumeDocument(event)}
        tabIndex={-1}
      />
      {io.importDraft && (
        <ImportReviewDialog
          draft={io.importDraft}
          providerLabel={PROVIDER_LABELS[ai.aiSettings.primaryProvider]}
          providerReady={
            desktop &&
            (ai.aiSettings.primaryProvider === "copilot"
              ? Boolean(ai.copilot?.available)
              : (ai.providerStates.find(
                  (item) => item.provider === ai.aiSettings.primaryProvider,
                )?.configured ?? ai.aiSettings.primaryProvider === "ollama"))
          }
          cleaningUp={ai.busy === "importCleanup"}
          onCleanUpWithAi={(importConsent) =>
            void io.cleanUpImportWithAi(importConsent)
          }
          onCancel={() => io.setImportDraft(null)}
          onConfirm={io.confirmImportedResume}
        />
      )}
      {deleteId && (
        <DeleteDialog
          title={
            workspace.resumes.find((item) => item.id === deleteId)?.title ??
            "this resume"
          }
          onCancel={() => setDeleteId(null)}
          onDelete={removeResume}
        />
      )}
      {showLicense && <LicenseDialog onClose={() => setShowLicense(false)} />}
    </div>
  );
}

export default App;
