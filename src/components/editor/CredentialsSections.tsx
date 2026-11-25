import { Award, GraduationCap, Plus } from "lucide-react";
import type { Certification, Education, Resume } from "../../model";
import { EntryControls, Field, move, type ChangeMeta } from "./FieldPrimitives";

export function EducationSection({
  resume,
  badgeNumber,
  open,
  onToggleSection,
  isEntryCollapsed,
  onToggleCollapsed,
  onSetManyCollapsed,
  onExpandEntry,
  onChange,
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
}) {
  const education = (id: string, patch: Partial<Education>) =>
    onChange({
      ...resume,
      education: resume.education.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    });

  const allCollapsed =
    resume.education.length > 0 &&
    resume.education.every((entry, idx) => isEntryCollapsed(entry.id, idx));

  return (
    <details
      className="editor-section"
      data-editor-section="education"
      open={open}
      onToggle={onToggleSection}
    >
      <summary>
        <span>
          <GraduationCap size={17} /> Education{" "}
          <span className="count">{resume.education.length}</span>
        </span>
        <span className="section-number">{badgeNumber}</span>
      </summary>
      <div className="section-fields">
        {resume.education.length > 1 && (
          <div className="section-bulk-bar">
            <span className="section-bulk-hint">
              Click an entry header to expand or collapse
            </span>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                onSetManyCollapsed(
                  resume.education.map((e) => e.id),
                  !allCollapsed,
                )
              }
            >
              {allCollapsed ? "Expand all" : "Collapse all"}
            </button>
          </div>
        )}
        {resume.education.map((entry, index) => {
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
                    Education {index + 1}
                    {entry.school.trim() ? (
                      <span className="entry-card-subtitle">
                        {" "}
                        · {entry.school.trim()}
                      </span>
                    ) : null}
                  </strong>
                </button>
                <EntryControls
                  label={`education ${index + 1}`}
                  index={index}
                  length={resume.education.length}
                  collapsed={isCollapsed}
                  onToggleCollapse={() => onToggleCollapsed(entry.id, index)}
                  onMove={(direction) =>
                    onChange(
                      {
                        ...resume,
                        education: move(resume.education, index, direction),
                      },
                      { discrete: true },
                    )
                  }
                  onRemove={() =>
                    onChange(
                      {
                        ...resume,
                        education: resume.education.filter(
                          (item) => item.id !== entry.id,
                        ),
                      },
                      {
                        discrete: true,
                        deletedLabel:
                          entry.school.trim() || `Education ${index + 1}`,
                      },
                    )
                  }
                />
              </div>
              {!isCollapsed && (
                <>
                  <div className="field-grid">
                    <Field
                      label={`School ${index + 1}`}
                      value={entry.school}
                      onChange={(school) => education(entry.id, { school })}
                      placeholder="University, college, or program"
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
                  <Field
                    label={`Degree or qualification ${index + 1}`}
                    value={entry.degree}
                    onChange={(degree) => education(entry.id, { degree })}
                    placeholder="Degree and field of study"
                  />
                </>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className="add-button"
          disabled={resume.education.length >= 20}
          onClick={() => {
            const id = crypto.randomUUID();
            onExpandEntry(id);
            onChange(
              {
                ...resume,
                education: [
                  ...resume.education,
                  {
                    id,
                    school: "",
                    degree: "",
                    graduation: "",
                  },
                ],
              },
              { discrete: true },
            );
          }}
        >
          <Plus size={16} /> Add education
        </button>
      </div>
    </details>
  );
}

export function CertificationsSection({
  resume,
  badgeNumber,
  open,
  onToggleSection,
  isEntryCollapsed,
  onToggleCollapsed,
  onSetManyCollapsed,
  onExpandEntry,
  onChange,
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
}) {
  const certification = (id: string, patch: Partial<Certification>) =>
    onChange({
      ...resume,
      certifications: resume.certifications.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    });

  const allCollapsed =
    resume.certifications.length > 0 &&
    resume.certifications.every((entry, idx) =>
      isEntryCollapsed(entry.id, idx),
    );

  return (
    <details
      className="editor-section"
      data-editor-section="certifications"
      open={open}
      onToggle={onToggleSection}
    >
      <summary>
        <span>
          <Award size={17} /> Certifications{" "}
          <span className="count">{resume.certifications.length}</span>
        </span>
        <span className="section-number">{badgeNumber}</span>
      </summary>
      <div className="section-fields">
        {resume.certifications.length > 1 && (
          <div className="section-bulk-bar">
            <span className="section-bulk-hint">
              Click an entry header to expand or collapse
            </span>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                onSetManyCollapsed(
                  resume.certifications.map((c) => c.id),
                  !allCollapsed,
                )
              }
            >
              {allCollapsed ? "Expand all" : "Collapse all"}
            </button>
          </div>
        )}
        {resume.certifications.map((entry, index) => {
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
                    Certification {index + 1}
                    {entry.name.trim() ? (
                      <span className="entry-card-subtitle">
                        {" "}
                        · {entry.name.trim()}
                      </span>
                    ) : null}
                  </strong>
                </button>
                <EntryControls
                  label={`certification ${index + 1}`}
                  index={index}
                  length={resume.certifications.length}
                  collapsed={isCollapsed}
                  onToggleCollapse={() => onToggleCollapsed(entry.id, index)}
                  onMove={(direction) =>
                    onChange(
                      {
                        ...resume,
                        certifications: move(
                          resume.certifications,
                          index,
                          direction,
                        ),
                      },
                      { discrete: true },
                    )
                  }
                  onRemove={() =>
                    onChange(
                      {
                        ...resume,
                        certifications: resume.certifications.filter(
                          (item) => item.id !== entry.id,
                        ),
                      },
                      {
                        discrete: true,
                        deletedLabel:
                          entry.name.trim() || `Certification ${index + 1}`,
                      },
                    )
                  }
                />
              </div>
              {!isCollapsed && (
                <>
                  <div className="field-grid">
                    <Field
                      label={`Certification name ${index + 1}`}
                      value={entry.name}
                      onChange={(name) => certification(entry.id, { name })}
                      placeholder="AWS Solutions Architect, PMP, CPA"
                    />
                    <Field
                      label={`Issuing organization ${index + 1}`}
                      value={entry.issuer}
                      onChange={(issuer) => certification(entry.id, { issuer })}
                      placeholder="Issuer"
                    />
                  </div>
                  <div className="field-grid">
                    <Field
                      label={`Date or year ${index + 1}`}
                      value={entry.date}
                      onChange={(date) => certification(entry.id, { date })}
                      placeholder="2025"
                    />
                    <Field
                      label={`Credential URL ${index + 1}`}
                      value={entry.url}
                      onChange={(url) => certification(entry.id, { url })}
                      placeholder="Optional verification link"
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className="add-button"
          disabled={resume.certifications.length >= 20}
          onClick={() => {
            const id = crypto.randomUUID();
            onExpandEntry(id);
            onChange(
              {
                ...resume,
                certifications: [
                  ...resume.certifications,
                  {
                    id,
                    name: "",
                    issuer: "",
                    date: "",
                    url: "",
                  },
                ],
              },
              { discrete: true },
            );
          }}
        >
          <Plus size={16} /> Add certification
        </button>
      </div>
    </details>
  );
}
