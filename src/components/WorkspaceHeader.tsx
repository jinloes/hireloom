import { CheckCircle2, ChevronRight, ShieldCheck, X } from "lucide-react";

export type Notice = { kind: "success" | "error"; text: string };

export function WorkspaceHeader({
  library,
  name,
  notice,
  onDismissNotice,
  saveError,
  onRetrySave,
  onExportBackup,
}: {
  library: boolean;
  name: string;
  notice: Notice | null;
  onDismissNotice: () => void;
  saveError: string | null;
  onRetrySave: () => void;
  onExportBackup: () => void;
}) {
  return (
    <>
      <header className="topbar">
        <div className="breadcrumb">
          Workspace <ChevronRight size={13} />
          <strong>{library ? "My resumes" : "Resume studio"}</strong>
        </div>
        <div className="topbar-right">
          <span className="private-badge">
            <ShieldCheck size={14} /> Private by default
          </span>
          <div className="avatar" aria-label="Local workspace">
            {name.slice(0, 1).toUpperCase() || "H"}
          </div>
        </div>
      </header>
      {notice && (
        <div
          className={`notice ${notice.kind}`}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          <span>
            {notice.kind === "success" && <CheckCircle2 size={16} />}
            {notice.text}
          </span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={onDismissNotice}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {saveError && (
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
      )}
      <section className="workspace-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> A LITTLE CLARITY. A LOT OF
            POSSIBILITY.
          </div>
          <h1>
            {library
              ? "A story for every opportunity."
              : "Make your next move."}
          </h1>
          <p>
            {library
              ? "Keep a thoughtful version for each role. Your work stays on this device."
              : "Your experience, beautifully told. Let's make a resume that feels like you."}
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
    </>
  );
}
