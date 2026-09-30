import type { Resume } from "../../model";
import { Field } from "./fields";

type SkillsSectionProps = {
  resume: Resume;
  onChange: (resume: Resume) => void;
};

export function SkillsSection({ resume, onChange }: SkillsSectionProps) {
  return (
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
  );
}
