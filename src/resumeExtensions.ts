import { z } from "zod";

const id = z.string().min(1).max(100);
const shortText = z.string().max(500);
const longText = z.string().max(10_000);
const bullet = z.string().max(2_000);

export const additionalSectionSchema = z.enum([
  "projects",
  "certifications",
  "awards",
  "volunteer",
  "publications",
  "languages",
]);

export const DEFAULT_ADDITIONAL_SECTION_ORDER = [
  "projects",
  "certifications",
  "awards",
  "volunteer",
  "publications",
  "languages",
] as const;

export const targetJobSchema = z.strictObject({
  title: shortText,
  company: shortText,
  sourceUrl: shortText,
  description: z.string().max(20_000),
});

export const projectSchema = z.strictObject({
  id,
  name: shortText,
  role: shortText,
  url: shortText,
  startDate: shortText,
  endDate: shortText,
  bullets: z.array(bullet).max(30),
});

export const certificationSchema = z.strictObject({
  id,
  name: shortText,
  issuer: shortText,
  date: shortText,
  credentialUrl: shortText,
});

export const awardSchema = z.strictObject({
  id,
  title: shortText,
  issuer: shortText,
  date: shortText,
  description: longText,
});

export const volunteerSchema = z.strictObject({
  id,
  organization: shortText,
  role: shortText,
  startDate: shortText,
  endDate: shortText,
  bullets: z.array(bullet).max(30),
});

export const publicationSchema = z.strictObject({
  id,
  title: shortText,
  publisher: shortText,
  date: shortText,
  url: shortText,
});

export const languageSchema = z.strictObject({
  id,
  name: shortText,
  proficiency: shortText,
});

export const additionalResumeFields = {
  targetJob: targetJobSchema,
  projects: z.array(projectSchema).max(20),
  certifications: z.array(certificationSchema).max(20),
  awards: z.array(awardSchema).max(20),
  volunteer: z.array(volunteerSchema).max(20),
  publications: z.array(publicationSchema).max(20),
  languages: z.array(languageSchema).max(20),
  additionalSectionOrder: z
    .array(additionalSectionSchema)
    .length(DEFAULT_ADDITIONAL_SECTION_ORDER.length),
};

export type AdditionalSection = z.infer<typeof additionalSectionSchema>;
export type TargetJob = z.infer<typeof targetJobSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Certification = z.infer<typeof certificationSchema>;
export type Award = z.infer<typeof awardSchema>;
export type Volunteer = z.infer<typeof volunteerSchema>;
export type Publication = z.infer<typeof publicationSchema>;
export type Language = z.infer<typeof languageSchema>;

export function emptyTargetJob(): TargetJob {
  return { title: "", company: "", sourceUrl: "", description: "" };
}

export function emptyAdditionalResumeFields() {
  return {
    targetJob: emptyTargetJob(),
    projects: [] as Project[],
    certifications: [] as Certification[],
    awards: [] as Award[],
    volunteer: [] as Volunteer[],
    publications: [] as Publication[],
    languages: [] as Language[],
    additionalSectionOrder: [...DEFAULT_ADDITIONAL_SECTION_ORDER],
  };
}
