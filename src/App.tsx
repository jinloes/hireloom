import { useEffect, useRef, useState } from "react";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import {
  createResume,
  errorMessage,
  exampleResume,
  type Resume,
} from "./model";
import { copilotStatus, loginToCopilot, type CopilotStatus } from "./platform";
import { useWorkspace } from "./useWorkspace";
import { useHighlightGuidance } from "./useHighlightGuidance";
import { useHighlightDrafts } from "./useHighlightDrafts";
import { useResumeGeneration } from "./useResumeGeneration";
import { useWorkspaceTransfer } from "./useWorkspaceTransfer";
import {
  contentRemovalRecord,
  reconcileContentView,
  removeContentItem,
  restoreContentItem,
  type ContentChange,
  type ContentRemoval,
} from "./contentView";
import {
  Editor,
  type ContentRemovalRequest,
  type ContentViewState,
} from "./components/Editor";
import { CopilotPanel } from "./components/CopilotPanel";
import { StylePanel } from "./components/StylePanel";
import { Sidebar } from "./components/Sidebar";
import { WorkspaceHeader, type Notice } from "./components/WorkspaceHeader";
import { ResumeLibrary } from "./components/ResumeLibrary";
import { DocumentToolbar } from "./components/DocumentToolbar";
import { WorkspaceTabs, type WorkspaceMode } from "./components/WorkspaceTabs";
import { PreviewPanel } from "./components/PreviewPanel";
import { DeleteDialog, LicenseDialog } from "./components/Dialogs";
import type { AuditFinding } from "./targetAudit";
import "./App.css";

type ContentStatus = {
  sequence: number;
  message: string;
};

function copyOf(item: Resume): Resume {
  return {
    ...structuredClone(item),
    id: crypto.randomUUID(),
    title: `${item.title.slice(0, 110)} (copy)`,
    updatedAt: new Date().toISOString(),
  };
}

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
  const [tab, setTab] = useState<WorkspaceMode>("content");
  const [library, setLibrary] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [copilot, setCopilot] = useState<CopilotStatus | null>(null);
  const [busy, setBusy] = useState<
    | "status"
    | "login"
    | "generate"
    | "analyze"
    | "refine"
    | "review"
    | "draft"
    | null
  >("status");
  const [undo, setUndo] = useState<Resume | null>(null);
  const [contentViews, setContentViews] = useState<
    Record<string, ContentViewState>
  >({});
  const [contentRemoval, setContentRemoval] = useState<ContentRemoval | null>(
    null,
  );
  const [contentStatus, setContentStatus] = useState<ContentStatus | null>(
    null,
  );
  const [contentFocusTarget, setContentFocusTarget] = useState<string | null>(
    null,
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [showLicense, setShowLicense] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const previewScroll = useRef<HTMLDivElement>(null);
  const contentStatusSequence = useRef(0);
  const resume = workspace?.resumes.find(
    (item) => item.id === workspace.activeResumeId,
  );
  const blocked =
    busy === "generate" ||
    busy === "analyze" ||
    busy === "refine" ||
    busy === "review" ||
    busy === "draft" ||
    busy === "login";
  // `HighlightGuidance` and `CopilotPanel` are reference-only panels that do not
  // know about the batch review request. Map it onto an existing truthy value so
  // their controls stay disabled while a review runs, without widening or
  // contradicting their own busy vocabulary.
  const panelBusy = busy === "review" || busy === "draft" ? "status" : busy;

  const report = (error: unknown) =>
    setNotice({ kind: "error", text: errorMessage(error) });

  function announceContentStatus(message: string) {
    contentStatusSequence.current += 1;
    setContentStatus({
      sequence: contentStatusSequence.current,
      message,
    });
  }

  const highlights = useHighlightGuidance({
    resume,
    status: copilot,
    busy,
    panelBusy,
    setBusy,
    report,
    notify: setNotice,
    changeResume,
    setUndo,
    announce: announceContentStatus,
  });
  const { resetApr, resetHighlightReviews } = highlights;
  const drafts = useHighlightDrafts({
    resume,
    status: copilot,
    busy,
    setBusy,
    report,
    notify: setNotice,
    changeResume,
    setUndo,
  });
  const generation = useResumeGeneration({
    resume,
    setBusy,
    report,
    notify: setNotice,
    changeResume,
    setUndo,
  });
  const { exporting, exportPdf, exportBackup, importBackup } =
    useWorkspaceTransfer({
      workspace,
      resume,
      update,
      report,
      notify: setNotice,
      onImported: () => {
        generation.reset();
        setUndo(null);
        resetApr();
        resetHighlightReviews();
        drafts.reset();
        setLibrary(false);
      },
    });

  async function refreshCopilot() {
    setBusy("status");
    try {
      setCopilot(await copilotStatus());
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    copilotStatus()
      .then(setCopilot, (error: unknown) =>
        setNotice({ kind: "error", text: errorMessage(error) }),
      )
      .finally(() => setBusy(null));
  }, []);

  useEffect(() => {
    if (!contentRemoval) return;
    const remaining = Math.max(0, contentRemoval.expiresAt - Date.now());
    const timer = window.setTimeout(() => setContentRemoval(null), remaining);
    return () => window.clearTimeout(timer);
  }, [contentRemoval]);

  const resumeId = resume?.id;
  useEffect(() => {
    if (resumeId && previewScroll.current) previewScroll.current.scrollTop = 0;
  }, [resumeId]);

  function selectWorkspaceMode(next: WorkspaceMode, focusTab = false) {
    setTab(next);
    if (!focusTab) return;
    const tabElement = document.getElementById(`tab-${next}`);
    tabElement?.focus();
    tabElement?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }

  function commitResume(next: Resume) {
    update((current) => ({
      ...current,
      resumes: current.resumes.map((item) =>
        item.id === next.id
          ? { ...next, updatedAt: new Date().toISOString() }
          : item,
      ),
    }));
  }

  function changeResume(next: Resume) {
    commitResume(next);
    setUndo(null);
    setContentRemoval(null);
  }

  function changeContentView(next: ContentViewState) {
    if (
      resume &&
      next.selectedExperienceId !==
        reconcileContentView(resume, contentViews[resume.id])
          .selectedExperienceId
    ) {
      resetApr();
      drafts.reset();
    }

    if (!resume) return;
    setContentViews((current) => ({ ...current, [resume.id]: next }));
  }

  function navigateFromAudit(target: AuditFinding["target"]) {
    if (!resume) return;
    if (target.workspace === "copilot") {
      document.getElementById(target.focusId)?.focus();
      return;
    }
    selectWorkspaceMode("content", true);
    setContentViews((current) => ({
      ...current,
      [resume.id]: {
        ...reconcileContentView(resume, current[resume.id]),
        section: target.section,
      },
    }));
    setContentFocusTarget(target.focusId ?? `content-tab-${target.section}`);
  }

  function applyContentChange(current: Resume, change: ContentChange) {
    const { view } = change;
    if (view) {
      setContentViews((views) => ({
        ...views,
        [current.id]: {
          ...reconcileContentView(current, views[current.id]),
          ...view,
        },
      }));
    }
    if (change.resetsGuidance) {
      resetApr();
      drafts.reset();
    }
    commitResume(change.next);
    setUndo(null);
  }

  function removeContent(request: ContentRemovalRequest) {
    if (!resume) return;
    const change = removeContentItem(resume, request);
    if (!change) {
      report(new Error("The experience for this highlight no longer exists."));
      return;
    }
    applyContentChange(resume, change);
    setContentRemoval(contentRemovalRecord(request, resume.id));
    announceContentStatus(`Removed ${request.label}.`);
    setContentFocusTarget(change.focusTarget);
  }

  function undoContentRemoval() {
    if (!resume || !contentRemoval || contentRemoval.resumeId !== resume.id) {
      setContentRemoval(null);
      return;
    }
    selectWorkspaceMode("content");
    const change = restoreContentItem(resume, contentRemoval);
    if (!change) {
      setContentRemoval(null);
      report(new Error("The experience for this highlight no longer exists."));
      return;
    }
    applyContentChange(resume, change);
    setContentRemoval(null);
    announceContentStatus(`Restored ${contentRemoval.label}.`);
    setContentFocusTarget(change.focusTarget);
  }

  function selectResume(id: string) {
    update((current) => ({ ...current, activeResumeId: id }));
    setLibrary(false);
    generation.reset();
    highlights.clearAprConsent();
    setUndo(null);
    setContentRemoval(null);
    resetHighlightReviews();
    drafts.reset();
  }

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
    setLibrary(false);
    selectWorkspaceMode("content");
    generation.reset();
    setUndo(null);
    setContentRemoval(null);
    resetApr();
    resetHighlightReviews();
    drafts.reset();
  }

  async function login() {
    setBusy("login");
    try {
      await loginToCopilot();
      setNotice({
        kind: "success",
        text: "GitHub sign-in completed. You can now request a resume rewrite.",
      });
      setCopilot(await copilotStatus());
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
    }
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
    generation.reset();
    resetApr();
    resetHighlightReviews();
    drafts.reset();
    setUndo(null);
    setContentRemoval(null);
    setContentViews((current) => {
      const next = { ...current };
      delete next[deleteId];
      return next;
    });
  }

  if (!workspace || !resume) {
    return (
      <main className="loading-screen">
        <img src="/hireloom.svg" width="60" height="60" alt="" />
        <h1>Hireloom</h1>
        {loadError ? (
          <div className="load-error" role="alert">
            <h2>We couldn't open your workspace.</h2>
            <p>{loadError}</p>
            <p>
              Your saved data has not been changed. Restore or repair your
              backup before continuing.
            </p>
            <button className="button primary" onClick={() => void reload()}>
              Try again
            </button>
          </div>
        ) : (
          <p>
            <LoaderCircle size={18} className="spin" /> Opening your next
            chapter…
          </p>
        )}
      </main>
    );
  }

  const allBusy = blocked || exporting;
  const contentView = reconcileContentView(resume, contentViews[resume.id]);

  return (
    <div className="app-shell">
      <Sidebar
        resumes={workspace.resumes}
        activeResumeId={resume.id}
        library={library}
        blocked={blocked}
        allBusy={allBusy}
        onShowLibrary={setLibrary}
        onNewResume={() => addResume()}
        onSelectResume={selectResume}
        onMeetCopilot={() => {
          setTab("copilot");
          setLibrary(false);
        }}
      />
      <main className="main-content">
        <WorkspaceHeader
          library={library}
          name={resume.basics.name}
          notice={notice}
          onDismissNotice={() => setNotice(null)}
          saveError={saveError}
          onRetrySave={() => void flush().catch(report)}
          onExportBackup={() => void exportBackup()}
        />
        {library ? (
          <ResumeLibrary
            resumes={workspace.resumes}
            onImport={() => importInput.current?.click()}
            onExportBackup={() => void exportBackup()}
            onSelect={selectResume}
            onDuplicate={(item) => addResume(copyOf(item))}
            onDelete={setDeleteId}
            onNew={() => addResume()}
          />
        ) : (
          <section className="studio-frame" aria-label="Resume studio">
            <DocumentToolbar
              resume={resume}
              onChange={changeResume}
              blocked={blocked}
              allBusy={allBusy}
              saving={saving}
              dirty={dirty}
              saveError={saveError}
              canUndo={undo !== null}
              onUndo={() => {
                if (!undo) return;
                changeResume(undo);
                setNotice({
                  kind: "success",
                  text: "Previous wording restored.",
                });
              }}
              showTools={showTools}
              onShowTools={setShowTools}
              onDuplicate={() => addResume(copyOf(resume))}
              onBackup={() => void exportBackup()}
              onImport={() => importInput.current?.click()}
              onDelete={() => setDeleteId(resume.id)}
              exporting={exporting}
              onExportPdf={() => void exportPdf()}
            />
            <div className="studio">
              <WorkspaceTabs
                tab={tab}
                blocked={blocked}
                onSelect={selectWorkspaceMode}
              />
              {contentRemoval?.resumeId === resume.id && (
                <div className="content-undo">
                  <span>Removed {contentRemoval.label}.</span>
                  <button className="text-button" onClick={undoContentRemoval}>
                    Undo
                  </button>
                </div>
              )}
              <span
                className="sr-only"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {contentStatus && (
                  <span key={contentStatus.sequence}>
                    {contentStatus.message}
                  </span>
                )}
              </span>
              <div className="workspace-panels">
                <div
                  className="workspace-panel content-panel"
                  role="tabpanel"
                  id="panel-content"
                  aria-labelledby="tab-content"
                  hidden={tab !== "content"}
                >
                  <Editor
                    resume={resume}
                    onChange={changeResume}
                    onAi={() => selectWorkspaceMode("copilot", true)}
                    onExample={() => addResume(exampleResume())}
                    viewState={contentView}
                    onViewStateChange={changeContentView}
                    onRemove={removeContent}
                    focusTarget={contentFocusTarget}
                    onFocusTargetHandled={() => setContentFocusTarget(null)}
                    highlightGuidance={highlights.guidance}
                    highlightReview={highlights.review}
                    highlightDrafts={drafts.controller}
                  />
                </div>
                <div
                  className="workspace-panel tool-panel-scroll"
                  role="tabpanel"
                  id="panel-copilot"
                  aria-labelledby="tab-copilot"
                  hidden={tab !== "copilot"}
                >
                  <fieldset
                    className="assistant-fieldset"
                    disabled={busy === "generate" || busy === "analyze"}
                  >
                    <CopilotPanel
                      resume={resume}
                      onChange={changeResume}
                      status={copilot}
                      busy={panelBusy}
                      consent={generation.consent}
                      onConsent={generation.setConsent}
                      onRefresh={() => void refreshCopilot()}
                      onLogin={() => void login()}
                      onGenerate={() => void generation.generate()}
                      proposal={generation.proposal}
                      stale={generation.stale}
                      onApply={generation.apply}
                      onDiscard={generation.discard}
                      onAuditNavigate={navigateFromAudit}
                    />
                  </fieldset>
                </div>
                <div
                  className="workspace-panel tool-panel-scroll"
                  role="tabpanel"
                  id="panel-style"
                  aria-labelledby="tab-style"
                  hidden={tab !== "style"}
                >
                  <StylePanel resume={resume} onChange={changeResume} />
                </div>
                <div
                  className="workspace-panel preview-pane"
                  role="tabpanel"
                  id="panel-preview"
                  aria-labelledby="tab-preview"
                  hidden={tab !== "preview"}
                >
                  <PreviewPanel
                    resume={resume}
                    blocked={blocked}
                    onChangeDesign={() => selectWorkspaceMode("style", true)}
                    scrollRef={previewScroll}
                  />
                </div>
              </div>
              <div className="editor-footer">
                <LockKeyhole size={12} /> No account needed to create, save, or
                export.
              </div>
            </div>
          </section>
        )}
        <footer className="page-footer">
          <span>Thoughtfully crafted. Authentically you.</span>
          <button className="text-button" onClick={() => setShowLicense(true)}>
            Font licenses
          </button>
          <span>HIRING IS HUMAN. YOUR RESUME SHOULD BE, TOO.</span>
        </footer>
      </main>
      <input
        className="visually-hidden"
        ref={importInput}
        type="file"
        accept=".json,application/json"
        aria-label="Import Hireloom backup"
        onChange={(event) => void importBackup(event)}
        tabIndex={-1}
      />
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
