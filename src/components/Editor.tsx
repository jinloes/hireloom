import { useEffect, useId, useRef } from "react";
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
import {
  HighlightGuidance,
  type HighlightGuidanceController,
} from "./HighlightGuidance";

export type ContentSection =
  "personal" | "summary" | "experience" | "education" | "skills";

export type ContentViewState = {
  section: ContentSection;
  selectedExperienceId: string | null;
};

export type ContentRemovalRequest =
  | {
      kind: "experience";
      item: Experience;
      index: number;
      label: string;
    }
  | {
      kind: "education";
      item: Education;
      index: number;
      label: string;
    }
  | {
      kind: "highlight";
      item: string;
      index: number;
      parentExperienceId: string;
      label: string;
    };

type FieldProps = {
  id?: string;
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
  id: requestedId,
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
  const generatedId = useId();
  const id = requestedId ?? generatedId;
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

function createExperience(): Experience {
  return {
    id: crypto.randomUUID(),
    role: "",
    company: "",
    location: "",
    startDate: "",
    endDate: "",
    bullets: [""],
  };
}

const contentSections: Array<{
  id: ContentSection;
  tabLabel: string;
  label: string;
  number: string;
}> = [
  {
    id: "personal",
    tabLabel: "Personal",
    label: "Personal details",
    number: "01",
  },
  {
    id: "summary",
    tabLabel: "Summary",
    label: "Professional summary",
    number: "02",
  },
  {
    id: "experience",
    tabLabel: "Experience",
    label: "Experience",
    number: "03",
  },
  {
    id: "education",
    tabLabel: "Education",
    label: "Education",
    number: "04",
  },
  { id: "skills", tabLabel: "Skills", label: "Skills", number: "05" },
];

function experienceTitle(entry: Experience) {
  const role = entry.role.trim();
  const company = entry.company.trim();
  if (role && company) return `${role} — ${company}`;
  return role || company || "Untitled position";
}

function educationTitle(entry: Education) {
  return entry.school.trim() || entry.degree.trim() || "Untitled education";
}

function displayResumeDate(value: string) {
  if (!value) return "";
  if (value === "Present") return value;
  const parsed = parsePickerDate(value);
  if (parsed.year && parsed.month) {
    const month = monthOptions.find((option) => option.value === parsed.month);
    return `${month?.label.slice(0, 3) ?? parsed.month} ${parsed.year}`;
  }
  return value;
}

function experienceDateRange(entry: Experience) {
  const start = displayResumeDate(entry.startDate);
  const end = displayResumeDate(entry.endDate);
  if (start && end) return `${start} – ${end}`;
  return start || end || "Dates not added";
}

export function Editor({
  resume,
  onChange,
  onAi,
  onExample,
  highlightGuidance,
  viewState,
  onViewStateChange,
  onRemove,
  focusTarget,
  onFocusTargetHandled,
}: {
  resume: Resume;
  onChange: (resume: Resume) => void;
  onAi: () => void;
  onExample: () => void;
  highlightGuidance: HighlightGuidanceController;
  viewState: ContentViewState;
  onViewStateChange: (state: ContentViewState) => void;
  onRemove: (request: ContentRemovalRequest) => void;
  focusTarget: string | null;
  onFocusTargetHandled: () => void;
}) {
  const pendingElementFocus = useRef<string | null>(null);
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
  const activeSection =
    contentSections.find((section) => section.id === viewState.section) ??
    contentSections[0];
  const selectedExperience =
    resume.experience.find(
      (entry) => entry.id === viewState.selectedExperienceId,
    ) ?? null;
  const selectedExperienceIndex = selectedExperience
    ? resume.experience.indexOf(selectedExperience)
    : -1;
  const sectionHeadingId = `content-section-${activeSection.id}`;

  useEffect(() => {
    const target = focusTarget ?? pendingElementFocus.current;
    if (!target) return;
    document.getElementById(target)?.focus();
    pendingElementFocus.current = null;
    if (focusTarget) onFocusTargetHandled();
  }, [focusTarget, onFocusTargetHandled, resume, viewState]);

  const selectSection = (section: ContentSection) => {
    onViewStateChange({ ...viewState, section });
  };

  const selectSectionFromKeyboard = (section: ContentSection) => {
    selectSection(section);
    const tab = document.getElementById(`content-tab-${section}`);
    tab?.focus();
    tab?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };

  const addExperience = (position: "top" | "end") => {
    const entry = createExperience();
    pendingElementFocus.current = `job-title-${entry.id}`;
    onViewStateChange({ ...viewState, selectedExperienceId: entry.id });
    onChange({
      ...resume,
      experience:
        position === "top"
          ? [entry, ...resume.experience]
          : [...resume.experience, entry],
    });
  };

  const selectExperience = (id: string) => {
    if (
      viewState.selectedExperienceId !== id &&
      highlightGuidance.target?.resumeId === resume.id
    ) {
      highlightGuidance.onKeep();
    }
    onViewStateChange({ ...viewState, selectedExperienceId: id });
  };

  const sectionCount = (section: ContentSection) => {
    if (section === "experience") return resume.experience.length;
    if (section === "education") return resume.education.length;
    return null;
  };

  const sectionIcon = (section: ContentSection) => {
    if (section === "personal") return <UserRound size={17} />;
    if (section === "summary") return <AlignLeft size={17} />;
    if (section === "experience") return <BriefcaseBusiness size={17} />;
    if (section === "education") return <GraduationCap size={17} />;
    return <Shapes size={17} />;
  };

  return (
    <div className="editor-content content-workspace">
      <div
        className="content-tabs"
        role="tablist"
        aria-label="Content sections"
      >
        {contentSections.map((section, index) => {
          const count = sectionCount(section.id);
          return (
            <button
              key={section.id}
              id={`content-tab-${section.id}`}
              role="tab"
              aria-label={section.tabLabel}
              aria-controls={`content-panel-${section.id}`}
              aria-selected={viewState.section === section.id}
              tabIndex={viewState.section === section.id ? 0 : -1}
              onClick={() => selectSection(section.id)}
              onKeyDown={(event) => {
                const nextIndex =
                  event.key === "ArrowRight"
                    ? (index + 1) % contentSections.length
                    : event.key === "ArrowLeft"
                      ? (index - 1 + contentSections.length) %
                        contentSections.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? contentSections.length - 1
                          : -1;
                if (nextIndex >= 0) {
                  event.preventDefault();
                  selectSectionFromKeyboard(contentSections[nextIndex].id);
                }
              }}
            >
              <span className="section-number" aria-hidden="true">
                {section.number}
              </span>
              <span>{section.tabLabel}</span>
              {count !== null && (
                <span className="count" aria-hidden="true">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {contentSections
        .filter((section) => section.id !== activeSection.id)
        .map((section) => (
          <div
            key={section.id}
            role="tabpanel"
            id={`content-panel-${section.id}`}
            aria-labelledby={`content-tab-${section.id}`}
            hidden
          />
        ))}
      <div
        className={`content-section-scroll content-section-${activeSection.id}`}
        role="tabpanel"
        id={`content-panel-${activeSection.id}`}
        aria-labelledby={`content-tab-${activeSection.id}`}
        data-testid="content-section-scroll"
      >
        {empty && viewState.section === "personal" && (
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
        <section className="editor-section" aria-labelledby={sectionHeadingId}>
          <h2 id={sectionHeadingId}>
            {sectionIcon(activeSection.id)}
            {activeSection.label}
          </h2>
          {viewState.section === "personal" && (
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
          )}
          {viewState.section === "summary" && (
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
          )}
          {viewState.section === "experience" && (
            <div className="section-fields experience-section-fields">
              {resume.experience.length > 0 && (
                <div className="experience-workspace">
                  <div className="experience-summary-rail">
                    <button
                      className="add-button"
                      disabled={resume.experience.length >= 30}
                      onClick={() => addExperience("top")}
                    >
                      <Plus size={16} /> Add experience to top
                    </button>
                    <ul
                      className="experience-summary-list"
                      aria-label="Experience"
                    >
                      {resume.experience.map((entry) => (
                        <li key={entry.id}>
                          <button
                            id={`experience-summary-${entry.id}`}
                            aria-current={
                              entry.id === selectedExperience?.id
                                ? "true"
                                : undefined
                            }
                            onClick={() => selectExperience(entry.id)}
                          >
                            <strong>{experienceTitle(entry)}</strong>
                            <span>
                              {experienceDateRange(entry)} ·{" "}
                              {entry.bullets.length}{" "}
                              {entry.bullets.length === 1
                                ? "highlight"
                                : "highlights"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      className="add-button"
                      id="add-experience"
                      disabled={resume.experience.length >= 30}
                      onClick={() => addExperience("end")}
                    >
                      <Plus size={16} /> Add experience to end
                    </button>
                  </div>
                  {selectedExperience && (
                    <div
                      className="entry-card selected-experience-editor"
                      role="region"
                      aria-labelledby={`experience-summary-${selectedExperience.id}`}
                    >
                      <div className="entry-topline">
                        <strong>{experienceTitle(selectedExperience)}</strong>
                        <EntryControls
                          label={`position ${selectedExperienceIndex + 1}`}
                          index={selectedExperienceIndex}
                          length={resume.experience.length}
                          onMove={(direction) =>
                            onChange({
                              ...resume,
                              experience: move(
                                resume.experience,
                                selectedExperienceIndex,
                                direction,
                              ),
                            })
                          }
                          onRemove={() =>
                            onRemove({
                              kind: "experience",
                              item: selectedExperience,
                              index: selectedExperienceIndex,
                              label: experienceTitle(selectedExperience),
                            })
                          }
                        />
                      </div>
                      <Field
                        id={`job-title-${selectedExperience.id}`}
                        label={`Job title ${selectedExperienceIndex + 1}`}
                        value={selectedExperience.role}
                        onChange={(role) =>
                          experience(selectedExperience.id, { role })
                        }
                        placeholder="Senior Product Designer"
                      />
                      <Field
                        label={`Company ${selectedExperienceIndex + 1}`}
                        value={selectedExperience.company}
                        onChange={(company) =>
                          experience(selectedExperience.id, { company })
                        }
                        placeholder="Company name"
                      />
                      <Field
                        label={`Work location ${selectedExperienceIndex + 1}`}
                        value={selectedExperience.location}
                        onChange={(location) =>
                          experience(selectedExperience.id, { location })
                        }
                        placeholder="City or remote"
                      />
                      <div className="field-grid">
                        <MonthField
                          label={`Start month ${selectedExperienceIndex + 1}`}
                          value={selectedExperience.startDate}
                          onChange={(startDate) =>
                            experience(selectedExperience.id, { startDate })
                          }
                        />
                        <MonthField
                          label={`End month ${selectedExperienceIndex + 1}`}
                          value={selectedExperience.endDate}
                          onChange={(endDate) =>
                            experience(selectedExperience.id, { endDate })
                          }
                          allowPresent
                        />
                      </div>
                      {selectedExperience.bullets.map((text, bulletIndex) => (
                        <div className="bullet-editor" key={bulletIndex}>
                          <EntryControls
                            label={`highlight ${selectedExperienceIndex + 1}.${bulletIndex + 1}`}
                            index={bulletIndex}
                            length={selectedExperience.bullets.length}
                            onMove={(direction) => {
                              if (
                                highlightGuidance.target?.resumeId ===
                                  resume.id &&
                                highlightGuidance.target.experienceId ===
                                  selectedExperience.id
                              ) {
                                highlightGuidance.onKeep();
                              }
                              experience(selectedExperience.id, {
                                bullets: move(
                                  selectedExperience.bullets,
                                  bulletIndex,
                                  direction,
                                ),
                              });
                            }}
                            onRemove={() => {
                              if (
                                highlightGuidance.target?.resumeId ===
                                  resume.id &&
                                highlightGuidance.target.experienceId ===
                                  selectedExperience.id
                              ) {
                                highlightGuidance.onKeep();
                              }
                              onRemove({
                                kind: "highlight",
                                item: text,
                                index: bulletIndex,
                                parentExperienceId: selectedExperience.id,
                                label: `highlight from ${experienceTitle(selectedExperience)}`,
                              });
                            }}
                          />
                          <Field
                            id={`highlight-${selectedExperience.id}-${bulletIndex}`}
                            label={`Highlight ${selectedExperienceIndex + 1}.${bulletIndex + 1}`}
                            value={text}
                            multiline
                            rows={3}
                            maxLength={2_000}
                            placeholder="What did you do, and what changed because of it?"
                            onChange={(value) =>
                              experience(selectedExperience.id, {
                                bullets: selectedExperience.bullets.map(
                                  (item, i) =>
                                    i === bulletIndex ? value : item,
                                ),
                              })
                            }
                          />
                          {text.trim() && (
                            <>
                              <button
                                className="text-button highlight-help-button"
                                aria-expanded={
                                  highlightGuidance.target?.resumeId ===
                                    resume.id &&
                                  highlightGuidance.target.experienceId ===
                                    selectedExperience.id &&
                                  highlightGuidance.target.bulletIndex ===
                                    bulletIndex
                                }
                                aria-controls={`highlight-guidance-${selectedExperienceIndex}-${bulletIndex}`}
                                onClick={() =>
                                  highlightGuidance.onSelect({
                                    resumeId: resume.id,
                                    experienceId: selectedExperience.id,
                                    bulletIndex,
                                    role: selectedExperience.role,
                                    bullet: text,
                                  })
                                }
                              >
                                <Sparkles size={13} /> Help me strengthen this
                                highlight
                              </button>
                              {highlightGuidance.target?.resumeId ===
                                resume.id &&
                                highlightGuidance.target.experienceId ===
                                  selectedExperience.id &&
                                highlightGuidance.target.bulletIndex ===
                                  bulletIndex && (
                                  <HighlightGuidance
                                    controller={highlightGuidance}
                                    currentHighlight={text}
                                    regionId={`highlight-guidance-${selectedExperienceIndex}-${bulletIndex}`}
                                  />
                                )}
                            </>
                          )}
                        </div>
                      ))}
                      <button
                        className="text-button add-inline"
                        id={`add-highlight-${selectedExperience.id}`}
                        disabled={selectedExperience.bullets.length >= 30}
                        onClick={() =>
                          experience(selectedExperience.id, {
                            bullets: [...selectedExperience.bullets, ""],
                          })
                        }
                      >
                        <Plus size={14} /> Add highlight
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!resume.experience.length && (
                <p className="empty-hint">
                  Paid work, internships, freelance projects, or volunteering.
                  Every chapter counts.
                </p>
              )}
              {!resume.experience.length && (
                <button
                  className="add-button"
                  id="add-experience"
                  disabled={resume.experience.length >= 30}
                  onClick={() => addExperience("end")}
                >
                  <Plus size={16} /> Add experience to end
                </button>
              )}
            </div>
          )}
          {viewState.section === "education" && (
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
                        onRemove({
                          kind: "education",
                          item: entry,
                          index,
                          label: educationTitle(entry),
                        })
                      }
                    />
                  </div>
                  <Field
                    id={`education-${entry.id}`}
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
                    onChange={(graduation) =>
                      education(entry.id, { graduation })
                    }
                    placeholder="2024 or Expected 2027"
                  />
                </div>
              ))}
              <button
                className="add-button"
                id="add-education"
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
          )}
          {viewState.section === "skills" && (
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
          )}
        </section>
      </div>
    </div>
  );
}
