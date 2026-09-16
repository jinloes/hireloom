import { useId } from "react";
import {
  ArrowDown,
  ArrowUp,
  BriefcaseBusiness,
  GraduationCap,
  Plus,
  Trash2,
  UserRound,
  AlignLeft,
  Shapes,
  Sparkles,
} from "lucide-react";
import type { Education, Experience, Resume } from "../model";

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  type?: string;
  hint?: string;
};

export function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  rows = 4,
  maxLength = 500,
  type = "text",
  hint,
}: FieldProps) {
  const id = useId();
  const props = {
    id,
    value,
    placeholder,
    maxLength,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(event.target.value),
    "aria-describedby": hint ? `${id}-hint` : undefined,
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea {...props} rows={rows} />
      ) : (
        <input {...props} type={type} />
      )}
      {hint && (
        <span className="field-hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
    </div>
  );
}

function MonthField({
  label,
  value,
  onChange,
  allowPresent = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allowPresent?: boolean;
}) {
  const groupId = useId();
  const presentId = useId();
  const current = allowPresent && value === "Present";
  const parsed = parsePickerDate(value);
  const legacyValue =
    value && !current && !/^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
  const hintId = legacyValue ? `${groupId}-hint` : undefined;
  const setYear = (year: string) =>
    onChange(year ? `${year}-${parsed.month || "01"}` : "");
  const setMonth = (month: string) =>
    onChange(
      month ? `${parsed.year || new Date().getFullYear()}-${month}` : "",
    );

  return (
    <fieldset className="field month-field" aria-describedby={hintId}>
      <legend>{label}</legend>
      <div className="month-picker">
        <select
          aria-label={`${label} month`}
          value={parsed.month}
          disabled={current}
          onChange={(event) => setMonth(event.target.value)}
        >
          <option value="">Month</option>
          {monthOptions.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} year`}
          value={parsed.year}
          disabled={current}
          onChange={(event) => setYear(event.target.value)}
        >
          <option value="">Year</option>
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
      {legacyValue && (
        <span className="field-hint" id={hintId}>
          Saved as “{legacyValue}”. Changing either dropdown converts it to
          month/year format.
        </span>
      )}
      {allowPresent && (
        <label className="current-role-check" htmlFor={presentId}>
          <input
            id={presentId}
            type="checkbox"
            checked={current}
            onChange={(event) =>
              onChange(event.target.checked ? "Present" : "")
            }
          />
          <span>Current role</span>
        </label>
      )}
    </fieldset>
  );
}

const monthOptions = [
  ["01", "January"],
  ["02", "February"],
  ["03", "March"],
  ["04", "April"],
  ["05", "May"],
  ["06", "June"],
  ["07", "July"],
  ["08", "August"],
  ["09", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
].map(([value, label]) => ({ value, label }));

const yearOptions = Array.from(
  { length: new Date().getFullYear() + 10 - 1900 + 1 },
  (_, index) => String(new Date().getFullYear() + 10 - index),
);

function parsePickerDate(value: string): { year: string; month: string } {
  const standard = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (standard) return { year: standard[1], month: standard[2] };

  const named = /^([A-Za-z]+)\s+(\d{4})$/.exec(value.trim());
  if (named) {
    const normalized = named[1].toLowerCase();
    const month = monthOptions.find(
      (option) =>
        option.label.toLowerCase() === normalized ||
        option.label.slice(0, 3).toLowerCase() === normalized,
    );
    if (month) return { year: named[2], month: month.value };
  }

  const year = /^(\d{4})$/.exec(value.trim());
  return { year: year?.[1] ?? "", month: "" };
}

function EntryControls({
  label,
  index,
  length,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  length: number;
  onMove: (direction: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="entry-controls">
      <button
        className="icon-button"
        aria-label={`Move ${label} up`}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUp size={14} />
      </button>
      <button
        className="icon-button"
        aria-label={`Move ${label} down`}
        disabled={index === length - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDown size={14} />
      </button>
      <button
        className="icon-button danger"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function move<T>(items: T[], index: number, direction: number): T[] {
  const result = [...items];
  const other = index + direction;
  if (other < 0 || other >= result.length) return result;
  [result[index], result[other]] = [result[other], result[index]];
  return result;
}

export function Editor({
  resume,
  onChange,
  onAi,
  onExample,
}: {
  resume: Resume;
  onChange: (resume: Resume) => void;
  onAi: () => void;
  onExample: () => void;
}) {
  const basics = (key: keyof Resume["basics"], value: string) =>
    onChange({ ...resume, basics: { ...resume.basics, [key]: value } });
  const experience = (id: string, patch: Partial<Experience>) =>
    onChange({
      ...resume,
      experience: resume.experience.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    });
  const education = (id: string, patch: Partial<Education>) =>
    onChange({
      ...resume,
      education: resume.education.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    });
  const empty =
    !resume.basics.name && !resume.experience.length && !resume.summary;
  return (
    <div className="editor-content">
      {empty && (
        <div className="start-note">
          <span className="small-icon">
            <Sparkles size={18} />
          </span>
          <div>
            <strong>A good story starts with you.</strong>
            <p>
              Add your details below, or{" "}
              <button className="text-button" onClick={onExample}>
                try a fictional example
              </button>
              .
            </p>
          </div>
        </div>
      )}
      <details className="editor-section" open>
        <summary>
          <span>
            <UserRound size={17} /> Personal details
          </span>
          <span className="section-number">01</span>
        </summary>
        <div className="section-fields">
          <Field
            label="Full name"
            value={resume.basics.name}
            onChange={(value) => basics("name", value)}
            placeholder="e.g. Alex Morgan"
          />
          <Field
            label="Professional headline"
            value={resume.basics.headline}
            onChange={(value) => basics("headline", value)}
            placeholder="e.g. Product Designer"
          />
          <div className="field-grid">
            <Field
              label="Email"
              type="email"
              value={resume.basics.email}
              onChange={(value) => basics("email", value)}
              placeholder="you@example.com"
            />
            <Field
              label="Phone"
              type="tel"
              value={resume.basics.phone}
              onChange={(value) => basics("phone", value)}
              placeholder="Optional"
            />
          </div>
          <Field
            label="Location"
            value={resume.basics.location}
            onChange={(value) => basics("location", value)}
            placeholder="City, country"
          />
          <Field
            label="Portfolio or LinkedIn"
            value={resume.basics.website}
            onChange={(value) => basics("website", value)}
            placeholder="Your website or profile URL"
          />
          <Field
            label="GitHub URL"
            type="url"
            value={resume.basics.github}
            onChange={(value) => basics("github", value)}
            placeholder="https://github.com/username"
          />
        </div>
      </details>
      <details className="editor-section" open>
        <summary>
          <span>
            <AlignLeft size={17} /> Professional summary
          </span>
          <span className="section-number">02</span>
        </summary>
        <div className="section-fields">
          <Field
            label="Your story, in a few lines"
            value={resume.summary}
            onChange={(summary) => onChange({ ...resume, summary })}
            multiline
            rows={5}
            maxLength={10_000}
            placeholder="What do you do well? What experience and perspective will you bring to your next team?"
          />
          <button className="ai-text-button" onClick={onAi}>
            <Sparkles size={14} /> Find the right words with Copilot
          </button>
        </div>
      </details>
      <details className="editor-section" open>
        <summary>
          <span>
            <BriefcaseBusiness size={17} /> Experience{" "}
            <span className="count">{resume.experience.length}</span>
          </span>
          <span className="section-number">03</span>
        </summary>
        <div className="section-fields">
          {resume.experience.map((entry, index) => (
            <div className="entry-card" key={entry.id}>
              <div className="entry-topline">
                <strong>Position {index + 1}</strong>
                <EntryControls
                  label={`position ${index + 1}`}
                  index={index}
                  length={resume.experience.length}
                  onMove={(direction) =>
                    onChange({
                      ...resume,
                      experience: move(resume.experience, index, direction),
                    })
                  }
                  onRemove={() =>
                    onChange({
                      ...resume,
                      experience: resume.experience.filter(
                        (item) => item.id !== entry.id,
                      ),
                    })
                  }
                />
              </div>
              <Field
                label={`Job title ${index + 1}`}
                value={entry.role}
                onChange={(role) => experience(entry.id, { role })}
                placeholder="Senior Product Designer"
              />
              <Field
                label={`Company ${index + 1}`}
                value={entry.company}
                onChange={(company) => experience(entry.id, { company })}
                placeholder="Company name"
              />
              <Field
                label={`Work location ${index + 1}`}
                value={entry.location}
                onChange={(location) => experience(entry.id, { location })}
                placeholder="City or remote"
              />
              <div className="field-grid">
                <MonthField
                  label={`Start month ${index + 1}`}
                  value={entry.startDate}
                  onChange={(startDate) => experience(entry.id, { startDate })}
                />
                <MonthField
                  label={`End month ${index + 1}`}
                  value={entry.endDate}
                  onChange={(endDate) => experience(entry.id, { endDate })}
                  allowPresent
                />
              </div>
              {entry.bullets.map((text, bulletIndex) => (
                <div className="bullet-editor" key={bulletIndex}>
                  <Field
                    label={`Highlight ${index + 1}.${bulletIndex + 1}`}
                    value={text}
                    multiline
                    rows={3}
                    maxLength={2_000}
                    placeholder="What did you do, and what changed because of it?"
                    onChange={(value) =>
                      experience(entry.id, {
                        bullets: entry.bullets.map((item, i) =>
                          i === bulletIndex ? value : item,
                        ),
                      })
                    }
                  />
                  <button
                    className="icon-button danger"
                    aria-label={`Remove highlight ${index + 1}.${bulletIndex + 1}`}
                    onClick={() =>
                      experience(entry.id, {
                        bullets: entry.bullets.filter(
                          (_, i) => i !== bulletIndex,
                        ),
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                className="text-button add-inline"
                disabled={entry.bullets.length >= 30}
                onClick={() =>
                  experience(entry.id, { bullets: [...entry.bullets, ""] })
                }
              >
                <Plus size={14} /> Add highlight
              </button>
            </div>
          ))}
          {!resume.experience.length && (
            <p className="empty-hint">
              Paid work, internships, freelance projects, or volunteering. Every
              chapter counts.
            </p>
          )}
          <button
            className="add-button"
            disabled={resume.experience.length >= 30}
            onClick={() =>
              onChange({
                ...resume,
                experience: [
                  ...resume.experience,
                  {
                    id: crypto.randomUUID(),
                    role: "",
                    company: "",
                    location: "",
                    startDate: "",
                    endDate: "",
                    bullets: [""],
                  },
                ],
              })
            }
          >
            <Plus size={16} /> Add experience
          </button>
        </div>
      </details>
      <details className="editor-section">
        <summary>
          <span>
            <GraduationCap size={17} /> Education{" "}
            <span className="count">{resume.education.length}</span>
          </span>
          <span className="section-number">04</span>
        </summary>
        <div className="section-fields">
          {resume.education.map((entry, index) => (
            <div className="entry-card" key={entry.id}>
              <div className="entry-topline">
                <strong>Education {index + 1}</strong>
                <EntryControls
                  label={`education ${index + 1}`}
                  index={index}
                  length={resume.education.length}
                  onMove={(direction) =>
                    onChange({
                      ...resume,
                      education: move(resume.education, index, direction),
                    })
                  }
                  onRemove={() =>
                    onChange({
                      ...resume,
                      education: resume.education.filter(
                        (item) => item.id !== entry.id,
                      ),
                    })
                  }
                />
              </div>
              <Field
                label={`School ${index + 1}`}
                value={entry.school}
                onChange={(school) => education(entry.id, { school })}
                placeholder="University, college, or program"
              />
              <Field
                label={`Degree or qualification ${index + 1}`}
                value={entry.degree}
                onChange={(degree) => education(entry.id, { degree })}
                placeholder="Degree and field of study"
              />
              <Field
                label={`Graduation ${index + 1}`}
                value={entry.graduation}
                onChange={(graduation) => education(entry.id, { graduation })}
                placeholder="2024 or Expected 2027"
              />
            </div>
          ))}
          <button
            className="add-button"
            disabled={resume.education.length >= 20}
            onClick={() =>
              onChange({
                ...resume,
                education: [
                  ...resume.education,
                  {
                    id: crypto.randomUUID(),
                    school: "",
                    degree: "",
                    graduation: "",
                  },
                ],
              })
            }
          >
            <Plus size={16} /> Add education
          </button>
        </div>
      </details>
      <details className="editor-section" open>
        <summary>
          <span>
            <Shapes size={17} /> Skills
          </span>
          <span className="section-number">05</span>
        </summary>
        <div className="section-fields">
          <Field
            label="Skills, separated by commas"
            value={resume.skills.join(",")}
            onChange={(value) =>
              onChange({
                ...resume,
                skills: value
                  .split(",")
                  .slice(0, 100)
                  .map((skill) => skill.slice(0, 100)),
              })
            }
            multiline
            rows={3}
            maxLength={10_000}
            placeholder="Product design, Figma, User research"
            hint="Use the skills you can confidently talk about in an interview."
          />
        </div>
      </details>
    </div>
  );
}
