import {
  ArrowUpRight,
  ChevronRight,
  FileText,
  FolderOpen,
  Github,
  LockKeyhole,
  Plus,
} from "lucide-react";
import type { Resume } from "../model";
import { desktop } from "../platform";

export function Sidebar({
  resumes,
  activeResumeId,
  library,
  blocked,
  allBusy,
  onShowLibrary,
  onNewResume,
  onSelectResume,
  onMeetCopilot,
}: {
  resumes: Resume[];
  activeResumeId: string;
  library: boolean;
  blocked: boolean;
  allBusy: boolean;
  onShowLibrary: (library: boolean) => void;
  onNewResume: () => void;
  onSelectResume: (id: string) => void;
  onMeetCopilot: () => void;
}) {
  return (
    <aside className="sidebar" aria-label="Workspace navigation">
      <a
        className="brand"
        href="#"
        onClick={(event) => {
          event.preventDefault();
          onShowLibrary(false);
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
        onClick={onNewResume}
      >
        <Plus size={17} /> New resume
      </button>
      <span className="nav-label">WORKSPACE</span>
      <nav>
        <button
          className={`nav-item ${!library ? "active" : ""}`}
          disabled={blocked}
          onClick={() => onShowLibrary(false)}
        >
          <FileText size={18} /> Resume studio <ChevronRight size={14} />
        </button>
        <button
          className={`nav-item ${library ? "active" : ""}`}
          disabled={blocked}
          onClick={() => onShowLibrary(true)}
        >
          <FolderOpen size={18} /> My resumes{" "}
          <span className="count">{resumes.length}</span>
        </button>
      </nav>
      <div className="sidebar-resumes">
        <span className="nav-label">YOUR DOCUMENTS</span>
        {resumes
          .slice(-5)
          .reverse()
          .map((item) => (
            <button
              key={item.id}
              disabled={blocked}
              className={`resume-link ${item.id === activeResumeId ? "selected" : ""}`}
              onClick={() => onSelectResume(item.id)}
            >
              <span className="document-dot" />
              <span>{item.title}</span>
            </button>
          ))}
      </div>
      <div className="sidebar-bottom">
        <div className="copilot-promo">
          <div className="promo-top">
            <Github size={23} />
            <span className="tiny-badge">YOUR AI CO-PILOT</span>
          </div>
          <h3>
            A stronger story.
            <br />
            Still entirely yours.
          </h3>
          <p>
            Bring your experience.
            <br />
            Let Copilot help with the words.
          </p>
          <button disabled={blocked} onClick={onMeetCopilot}>
            Meet your writing partner <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="local-status">
          <LockKeyhole size={15} />
          <span>
            {desktop
              ? "Local-first. Yours to keep."
              : "Browser preview · local storage"}
          </span>
        </div>
        <p className="sidebar-version">
          HIRELOOM <span>v0.1</span>
        </p>
      </div>
    </aside>
  );
}
