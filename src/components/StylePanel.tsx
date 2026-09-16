import { Check, LayoutTemplate, Palette } from "lucide-react";
import { accents, type Resume } from "../model";

export function StylePanel({
  resume,
  onChange,
}: {
  resume: Resume;
  onChange: (resume: Resume) => void;
}) {
  return (
    <div className="style-content">
      <span className="eyebrow">LET YOUR WORK DO THE TALKING</span>
      <h2>A little polish. All you.</h2>
      <p className="muted">
        Clean, single-column layouts with selectable text. Made for people to
        read and software to parse.
      </p>
      <h3 className="control-heading">
        <LayoutTemplate size={17} /> Layout
      </h3>
      <div className="template-options">
        {(["editorial", "modern"] as const).map((template) => (
          <button
            key={template}
            className={`template-option ${resume.template === template ? "selected" : ""}`}
            aria-pressed={resume.template === template}
            onClick={() => onChange({ ...resume, template })}
          >
            <div className={`mini-paper ${template}`}>
              <strong>Alex Morgan</strong>
              <span>PRODUCT DESIGNER</span>
              <i />
              <i />
              <i />
              <b>EXPERIENCE</b>
              <i />
              <i />
              <i />
            </div>
            <span className="template-label">
              {template === "editorial" ? "Editorial" : "Modern"}
              {resume.template === template && <Check size={15} />}
            </span>
            <small>
              {template === "editorial"
                ? "A confident, classic serif"
                : "A crisp, contemporary sans"}
            </small>
          </button>
        ))}
      </div>
      <h3 className="control-heading">
        <Palette size={17} /> Accent color
      </h3>
      <div className="accent-options">
        {(Object.keys(accents) as Resume["accent"][]).map((accent) => (
          <button
            key={accent}
            className="accent-option"
            aria-label={`${accent} accent`}
            aria-pressed={resume.accent === accent}
            onClick={() => onChange({ ...resume, accent })}
          >
            <span style={{ backgroundColor: accents[accent] }}>
              {resume.accent === accent && <Check size={18} />}
            </span>
            {accent}
          </button>
        ))}
      </div>
      <div className="style-note">
        <strong>Good design gets out of the way.</strong>
        <p>
          Both layouts export as an A4 PDF with embedded fonts. Longer resumes
          flow onto additional pages automatically. The live preview is
          continuous; the PDF is the final paginated version.
        </p>
      </div>
    </div>
  );
}
