import { z } from "zod";
import { emptyAdditionalResumeFields } from "./resumeExtensions";

const id = z.string().min(1).max(100);
const shortText = z.string().max(500);
const bullet = z.string().max(2_000);

const legacyExperienceSchema = z.strictObject({
  id,
  role: shortText,
  company: shortText,
  location: shortText,
  startDate: shortText,
  endDate: shortText,
  bullets: z.array(bullet).max(30),
});

const legacyResumeSchema = z.strictObject({
  id,
  title: z.string().min(1).max(120),
  updatedAt: z.iso.datetime(),
  basics: z.strictObject({
    name: shortText,
    headline: shortText,
    email: shortText,
    phone: shortText,
    location: shortText,
    website: shortText,
    github: shortText.default(""),
  }),
  summary: z.string().max(10_000),
  experience: z.array(legacyExperienceSchema).max(30),
  education: z
    .array(
      z.strictObject({
        id,
        school: shortText,
        degree: shortText,
        graduation: shortText,
      }),
    )
    .max(20),
  skills: z.array(z.string().max(100)).max(100),
  jobDescription: z.string().max(20_000),
  template: z.enum(["editorial", "modern"]),
  accent: z.enum(["teal", "indigo", "charcoal"]),
});

export const workspaceV1Schema = z.strictObject({
  version: z.literal(1),
  activeResumeId: id,
  resumes: z.array(legacyResumeSchema).min(1).max(50),
});

export function migrateWorkspaceV1(value: unknown): unknown {
  const workspace = workspaceV1Schema.parse(value);
  return {
    version: 2,
    activeResumeId: workspace.activeResumeId,
    resumes: workspace.resumes.map(({ jobDescription, ...resume }) => {
      const additional = emptyAdditionalResumeFields();
      return {
        ...resume,
        ...additional,
        targetJob: { ...additional.targetJob, description: jobDescription },
      };
    }),
  };
}
