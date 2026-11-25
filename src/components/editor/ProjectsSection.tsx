import {
  BookMarked,
  FolderGit2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  isProjectOutOfSync,
  projectRoleLabel,
  type AprTarget,
  type CareerLibrary,
  type Project,
  type Resume,
} from "../../model";
import {
  EntryControls,
  Field,
  MonthField,
  move,
  type ChangeMeta,
} from "./FieldPrimitives";

export function ProjectsSection({
  resume,
  badgeNumber,
  open,
  onToggleSection,
  isEntryCollapsed,
  onToggleCollapsed,
  onSetManyCollapsed,
  onExpandEntry,
  onChange,
  onCoachBullet,
  careerLibrary,
  onSaveProjectToLibrary,
  onPullProjectFromLibrary,
}: {
  resume: Resume;
  badgeNumber: string;
  open: boolean;
  onToggleSection: (event: React.SyntheticEvent<HTMLDetailsElement>) => void;
  isEntryCollapsed: (id: string, index: number) => boolean;
  onToggleCollapsed: (id: string, index: number) => void;
  onSetManyCollapsed: (ids: string[], collapsed: boolean) => void;
  onExpandEntry: (id: string) => void;
  onChange: (resume: Resume, meta?: ChangeMeta) => void;
  onCoachBullet?: (target: AprTarget) => void;
  careerLibrary?: CareerLibrary;
  onSaveProjectToLibrary?: (projectId: string) => void;
  onPullProjectFromLibrary?: (projectId: string) => void;
}) {
  const project = (id: string, patch: Partial<Project>) =>
    onChange({
      ...resume,
      projects: resume.projects.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    });

  const allCollapsed =
    resume.projects.length > 0 &&
    resume.projects.every((entry, idx) => isEntryCollapsed(entry.id, idx));

  return (
    <details
      className="editor-section"
      data-editor-section="projects"
      open={open}
      onToggle={onToggleSection}
    >
      <summary>
        <span>
          <FolderGit2 size={17} /> Projects{" "}
          <span className="count">{resume.projects.length}</span>
        </span>
        <span className="section-number">{badgeNumber}</span>
      </summary>
      <div className="section-fields">
        {resume.projects.length > 1 && (
          <div className="section-bulk-bar">
            <span className="section-bulk-hint">
              Click a project header to expand or collapse
            </span>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                onSetManyCollapsed(
                  resume.projects.map((p) => p.id),
                  !allCollapsed,
                )
              }
            >
              {allCollapsed ? "Expand all" : "Collapse all"}
            </button>
          </div>
        )}
        {resume.projects.map((entry, index) => {
          const isCollapsed = isEntryCollapsed(entry.id, index);
          return (
            <div
              className={`entry-card ${isCollapsed ? "collapsed" : ""}`}
              key={entry.id}
              data-entry-id={entry.id}
            >
              <div className="entry-topline">
                <button
                  type="button"
                  className="entry-card-title-btn"
                  aria-expanded={!isCollapsed}
                  onClick={() => onToggleCollapsed(entry.id, index)}
                >
                  <strong className="entry-card-title">
                    Project {index + 1}
                    {entry.name.trim() ? (
                      <span className="entry-card-subtitle">
                        {" "}
                        · {entry.name.trim()}
                      </span>
                    ) : null}
                  </strong>
                </button>
                <EntryControls
                  label={`project ${index + 1}`}
                  index={index}
                  length={resume.projects.length}
                  collapsed={isCollapsed}
                  onToggleCollapse={() => onToggleCollapsed(entry.id, index)}
                  onMove={(direction) =>
                    onChange(
                      {
                        ...resume,
                        projects: move(resume.projects, index, direction),
                      },
                      { discrete: true },
                    )
                  }
                  onRemove={() =>
                    onChange(
                      {
                        ...resume,
                        projects: resume.projects.filter(
                          (item) => item.id !== entry.id,
                        ),
                      },
                      {
                        discrete: true,
                        deletedLabel:
                          entry.name.trim() || `Project ${index + 1}`,
                      },
                    )
                  }
                />
              </div>
              {!isCollapsed && (
                <>
                  <div className="field-grid">
                    <Field
                      label={`Project name ${index + 1}`}
                      value={entry.name}
                      onChange={(name) => project(entry.id, { name })}
                      placeholder="Open-source library, case study, or system"
                    />
                    <Field
                      label={`Project role or stack ${index + 1}`}
                      value={entry.subtitle}
                      onChange={(subtitle) => project(entry.id, { subtitle })}
                      placeholder="Creator · Rust, TypeScript, React"
                    />
                  </div>
                  <Field
                    label={`Project URL ${index + 1}`}
                    value={entry.url}
                    onChange={(url) => project(entry.id, { url })}
                    placeholder="Optional link or repository"
                  />
                  <div className="field-grid">
                    <MonthField
                      label={`Project start ${index + 1}`}
                      value={entry.startDate}
                      onChange={(startDate) => project(entry.id, { startDate })}
                    />
                    <MonthField
                      label={`Project end ${index + 1}`}
                      value={entry.endDate}
                      onChange={(endDate) => project(entry.id, { endDate })}
                      allowPresent
                      presentLabel="Ongoing project"
                    />
                  </div>
                  {entry.bullets.map((text, bulletIndex) => (
                    <div className="bullet-editor" key={bulletIndex}>
                      <Field
                        label={`Project highlight ${index + 1}.${bulletIndex + 1}`}
                        value={text}
                        multiline
                        rows={2}
                        maxLength={2_000}
                        placeholder="What problem did this project solve, and how?"
                        onChange={(value) =>
                          project(entry.id, {
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
                            aria-label={`Coach project highlight ${index + 1}.${bulletIndex + 1} with APR`}
                            onClick={() =>
                              onCoachBullet({
                                resumeId: resume.id,
                                experienceId: entry.id,
                                bulletIndex,
                                role: projectRoleLabel(entry),
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
                          aria-label={`Remove project highlight ${index + 1}.${bulletIndex + 1}`}
                          onClick={() =>
                            project(entry.id, {
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
                        project(entry.id, {
                          bullets: [...entry.bullets, ""],
                        })
                      }
                    >
                      <Plus size={14} /> Add project highlight
                    </button>
                    {careerLibrary && onSaveProjectToLibrary && (
                      <div className="library-sync-controls">
                        {entry.libraryId &&
                        isProjectOutOfSync(entry, careerLibrary) ? (
                          <>
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => onSaveProjectToLibrary(entry.id)}
                            >
                              <BookMarked size={12} /> Update library
                            </button>
                            {onPullProjectFromLibrary && (
                              <button
                                type="button"
                                className="text-button"
                                onClick={() =>
                                  onPullProjectFromLibrary(entry.id)
                                }
                              >
                                <RefreshCw size={12} /> Pull library
                              </button>
                            )}
                          </>
                        ) : entry.name.trim() && !entry.libraryId ? (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => onSaveProjectToLibrary(entry.id)}
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
        <button
          type="button"
          className="add-button"
          disabled={resume.projects.length >= 20}
          onClick={() => {
            const id = crypto.randomUUID();
            onExpandEntry(id);
            onChange(
              {
                ...resume,
                projects: [
                  ...resume.projects,
                  {
                    id,
                    name: "",
                    subtitle: "",
                    url: "",
                    startDate: "",
                    endDate: "",
                    bullets: [""],
                  },
                ],
              },
              { discrete: true },
            );
          }}
        >
          <Plus size={16} /> Add project
        </button>
      </div>
    </details>
  );
}
