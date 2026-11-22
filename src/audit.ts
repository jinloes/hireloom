import {
  estimatePageCount,
  jobKeywords,
  resumeTotalSkillCount,
  type Resume,
} from "./model";

export type AuditCategory =
  "Completeness" | "Impact & Verbs" | "Formatting & Length" | "Role Alignment";

export type AuditStatus = "pass" | "warn" | "info";

export type AuditItem = {
  id: string;
  category: AuditCategory;
  status: AuditStatus;
  label: string;
  detail: string;
  targetTab: "content" | "copilot" | "style";
};

export type ResumeAudit = {
  passed: number;
  total: number;
  warnings: number;
  items: AuditItem[];
};

const WEAK_OPENERS = [
  /^responsible\s+for\b/i,
  /^helped\s+(?:with|to)?\b/i,
  /^worked\s+(?:on|with)\b/i,
  /^assisted\s+(?:with|in)?\b/i,
  /^tasked\s+with\b/i,
  /^duties\s+included\b/i,
  /^participated\s+in\b/i,
  /^involved\s+in\b/i,
  /^was\s+responsible\b/i,
];

const FIRST_PERSON = /(?:^|[^a-zA-Z])(?:I|me|my|myself|we|our)(?:$|[^a-zA-Z])/;

const OUTCOME_SIGNAL =
  /(?:\b\d+(?:[.,]\d+)?%|\$\s?\d+|\b\d+\s*(?:x|ms|s|sec|seconds|mins|minutes|hours|days|weeks|months|users|customers|clients|teams|engineers|services|projects|countries|markets|requests|leads|tickets)\b|\b(?:reduced|increased|improved|accelerated|cut|grew|saved|launched|shipped|eliminated|automated|scaled|boosted|lowered|raised|streamlined|delivered|validated|achieved|resulting\s+in|leading\s+to)\b)/i;

function parseSortableYearMonth(value: string): number | null {
  if (!value.trim()) return null;
  if (value.trim().toLowerCase() === "present") {
    const now = new Date();
    return now.getFullYear() * 12 + now.getMonth();
  }
  const ym = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value.trim());
  if (ym) return Number(ym[1]) * 12 + (Number(ym[2]) - 1);
  const yearOnly = /^(\d{4})$/.exec(value.trim());
  if (yearOnly) return Number(yearOnly[1]) * 12;
  return null;
}

function collectNonEmptyBullets(resume: Resume): string[] {
  return [
    ...resume.experience.flatMap((entry) => entry.bullets),
    ...resume.projects.flatMap((project) => project.bullets),
    ...resume.customSections.flatMap((section) =>
      section.entries.flatMap((entry) => entry.bullets),
    ),
  ]
    .map((text) => text.trim())
    .filter(Boolean);
}

/**
 * Deterministic, local resume quality checks across Completeness, Impact & Verbs,
 * Formatting & Length, and Role Alignment. Never claims a proprietary ATS hiring score.
 */
export function auditResume(resume: Resume): ResumeAudit {
  const items: AuditItem[] = [];
  const bullets = collectNonEmptyBullets(resume);

  // 1. Completeness
  const hasNameAndEmail = Boolean(
    resume.basics.name.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resume.basics.email.trim()),
  );
  items.push({
    id: "contact-essentials",
    category: "Completeness",
    status: hasNameAndEmail ? "pass" : "warn",
    label: "Name and valid email",
    detail: hasNameAndEmail
      ? "Header includes full name and a valid email address."
      : "Add your full name and a valid email address in Personal details.",
    targetTab: "content",
  });

  const hasHeadline = Boolean(resume.basics.headline.trim());
  items.push({
    id: "headline",
    category: "Completeness",
    status: hasHeadline ? "pass" : "warn",
    label: "Target role headline",
    detail: hasHeadline
      ? "Professional headline clearly frames your target role."
      : "Add a concise professional headline matching the role you want.",
    targetTab: "content",
  });

  const summaryLen = resume.summary.trim().length;
  const summaryGood = summaryLen >= 40 && summaryLen <= 650;
  items.push({
    id: "summary-length",
    category: "Completeness",
    status: summaryGood ? "pass" : "warn",
    label: "Focused profile summary",
    detail:
      summaryLen === 0
        ? "Write a 2–4 line summary connecting your real background to what's next."
        : summaryLen < 40
          ? "Expand your summary slightly (aim for 40–500 characters)."
          : summaryLen > 650
            ? "Trim your summary under ~650 characters so recruiters reach your experience fast."
            : "Summary length is concise and scannable.",
    targetTab: "content",
  });

  const hasWorkOrProjects =
    resume.experience.some(
      (entry) =>
        entry.role.trim() &&
        entry.company.trim() &&
        entry.bullets.some((b) => b.trim()),
    ) ||
    resume.projects.some(
      (proj) => proj.name.trim() && proj.bullets.some((b) => b.trim()),
    );
  items.push({
    id: "experience-or-projects",
    category: "Completeness",
    status: hasWorkOrProjects ? "pass" : "warn",
    label: "Experience or project accomplishments",
    detail: hasWorkOrProjects
      ? "Includes concrete experience or project highlights."
      : "Add at least one experience role or project with accomplishment bullets.",
    targetTab: "content",
  });

  const totalSkills = resumeTotalSkillCount(resume);
  items.push({
    id: "skills-coverage",
    category: "Completeness",
    status: totalSkills >= 5 ? "pass" : totalSkills >= 3 ? "info" : "warn",
    label: "Relevant skills listed",
    detail:
      totalSkills >= 5
        ? `${totalSkills} skills listed${resume.skillGroups.length ? " with categorized groups" : ""}.`
        : totalSkills >= 3
          ? `${totalSkills} skills listed; grouping 5+ skills by category improves scanability.`
          : "Add at least 3–5 skills you can discuss confidently in interviews.",
    targetTab: "content",
  });

  // 2. Impact & Verbs
  if (bullets.length > 0) {
    const weakCount = bullets.filter((b) =>
      WEAK_OPENERS.some((pattern) => pattern.test(b)),
    ).length;
    items.push({
      id: "strong-action-verbs",
      category: "Impact & Verbs",
      status: weakCount === 0 ? "pass" : "warn",
      label: "Strong leading action verbs",
      detail:
        weakCount === 0
          ? "No bullets open with passive phrases like “Responsible for” or “Helped with”."
          : `${weakCount} bullet${weakCount === 1 ? "" : "s"} start with passive phrasing (“Responsible for”, “Worked on”, “Helped”). Lead with your direct action or coach with APR.`,
      targetTab: weakCount === 0 ? "content" : "copilot",
    });

    const outcomeCount = bullets.filter((b) => OUTCOME_SIGNAL.test(b)).length;
    const outcomeRatio = outcomeCount / bullets.length;
    items.push({
      id: "supported-outcomes",
      category: "Impact & Verbs",
      status: outcomeRatio >= 0.4 ? "pass" : "warn",
      label: "Supported outcomes & scope",
      detail:
        outcomeRatio >= 0.4
          ? `${outcomeCount} of ${bullets.length} bullets state concrete outcomes, scope, or metrics.`
          : `Only ${outcomeCount} of ${bullets.length} bullets show clear outcomes or scope. Use APR coaching to surface real results—never invent metrics.`,
      targetTab: outcomeRatio >= 0.4 ? "content" : "copilot",
    });

    const verbCounts = new Map<string, number>();
    for (const b of bullets) {
      const firstWord = b
        .replace(/^[^a-zA-Z]+/, "")
        .split(/\s+/)[0]
        ?.toLowerCase();
      if (firstWord && firstWord.length > 2) {
        verbCounts.set(firstWord, (verbCounts.get(firstWord) ?? 0) + 1);
      }
    }
    const repeated = [...verbCounts.entries()]
      .filter(([, count]) => count >= 3)
      .map(([word, count]) => `“${word}” (${count}×)`);
    items.push({
      id: "verb-variety",
      category: "Impact & Verbs",
      status: repeated.length === 0 ? "pass" : "info",
      label: "Varied bullet starters",
      detail:
        repeated.length === 0
          ? "Opening action verbs are varied across accomplishments."
          : `Repeated opening verbs: ${repeated.join(", ")}. Varying verbs keeps your story engaging.`,
      targetTab: "content",
    });

    const pronounBullets = bullets.filter((b) => FIRST_PERSON.test(b)).length;
    const summaryPronouns = FIRST_PERSON.test(resume.summary);
    items.push({
      id: "pronoun-free",
      category: "Impact & Verbs",
      status: pronounBullets === 0 && !summaryPronouns ? "pass" : "info",
      label: "Implied first-person voice",
      detail:
        pronounBullets === 0 && !summaryPronouns
          ? "Uses standard resume voice without “I”, “my”, or “we”."
          : "Consider removing first-person pronouns (“I”, “my”, “we”) for crisp resume style.",
      targetTab: "content",
    });
  }

  // 3. Formatting & Length
  const longBullets = bullets.filter((b) => b.length > 220).length;
  const tinyBullets = bullets.filter((b) => b.length < 25).length;
  items.push({
    id: "bullet-length",
    category: "Formatting & Length",
    status:
      bullets.length > 0 && longBullets === 0 && tinyBullets === 0
        ? "pass"
        : bullets.length === 0
          ? "info"
          : "warn",
    label: "1–2 line bullet length",
    detail:
      bullets.length === 0
        ? "Add accomplishment bullets (aim for 50–200 characters each)."
        : longBullets > 0
          ? `${longBullets} bullet${longBullets === 1 ? " exceeds" : "s exceed"} 220 characters; split or tighten to 1–2 lines.`
          : tinyBullets > 0
            ? `${tinyBullets} bullet${tinyBullets === 1 ? " is" : "s are"} under 25 characters; add project context and impact.`
            : "All bullets fall within a readable 1–2 line range.",
    targetTab: "content",
  });

  // Date chronology & gaps check
  let invertedDates = 0;
  const ranges: { start: number; end: number }[] = [];
  for (const exp of resume.experience) {
    const s = parseSortableYearMonth(exp.startDate);
    const e = parseSortableYearMonth(exp.endDate);
    if (s !== null && e !== null) {
      if (e < s) invertedDates++;
      else ranges.push({ start: s, end: e });
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  let largestGapMonths = 0;
  let maxEndSoFar = ranges[0]?.end ?? null;
  for (let i = 1; i < ranges.length; i++) {
    if (
      maxEndSoFar !== null &&
      ranges[i].start - maxEndSoFar > largestGapMonths
    ) {
      largestGapMonths = ranges[i].start - maxEndSoFar;
    }
    if (maxEndSoFar === null || ranges[i].end > maxEndSoFar) {
      maxEndSoFar = ranges[i].end;
    }
  }
  items.push({
    id: "date-consistency",
    category: "Formatting & Length",
    status: invertedDates > 0 ? "warn" : largestGapMonths > 6 ? "info" : "pass",
    label: "Timeline consistency",
    detail:
      invertedDates > 0
        ? `${invertedDates} experience entry has an end date earlier than its start date.`
        : largestGapMonths > 6
          ? `Detected a ${largestGapMonths}-month gap between roles—fine if intentional; add context if relevant.`
          : "Experience dates are chronologically consistent.",
    targetTab: "content",
  });

  const pagination = estimatePageCount(resume);
  const sparseSpillover =
    pagination.pages > 1 && pagination.fillRatioLastPage < 0.28;
  items.push({
    id: "page-fit",
    category: "Formatting & Length",
    status: sparseSpillover ? "warn" : "pass",
    label: `${resume.pageSize === "letter" ? "US Letter" : "A4"} page fit`,
    detail: sparseSpillover
      ? `Content spills onto page ${pagination.pages} (~${Math.round(pagination.fillRatioLastPage * 100)}% full). Try Compact density in Design or trim 2–3 bullets.`
      : `Estimated ${pagination.pages} page${pagination.pages === 1 ? "" : "s"} (${resume.density} density) without awkward trailing spillover.`,
    targetTab: "style",
  });

  // 4. Role Alignment
  if (resume.jobDescription.trim()) {
    const keywords = jobKeywords(resume).filter((k) => !k.skipped);
    const matched = keywords.filter((k) => k.matched).length;
    const missing = keywords.length - matched;
    items.push({
      id: "jd-keyword-alignment",
      category: "Role Alignment",
      status:
        keywords.length === 0
          ? "info"
          : missing === 0 || matched / keywords.length >= 0.6
            ? "pass"
            : "warn",
      label: "Job description keyword triage",
      detail:
        keywords.length === 0
          ? "Job description added; review your summary and bullets against its core requirements."
          : `${matched} of ${keywords.length} active role terms matched (${missing} untriaged—add skills you truly have or skip irrelevant ones in Copilot).`,
      targetTab: "copilot",
    });
  }

  const passed = items.filter((item) => item.status === "pass").length;
  const warnings = items.filter((item) => item.status === "warn").length;
  return {
    passed,
    total: items.length,
    warnings,
    items,
  };
}
