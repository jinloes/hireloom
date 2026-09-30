import { Plus } from "lucide-react";
import type {
  AdditionalSection as AdditionalSectionId,
  Resume,
} from "../../model";
import { EntryControls, Field, MonthField } from "./fields";
import { move } from "./helpers";

const labels: Record<AdditionalSectionId, string> = {
  projects: "Projects",
  certifications: "Certifications",
  awards: "Awards",
  volunteer: "Volunteer experience",
  publications: "Publications",
  languages: "Languages",
};

type Props = {
  resume: Resume;
  onChange: (resume: Resume) => void;
};

function BulletFields({
  id,
  bullets,
  onChange,
}: {
  id: string;
  bullets: string[];
  onChange: (bullets: string[]) => void;
}) {
  return (
    <>
      {bullets.map((bullet, index) => (
        <div className="bullet-editor" key={`${id}-${index}`}>
          <EntryControls
            label={`highlight ${index + 1}`}
            index={index}
            length={bullets.length}
            onMove={(direction) => onChange(move(bullets, index, direction))}
            onRemove={() =>
              onChange(bullets.filter((_, itemIndex) => itemIndex !== index))
            }
          />
          <Field
            label={`Highlight ${index + 1}`}
            value={bullet}
            onChange={(value) =>
              onChange(
                bullets.map((item, itemIndex) =>
                  itemIndex === index ? value : item,
                ),
              )
            }
            multiline
            maxLength={2_000}
          />
        </div>
      ))}
      <button
        className="add-button"
        disabled={bullets.length >= 30}
        onClick={() => onChange([...bullets, ""])}
      >
        <Plus size={14} /> Add highlight
      </button>
    </>
  );
}

export function AdditionalSection({ resume, onChange }: Props) {
  const update = <K extends AdditionalSectionId>(key: K, value: Resume[K]) =>
    onChange({ ...resume, [key]: value });
  const sectionOrder = resume.additionalSectionOrder;

  return (
    <div className="section-fields additional-sections">
      <p className="empty-hint">
        Add only the sections that strengthen this resume. Use the arrows to
        control their order in the preview and PDF.
      </p>
      {sectionOrder.map((section, sectionIndex) => (
        <section
          className="additional-section-card"
          key={section}
          aria-labelledby={`additional-heading-${section}`}
        >
          <div className="entry-topline">
            <h3 id={`additional-heading-${section}`}>{labels[section]}</h3>
            <div className="entry-controls">
              <button
                className="icon-button"
                aria-label={`Move ${labels[section]} section up`}
                disabled={sectionIndex === 0}
                onClick={() =>
                  onChange({
                    ...resume,
                    additionalSectionOrder: move(
                      sectionOrder,
                      sectionIndex,
                      -1,
                    ),
                  })
                }
              >
                ↑
              </button>
              <button
                className="icon-button"
                aria-label={`Move ${labels[section]} section down`}
                disabled={sectionIndex === sectionOrder.length - 1}
                onClick={() =>
                  onChange({
                    ...resume,
                    additionalSectionOrder: move(sectionOrder, sectionIndex, 1),
                  })
                }
              >
                ↓
              </button>
            </div>
          </div>

          {section === "projects" && (
            <>
              {resume.projects.map((entry, index) => (
                <div className="entry-card" key={entry.id}>
                  <EntryControls
                    label={`project ${index + 1}`}
                    index={index}
                    length={resume.projects.length}
                    onMove={(direction) =>
                      update(
                        "projects",
                        move(resume.projects, index, direction),
                      )
                    }
                    onRemove={() =>
                      update(
                        "projects",
                        resume.projects.filter((item) => item.id !== entry.id),
                      )
                    }
                  />
                  <Field
                    id={`project-${entry.id}`}
                    label="Project name"
                    value={entry.name}
                    onChange={(name) =>
                      update(
                        "projects",
                        resume.projects.map((item) =>
                          item.id === entry.id ? { ...item, name } : item,
                        ),
                      )
                    }
                  />
                  <div className="field-grid">
                    <Field
                      label="Role"
                      value={entry.role}
                      onChange={(role) =>
                        update(
                          "projects",
                          resume.projects.map((item) =>
                            item.id === entry.id ? { ...item, role } : item,
                          ),
                        )
                      }
                    />
                    <Field
                      label="Project URL"
                      value={entry.url}
                      type="url"
                      onChange={(url) =>
                        update(
                          "projects",
                          resume.projects.map((item) =>
                            item.id === entry.id ? { ...item, url } : item,
                          ),
                        )
                      }
                    />
                    <MonthField
                      label="Start date"
                      value={entry.startDate}
                      onChange={(startDate) =>
                        update(
                          "projects",
                          resume.projects.map((item) =>
                            item.id === entry.id
                              ? { ...item, startDate }
                              : item,
                          ),
                        )
                      }
                    />
                    <MonthField
                      label="End date"
                      value={entry.endDate}
                      allowPresent
                      onChange={(endDate) =>
                        update(
                          "projects",
                          resume.projects.map((item) =>
                            item.id === entry.id ? { ...item, endDate } : item,
                          ),
                        )
                      }
                    />
                  </div>
                  <BulletFields
                    id={entry.id}
                    bullets={entry.bullets}
                    onChange={(bullets) =>
                      update(
                        "projects",
                        resume.projects.map((item) =>
                          item.id === entry.id ? { ...item, bullets } : item,
                        ),
                      )
                    }
                  />
                </div>
              ))}
              <button
                className="add-button"
                id="add-project"
                disabled={resume.projects.length >= 20}
                onClick={() =>
                  update("projects", [
                    ...resume.projects,
                    {
                      id: crypto.randomUUID(),
                      name: "",
                      role: "",
                      url: "",
                      startDate: "",
                      endDate: "",
                      bullets: [],
                    },
                  ])
                }
              >
                <Plus size={16} /> Add project
              </button>
            </>
          )}

          {section === "certifications" && (
            <SimpleEntries
              entries={resume.certifications}
              name="certification"
              fields={[
                ["name", "Certification"],
                ["issuer", "Issuer"],
                ["date", "Date"],
                ["credentialUrl", "Credential URL"],
              ]}
              onChange={(entries) => update("certifications", entries)}
              create={() => ({
                id: crypto.randomUUID(),
                name: "",
                issuer: "",
                date: "",
                credentialUrl: "",
              })}
            />
          )}
          {section === "awards" && (
            <SimpleEntries
              entries={resume.awards}
              name="award"
              fields={[
                ["title", "Award"],
                ["issuer", "Issuer"],
                ["date", "Date"],
                ["description", "Description"],
              ]}
              multiline="description"
              onChange={(entries) => update("awards", entries)}
              create={() => ({
                id: crypto.randomUUID(),
                title: "",
                issuer: "",
                date: "",
                description: "",
              })}
            />
          )}
          {section === "volunteer" && (
            <>
              {resume.volunteer.map((entry, index) => (
                <div className="entry-card" key={entry.id}>
                  <EntryControls
                    label={`volunteer experience ${index + 1}`}
                    index={index}
                    length={resume.volunteer.length}
                    onMove={(direction) =>
                      update(
                        "volunteer",
                        move(resume.volunteer, index, direction),
                      )
                    }
                    onRemove={() =>
                      update(
                        "volunteer",
                        resume.volunteer.filter((item) => item.id !== entry.id),
                      )
                    }
                  />
                  <div className="field-grid">
                    <Field
                      id={`volunteer-${entry.id}`}
                      label="Organization"
                      value={entry.organization}
                      onChange={(organization) =>
                        update(
                          "volunteer",
                          resume.volunteer.map((item) =>
                            item.id === entry.id
                              ? { ...item, organization }
                              : item,
                          ),
                        )
                      }
                    />
                    <Field
                      label="Role"
                      value={entry.role}
                      onChange={(role) =>
                        update(
                          "volunteer",
                          resume.volunteer.map((item) =>
                            item.id === entry.id ? { ...item, role } : item,
                          ),
                        )
                      }
                    />
                    <MonthField
                      label="Start date"
                      value={entry.startDate}
                      onChange={(startDate) =>
                        update(
                          "volunteer",
                          resume.volunteer.map((item) =>
                            item.id === entry.id
                              ? { ...item, startDate }
                              : item,
                          ),
                        )
                      }
                    />
                    <MonthField
                      label="End date"
                      value={entry.endDate}
                      allowPresent
                      onChange={(endDate) =>
                        update(
                          "volunteer",
                          resume.volunteer.map((item) =>
                            item.id === entry.id ? { ...item, endDate } : item,
                          ),
                        )
                      }
                    />
                  </div>
                  <BulletFields
                    id={entry.id}
                    bullets={entry.bullets}
                    onChange={(bullets) =>
                      update(
                        "volunteer",
                        resume.volunteer.map((item) =>
                          item.id === entry.id ? { ...item, bullets } : item,
                        ),
                      )
                    }
                  />
                </div>
              ))}
              <button
                className="add-button"
                id="add-volunteer"
                disabled={resume.volunteer.length >= 20}
                onClick={() =>
                  update("volunteer", [
                    ...resume.volunteer,
                    {
                      id: crypto.randomUUID(),
                      organization: "",
                      role: "",
                      startDate: "",
                      endDate: "",
                      bullets: [],
                    },
                  ])
                }
              >
                <Plus size={16} /> Add volunteer experience
              </button>
            </>
          )}
          {section === "publications" && (
            <SimpleEntries
              entries={resume.publications}
              name="publication"
              fields={[
                ["title", "Title"],
                ["publisher", "Publisher"],
                ["date", "Date"],
                ["url", "URL"],
              ]}
              onChange={(entries) => update("publications", entries)}
              create={() => ({
                id: crypto.randomUUID(),
                title: "",
                publisher: "",
                date: "",
                url: "",
              })}
            />
          )}
          {section === "languages" && (
            <SimpleEntries
              entries={resume.languages}
              name="language"
              fields={[
                ["name", "Language"],
                ["proficiency", "Proficiency"],
              ]}
              onChange={(entries) => update("languages", entries)}
              create={() => ({
                id: crypto.randomUUID(),
                name: "",
                proficiency: "",
              })}
            />
          )}
        </section>
      ))}
    </div>
  );
}

type Entry = { id: string } & Record<string, string>;

function SimpleEntries<T extends Entry>({
  entries,
  name,
  fields,
  multiline,
  onChange,
  create,
}: {
  entries: T[];
  name: string;
  fields: Array<[keyof T & string, string]>;
  multiline?: keyof T & string;
  onChange: (entries: T[]) => void;
  create: () => T;
}) {
  return (
    <>
      {entries.map((entry, index) => (
        <div className="entry-card" key={entry.id}>
          <EntryControls
            label={`${name} ${index + 1}`}
            index={index}
            length={entries.length}
            onMove={(direction) => onChange(move(entries, index, direction))}
            onRemove={() =>
              onChange(entries.filter((item) => item.id !== entry.id))
            }
          />
          {fields.map(([key, label], fieldIndex) => (
            <Field
              key={key}
              id={fieldIndex === 0 ? `${name}-${entry.id}` : undefined}
              label={label}
              value={entry[key]}
              multiline={key === multiline}
              maxLength={key === multiline ? 10_000 : 500}
              onChange={(value) =>
                onChange(
                  entries.map((item) =>
                    item.id === entry.id ? { ...item, [key]: value } : item,
                  ),
                )
              }
            />
          ))}
        </div>
      ))}
      <button
        className="add-button"
        id={`add-${name}`}
        disabled={entries.length >= 20}
        onClick={() => onChange([...entries, create()])}
      >
        <Plus size={16} /> Add {name}
      </button>
    </>
  );
}
