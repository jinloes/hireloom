import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Info,
  Minus,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { auditResume } from "../../audit";
import {
  estimatePageCount,
  resumeReadiness,
  type Resume,
  type SectionKey,
} from "../../model";
import { ResumePreview } from "../ResumePreview";

export type StudioTab = "content" | "copilot" | "style";

export function StudioPreviewPane({
  resume,
  blocked,
  previewZoom,
  showAudit,
  onSetPreviewZoom,
  onSetShowAudit,
  onSetTab,
  onSelectSection,
}: {
  resume: Resume;
  blocked: boolean;
  previewZoom: 90 | 100 | 125;
  showAudit: boolean;
  onSetPreviewZoom: React.Dispatch<React.SetStateAction<90 | 100 | 125>>;
  onSetShowAudit: React.Dispatch<React.SetStateAction<boolean>>;
  onSetTab: (tab: StudioTab) => void;
  onSelectSection: (section: SectionKey | "basics", entryId?: string) => void;
}) {
  const readiness = resumeReadiness(resume);
  const completed = readiness.filter((item) => item.complete).length;
  const audit = auditResume(resume);
  const pageEstimate = estimatePageCount(resume);

  return (
    <div className="preview-pane">
      <div className="preview-toolbar">
        <span>
          <span className="live-dot" /> LIVE PREVIEW
        </span>
        <div className="preview-toolbar-controls">
          <div className="zoom-controls" role="group" aria-label="Preview zoom">
            <button
              type="button"
              className="icon-button zoom-btn"
              aria-label="Zoom out preview"
              disabled={previewZoom === 90}
              onClick={() => onSetPreviewZoom((z) => (z === 125 ? 100 : 90))}
            >
              <Minus size={12} />
            </button>
            <span className="zoom-readout">{previewZoom}%</span>
            <button
              type="button"
              className="icon-button zoom-btn"
              aria-label="Zoom in preview"
              disabled={previewZoom === 125}
              onClick={() => onSetPreviewZoom((z) => (z === 90 ? 100 : 125))}
            >
              <Plus size={12} />
            </button>
          </div>
          <span>
            {resume.pageSize === "letter" ? "US Letter" : "A4"}{" "}
            <span className="toolbar-divider">/</span>{" "}
            {resume.template === "editorial" ? "Editorial" : "Modern"}{" "}
            <span className="toolbar-divider">·</span> ~{pageEstimate.pages}{" "}
            {pageEstimate.pages === 1 ? "page" : "pages"}{" "}
            <button
              type="button"
              className="text-button"
              disabled={blocked}
              onClick={() => onSetTab("style")}
            >
              Change
            </button>
          </span>
        </div>
      </div>
      <div className="paper-scroll">
        <ResumePreview
          resume={resume}
          zoom={previewZoom}
          onSelectSection={onSelectSection}
        />
        <p className="preview-caption">
          <ShieldCheck size={13} /> Selectable text. Click any section to jump
          to its fields.
        </p>
      </div>
      <div className="readiness-bar">
        <div className="readiness-heading">
          <span>
            <CheckCircle2 size={17} />
            <strong>Resume essentials</strong>
          </span>
          <div className="readiness-summary-controls">
            <span>
              {completed} of {readiness.length} ready
            </span>
            <button
              className="text-button audit-toggle"
              aria-expanded={showAudit}
              onClick={() => onSetShowAudit((open) => !open)}
            >
              Quality checks ({audit.passed}/{audit.total})
              {showAudit ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </button>
          </div>
        </div>
        <div className="readiness-track">
          <span
            style={{
              width: `${(completed / readiness.length) * 100}%`,
            }}
          />
        </div>
        <div className="readiness-items">
          {readiness.map((item) => (
            <span
              key={item.label}
              className={item.complete ? "complete" : ""}
              title={item.label}
            >
              {item.complete ? <Check size={11} /> : <Circle size={9} />}
              {item.label}
            </span>
          ))}
        </div>
        {showAudit && (
          <section className="audit-drawer" aria-label="Resume quality checks">
            <p className="fine-print">
              Deterministic local checks across completeness, impact,
              formatting, and role alignment—never a black-box ATS score.
            </p>
            <ul className="audit-list">
              {audit.items.map((item) => (
                <li
                  key={item.id}
                  className={`audit-item status-${item.status}`}
                >
                  <span className="audit-icon">
                    {item.status === "pass" ? (
                      <Check size={12} />
                    ) : item.status === "warn" ? (
                      <AlertTriangle size={12} />
                    ) : (
                      <Info size={12} />
                    )}
                  </span>
                  <div className="audit-body">
                    <strong>
                      <span className="audit-category">{item.category}</span>
                      {item.label}
                    </strong>
                    <p>{item.detail}</p>
                  </div>
                  {item.status !== "pass" && (
                    <button
                      className="text-button"
                      onClick={() => onSetTab(item.targetTab)}
                    >
                      Open
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
