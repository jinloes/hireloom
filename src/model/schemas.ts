import { z } from "zod";

export const WORKSPACE_VERSION = 2;

export const SECTION_KEYS = [
  "summary",
  "experience",
  "projects",
  "education",
  "certifications",
  "skills",
  "custom",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const DEFAULT_SECTION_ORDER: SectionKey[] = [...SECTION_KEYS];

export const SECTION_LABELS: Record<SectionKey, string> = {
  summary: "Profile summary",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
  skills: "Skills",
  custom: "Custom sections",
};

export const idField = z.string().min(1).max(100);
export const shortTextField = z.string().max(500);
export const bulletField = z.string().max(2_000);
export const nonemptyBulletField = bulletField.refine(
  (value) => value.trim().length > 0,
  {
    message: "Text must not be blank.",
  },
);

export const experienceSchema = z.strictObject({
  id: idField,
  role: shortTextField,
  company: shortTextField,
  location: shortTextField,
  startDate: shortTextField,
  endDate: shortTextField,
  bullets: z.array(bulletField).max(30),
  libraryId: idField.optional(),
});

export const projectSchema = z.strictObject({
  id: idField,
  name: shortTextField,
  subtitle: shortTextField,
  url: shortTextField,
  startDate: shortTextField,
  endDate: shortTextField,
  bullets: z.array(bulletField).max(30),
  libraryId: idField.optional(),
});

export const educationSchema = z.strictObject({
  id: idField,
  school: shortTextField,
  degree: shortTextField,
  graduation: shortTextField,
  libraryId: idField.optional(),
});

export const certificationSchema = z.strictObject({
  id: idField,
  name: shortTextField,
  issuer: shortTextField,
  date: shortTextField,
  url: shortTextField,
  libraryId: idField.optional(),
});

export const skillGroupSchema = z.strictObject({
  id: idField,
  category: shortTextField,
  items: z.array(z.string().max(100)).max(50),
  libraryId: idField.optional(),
});

export const customEntrySchema = z.strictObject({
  id: idField,
  heading: shortTextField,
  subheading: shortTextField,
  date: shortTextField,
  bullets: z.array(bulletField).max(30),
});

export const customSectionSchema = z
  .strictObject({
    id: idField,
    title: shortTextField,
    entries: z.array(customEntrySchema).max(20),
  })
  .superRefine((section, ctx) => {
    if (
      new Set(section.entries.map((entry) => entry.id)).size !==
      section.entries.length
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Duplicate customSections entry IDs.",
        path: ["entries"],
      });
    }
  });

export const sectionKeySchema = z.enum(SECTION_KEYS);

export const sectionOrderSchema = z
  .array(sectionKeySchema)
  .length(SECTION_KEYS.length)
  .superRefine((order, ctx) => {
    if (new Set(order).size !== SECTION_KEYS.length) {
      ctx.addIssue({
        code: "custom",
        message: "Section order must include each section once.",
      });
    }
  });

export const resumeSchema = z
  .strictObject({
    id: idField,
    title: z.string().min(1).max(120),
    updatedAt: z.iso.datetime(),
    basics: z.strictObject({
      name: shortTextField,
      headline: shortTextField,
      email: shortTextField,
      phone: shortTextField,
      location: shortTextField,
      website: shortTextField,
      github: shortTextField.default(""),
    }),
    summary: z.string().max(10_000),
    experience: z.array(experienceSchema).max(30),
    projects: z.array(projectSchema).max(20).default([]),
    education: z.array(educationSchema).max(20),
    certifications: z.array(certificationSchema).max(20).default([]),
    customSections: z.array(customSectionSchema).max(10).default([]),
    skills: z.array(z.string().max(100)).max(100),
    skillGroups: z.array(skillGroupSchema).max(20).default([]),
    sectionOrder: sectionOrderSchema.default(() => [...DEFAULT_SECTION_ORDER]),
    skippedKeywords: z.array(z.string().min(1).max(100)).max(200).default([]),
    jobDescription: z.string().max(20_000),
    template: z.enum(["editorial", "modern"]),
    accent: z.enum(["teal", "indigo", "charcoal"]),
    pageSize: z.enum(["a4", "letter"]).default("a4"),
    density: z.enum(["compact", "standard", "spacious"]).default("standard"),
  })
  .superRefine((resume, ctx) => {
    for (const key of [
      "experience",
      "projects",
      "education",
      "certifications",
      "customSections",
      "skillGroups",
    ] as const) {
      if (
        new Set(resume[key].map((entry) => entry.id)).size !==
        resume[key].length
      ) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate ${key} IDs.`,
          path: [key],
        });
      }
    }
    if (
      new Set(resume.skippedKeywords).size !== resume.skippedKeywords.length
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Duplicate skippedKeywords.",
        path: ["skippedKeywords"],
      });
    }
  });

export const careerLibrarySchema = z
  .strictObject({
    experiences: z.array(experienceSchema).max(50).default([]),
    projects: z.array(projectSchema).max(40).default([]),
    education: z.array(educationSchema).max(30).default([]),
    certifications: z.array(certificationSchema).max(30).default([]),
    skillGroups: z.array(skillGroupSchema).max(30).default([]),
  })
  .superRefine((library, ctx) => {
    for (const key of [
      "experiences",
      "projects",
      "education",
      "certifications",
      "skillGroups",
    ] as const) {
      if (
        new Set(library[key].map((entry) => entry.id)).size !==
        library[key].length
      ) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate careerLibrary.${key} IDs.`,
          path: [key],
        });
      }
      if (library[key].some((entry) => entry.libraryId !== undefined)) {
        ctx.addIssue({
          code: "custom",
          message: `Canonical careerLibrary.${key} items cannot set libraryId.`,
          path: [key],
        });
      }
    }
  });

function checkWorkspaceSelection(
  workspace: { activeResumeId: string; resumes: { id: string }[] },
  ctx: z.RefinementCtx,
) {
  if (
    new Set(workspace.resumes.map((resume) => resume.id)).size !==
    workspace.resumes.length
  ) {
    ctx.addIssue({ code: "custom", message: "Resume IDs must be unique." });
  }
  if (
    !workspace.resumes.some((resume) => resume.id === workspace.activeResumeId)
  ) {
    ctx.addIssue({
      code: "custom",
      message: "The selected resume does not exist.",
    });
  }
}

export function emptyCareerLibrary(): CareerLibrary {
  return {
    experiences: [],
    projects: [],
    education: [],
    certifications: [],
    skillGroups: [],
  };
}

export const workspaceV1Schema = z
  .strictObject({
    version: z.literal(1),
    activeResumeId: idField,
    resumes: z.array(resumeSchema).min(1).max(50),
  })
  .superRefine(checkWorkspaceSelection);

export const workspaceSchema = z
  .strictObject({
    version: z.literal(WORKSPACE_VERSION),
    activeResumeId: idField,
    resumes: z.array(resumeSchema).min(1).max(50),
    careerLibrary: careerLibrarySchema.default(() => emptyCareerLibrary()),
  })
  .superRefine(checkWorkspaceSelection);

export type Resume = z.infer<typeof resumeSchema>;
export type Experience = Resume["experience"][number];
export type Project = Resume["projects"][number];
export type Education = Resume["education"][number];
export type Certification = Resume["certifications"][number];
export type SkillGroup = Resume["skillGroups"][number];
export type CustomSection = Resume["customSections"][number];
export type CustomEntry = CustomSection["entries"][number];
export type PageSize = Resume["pageSize"];
export type Density = Resume["density"];
export type CareerLibrary = z.infer<typeof careerLibrarySchema>;
export type Workspace = z.infer<typeof workspaceSchema>;

export const MAX_WORKSPACE_BYTES = 2 * 1024 * 1024;
export const accents = {
  teal: "#174c43",
  indigo: "#4d5092",
  charcoal: "#343b43",
};

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatYearMonth(value: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return match ? `${months[Number(match[2]) - 1]} ${match[1]}` : value;
}

export function createResume(): Resume {
  return {
    id: crypto.randomUUID(),
    title: "Untitled resume",
    updatedAt: new Date().toISOString(),
    basics: {
      name: "",
      headline: "",
      email: "",
      phone: "",
      location: "",
      website: "",
      github: "",
    },
    summary: "",
    experience: [],
    projects: [],
    education: [],
    certifications: [],
    customSections: [],
    skills: [],
    skillGroups: [],
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    skippedKeywords: [],
    jobDescription: "",
    template: "editorial",
    accent: "teal",
    pageSize: "a4",
    density: "standard",
  };
}

export function initialWorkspace(): Workspace {
  const resume = createResume();
  return {
    version: WORKSPACE_VERSION,
    activeResumeId: resume.id,
    resumes: [resume],
    careerLibrary: emptyCareerLibrary(),
  };
}

export function exampleResume(): Resume {
  return {
    ...createResume(),
    title: "Product designer · example",
    basics: {
      name: "Alex Morgan",
      headline: "Product Designer",
      email: "alex@example.com",
      phone: "",
      location: "Portland, OR",
      website: "portfolio.example.com",
      github: "github.com/alexmorgan",
    },
    summary:
      "Product designer who makes complex tools feel simple. Experienced in turning research into thoughtful, accessible digital experiences, working closely with engineering teams from the first sketch to the final detail.",
    experience: [
      {
        id: crypto.randomUUID(),
        role: "Senior Product Designer",
        company: "Morrow Studio",
        location: "Remote",
        startDate: "2022-01",
        endDate: "Present",
        bullets: [
          "Led the end-to-end redesign of a customer onboarding experience, combining user research, prototyping, and usability testing.",
          "Built a shared Figma design system with engineering partners to create more consistent, accessible product experiences.",
          "Partnered with product managers to turn customer feedback into a focused roadmap of design improvements.",
        ],
      },
      {
        id: crypto.randomUUID(),
        role: "Product Designer",
        company: "Forma",
        location: "Portland, OR",
        startDate: "2019-06",
        endDate: "2022-01",
        bullets: [
          "Designed responsive web experiences from early wireframes through high-fidelity prototypes.",
          "Conducted customer interviews and usability studies to guide iterative product improvements.",
        ],
      },
    ],
    education: [
      {
        id: crypto.randomUUID(),
        school: "Example University",
        degree: "BFA, Communication Design",
        graduation: "2019",
      },
    ],
    skills: [
      "Product design",
      "User research",
      "Figma",
      "Prototyping",
      "Design systems",
      "Accessibility",
    ],
  };
}

export function upgradeWorkspace(parsed: unknown): Workspace {
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "version" in parsed &&
    (parsed as { version?: unknown }).version === 1
  ) {
    const v1 = workspaceV1Schema.safeParse(parsed);
    if (!v1.success) {
      throw new Error(
        `This is not a supported Hireloom workspace: ${v1.error.issues[0]?.message ?? "invalid data"}`,
      );
    }
    return workspaceSchema.parse({
      version: WORKSPACE_VERSION,
      activeResumeId: v1.data.activeResumeId,
      resumes: v1.data.resumes,
      careerLibrary: emptyCareerLibrary(),
    });
  }

  const result = workspaceSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `This is not a supported Hireloom workspace: ${result.error.issues[0]?.message ?? "invalid data"}`,
    );
  }
  return result.data;
}

export function parseWorkspace(text: string): Workspace {
  if (new TextEncoder().encode(text).length > MAX_WORKSPACE_BYTES) {
    throw new Error("This workspace is larger than the 2 MB limit.");
  }
  const parsed: unknown = JSON.parse(text);
  return upgradeWorkspace(parsed);
}

export function documentFilename(
  title: string,
  extension: "pdf" | "docx" | "json",
): string {
  const safe = title
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return `${safe || "hireloom-resume"}.${extension}`;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
