import type { RefObject } from "react";
import { Check, CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import { resumeReadiness, type Resume } from "../model";
import { ResumePreview } from "./ResumePreview";

export function PreviewPanel({
  resume,
  blocked,
  onChangeDesign,
  scrollRef,
}: {
  resume: Resume;
  blocked: boolean;
  onChangeDesign: () => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const readiness = resumeReadiness(resume);
  const completed = readiness.filter((item) => item.complete).length;
  return (
    <>
      <div className="preview-toolbar">
        <span>
          <span className="live-dot" /> LIVE PREVIEW
        </span>
        <span>
          A4 <span className="toolbar-divider">/</span>{" "}
          {resume.template === "editorial" ? "Editorial" : "Modern"}{" "}
          <button
            className="text-button"
            disabled={blocked}
            onClick={onChangeDesign}
          >
            Change
          </button>
        </span>
      </div>
      <div className="paper-scroll" ref={scrollRef}>
        <ResumePreview resume={resume} />
        <p className="preview-caption">
          <ShieldCheck size={13} /> Selectable text. Clean layout. No
          watermarks.
        </p>
      </div>
      <div className="readiness-bar">
        <div className="readiness-heading">
          <span>
            <CheckCircle2 size={17} />
            <strong>Resume essentials</strong>
          </span>
          <span>
            {completed} of {readiness.length} ready
          </span>
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
      </div>
    </>
  );
}
