import {
  createResume,
  resumeSchema,
  type CustomSection,
  type Resume,
} from "./model";
import {
  extractDocxLines,
  extractPdfLines,
  MAX_RESUME_IMPORT_BYTES,
  redactImportLinesForAi,
} from "./import/extractText";
import {
  classifyHeading,
  parseCertificationBlocks,
  parseEducationBlocks,
  parseExperienceBlocks,
  parseProjectBlocks,
  parseSkillsBlocks,
  type SectionKind,
} from "./import/parseSections";

export {
  extractDocxLines,
  extractPdfLines,
  MAX_RESUME_IMPORT_BYTES,
  redactImportLinesForAi,
};

export type ImportedResumeDraft = {
  resume: Resume;
  rawLines: string[];
  warnings: string[];
  sourceFormat: "pdf" | "docx";
  stats: {
    experiences: number;
    projects: number;
    education: number;
    certifications: number;
    skills: number;
  };
};

export function parseResumeLinesToDraft(
  lines: string[],
  filename: string,
  sourceFormat: "pdf" | "docx",
): ImportedResumeDraft {
  const warnings: string[] = [];
  const baseTitle = filename
    .replace(/\.(pdf|docx)$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  const resume = createResume();
  resume.title = (baseTitle || "Imported resume").slice(0, 120);

  if (lines.length === 0) {
    warnings.push(
      "No selectable text was found. Scanned image PDFs cannot be parsed without OCR.",
    );
    return {
      resume: resumeSchema.parse(resume),
      rawLines: [],
      warnings,
      sourceFormat,
      stats: {
        experiences: 0,
        projects: 0,
        education: 0,
        certifications: 0,
        skills: 0,
      },
    };
  }

  const buckets: Record<Exclude<SectionKind, "custom">, string[]> = {
    header: [],
    summary: [],
    experience: [],
    projects: [],
    education: [],
    certifications: [],
    skills: [],
  };
  const customBuckets: { title: string; lines: string[] }[] = [];

  let currentSection: SectionKind = "header";
  for (const line of lines) {
    const heading = classifyHeading(line);
    if (heading) {
      currentSection = heading.kind;
      if (heading.kind === "custom") {
        customBuckets.push({ title: heading.title, lines: [] });
      }
      continue;
    }
    if (currentSection === "custom") {
      customBuckets[customBuckets.length - 1]?.lines.push(line);
    } else {
      buckets[currentSection].push(line);
    }
  }

  // Parse header basics
  const headerText = buckets.header.join("  ");
  const emailMatch = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/.exec(
    headerText,
  );
  if (emailMatch) resume.basics.email = emailMatch[1].slice(0, 500);

  const phoneMatch =
    /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}/.exec(
      headerText,
    );
  if (phoneMatch) resume.basics.phone = phoneMatch[0].trim().slice(0, 500);

  const githubMatch =
    /((?:https?:\/\/)?(?:www\.)?github\.com\/[^\s·|,]+)/i.exec(headerText);
  if (githubMatch) resume.basics.github = githubMatch[1].slice(0, 500);

  const webCandidates =
    headerText.match(
      /(?:https?:\/\/[^\s·|,]+|(?:www\.)?linkedin\.com\/in\/[^\s·|,]+|in\/[a-zA-Z0-9_-]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s·|,]*)?)/gi,
    ) ?? [];
  for (const candidate of webCandidates) {
    if (candidate.includes("@")) continue;
    if (/github\.com/i.test(candidate)) continue;
    resume.basics.website = candidate.slice(0, 500);
    break;
  }

  const nonContactHeaderLines: string[] = [];
  for (const hLine of buckets.header) {
    const parts = hLine
      .split(/\s*(?:·|\||•)\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      for (const part of parts) {
        if (
          !part.includes("@") &&
          !/github\.com|linkedin\.com|^https?:\/\//i.test(part) &&
          !/\d{3}[\s.-]\d{4}/.test(part) &&
          !resume.basics.location &&
          part.length <= 60
        ) {
          resume.basics.location = part.slice(0, 500);
        }
      }
      continue;
    }
    if (
      hLine.includes("@") ||
      /github\.com|linkedin\.com|^https?:\/\//i.test(hLine) ||
      /\d{3}[\s.-]\d{4}/.test(hLine)
    ) {
      continue;
    }
    nonContactHeaderLines.push(hLine);
  }

  if (nonContactHeaderLines[0] && nonContactHeaderLines[0].length <= 80) {
    resume.basics.name = nonContactHeaderLines[0].slice(0, 500);
  }
  if (nonContactHeaderLines[1] && nonContactHeaderLines[1].length <= 120) {
    resume.basics.headline = nonContactHeaderLines[1].slice(0, 500);
  }
  if (
    !resume.basics.location &&
    nonContactHeaderLines[2] &&
    nonContactHeaderLines[2].length <= 60
  ) {
    resume.basics.location = nonContactHeaderLines[2].slice(0, 500);
  }

  if (buckets.summary.length > 0) {
    resume.summary = buckets.summary.join(" ").slice(0, 10_000);
  } else if (nonContactHeaderLines.length > 2) {
    const extra = nonContactHeaderLines.slice(2).join(" ");
    if (extra.length >= 50) resume.summary = extra.slice(0, 10_000);
  }

  resume.experience = parseExperienceBlocks(buckets.experience);
  resume.projects = parseProjectBlocks(buckets.projects);
  resume.education = parseEducationBlocks(buckets.education);
  resume.certifications = parseCertificationBlocks(buckets.certifications);
  const parsedSkills = parseSkillsBlocks(buckets.skills);
  resume.skills = parsedSkills.skills;
  resume.skillGroups = parsedSkills.skillGroups;

  const customSections: CustomSection[] = [];
  for (const bucket of customBuckets.slice(0, 10)) {
    const parsedAsExp = parseExperienceBlocks(bucket.lines);
    customSections.push({
      id: crypto.randomUUID(),
      title: bucket.title.slice(0, 500),
      entries: parsedAsExp.slice(0, 20).map((entry) => ({
        id: crypto.randomUUID(),
        heading: entry.role || entry.company || "Entry",
        subheading: entry.role ? entry.company : "",
        date: [entry.startDate, entry.endDate].filter(Boolean).join(" – "),
        bullets: entry.bullets,
      })),
    });
  }
  resume.customSections = customSections;

  if (!resume.basics.name) {
    warnings.push(
      "Could not confidently detect your name from the header—fill it in after import.",
    );
  }
  if (
    resume.experience.length === 0 &&
    resume.projects.length === 0 &&
    resume.education.length === 0
  ) {
    warnings.push(
      "Standard section headings (Experience, Education, Skills) were not detected; review imported fields carefully.",
    );
  } else {
    warnings.push(
      "Imported locally on this device. Review dates, companies, and bullet breaks before exporting.",
    );
  }

  const valid = resumeSchema.parse(resume);
  const totalSkills =
    valid.skills.length +
    valid.skillGroups.reduce((sum, g) => sum + g.items.length, 0);

  return {
    resume: valid,
    rawLines: lines,
    warnings,
    sourceFormat,
    stats: {
      experiences: valid.experience.length,
      projects: valid.projects.length,
      education: valid.education.length,
      certifications: valid.certifications.length,
      skills: totalSkills,
    },
  };
}

async function readBlobAsBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer());
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error("Could not read file bytes."));
      }
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read file."));
    reader.readAsArrayBuffer(blob);
  });
}

export async function importResumeFile(
  file: File,
): Promise<ImportedResumeDraft> {
  if (file.size > MAX_RESUME_IMPORT_BYTES) {
    throw new Error("Choose a PDF or Word (.docx) resume under 5 MB.");
  }
  const lower = file.name.toLowerCase();
  const bytes = await readBlobAsBytes(file);
  const isZipMagic =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;
  const isPdfMagic =
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d;

  if (lower.endsWith(".docx") || (!lower.endsWith(".pdf") && isZipMagic)) {
    const lines = await extractDocxLines(bytes);
    return parseResumeLinesToDraft(lines, file.name, "docx");
  }
  if (lower.endsWith(".pdf") || isPdfMagic) {
    const lines = await extractPdfLines(bytes);
    return parseResumeLinesToDraft(lines, file.name, "pdf");
  }
  throw new Error("Choose a .pdf or .docx resume file.");
}
