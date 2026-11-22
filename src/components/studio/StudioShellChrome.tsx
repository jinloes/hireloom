import {
  ArrowUpRight,
  BookMarked,
  CheckCircle2,
  ChevronRight,
  FileText,
  FolderOpen,
  Github,
  LoaderCircle,
  LockKeyhole,
  Moon,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import type { Resume, Workspace } from "../../model";
import { desktop } from "../../platform";
import type { StudioNotice } from "../../hooks/useStudioAiWorkflows";

export type WorkspaceView = "studio" | "resumes" | "careerLibrary";
export type StudioTheme = "light" | "dark";

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
  blocked,
  onSetView,
  onAddResume,
  onSelectResume,
  onOpenCopilotTab,
}: {
  workspace: Workspace;
  resume: Resume;
  view: WorkspaceView;
  careerLibraryCount: number;
  allBusy: boolean;
  blocked: boolean;
  onSetView: (view: WorkspaceView) => void;
  onAddResume: () => void;
  onSelectResume: (id: string) => void;
  onOpenCopilotTab: () => void;
}) {
  return (
    <aside className="sidebar" aria-label="Workspace navigation">
      <a
        className="brand"
        href="#"
        onClick={(event) => {
          event.preventDefault();
          onSetView("studio");
        }}
      >
        <img src="/hireloom.svg" alt="" />
        <span>
          hireloom<span className="brand-period">.</span>
        </span>
      </a>
      <p className="brand-caption">YOUR NEXT CHAPTER</p>
      <button
        className="button primary new-resume"
        disabled={allBusy}
        onClick={onAddResume}
      >
        <Plus size={17} /> New resume
      </button>
      <span className="nav-label">WORKSPACE</span>
      <nav>
        <button
          className={`nav-item ${view === "studio" ? "active" : ""}`}
          disabled={blocked}
          onClick={() => onSetView("studio")}
        >
          <FileText size={18} /> Resume studio <ChevronRight size={14} />
        </button>
        <button
          className={`nav-item ${view === "resumes" ? "active" : ""}`}
          disabled={blocked}
          onClick={() => onSetView("resumes")}
        >
          <FolderOpen size={18} /> My resumes{" "}
          <span className="count">{workspace.resumes.length}</span>
        </button>
        <button
          className={`nav-item ${view === "careerLibrary" ? "active" : ""}`}
          disabled={blocked}
          onClick={() => onSetView("careerLibrary")}
        >
          <BookMarked size={18} /> Career library{" "}
          <span className="count">{careerLibraryCount}</span>
        </button>
      </nav>
      <div className="sidebar-resumes">
        <span className="nav-label">YOUR DOCUMENTS</span>
        {workspace.resumes
          .slice(-5)
          .reverse()
          .map((item) => (
            <button
              key={item.id}
              disabled={blocked}
              className={`resume-link ${item.id === resume.id ? "selected" : ""}`}
              onClick={() => onSelectResume(item.id)}
            >
              <span className="document-dot" />
              <span>{item.title}</span>
            </button>
          ))}
      </div>
      <div className="sidebar-bottom">
        {desktop ? (
          <div className="copilot-promo">
            <div className="promo-top">
              <Github size={20} />
              <span className="tiny-badge">YOUR AI CO-PILOT</span>
            </div>
            <h3>A stronger story. Still entirely yours.</h3>
            <button disabled={blocked} onClick={onOpenCopilotTab}>
              Meet your writing partner <ArrowUpRight size={15} />
            </button>
          </div>
        ) : null}
        <div className="local-status">
          <LockKeyhole size={14} />
          <span>
            {desktop
              ? "Local-first. Yours to keep."
              : "Browser preview · local storage"}
          </span>
        </div>
        <p className="sidebar-version">
          HIRELOOM <span>v0.2</span>
        </p>
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
