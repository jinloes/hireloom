import { Plus } from "lucide-react";
import type { Resume } from "../../model";
import type { ContentRemovalRequest } from "./types";
import { EntryControls, Field } from "./fields";
import { educationTitle, move } from "./helpers";

type EducationSectionProps = {
  resume: Resume;
  onChange: (resume: Resume) => void;
  education: (id: string, patch: Partial<Resume["education"][number]>) => void;
  onRemove: (request: ContentRemovalRequest) => void;
};

export function EducationSection({
  resume,
  onChange,
  education,
  onRemove,
}: EducationSectionProps) {
  return (
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
            onChange={(graduation) => education(entry.id, { graduation })}
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
  );
}
