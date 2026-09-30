import {
  ArrowDownToLine,
  Copy,
  FileText,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import type { Resume } from "../model";

export function ResumeLibrary({
  resumes,
  onImport,
  onExportBackup,
  onSelect,
  onDuplicate,
  onDelete,
  onNew,
}: {
  resumes: Resume[];
  onImport: () => void;
  onExportBackup: () => void;
  onSelect: (id: string) => void;
  onDuplicate: (resume: Resume) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <section className="library">
      <div className="library-toolbar">
        <span>
          {resumes.length} local document
          {resumes.length === 1 ? "" : "s"}
        </span>
        <div className="button-row">
          <button className="button secondary small" onClick={onImport}>
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
              onClick={() => onSelect(item.id)}
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
              <button className="text-button" onClick={() => onDuplicate(item)}>
                <Copy size={13} /> Duplicate
              </button>
              <button
                className="icon-button danger"
                aria-label={`Delete ${item.title}`}
                onClick={() => onDelete(item.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        <button className="new-document-card" onClick={onNew}>
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
