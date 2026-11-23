import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Info,
  LoaderCircle,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { auditResume } from "../../audit";
import {
  countPdfPages,
  estimatePageCount,
  resumeReadiness,
  type CareerLibrary,
  type Resume,
  type SectionKey,
} from "../../model";
import { ResumePreview } from "../ResumePreview";
import { VariantCompareView } from "./VariantCompareView";

export type StudioTab = "content" | "copilot" | "style";
export type PreviewMode = "sheet" | "pdf" | "compare";

export function StudioPreviewPane({
  resume,
  resumes,
  careerLibrary,
  previewZoom,
  showAudit,
  onSetPreviewZoom,
  onSetShowAudit,
  onSetTab,
  onSelectSection,
}: {
  resume: Resume;
  resumes: Resume[];
  careerLibrary: CareerLibrary;
  previewZoom: 90 | 100 | 125;
  showAudit: boolean;
  onSetPreviewZoom: React.Dispatch<React.SetStateAction<90 | 100 | 125>>;
  onSetShowAudit: React.Dispatch<React.SetStateAction<boolean>>;
  onSetTab: (tab: StudioTab) => void;
  onSelectSection: (section: SectionKey | "basics", entryId?: string) => void;
}) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>("sheet");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [exactPdfPages, setExactPdfPages] = useState<number | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfSeqRef = useRef(0);
  const pdfUrlRef = useRef<string | null>(null);

  const readiness = resumeReadiness(resume);
  const completed = readiness.filter((item) => item.complete).length;
  const audit = auditResume(resume);
  const pageEstimate = estimatePageCount(resume);

  const renderExactPdfProof = useCallback(async (source: Resume) => {
    pdfSeqRef.current += 1;
    const seq = pdfSeqRef.current;
    setPdfBusy(true);
    setPdfError(null);
    try {
      const { createPdf } = await import("../../ResumeDocument");
      const blob = await createPdf(source);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const pages = countPdfPages(bytes);
      if (pdfSeqRef.current !== seq) return;
      const nextUrl = URL.createObjectURL(blob);
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
      }
      pdfUrlRef.current = nextUrl;
      setPdfUrl(nextUrl);
      setExactPdfPages(pages);
    } catch (error) {
      if (pdfSeqRef.current !== seq) return;
      setPdfError(
        error instanceof Error
          ? error.message
          : "Unable to render PDF page proof.",
      );
    } finally {
      if (pdfSeqRef.current === seq) {
        setPdfBusy(false);
      }
    }
  }, []);

  useEffect(() => {
    if (previewMode !== "pdf") return;
    const timer = window.setTimeout(() => {
      void renderExactPdfProof(resume);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [previewMode, resume, renderExactPdfProof]);

  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
      }
    };
  }, []);

  return (
    <div className="preview-pane">
      <div className="preview-toolbar">
        <div className="preview-mode-bar">
          <div
            className="preview-mode-group"
            role="group"
            aria-label="Preview mode"
          >
            {(
              [
                ["sheet", "Live sheet"],
                ["pdf", "PDF proof"],
                ["compare", "Compare"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={previewMode === mode ? "active" : ""}
                aria-pressed={previewMode === mode}
                onClick={() => setPreviewMode(mode)}
              >
                {mode === "sheet" && <span className="live-dot" />}
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="preview-toolbar-controls">
          {previewMode === "sheet" && (
            <div
              className="zoom-controls"
              role="group"
              aria-label="Preview zoom"
            >
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
          )}
          {previewMode === "pdf" && (
            <button
              type="button"
              className="button secondary small"
              disabled={pdfBusy}
              onClick={() => void renderExactPdfProof(resume)}
            >
              {pdfBusy ? (
                <LoaderCircle size={12} className="spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              Refresh proof
            </button>
          )}
          <span>
            {resume.pageSize === "letter" ? "US Letter" : "A4"}{" "}
            <span className="toolbar-divider">/</span>{" "}
            {resume.template === "editorial" ? "Editorial" : "Modern"}{" "}
            <span className="toolbar-divider">·</span>{" "}
            {previewMode === "pdf" && exactPdfPages !== null
              ? `Exact PDF: ${exactPdfPages} ${exactPdfPages === 1 ? "page" : "pages"}`
              : `~${pageEstimate.pages} ${pageEstimate.pages === 1 ? "page" : "pages"}`}{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => onSetTab("style")}
            >
              Change
            </button>
          </span>
        </div>
      </div>
      <div className="paper-scroll">
        {previewMode === "sheet" && (
          <>
            <ResumePreview
              resume={resume}
              zoom={previewZoom}
              onSelectSection={onSelectSection}
            />
            <p className="preview-caption">
              <ShieldCheck size={13} /> Selectable text. Click any section to
              jump to its fields.
            </p>
          </>
        )}
        {previewMode === "pdf" && (
          <div className="pdf-proof-stage">
            <div className="pdf-proof-banner" role="status">
              <span>
                {pdfBusy
                  ? "Rendering exact PDF page proof locally…"
                  : pdfError
                    ? pdfError
                    : exactPdfPages !== null
                      ? `Verified local PDF output: ${exactPdfPages} ${exactPdfPages === 1 ? "page" : "pages"} (${resume.pageSize === "letter" ? "US Letter" : "A4"}).`
                      : "Preparing exact PDF page proof…"}
              </span>
            </div>
            {pdfUrl && !pdfError && (
              <iframe
                title="Exact PDF page proof"
                src={pdfUrl}
                className="pdf-proof-frame"
              />
            )}
          </div>
        )}
        {previewMode === "compare" && (
          <VariantCompareView
            resume={resume}
            resumes={resumes}
            careerLibrary={careerLibrary}
          />
        )}
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
