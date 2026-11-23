import {
  extractJobKeywords,
  normalizeKeyword,
  type JobKeyword,
} from "../keywords";
import type { Resume } from "./schemas";

export type { JobKeyword };

export function resumeTotalSkillCount(resume: Resume): number {
  const flat = resume.skills.filter((skill) => skill.trim()).length;
  const grouped = resume.skillGroups.reduce(
    (sum, group) => sum + group.items.filter((item) => item.trim()).length,
    0,
  );
  return flat + grouped;
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
      complete:
        resume.experience.some(
          (entry) =>
            entry.company.trim() &&
            entry.role.trim() &&
            entry.bullets.some((text) => text.trim()),
        ) ||
        resume.projects.some(
          (project) =>
            project.name.trim() && project.bullets.some((text) => text.trim()),
        ),
    },
    {
      label: "At least three skills",
      complete: resumeTotalSkillCount(resume) >= 3,
    },
  ];
}

export function jobKeywords(resume: Resume): JobKeyword[] {
  return extractJobKeywords(resume);
}

export function skipJobKeyword(resume: Resume, term: string): Resume {
  const normalized = normalizeKeyword(term);
  if (
    !normalized ||
    resume.skippedKeywords.includes(normalized) ||
    resume.skippedKeywords.length >= 200
  ) {
    return resume;
  }
  return {
    ...resume,
    skippedKeywords: [...resume.skippedKeywords, normalized],
    updatedAt: new Date().toISOString(),
  };
}

export function restoreJobKeyword(resume: Resume, term: string): Resume {
  const normalized = normalizeKeyword(term);
  return {
    ...resume,
    skippedKeywords: resume.skippedKeywords.filter(
      (item) => item !== normalized,
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function addKeywordToSkills(resume: Resume, term: string): Resume {
  const cleaned = term.trim().slice(0, 100);
  if (!cleaned) return resume;
  const lower = cleaned.toLowerCase();
  const alreadyPresent =
    resume.skills.some((skill) => skill.trim().toLowerCase() === lower) ||
    resume.skillGroups.some((group) =>
      group.items.some((item) => item.trim().toLowerCase() === lower),
    );
  const nextSkipped = resume.skippedKeywords.filter(
    (item) => item !== normalizeKeyword(cleaned),
  );
  if (alreadyPresent || resume.skills.length >= 100) {
    return nextSkipped.length !== resume.skippedKeywords.length
      ? {
          ...resume,
          skippedKeywords: nextSkipped,
          updatedAt: new Date().toISOString(),
        }
      : resume;
  }
  const nonEmptySkills = resume.skills.filter((skill) => skill.trim());
  return {
    ...resume,
    skills: [...nonEmptySkills, cleaned],
    skippedKeywords: nextSkipped,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Deterministic visual line-budget estimate for page-overflow guidance and
 * environments where DOM layout measurement is unavailable (e.g. unit tests).
 */
export function estimatePageCount(resume: Resume): {
  pages: number;
  fillRatioLastPage: number;
  lineCapacityPerPage: number;
  estimatedLines: number;
} {
  const baseCapacity = resume.pageSize === "letter" ? 52 : 56;
  const densityMultiplier =
    resume.density === "compact"
      ? 1.24
      : resume.density === "spacious"
        ? 0.86
        : 1;
  const lineCapacityPerPage = Math.round(baseCapacity * densityMultiplier);
  const charsPerLine =
    resume.density === "compact" ? 96 : resume.density === "spacious" ? 80 : 88;

  let lines = 5; // Header block
  if (resume.summary.trim()) {
    lines += 2 + Math.ceil(resume.summary.trim().length / charsPerLine);
  }
  if (resume.experience.length > 0) {
    lines += 2;
    for (const entry of resume.experience) {
      lines += 2.2;
      for (const b of entry.bullets) {
        if (b.trim())
          lines += Math.max(1, Math.ceil(b.trim().length / (charsPerLine - 4)));
      }
    }
  }
  if (resume.projects.length > 0) {
    lines += 2;
    for (const proj of resume.projects) {
      lines += 2;
      for (const b of proj.bullets) {
        if (b.trim())
          lines += Math.max(1, Math.ceil(b.trim().length / (charsPerLine - 4)));
      }
    }
  }
  if (resume.education.length > 0) {
    lines += 2 + resume.education.length * 2.1;
  }
  if (resume.certifications.length > 0) {
    lines += 2 + resume.certifications.length * 1.4;
  }
  const hasSkills =
    resume.skills.some((s) => s.trim()) ||
    resume.skillGroups.some((g) => g.items.some((i) => i.trim()));
  if (hasSkills) {
    lines += 2;
    if (resume.skillGroups.length > 0) {
      for (const group of resume.skillGroups) {
        const text = `${group.category}: ${group.items.join(" · ")}`;
        if (text.trim())
          lines += Math.max(1, Math.ceil(text.length / charsPerLine));
      }
    }
    if (resume.skills.some((s) => s.trim())) {
      lines += Math.max(
        1,
        Math.ceil(resume.skills.join(" · ").length / charsPerLine),
      );
    }
  }
  for (const section of resume.customSections) {
    if (!section.entries.length) continue;
    lines += 2;
    for (const entry of section.entries) {
      lines += 1.8;
      for (const b of entry.bullets) {
        if (b.trim())
          lines += Math.max(1, Math.ceil(b.trim().length / (charsPerLine - 4)));
      }
    }
  }

  const estimatedLines = Math.ceil(lines);
  const pages = Math.max(1, Math.ceil(estimatedLines / lineCapacityPerPage));
  const remainder = estimatedLines % lineCapacityPerPage;
  const fillRatioLastPage =
    remainder === 0 ? 1 : Number((remainder / lineCapacityPerPage).toFixed(2));
  return { pages, fillRatioLastPage, lineCapacityPerPage, estimatedLines };
}

/**
 * Validates and normalizes an external HTTP/HTTPS URL for safe linking in PDF,
 * DOCX, and preview surfaces. Rejects unsafe schemes (`javascript:`, `data:`,
 * `file:`, etc.), credentials, control characters, and plain email addresses.
 */
export function normalizeExternalUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500) return null;
  if (/[\u0000-\u0020\u007f]/.test(trimmed)) return null;

  const firstSlash = trimmed.indexOf("/");
  const firstColon = trimmed.indexOf(":");
  const hasExplicitScheme =
    firstColon > 0 && (firstSlash === -1 || firstColon < firstSlash);

  if (hasExplicitScheme) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return null;
      }
      if (!parsed.hostname || parsed.username || parsed.password) {
        return null;
      }
      return parsed.href;
    } catch {
      return null;
    }
  }

  if (trimmed.includes("@")) return null;
  if (
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:[/?#].*)?$/i.test(
      trimmed,
    )
  ) {
    return null;
  }
  try {
    const parsed = new URL(`https://${trimmed}`);
    if (
      !parsed.hostname.includes(".") ||
      !/\.[a-z]{2,}$/i.test(parsed.hostname) ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

export function countPdfPages(bytes: Uint8Array): number {
  const raw = new TextDecoder("latin1").decode(bytes);
  const matches = raw.match(/\/Type\s*\/Page\b(?!s)/g);
  return Math.max(1, matches ? matches.length : 1);
}
