import {
  ArrowUpRight,
  BookMarked,
  CheckCircle2,
  ChevronRight,
  FileText,
  FolderOpen,
  LoaderCircle,
  LockKeyhole,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import type { Resume, Workspace } from "../../model";
import { desktop } from "../../platform";
import type { StudioNotice } from "../../hooks/useStudioAiWorkflows";
import type { StudioTheme } from "../../uiPreferences";

export type WorkspaceView = "studio" | "resumes" | "careerLibrary";
export type { StudioTheme };

export function LoadingScreen({
  loadError,
  onReload,
}: {
  loadError: string | null;
  onReload: () => void;
}) {
  return (
    <main className="loading-screen">
      <img src="/hireloom.svg" width="60" height="60" alt="" />
      <h1>Hireloom</h1>
      {loadError ? (
        <div className="load-error" role="alert">
          <h2>We couldn't open your workspace.</h2>
          <p>{loadError}</p>
          <p>
            Your saved data has not been changed. Restore or repair your backup
            before continuing.
          </p>
          <button className="button primary" onClick={onReload}>
            Try again
          </button>
        </div>
      ) : (
        <p>
          <LoaderCircle size={18} className="spin" /> Opening your next chapter…
        </p>
      )}
    </main>
  );
}

export function StudioSidebar({
  workspace,
  resume,
  view,
  careerLibraryCount,
  allBusy,
  collapsed,
  aiPromoDismissed,
  onSetView,
  onAddResume,
  onSelectResume,
  onOpenCopilotTab,
  onToggleCollapsed,
  onDismissAiPromo,
}: {
  workspace: Workspace;
  resume: Resume;
  view: WorkspaceView;
  careerLibraryCount: number;
  allBusy: boolean;
  collapsed: boolean;
  aiPromoDismissed: boolean;
  onSetView: (view: WorkspaceView) => void;
  onAddResume: () => void;
  onSelectResume: (id: string) => void;
  onOpenCopilotTab: () => void;
  onToggleCollapsed: () => void;
  onDismissAiPromo: () => void;
}) {
  return (
    <aside
      className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}
      aria-label="Workspace navigation"
    >
      <div className="sidebar-brand-row">
        <a
          className="brand"
          href="#"
          title="Resume studio"
          onClick={(event) => {
            event.preventDefault();
            onSetView("studio");
          }}
        >
          <img src="/hireloom.svg" alt="" />
          <span className="sidebar-text">
            hireloom<span className="brand-period">.</span>
          </span>
        </a>
        <button
          type="button"
          className="icon-button sidebar-collapse-btn"
          aria-label={
            collapsed
              ? "Expand workspace sidebar"
              : "Collapse workspace sidebar"
          }
          aria-expanded={!collapsed}
          title={
            collapsed
              ? "Expand sidebar (Ctrl+\\)"
              : "Collapse sidebar (Ctrl+\\)"
          }
          onClick={onToggleCollapsed}
        >
          {collapsed ? (
            <PanelLeftOpen size={15} />
          ) : (
            <PanelLeftClose size={15} />
          )}
        </button>
      </div>
      <p className="brand-caption sidebar-text">YOUR NEXT CHAPTER</p>
      <button
        className="button primary new-resume"
        disabled={allBusy}
        title="New resume"
        onClick={onAddResume}
      >
        <Plus size={17} /> <span className="sidebar-text">New resume</span>
      </button>
      <span className="nav-label sidebar-text">WORKSPACE</span>
      <nav>
        <button
          className={`nav-item ${view === "studio" ? "active" : ""}`}
          title="Resume studio"
          onClick={() => onSetView("studio")}
        >
          <FileText size={18} />{" "}
          <span className="sidebar-text">Resume studio</span>{" "}
          <ChevronRight size={14} className="sidebar-text" />
        </button>
        <button
          className={`nav-item ${view === "resumes" ? "active" : ""}`}
          title="My resumes"
          onClick={() => onSetView("resumes")}
        >
          <FolderOpen size={18} />{" "}
          <span className="sidebar-text">My resumes</span>{" "}
          <span className="count sidebar-text">{workspace.resumes.length}</span>
        </button>
        <button
          className={`nav-item ${view === "careerLibrary" ? "active" : ""}`}
          title="Career library"
          onClick={() => onSetView("careerLibrary")}
        >
          <BookMarked size={18} />{" "}
          <span className="sidebar-text">Career library</span>{" "}
          <span className="count sidebar-text">{careerLibraryCount}</span>
        </button>
      </nav>
      {!collapsed && (
        <div className="sidebar-resumes">
          <span className="nav-label">YOUR DOCUMENTS</span>
          {workspace.resumes
            .slice(-5)
            .reverse()
            .map((item) => (
              <button
                key={item.id}
                disabled={allBusy}
                className={`resume-link ${item.id === resume.id ? "selected" : ""}`}
                onClick={() => onSelectResume(item.id)}
              >
                <span className="document-dot" />
                <span>{item.title}</span>
              </button>
            ))}
        </div>
      )}
      <div className="sidebar-bottom">
        {desktop && !aiPromoDismissed && !collapsed ? (
          <div className="copilot-promo">
            <div className="promo-top">
              <Sparkles size={18} />
              <span className="tiny-badge">TAILOR &amp; COACH</span>
              <button
                type="button"
                className="promo-dismiss-btn"
                aria-label="Dismiss AI studio card"
                onClick={onDismissAiPromo}
              >
                <X size={13} />
              </button>
            </div>
            <h3>A stronger story. Still entirely yours.</h3>
            <button onClick={onOpenCopilotTab}>
              Open Tailor &amp; Coach <ArrowUpRight size={15} />
            </button>
          </div>
        ) : null}
        <div
          className="local-status"
          title={
            desktop
              ? "Local-first. Yours to keep."
              : "Browser preview · local storage"
          }
        >
          <LockKeyhole size={14} />
          <span className="sidebar-text">
            {desktop
              ? "Local-first. Yours to keep."
              : "Browser preview · local storage"}
          </span>
        </div>
        {!collapsed && (
          <p className="sidebar-version">
            HIRELOOM <span>v0.2</span>
          </p>
        )}
      </div>
    </aside>
  );
}

export function StudioTopbar({
  view,
  theme,
  candidateInitial,
  onToggleTheme,
}: {
  view: WorkspaceView;
  theme: StudioTheme;
  candidateInitial: string;
  onToggleTheme: () => void;
}) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        Workspace <ChevronRight size={13} />
        <strong>
          {view === "resumes"
            ? "My resumes"
            : view === "careerLibrary"
              ? "Career library"
              : "Resume studio"}
        </strong>
      </div>
      <div className="topbar-right">
        <span className="private-badge">
          <ShieldCheck size={14} /> Private by default
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
        <div className="avatar" aria-label="Local workspace">
          {candidateInitial}
        </div>
      </div>
    </header>
  );
}

export function NoticeBanner({
  notice,
  canUndo,
  onUndo,
  onDismiss,
}: {
  notice: StudioNotice;
  canUndo: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className={`notice ${notice.kind}`}
      role={notice.kind === "error" ? "alert" : "status"}
    >
      <span>
        {notice.kind === "success" && <CheckCircle2 size={16} />}
        {notice.text}
      </span>
      <div className="notice-actions">
        {notice.canUndo && canUndo && (
          <button type="button" className="text-button" onClick={onUndo}>
            <RotateCcw size={13} /> Undo
          </button>
        )}
        <button
          type="button"
          className="icon-button"
          aria-label="Dismiss notification"
          onClick={onDismiss}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

export function SaveErrorBanner({
  saveError,
  onRetrySave,
  onExportBackup,
}: {
  saveError: string;
  onRetrySave: () => void;
  onExportBackup: () => void;
}) {
  return (
    <div className="save-error" role="alert">
      <strong>Your latest changes are not saved.</strong>
      <span>{saveError}</span>
      <button className="text-button" onClick={onRetrySave}>
        Retry save
      </button>
      <button className="text-button" onClick={onExportBackup}>
        Export recovery backup
      </button>
    </div>
  );
}

export function WorkspaceHeading({
  view,
}: {
  view: "resumes" | "careerLibrary";
}) {
  return (
    <section className="workspace-heading">
      <div>
        <div className="eyebrow">
          <span className="eyebrow-line" /> A LITTLE CLARITY. A LOT OF
          POSSIBILITY.
        </div>
        <h1>
          {view === "resumes"
            ? "A story for every opportunity."
            : "Your master career library."}
        </h1>
        <p>
          {view === "resumes"
            ? "Keep a thoughtful version for each role. Your work stays on this device."
            : "Maintain your canonical roles, APR-refined accomplishments, and projects in one local place."}
        </p>
      </div>
      <div className="heading-detail">
        <span className="decorative-sparkle">✧</span>
        <span>
          Made for
          <br />
          <strong>what's next.</strong>
        </span>
      </div>
    </section>
  );
}
