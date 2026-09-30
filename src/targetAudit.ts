import { jobKeywords, type Resume } from "./model";
import type { ContentSection } from "./components/Editor";

export type AuditCategory =
  | "Setup"
  | "Content quality"
  | "Evidence"
  | "Job alignment"
  | "ATS format"
  | "Consistency";

export type AuditFinding = {
  id: string;
  category: AuditCategory;
  level: "attention" | "improve";
  title: string;
  observed: string;
  why: string;
  action: string;
  target:
    | { workspace: "copilot"; focusId: string }
    | {
        workspace: "content";
        section: ContentSection;
        focusId?: string;
      };
};

const actionVerb =
  /^(achieved|built|created|delivered|designed|developed|drove|established|grew|implemented|improved|increased|launched|led|managed|reduced|resolved|saved|shipped|streamlined)\b/i;
const number = /\b(?:\d+(?:[.,]\d+)?%?|\$\d+)\b/;

function phraseIn(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(text);
}

function narrative(resume: Resume): string {
  return [
    resume.basics.headline,
    resume.summary,
    ...resume.experience.flatMap((entry) => [
      entry.role,
      entry.company,
      ...entry.bullets,
    ]),
    ...resume.projects.flatMap((entry) => [
      entry.name,
      entry.role,
      ...entry.bullets,
    ]),
    ...resume.volunteer.flatMap((entry) => [
      entry.organization,
      entry.role,
      ...entry.bullets,
    ]),
  ].join(" ");
}

export function auditResume(resume: Resume): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const add = (finding: AuditFinding) => findings.push(finding);

  if (!resume.targetJob.title.trim())
    add({
      id: "target-title",
      category: "Setup",
      level: "attention",
      title: "Name the target role",
      observed: "No target job title is saved.",
      why: "A title keeps this version focused and makes the audit easier to interpret.",
      action: "Add the exact role title from the posting.",
      target: { workspace: "copilot", focusId: "target-job-title" },
    });
  if (!resume.targetJob.description.trim())
    add({
      id: "target-description",
      category: "Setup",
      level: "attention",
      title: "Add the job description",
      observed: "There is no job description to compare with this resume.",
      why: "Job-alignment checks need the posting text; Hireloom does not fetch it automatically.",
      action: "Paste the description for this application.",
      target: { workspace: "copilot", focusId: "target-job-description" },
    });
  if (!resume.basics.name.trim() || !resume.basics.headline.trim())
    add({
      id: "identity",
      category: "Content quality",
      level: "attention",
      title: "Complete the resume heading",
      observed: `${resume.basics.name.trim() ? "Headline" : "Name"} is missing from the heading.`,
      why: "The first lines should immediately identify the candidate and professional direction.",
      action: "Complete the name and professional headline.",
      target: {
        workspace: "content",
        section: "personal",
        focusId: resume.basics.name.trim() ? "headline" : "name",
      },
    });
  if (resume.summary.trim().length < 80)
    add({
      id: "summary-depth",
      category: "Content quality",
      level: "improve",
      title: "Strengthen the summary",
      observed: resume.summary.trim()
        ? `The summary is ${resume.summary.trim().length} characters.`
        : "The summary is empty.",
      why: "A concise summary should connect the candidate's real experience to the target role.",
      action: "Write two or three fact-based sentences tailored to the role.",
      target: { workspace: "content", section: "summary", focusId: "summary" },
    });
  if (!resume.experience.length)
    add({
      id: "experience-empty",
      category: "Content quality",
      level: "attention",
      title: "Add relevant experience",
      observed: "No work experience is listed.",
      why: "Recruiters need evidence of responsibilities and outcomes, including internships or freelance work.",
      action: "Add the most relevant real experience.",
      target: {
        workspace: "content",
        section: "experience",
        focusId: "add-experience",
      },
    });

  const bullets = resume.experience.flatMap((entry) =>
    entry.bullets.map((text, index) => ({ entry, text, index })),
  );
  const weakBullet = bullets.find(
    ({ text }) => text.trim() && !actionVerb.test(text.trim()),
  );
  if (weakBullet)
    add({
      id: "bullet-action",
      category: "Evidence",
      level: "improve",
      title: "Lead highlights with clear actions",
      observed: `“${weakBullet.text.trim().slice(0, 90)}${weakBullet.text.trim().length > 90 ? "…" : ""}” does not start with a clear action verb.`,
      why: "Action-led highlights make ownership easier to scan.",
      action: "Rewrite the highlight using only facts you can support.",
      target: {
        workspace: "content",
        section: "experience",
        focusId: `highlight-${weakBullet.entry.id}-${weakBullet.index}`,
      },
    });
  if (bullets.length && !bullets.some(({ text }) => number.test(text)))
    add({
      id: "evidence-specificity",
      category: "Evidence",
      level: "improve",
      title: "Add supported specifics",
      observed:
        "No experience highlight includes a number or measurable scope.",
      why: "Specific scale, frequency, or outcomes can make evidence more concrete.",
      action:
        "Add a truthful metric or scope where one is already known; do not invent one.",
      target: {
        workspace: "content",
        section: "experience",
        focusId: bullets[0]
          ? `highlight-${bullets[0].entry.id}-${bullets[0].index}`
          : "add-experience",
      },
    });

  const keywords = jobKeywords(resume);
  const narrativeText = narrative(resume);
  const listedOnly = keywords
    .filter(
      ({ term }) =>
        resume.skills.some((skill) => phraseIn(skill, term)) &&
        !phraseIn(narrativeText, term),
    )
    .map(({ term }) => term);
  const missing = keywords
    .filter(({ matched }) => !matched)
    .map(({ term }) => term);
  if (listedOnly.length)
    add({
      id: "skills-only",
      category: "Job alignment",
      level: "improve",
      title: "Support listed skills with evidence",
      observed: `${listedOnly.slice(0, 5).join(", ")} ${listedOnly.length === 1 ? "appears" : "appear"} only in the skills list.`,
      why: "A skill is more credible when the resume shows where it was used.",
      action:
        "If supported by your history, connect these skills to an existing highlight.",
      target: { workspace: "content", section: "skills" },
    });
  if (missing.length)
    add({
      id: "keywords-missing",
      category: "Job alignment",
      level: "improve",
      title: "Review unmatched role language",
      observed: `${missing.slice(0, 6).join(", ")} ${missing.length === 1 ? "is" : "are"} present in the posting but not shown in the resume.`,
      why: "Relevant language can help reviewers recognize a genuine match.",
      action:
        "Review these terms and add only those your experience actually supports.",
      target: { workspace: "content", section: "experience" },
    });

  const inconsistentDate = resume.experience.find(
    (entry) =>
      /^\d{4}-\d{2}$/.test(entry.startDate) &&
      /^\d{4}-\d{2}$/.test(entry.endDate) &&
      entry.startDate > entry.endDate,
  );
  if (inconsistentDate)
    add({
      id: "date-order",
      category: "Consistency",
      level: "attention",
      title: "Fix a reversed date range",
      observed: `${inconsistentDate.role || "An experience"} ends before it starts.`,
      why: "Conflicting dates can make work history difficult to trust or understand.",
      action: "Correct the start or end date.",
      target: {
        workspace: "content",
        section: "experience",
        focusId: `job-title-${inconsistentDate.id}`,
      },
    });

  if (resume.targetJob.sourceUrl.trim()) {
    try {
      const url = new URL(resume.targetJob.sourceUrl);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      add({
        id: "source-url",
        category: "ATS format",
        level: "improve",
        title: "Check the job-posting link",
        observed: "The saved source is not a valid HTTP or HTTPS URL.",
        why: "A working source helps you return to the original posting without placing it on the resume.",
        action: "Correct the source URL or leave it blank.",
        target: { workspace: "copilot", focusId: "target-job-source-url" },
      });
    }
  }

  return findings;
}
