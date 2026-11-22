import {
  ArrowDownToLine,
  Copy,
  FileText,
  FileUp,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import type { Resume } from "../../model";

export function ResumeLibraryView({
  resumes,
  allBusy,
  onSelectResume,
  onAddResume,
  onDuplicateResume,
  onRequestDeleteResume,
  onTriggerResumeImport,
  onTriggerBackupImport,
  onExportBackup,
}: {
  resumes: Resume[];
  allBusy: boolean;
  onSelectResume: (id: string) => void;
  onAddResume: () => void;
  onDuplicateResume: (item: Resume) => void;
  onRequestDeleteResume: (id: string) => void;
  onTriggerResumeImport: () => void;
  onTriggerBackupImport: () => void;
  onExportBackup: () => void;
}) {
  return (
    <section className="library">
      <div className="library-toolbar">
        <span>
          {resumes.length} local document{resumes.length === 1 ? "" : "s"}
        </span>
        <div className="button-row">
          <button
            className="button secondary small"
            disabled={allBusy}
            onClick={onTriggerResumeImport}
          >
            <FileUp size={14} /> Import PDF or DOCX
          </button>
          <button
            className="button secondary small"
            onClick={onTriggerBackupImport}
          >
            <Upload size={14} /> Import backup
          </button>
          <button className="button secondary small" onClick={onExportBackup}>
            <ArrowDownToLine size={14} /> Back up all
          </button>
        </div>
      </div>
      <div className="resume-grid">
        {resumes.map((item) => (
          <div className="library-card" key={item.id}>
            <button
              className="library-card-open"
              onClick={() => onSelectResume(item.id)}
            >
              <div className={`library-thumbnail template-${item.template}`}>
                <FileText size={24} />
                <h3>{item.basics.name || "Your name"}</h3>
                <p>{item.basics.headline || "Your next chapter"}</p>
                <div />
                <div />
                <div />
              </div>
              <strong>{item.title}</strong>
              <span>
                Edited{" "}
                {new Date(item.updatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </button>
            <div className="library-card-actions">
              <button
                className="text-button"
                onClick={() => onDuplicateResume(item)}
              >
                <Copy size={13} /> Duplicate
              </button>
              <button
                className="icon-button danger"
                aria-label={`Delete ${item.title}`}
                onClick={() => onRequestDeleteResume(item.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        <button className="new-document-card" onClick={onAddResume}>
          <span>
            <Plus size={23} />
          </span>
          <strong>A fresh start</strong>
          <p>Create a resume for your next opportunity.</p>
        </button>
      </div>
    </section>
  );
}
