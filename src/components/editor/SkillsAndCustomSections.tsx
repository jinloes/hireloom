import { Layers, Plus, Shapes, Trash2 } from "lucide-react";
import type {
  CustomEntry,
  CustomSection,
  Resume,
  SkillGroup,
} from "../../model";
import {
  EntryControls,
  Field,
  move,
  SkillChipsManager,
  type ChangeMeta,
} from "./FieldPrimitives";

export function SkillsSection({
  resume,
  badgeNumber,
  open,
  onToggleSection,
  onChange,
}: {
  resume: Resume;
  badgeNumber: string;
  open: boolean;
  onToggleSection: (event: React.SyntheticEvent<HTMLDetailsElement>) => void;
  onChange: (resume: Resume, meta?: ChangeMeta) => void;
}) {
  const skillGroup = (id: string, patch: Partial<SkillGroup>) =>
    onChange({
      ...resume,
      skillGroups: resume.skillGroups.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    });

  return (
    <details
      className="editor-section"
      data-editor-section="skills"
      open={open}
      onToggle={onToggleSection}
    >
      <summary>
        <span>
          <Shapes size={17} /> Skills
        </span>
        <span className="section-number">{badgeNumber}</span>
      </summary>
      <div className="section-fields">
        {resume.skillGroups.map((group, index) => (
          <div className="entry-card" key={group.id} data-entry-id={group.id}>
            <div className="entry-topline">
              <strong className="entry-card-title">
                Skill category {index + 1}
              </strong>
              <EntryControls
                label={`skill category ${index + 1}`}
                index={index}
                length={resume.skillGroups.length}
                onMove={(direction) =>
                  onChange(
                    {
                      ...resume,
                      skillGroups: move(resume.skillGroups, index, direction),
                    },
                    { discrete: true },
                  )
                }
                onRemove={() =>
                  onChange(
                    {
                      ...resume,
                      skillGroups: resume.skillGroups.filter(
                        (item) => item.id !== group.id,
                      ),
                    },
                    {
                      discrete: true,
                      deletedLabel:
                        group.category.trim() || `Skill category ${index + 1}`,
                    },
                  )
                }
              />
            </div>
            <Field
              label={`Category heading ${index + 1}`}
              value={group.category}
              onChange={(category) => skillGroup(group.id, { category })}
              placeholder="e.g. Languages, Cloud & DevOps, Product"
            />
            <Field
              label={`Category ${index + 1} skills`}
              value={group.items.join(", ")}
              onChange={(value) =>
                skillGroup(group.id, {
                  items: value
                    .split(",")
                    .slice(0, 50)
                    .map((item) => item.trimStart().slice(0, 100)),
                })
              }
              placeholder="TypeScript, Rust, SQL"
            />
          </div>
        ))}
        <button
          type="button"
          className="add-button"
          disabled={resume.skillGroups.length >= 20}
          onClick={() =>
            onChange(
              {
                ...resume,
                skillGroups: [
                  ...resume.skillGroups,
                  {
                    id: crypto.randomUUID(),
                    category: "",
                    items: [],
                  },
                ],
              },
              { discrete: true },
            )
          }
        >
          <Plus size={16} /> Add skill category
        </button>
        <SkillChipsManager
          skills={resume.skills}
          onChangeSkills={(skills, discrete) =>
            onChange({ ...resume, skills }, { discrete })
          }
        />
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
  );
}

export function CustomSectionsEditor({
  resume,
  badgeNumber,
  open,
  onToggleSection,
  onChange,
}: {
  resume: Resume;
  badgeNumber: string;
  open: boolean;
  onToggleSection: (event: React.SyntheticEvent<HTMLDetailsElement>) => void;
  onChange: (resume: Resume, meta?: ChangeMeta) => void;
}) {
  const customSection = (id: string, patch: Partial<CustomSection>) =>
    onChange({
      ...resume,
      customSections: resume.customSections.map((section) =>
        section.id === id ? { ...section, ...patch } : section,
      ),
    });
  const customEntry = (
    sectionId: string,
    entryId: string,
    patch: Partial<CustomEntry>,
  ) =>
    onChange({
      ...resume,
      customSections: resume.customSections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              entries: section.entries.map((entry) =>
                entry.id === entryId ? { ...entry, ...patch } : entry,
              ),
            }
          : section,
      ),
    });

  return (
    <details
      className="editor-section"
      data-editor-section="custom"
      open={open}
      onToggle={onToggleSection}
    >
      <summary>
        <span>
          <Layers size={17} /> Custom sections{" "}
          <span className="count">{resume.customSections.length}</span>
        </span>
        <span className="section-number">{badgeNumber}</span>
      </summary>
      <div className="section-fields">
        {resume.customSections.map((section, sectionIndex) => (
          <div
            className="entry-card"
            key={section.id}
            data-entry-id={section.id}
          >
            <div className="entry-topline">
              <strong className="entry-card-title">
                Custom section {sectionIndex + 1}
              </strong>
              <EntryControls
                label={`custom section ${sectionIndex + 1}`}
                index={sectionIndex}
                length={resume.customSections.length}
                onMove={(direction) =>
                  onChange(
                    {
                      ...resume,
                      customSections: move(
                        resume.customSections,
                        sectionIndex,
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
                      customSections: resume.customSections.filter(
                        (item) => item.id !== section.id,
                      ),
                    },
                    {
                      discrete: true,
                      deletedLabel:
                        section.title.trim() ||
                        `Custom section ${sectionIndex + 1}`,
                    },
                  )
                }
              />
            </div>
            <Field
              label={`Custom section title ${sectionIndex + 1}`}
              value={section.title}
              onChange={(title) => customSection(section.id, { title })}
              placeholder="Volunteering, Awards, Publications, Speaking"
            />
            {section.entries.map((entry, entryIndex) => (
              <div className="nested-entry" key={entry.id}>
                <div className="entry-topline">
                  <strong>
                    Entry {sectionIndex + 1}.{entryIndex + 1}
                  </strong>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Remove entry ${sectionIndex + 1}.${entryIndex + 1}`}
                    onClick={() =>
                      customSection(section.id, {
                        entries: section.entries.filter(
                          (item) => item.id !== entry.id,
                        ),
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="field-grid">
                  <Field
                    label={`Entry heading ${sectionIndex + 1}.${entryIndex + 1}`}
                    value={entry.heading}
                    onChange={(heading) =>
                      customEntry(section.id, entry.id, { heading })
                    }
                    placeholder="Role, award, or talk title"
                  />
                  <Field
                    label={`Entry date ${sectionIndex + 1}.${entryIndex + 1}`}
                    value={entry.date}
                    onChange={(date) =>
                      customEntry(section.id, entry.id, { date })
                    }
                    placeholder="2025"
                  />
                </div>
                <Field
                  label={`Entry organization ${sectionIndex + 1}.${entryIndex + 1}`}
                  value={entry.subheading}
                  onChange={(subheading) =>
                    customEntry(section.id, entry.id, { subheading })
                  }
                  placeholder="Organization, publication, or venue"
                />
                {entry.bullets.map((bText, bIdx) => (
                  <div className="bullet-editor" key={bIdx}>
                    <Field
                      label={`Entry detail ${sectionIndex + 1}.${entryIndex + 1}.${bIdx + 1}`}
                      value={bText}
                      multiline
                      rows={2}
                      maxLength={2_000}
                      onChange={(val) =>
                        customEntry(section.id, entry.id, {
                          bullets: entry.bullets.map((b, i) =>
                            i === bIdx ? val : b,
                          ),
                        })
                      }
                    />
                    <div className="bullet-editor-actions">
                      <span />
                      <button
                        type="button"
                        className="icon-button danger"
                        aria-label={`Remove entry detail ${sectionIndex + 1}.${entryIndex + 1}.${bIdx + 1}`}
                        onClick={() =>
                          customEntry(section.id, entry.id, {
                            bullets: entry.bullets.filter((_, i) => i !== bIdx),
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-button add-inline"
                  disabled={entry.bullets.length >= 30}
                  onClick={() =>
                    customEntry(section.id, entry.id, {
                      bullets: [...entry.bullets, ""],
                    })
                  }
                >
                  <Plus size={14} /> Add detail bullet
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-button add-inline"
              disabled={section.entries.length >= 20}
              onClick={() =>
                customSection(section.id, {
                  entries: [
                    ...section.entries,
                    {
                      id: crypto.randomUUID(),
                      heading: "",
                      subheading: "",
                      date: "",
                      bullets: [],
                    },
                  ],
                })
              }
            >
              <Plus size={14} /> Add section entry
            </button>
          </div>
        ))}
        <button
          type="button"
          className="add-button"
          disabled={resume.customSections.length >= 10}
          onClick={() =>
            onChange(
              {
                ...resume,
                customSections: [
                  ...resume.customSections,
                  {
                    id: crypto.randomUUID(),
                    title: "",
                    entries: [
                      {
                        id: crypto.randomUUID(),
                        heading: "",
                        subheading: "",
                        date: "",
                        bullets: [],
                      },
                    ],
                  },
                ],
              },
              { discrete: true },
            )
          }
        >
          <Plus size={16} /> Add custom section
        </button>
      </div>
    </details>
  );
}
