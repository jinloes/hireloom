import {
  ArrowDown,
  ArrowUp,
  Check,
  FileSpreadsheet,
  LayoutTemplate,
  ListOrdered,
  Palette,
  SlidersHorizontal,
} from "lucide-react";
import {
  accents,
  SECTION_LABELS,
  type Density,
  type PageSize,
  type Resume,
} from "../model";

export function StylePanel({
  resume,
  onChange,
}: {
  resume: Resume;
  onChange: (resume: Resume) => void;
}) {
  const moveSection = (index: number, direction: number) => {
    const other = index + direction;
    if (other < 0 || other >= resume.sectionOrder.length) return;
    const next = [...resume.sectionOrder];
    [next[index], next[other]] = [next[other], next[index]];
    onChange({ ...resume, sectionOrder: next });
  };

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

      <h3 className="control-heading">
        <FileSpreadsheet size={17} /> Page size
      </h3>
      <div className="segmented-options" role="group" aria-label="Page size">
        {(
          [
            {
              id: "a4",
              label: "A4",
              hint: "210 × 297 mm · International",
            },
            {
              id: "letter",
              label: "US Letter",
              hint: "8.5 × 11 in · North America",
            },
          ] as { id: PageSize; label: string; hint: string }[]
        ).map((option) => (
          <button
            key={option.id}
            className={`segmented-option ${resume.pageSize === option.id ? "selected" : ""}`}
            aria-pressed={resume.pageSize === option.id}
            onClick={() => onChange({ ...resume, pageSize: option.id })}
          >
            <strong>
              {option.label}
              {resume.pageSize === option.id && <Check size={13} />}
            </strong>
            <small>{option.hint}</small>
          </button>
        ))}
      </div>

      <h3 className="control-heading">
        <SlidersHorizontal size={17} /> Density &amp; page fit
      </h3>
      <div
        className="segmented-options three-col"
        role="group"
        aria-label="Spacing density"
      >
        {(
          [
            { id: "compact", label: "Compact", hint: "Fit more on 1 page" },
            { id: "standard", label: "Standard", hint: "Balanced spacing" },
            { id: "spacious", label: "Spacious", hint: "Open, airy layout" },
          ] as { id: Density; label: string; hint: string }[]
        ).map((option) => (
          <button
            key={option.id}
            className={`segmented-option ${resume.density === option.id ? "selected" : ""}`}
            aria-pressed={resume.density === option.id}
            onClick={() => onChange({ ...resume, density: option.id })}
          >
            <strong>
              {option.label}
              {resume.density === option.id && <Check size={13} />}
            </strong>
            <small>{option.hint}</small>
          </button>
        ))}
      </div>

      <h3 className="control-heading">
        <ListOrdered size={17} /> Section order
      </h3>
      <ul className="section-order-list" aria-label="Section order">
        {resume.sectionOrder.map((sectionKey, index) => (
          <li key={sectionKey} className="section-order-item">
            <span>{SECTION_LABELS[sectionKey]}</span>
            <div className="entry-controls">
              <button
                className="icon-button"
                aria-label={`Move ${SECTION_LABELS[sectionKey]} up`}
                disabled={index === 0}
                onClick={() => moveSection(index, -1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                className="icon-button"
                aria-label={`Move ${SECTION_LABELS[sectionKey]} down`}
                disabled={index === resume.sectionOrder.length - 1}
                onClick={() => moveSection(index, 1)}
              >
                <ArrowDown size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="style-note">
        <strong>Good design gets out of the way.</strong>
        <p>
          Exports as a single-column PDF or Word (.docx) in{" "}
          {resume.pageSize === "letter" ? "US Letter" : "A4"} size. Dashed
          preview markers indicate estimated page breaks; the exported PDF is
          the final paginated version.
        </p>
      </div>
    </div>
  );
}
