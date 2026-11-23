import { z } from "zod";
import {
  bulletField,
  idField,
  nonemptyBulletField,
  resumeSchema,
  shortTextField,
  type Project,
  type Resume,
} from "./schemas";

export const providerKindSchema = z.enum([
  "copilot",
  "openai",
  "anthropic",
  "gemini",
  "ollama",
]);

export type ProviderKind = z.infer<typeof providerKindSchema>;

export const PROVIDER_LABELS: Record<ProviderKind, string> = {
  copilot: "GitHub Copilot CLI",
  openai: "OpenAI API",
  anthropic: "Anthropic API",
  gemini: "Google Gemini API",
  ollama: "Local Ollama / OpenAI-compatible",
};

export const COPILOT_MODELS = [
  "claude-sonnet-5.5",
  "gpt-6.1-terra",
  "gpt-6.2-sol",
  "gpt-6-luna",
  "claude-haiku-5.5",
] as const;

export const DEFAULT_MODELS_BY_PROVIDER: Record<ProviderKind, string> = {
  copilot: "claude-sonnet-5.5",
  openai: "gpt-4.1",
  anthropic: "claude-sonnet-4-6",
  gemini: "gemini-2.5-pro",
  ollama: "llama3.3",
};

export const aiSettingsSchema = z.strictObject({
  primaryProvider: providerKindSchema,
  primaryModel: z.string().min(1).max(100),
  ollamaBaseUrl: z
    .string()
    .min(1)
    .max(300)
    .default("http://127.0.0.1:11434/v1"),
  verifierEnabled: z.boolean().default(false),
  verifierProvider: providerKindSchema.default("copilot"),
  verifierModel: z.string().min(1).max(100).default("gpt-6.1-terra"),
});

export type AiSettings = z.infer<typeof aiSettingsSchema>;

export function defaultAiSettings(): AiSettings {
  return {
    primaryProvider: "copilot",
    primaryModel: "claude-sonnet-5.5",
    ollamaBaseUrl: "http://127.0.0.1:11434/v1",
    verifierEnabled: false,
    verifierProvider: "copilot",
    verifierModel: "gpt-6.1-terra",
  };
}

export const groundingStatusSchema = z.enum([
  "supported",
  "inferred",
  "unsupported",
]);

export const groundingItemSchema = z.strictObject({
  key: z.string().min(1).max(200),
  status: groundingStatusSchema,
  note: z.string().min(1).max(500),
});

export const groundingReportSchema = z.strictObject({
  provider: providerKindSchema,
  model: z.string().min(1).max(100),
  items: z.array(groundingItemSchema).max(200),
});

export type GroundingStatus = z.infer<typeof groundingStatusSchema>;
export type GroundingItem = z.infer<typeof groundingItemSchema>;
export type GroundingReport = z.infer<typeof groundingReportSchema>;

export const proposalEntrySchema = z.strictObject({
  id: idField,
  bullets: z.array(bulletField).max(30),
});

export const proposalSchema = z.strictObject({
  summary: z.string().max(10_000),
  experience: z.array(proposalEntrySchema).max(30),
  projects: z.array(proposalEntrySchema).max(20).optional(),
  notes: z.array(z.string().max(2_000)).max(20),
  verification: groundingReportSchema.optional(),
  verificationWarning: z.string().max(1_000).optional(),
});

export const summaryOptionSchema = z.strictObject({
  label: z.string().min(1).max(80),
  summary: nonemptyBulletField.max(10_000),
});

export const summaryOptionsProposalSchema = z.strictObject({
  options: z.array(summaryOptionSchema).min(1).max(3),
});

export const roleTailorProposalSchema = z.strictObject({
  entryId: idField,
  bullets: z.array(bulletField).max(30),
  notes: z.array(z.string().max(2_000)).max(20),
  verification: groundingReportSchema.optional(),
  verificationWarning: z.string().max(1_000).optional(),
});

export const importedStructureProposalSchema = z.strictObject({
  headline: shortTextField,
  summary: z.string().max(10_000),
  experience: z
    .array(
      z.strictObject({
        role: shortTextField,
        company: shortTextField,
        location: shortTextField,
        startDate: shortTextField,
        endDate: shortTextField,
        bullets: z.array(bulletField).max(30),
      }),
    )
    .max(30)
    .default([]),
  projects: z
    .array(
      z.strictObject({
        name: shortTextField,
        subtitle: shortTextField,
        startDate: shortTextField,
        endDate: shortTextField,
        bullets: z.array(bulletField).max(30),
      }),
    )
    .max(20)
    .default([]),
  education: z
    .array(
      z.strictObject({
        school: shortTextField,
        degree: shortTextField,
        graduation: shortTextField,
      }),
    )
    .max(20)
    .default([]),
  certifications: z
    .array(
      z.strictObject({
        name: shortTextField,
        issuer: shortTextField,
        date: shortTextField,
      }),
    )
    .max(20)
    .default([]),
  skills: z.array(z.string().max(100)).max(100).default([]),
  skillGroups: z
    .array(
      z.strictObject({
        category: shortTextField,
        items: z.array(z.string().max(100)).max(50),
      }),
    )
    .max(20)
    .default([]),
});

export const aprTargetSchema = z.strictObject({
  resumeId: idField,
  experienceId: idField,
  bulletIndex: z.number().int().min(0).max(29),
  role: shortTextField,
  bullet: nonemptyBulletField,
  focusKeyword: z
    .string()
    .min(1)
    .max(100)
    .refine((v) => v.trim().length > 0 && v.trim() === v, {
      message: "Focus keyword must be trimmed and nonblank.",
    })
    .optional(),
});

export const aprDimensionSchema = z.strictObject({
  status: z.enum(["clear", "partial", "missing"]),
  feedback: nonemptyBulletField,
});

export const aprAnalysisSchema = z
  .strictObject({
    target: aprTargetSchema,
    action: aprDimensionSchema,
    project: aprDimensionSchema,
    result: aprDimensionSchema,
    rewrite: z.string().max(2_000).optional(),
    questions: z.array(nonemptyBulletField).max(5),
    verification: groundingReportSchema.optional(),
    verificationWarning: z.string().max(1_000).optional(),
  })
  .superRefine((analysis, ctx) => {
    if (new Set(analysis.questions).size !== analysis.questions.length) {
      ctx.addIssue({
        code: "custom",
        message: "APR questions must be unique.",
        path: ["questions"],
      });
    }
  });

export const aprQuestionAnswerSchema = z.strictObject({
  question: nonemptyBulletField,
  answer: nonemptyBulletField,
});

export const aprRefinementSchema = z.strictObject({
  target: aprTargetSchema,
  answers: z.array(aprQuestionAnswerSchema).min(1).max(5),
  rewrite: nonemptyBulletField,
  verification: groundingReportSchema.optional(),
  verificationWarning: z.string().max(1_000).optional(),
});

export type SummaryOption = z.infer<typeof summaryOptionSchema>;
export type SummaryOptionsProposal = z.infer<
  typeof summaryOptionsProposalSchema
>;
export type RoleTailorProposal = z.infer<typeof roleTailorProposalSchema>;
export type ImportedStructureProposal = z.infer<
  typeof importedStructureProposalSchema
>;
export type AiProposal = z.infer<typeof proposalSchema>;
export type AprTarget = z.infer<typeof aprTargetSchema>;
export type AprDimension = z.infer<typeof aprDimensionSchema>;
export type AprAnalysis = z.infer<typeof aprAnalysisSchema>;
export type AprQuestionAnswer = z.infer<typeof aprQuestionAnswerSchema>;
export type AprRefinement = z.infer<typeof aprRefinementSchema>;

export type ProposalSelection = {
  summary: boolean;
  experienceBullets: Record<string, boolean[]>;
  projectBullets: Record<string, boolean[]>;
};

export function validateProposal(value: unknown, resume: Resume): AiProposal {
  const proposal = proposalSchema.parse(value);
  const expIds = proposal.experience.map((entry) => entry.id);
  if (
    expIds.length !== resume.experience.length ||
    new Set(expIds).size !== expIds.length ||
    resume.experience.some((entry) => !expIds.includes(entry.id))
  ) {
    throw new Error(
      "Copilot returned mismatched experience entries. Nothing has been changed.",
    );
  }
  const proposalProjects = proposal.projects ?? [];
  if (proposalProjects.length > 0 || resume.projects.length > 0) {
    const projIds = proposalProjects.map((entry) => entry.id);
    if (
      projIds.length !== resume.projects.length ||
      new Set(projIds).size !== projIds.length ||
      resume.projects.some((entry) => !projIds.includes(entry.id))
    ) {
      throw new Error(
        "Copilot returned mismatched project entries. Nothing has been changed.",
      );
    }
  }
  return proposal;
}

export function defaultProposalSelection(
  resume: Resume,
  proposal: AiProposal,
): ProposalSelection {
  const experienceBullets: Record<string, boolean[]> = {};
  for (const entry of resume.experience) {
    const proposed =
      proposal.experience.find((item) => item.id === entry.id)?.bullets ?? [];
    const count = Math.max(entry.bullets.length, proposed.length);
    experienceBullets[entry.id] = Array.from({ length: count }, () => true);
  }
  const projectBullets: Record<string, boolean[]> = {};
  for (const project of resume.projects) {
    const proposed =
      (proposal.projects ?? []).find((item) => item.id === project.id)
        ?.bullets ?? [];
    const count = Math.max(project.bullets.length, proposed.length);
    projectBullets[project.id] = Array.from({ length: count }, () => true);
  }
  return {
    summary: true,
    experienceBullets,
    projectBullets,
  };
}

function mergeBulletsWithSelection(
  original: string[],
  proposed: string[],
  selected?: boolean[],
): string[] {
  if (!selected || selected.every(Boolean)) {
    return [...proposed];
  }
  const count = Math.max(original.length, proposed.length);
  const merged: string[] = [];
  for (let index = 0; index < count; index++) {
    const useProposed = selected[index] ?? true;
    if (useProposed) {
      if (index < proposed.length) merged.push(proposed[index]);
    } else if (index < original.length) {
      merged.push(original[index]);
    }
  }
  return merged;
}

export function applyPartialProposal(
  resume: Resume,
  proposal: AiProposal,
  selection: ProposalSelection,
): Resume {
  const valid = validateProposal(proposal, resume);
  return {
    ...resume,
    summary: selection.summary ? valid.summary : resume.summary,
    experience: resume.experience.map((entry) => ({
      ...entry,
      bullets: mergeBulletsWithSelection(
        entry.bullets,
        valid.experience.find((suggestion) => suggestion.id === entry.id)!
          .bullets,
        selection.experienceBullets[entry.id],
      ),
    })),
    projects: resume.projects.map((project) => {
      const suggestion = (valid.projects ?? []).find(
        (item) => item.id === project.id,
      );
      if (!suggestion) return project;
      return {
        ...project,
        bullets: mergeBulletsWithSelection(
          project.bullets,
          suggestion.bullets,
          selection.projectBullets[project.id],
        ),
      };
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function validateRoleTailorProposal(
  value: unknown,
  resume: Resume,
  expectedEntryId: string,
): RoleTailorProposal {
  const proposal = roleTailorProposalSchema.parse(value);
  const exists =
    resume.experience.some((e) => e.id === expectedEntryId) ||
    resume.projects.some((p) => p.id === expectedEntryId);
  if (!exists || proposal.entryId !== expectedEntryId) {
    throw new Error(
      "AI returned a role proposal for a different entry. Nothing has been changed.",
    );
  }
  return proposal;
}

export function applyRoleTailorProposal(
  resume: Resume,
  proposal: RoleTailorProposal,
  selectedBullets?: boolean[],
): Resume {
  const valid = validateRoleTailorProposal(
    structuredClone(proposal),
    resume,
    proposal.entryId,
  );
  return {
    ...resume,
    experience: resume.experience.map((entry) =>
      entry.id === valid.entryId
        ? {
            ...entry,
            bullets: mergeBulletsWithSelection(
              entry.bullets,
              valid.bullets,
              selectedBullets,
            ),
          }
        : entry,
    ),
    projects: resume.projects.map((project) =>
      project.id === valid.entryId
        ? {
            ...project,
            bullets: mergeBulletsWithSelection(
              project.bullets,
              valid.bullets,
              selectedBullets,
            ),
          }
        : project,
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function mergeAiImportedStructure(
  baseResume: Resume,
  structured: ImportedStructureProposal,
): Resume {
  const valid = importedStructureProposalSchema.parse(structured);
  return resumeSchema.parse({
    ...baseResume,
    basics: {
      ...baseResume.basics,
      headline: valid.headline.trim() || baseResume.basics.headline,
    },
    summary: valid.summary.trim() || baseResume.summary,
    experience: valid.experience.map((exp) => ({
      id: crypto.randomUUID(),
      role: exp.role,
      company: exp.company,
      location: exp.location,
      startDate: exp.startDate,
      endDate: exp.endDate,
      bullets: exp.bullets,
    })),
    projects: valid.projects.map((proj) => ({
      id: crypto.randomUUID(),
      name: proj.name,
      subtitle: proj.subtitle,
      url: "",
      startDate: proj.startDate,
      endDate: proj.endDate,
      bullets: proj.bullets,
    })),
    education: valid.education.map((edu) => ({
      id: crypto.randomUUID(),
      school: edu.school,
      degree: edu.degree,
      graduation: edu.graduation,
    })),
    certifications: valid.certifications.map((cert) => ({
      id: crypto.randomUUID(),
      name: cert.name,
      issuer: cert.issuer,
      date: cert.date,
      url: "",
    })),
    skills: valid.skills,
    skillGroups: valid.skillGroups.map((group) => ({
      id: crypto.randomUUID(),
      category: group.category,
      items: group.items,
    })),
    updatedAt: new Date().toISOString(),
  });
}

export function applyProposal(resume: Resume, proposal: AiProposal): Resume {
  const valid = validateProposal(proposal, resume);
  return applyPartialProposal(
    resume,
    valid,
    defaultProposalSelection(resume, valid),
  );
}

export function projectRoleLabel(
  project: Pick<Project, "name" | "subtitle">,
): string {
  return project.subtitle.trim() || project.name.trim();
}

function findAprOwner(
  resume: Resume,
  entryId: string,
): { role: string; bullets: string[]; kind: "experience" | "project" } | null {
  const exp = resume.experience.find((entry) => entry.id === entryId);
  if (exp) return { role: exp.role, bullets: exp.bullets, kind: "experience" };
  const proj = resume.projects.find((entry) => entry.id === entryId);
  if (proj) {
    return {
      role: projectRoleLabel(proj),
      bullets: proj.bullets,
      kind: "project",
    };
  }
  return null;
}

export function validateAprTarget(value: unknown, resume?: Resume): AprTarget {
  const target = aprTargetSchema.parse(value);
  if (resume) {
    const owner = findAprOwner(resume, target.experienceId);
    if (
      resume.id !== target.resumeId ||
      !owner ||
      owner.role !== target.role ||
      owner.bullets[target.bulletIndex] !== target.bullet
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
    analysis.target.bullet !== expectedTarget.bullet ||
    (analysis.target.focusKeyword ?? undefined) !==
      (expectedTarget.focusKeyword ?? undefined)
  ) {
    throw new Error(
      "Copilot returned an analysis for a different accomplishment. Nothing has been changed.",
    );
  }
  return analysis;
}

export function normalizeAprAnswers(
  questions: string[],
  answers: string[],
): AprQuestionAnswer[] {
  const validQuestions = z.array(nonemptyBulletField).max(5).parse(questions);
  if (new Set(validQuestions).size !== validQuestions.length) {
    throw new Error("APR questions must be unique.");
  }
  if (answers.length !== validQuestions.length) {
    throw new Error("APR answers must match the current question list.");
  }
  return validQuestions.flatMap((question, index) => {
    const answer = bulletField.parse(answers[index]).trim();
    return answer ? [{ question, answer }] : [];
  });
}

export function validateAprQuestionAnswers(
  questions: string[],
  value: unknown,
): AprQuestionAnswer[] {
  const validQuestions = z.array(nonemptyBulletField).max(5).parse(questions);
  if (new Set(validQuestions).size !== validQuestions.length) {
    throw new Error("APR questions must be unique.");
  }
  const answers = z.array(aprQuestionAnswerSchema).min(1).max(5).parse(value);
  const seen = new Set<string>();
  let previousIndex = -1;
  for (const pair of answers) {
    if (pair.answer !== pair.answer.trim()) {
      throw new Error("APR answers must be trimmed.");
    }
    const index = validQuestions.indexOf(pair.question);
    if (index < 0) throw new Error("APR answer contains an unknown question.");
    if (seen.has(pair.question)) {
      throw new Error("APR answer questions must not be duplicated.");
    }
    if (index <= previousIndex) {
      throw new Error("APR answers must follow question display order.");
    }
    seen.add(pair.question);
    previousIndex = index;
  }
  return answers;
}

export function validateAprRefinement(
  value: unknown,
  expectedTarget: AprTarget,
  expectedAnswers: AprQuestionAnswer[],
): AprRefinement {
  const refinement = aprRefinementSchema.parse(value);
  validateAprTarget(refinement.target);
  if (
    refinement.target.resumeId !== expectedTarget.resumeId ||
    refinement.target.experienceId !== expectedTarget.experienceId ||
    refinement.target.bulletIndex !== expectedTarget.bulletIndex ||
    refinement.target.role !== expectedTarget.role ||
    refinement.target.bullet !== expectedTarget.bullet ||
    (refinement.target.focusKeyword ?? undefined) !==
      (expectedTarget.focusKeyword ?? undefined)
  ) {
    throw new Error(
      "Copilot returned a refinement for a different accomplishment. Nothing has been changed.",
    );
  }
  if (JSON.stringify(refinement.answers) !== JSON.stringify(expectedAnswers)) {
    throw new Error(
      "Copilot returned a refinement for different answers. Nothing has been changed.",
    );
  }
  if (refinement.rewrite === expectedTarget.bullet) {
    throw new Error("Copilot did not provide a changed, nonempty rewrite.");
  }
  return refinement;
}

export function applyAprRewrite(
  resume: Resume,
  target: AprTarget,
  rewrite: string,
): Resume {
  const validTarget = validateAprTarget(target, resume);
  const validRewrite = bulletField.parse(rewrite);
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
    projects: resume.projects.map((project) =>
      project.id === validTarget.experienceId
        ? {
            ...project,
            bullets: project.bullets.map((text, index) =>
              index === validTarget.bulletIndex ? validRewrite : text,
            ),
          }
        : project,
    ),
    updatedAt: new Date().toISOString(),
  };
}
