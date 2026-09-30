import type { Resume } from "../../model";
import { Field } from "./fields";

type PersonalSectionProps = {
  resume: Resume;
  basics: (key: keyof Resume["basics"], value: string) => void;
};

export function PersonalSection({ resume, basics }: PersonalSectionProps) {
  return (
    <div className="section-fields">
      <Field
        id="name"
        label="Full name"
        value={resume.basics.name}
        onChange={(value) => basics("name", value)}
        placeholder="e.g. Alex Morgan"
      />
      <Field
        id="headline"
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
  );
}
