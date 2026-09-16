import { z } from "zod";

const id = z.string().min(1).max(100);
const shortText = z.string().max(500);
const bullet = z.string().max(2_000);
const nonemptyBullet = bullet.refine((value) => value.trim().length > 0, {
  message: "Text must not be blank.",
});

export const experienceSchema = z.strictObject({
  id,
  role: shortText,
  company: shortText,
  location: shortText,
  startDate: shortText,
  endDate: shortText,
  bullets: z.array(bullet).max(30),
});

export const resumeSchema = z
  .strictObject({
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
    experience: z.array(experienceSchema).max(30),
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
  })
  .superRefine((resume, ctx) => {
    for (const key of ["experience", "education"] as const) {
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
  });

export const workspaceSchema = z
  .strictObject({
    version: z.literal(1),
    activeResumeId: id,
    resumes: z.array(resumeSchema).min(1).max(50),
  })
  .superRefine((workspace, ctx) => {
    if (
      new Set(workspace.resumes.map((resume) => resume.id)).size !==
      workspace.resumes.length
    ) {
      ctx.addIssue({ code: "custom", message: "Resume IDs must be unique." });
    }
    if (
      !workspace.resumes.some(
        (resume) => resume.id === workspace.activeResumeId,
      )
    ) {
      ctx.addIssue({
        code: "custom",
        message: "The selected resume does not exist.",
      });
    }
  });

export const proposalSchema = z.strictObject({
  summary: z.string().max(10_000),
  experience: z
    .array(
      z.strictObject({
        id,
        bullets: z.array(bullet).max(30),
      }),
    )
    .max(30),
  notes: z.array(z.string().max(2_000)).max(20),
});

export const aprTargetSchema = z.strictObject({
  resumeId: id,
  experienceId: id,
  bulletIndex: z.number().int().min(0).max(29),
  role: shortText,
  bullet: nonemptyBullet,
});

export const aprDimensionSchema = z.strictObject({
  status: z.enum(["clear", "partial", "missing"]),
  feedback: nonemptyBullet,
});

export const aprAnalysisSchema = z.strictObject({
  target: aprTargetSchema,
  action: aprDimensionSchema,
  project: aprDimensionSchema,
  result: aprDimensionSchema,
  rewrite: z.string().max(2_000).optional(),
  questions: z.array(nonemptyBullet).max(5),
});

export type Resume = z.infer<typeof resumeSchema>;
export type Experience = Resume["experience"][number];
export type Education = Resume["education"][number];
export type Workspace = z.infer<typeof workspaceSchema>;
export type AiProposal = z.infer<typeof proposalSchema>;
export type AprTarget = z.infer<typeof aprTargetSchema>;
export type AprDimension = z.infer<typeof aprDimensionSchema>;
export type AprAnalysis = z.infer<typeof aprAnalysisSchema>;

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
    education: [],
    skills: [],
    jobDescription: "",
    template: "editorial",
    accent: "teal",
  };
}

export function initialWorkspace(): Workspace {
  const resume = createResume();
  return { version: 1, activeResumeId: resume.id, resumes: [resume] };
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

export function parseWorkspace(text: string): Workspace {
  if (new TextEncoder().encode(text).length > MAX_WORKSPACE_BYTES) {
    throw new Error("This workspace is larger than the 2 MB limit.");
  }
  const parsed: unknown = JSON.parse(text);
  const result = workspaceSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `This is not a supported Hireloom workspace: ${result.error.issues[0]?.message ?? "invalid data"}`,
    );
  }
  return result.data;
}

export function validateProposal(value: unknown, resume: Resume): AiProposal {
  const proposal = proposalSchema.parse(value);
  const ids = proposal.experience.map((entry) => entry.id);
  if (
    ids.length !== resume.experience.length ||
    new Set(ids).size !== ids.length ||
    resume.experience.some((entry) => !ids.includes(entry.id))
  ) {
    throw new Error(
      "Copilot returned mismatched experience entries. Nothing has been changed.",
    );
  }
  return proposal;
}

export function applyProposal(resume: Resume, proposal: AiProposal): Resume {
  const valid = validateProposal(proposal, resume);
  return {
    ...resume,
    summary: valid.summary,
    experience: resume.experience.map((entry) => ({
      ...entry,
      bullets: valid.experience.find(
        (suggestion) => suggestion.id === entry.id,
      )!.bullets,
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function validateAprTarget(value: unknown, resume?: Resume): AprTarget {
  const target = aprTargetSchema.parse(value);
  if (resume) {
    const experience = resume.experience.find(
      (entry) => entry.id === target.experienceId,
    );
    if (
      resume.id !== target.resumeId ||
      !experience ||
      experience.role !== target.role ||
      experience.bullets[target.bulletIndex] !== target.bullet
    ) {
      throw new Error(
        "The selected accomplishment no longer matches this resume.",
      );
    }
  }
  return target;
}

export function validateAprAnalysis(
  value: unknown,
  expectedTarget: AprTarget,
): AprAnalysis {
  const analysis = aprAnalysisSchema.parse(value);
  if (
    analysis.target.resumeId !== expectedTarget.resumeId ||
    analysis.target.experienceId !== expectedTarget.experienceId ||
    analysis.target.bulletIndex !== expectedTarget.bulletIndex ||
    analysis.target.role !== expectedTarget.role ||
    analysis.target.bullet !== expectedTarget.bullet
  ) {
    throw new Error(
      "Copilot returned an analysis for a different accomplishment. Nothing has been changed.",
    );
  }
  return analysis;
}

export function applyAprRewrite(
  resume: Resume,
  target: AprTarget,
  rewrite: string,
): Resume {
  const validTarget = validateAprTarget(target, resume);
  const validRewrite = bullet.parse(rewrite);
  if (!validRewrite.trim() || validRewrite === validTarget.bullet) {
    throw new Error("Copilot did not provide a changed, nonempty rewrite.");
  }
  return {
    ...resume,
    experience: resume.experience.map((entry) =>
      entry.id === validTarget.experienceId
        ? {
            ...entry,
            bullets: entry.bullets.map((text, index) =>
              index === validTarget.bulletIndex ? validRewrite : text,
            ),
          }
        : entry,
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function resumeReadiness(resume: Resume) {
  return [
    {
      label: "Name and email",
      complete: Boolean(
        resume.basics.name.trim() &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resume.basics.email),
      ),
    },
    {
      label: "Professional headline",
      complete: Boolean(resume.basics.headline.trim()),
    },
    { label: "A clear summary", complete: resume.summary.trim().length >= 40 },
    {
      label: "Experience with highlights",
      complete: resume.experience.some(
        (entry) =>
          entry.company.trim() &&
          entry.role.trim() &&
          entry.bullets.some((text) => text.trim()),
      ),
    },
    {
      label: "At least three skills",
      complete: resume.skills.filter((skill) => skill.trim()).length >= 3,
    },
  ];
}

const vocabulary = [
  "product design",
  "user research",
  "user experience",
  "design systems",
  "accessibility",
  "prototyping",
  "figma",
  "usability",
  "interaction design",
  "visual design",
  "typescript",
  "javascript",
  "react",
  "python",
  "java",
  "c++",
  "c#",
  ".net",
  "node.js",
  "rust",
  "sql",
  "postgresql",
  "aws",
  "azure",
  "docker",
  "kubernetes",
  "project management",
  "product management",
  "agile",
  "scrum",
  "leadership",
  "communication",
  "collaboration",
  "stakeholder",
  "analytics",
  "data analysis",
  "machine learning",
  "sales",
  "marketing",
  "customer service",
  "excel",
  "budgeting",
  "operations",
  "compliance",
  "accounting",
  "healthcare",
];

function containsPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(text);
}

export function jobKeywords(
  resume: Resume,
): { term: string; matched: boolean }[] {
  const content = [
    resume.basics.headline,
    resume.summary,
    ...resume.skills,
    ...resume.experience.flatMap((entry) => [entry.role, ...entry.bullets]),
    ...resume.education.map((entry) => entry.degree),
  ].join(" ");
  return vocabulary
    .filter((term) => containsPhrase(resume.jobDescription, term))
    .map((term) => ({ term, matched: containsPhrase(content, term) }));
}

export function documentFilename(
  title: string,
  extension: "pdf" | "json",
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
