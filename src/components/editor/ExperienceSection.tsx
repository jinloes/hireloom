import {
  BookMarked,
  BriefcaseBusiness,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  isExperienceOutOfSync,
  type AprTarget,
  type CareerLibrary,
  type Experience,
  type Resume,
} from "../../model";
import {
  EntryControls,
  Field,
  MonthField,
  move,
  type ChangeMeta,
} from "./FieldPrimitives";

export function ExperienceSection({
  resume,
  badgeNumber,
  open,
  onToggleSection,
  collapsedIds,
  onToggleCollapsed,
  onChange,
  onCoachBullet,
  careerLibrary,
  onSaveExperienceToLibrary,
  onPullExperienceFromLibrary,
}: {
  resume: Resume;
  badgeNumber: string;
  open: boolean;
  onToggleSection: (event: React.SyntheticEvent<HTMLDetailsElement>) => void;
  collapsedIds: Record<string, boolean>;
  onToggleCollapsed: (id: string) => void;
  onChange: (resume: Resume, meta?: ChangeMeta) => void;
  onCoachBullet?: (target: AprTarget) => void;
  careerLibrary?: CareerLibrary;
  onSaveExperienceToLibrary?: (experienceId: string) => void;
  onPullExperienceFromLibrary?: (experienceId: string) => void;
}) {
  const experience = (id: string, patch: Partial<Experience>) =>
    onChange({
      ...resume,
      experience: resume.experience.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    });

  return (
    <details
      className="editor-section"
      data-editor-section="experience"
      open={open}
      onToggle={onToggleSection}
    >
      <summary>
        <span>
          <BriefcaseBusiness size={17} /> Experience{" "}
          <span className="count">{resume.experience.length}</span>
        </span>
        <span className="section-number">{badgeNumber}</span>
      </summary>
      <div className="section-fields">
        {resume.experience.map((entry, index) => {
          const isCollapsed = Boolean(collapsedIds[entry.id]);
          const summaryTitle = [entry.role, entry.company]
            .filter((v) => v.trim())
            .join(" · ");
          return (
            <div
              className={`entry-card ${isCollapsed ? "collapsed" : ""}`}
              key={entry.id}
              data-entry-id={entry.id}
            >
              <div className="entry-topline">
                <strong className="entry-card-title">
                  Position {index + 1}
                  {summaryTitle ? (
                    <span className="entry-card-subtitle">
                      {" "}
                      · {summaryTitle}
                    </span>
                  ) : null}
                </strong>
                <EntryControls
                  label={`position ${index + 1}`}
                  index={index}
                  length={resume.experience.length}
                  collapsed={isCollapsed}
                  onToggleCollapse={() => onToggleCollapsed(entry.id)}
                  onMove={(direction) =>
                    onChange(
                      {
                        ...resume,
                        experience: move(resume.experience, index, direction),
                      },
                      { discrete: true },
                    )
                  }
                  onRemove={() =>
                    onChange(
                      {
                        ...resume,
                        experience: resume.experience.filter(
                          (item) => item.id !== entry.id,
                        ),
                      },
                      {
                        discrete: true,
                        deletedLabel:
                          entry.role.trim() || `Position ${index + 1}`,
                      },
                    )
                  }
                />
              </div>
              {!isCollapsed && (
                <>
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
                      onChange={(startDate) =>
                        experience(entry.id, { startDate })
                      }
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
                      <div className="bullet-editor-actions">
                        {onCoachBullet && text.trim() ? (
                          <button
                            type="button"
                            className="ai-text-button bullet-apr-trigger"
                            aria-label={`Coach highlight ${index + 1}.${bulletIndex + 1} with APR`}
                            onClick={() =>
                              onCoachBullet({
                                resumeId: resume.id,
                                experienceId: entry.id,
                                bulletIndex,
                                role: entry.role,
                                bullet: text,
                              })
                            }
                          >
                            <Sparkles size={12} /> Coach with APR
                          </button>
                        ) : (
                          <span />
                        )}
                        <button
                          type="button"
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
                    </div>
                  ))}
                  <div className="entry-footer-actions">
                    <button
                      type="button"
                      className="text-button add-inline"
                      disabled={entry.bullets.length >= 30}
                      onClick={() =>
                        experience(entry.id, {
                          bullets: [...entry.bullets, ""],
                        })
                      }
                    >
                      <Plus size={14} /> Add highlight
                    </button>
                    {careerLibrary && onSaveExperienceToLibrary && (
                      <div className="library-sync-controls">
                        {entry.libraryId &&
                        isExperienceOutOfSync(entry, careerLibrary) ? (
                          <>
                            <button
                              type="button"
                              className="text-button"
                              onClick={() =>
                                onSaveExperienceToLibrary(entry.id)
                              }
                            >
                              <BookMarked size={12} /> Update library
                            </button>
                            {onPullExperienceFromLibrary && (
                              <button
                                type="button"
                                className="text-button"
                                onClick={() =>
                                  onPullExperienceFromLibrary(entry.id)
                                }
                              >
                                <RefreshCw size={12} /> Pull library
                              </button>
                            )}
                          </>
                        ) : (entry.role.trim() || entry.company.trim()) &&
                          !entry.libraryId ? (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => onSaveExperienceToLibrary(entry.id)}
                          >
                            <BookMarked size={12} /> Save to library
                          </button>
                        ) : entry.libraryId ? (
                          <span className="library-linked-badge">
                            <BookMarked size={11} /> Linked to library
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
        {!resume.experience.length && (
          <p className="empty-hint">
            Paid work, internships, freelance projects, or volunteering. Every
            chapter counts.
          </p>
        )}
        <button
          type="button"
          className="add-button"
          disabled={resume.experience.length >= 30}
          onClick={() =>
            onChange(
              {
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
              },
              { discrete: true },
            )
          }
        >
          <Plus size={16} /> Add experience
        </button>
      </div>
    </details>
  );
}
