import type {
  Certification,
  Education,
  Experience,
  Project,
  SkillGroup,
} from "../model";

export type SectionKind =
  | "header"
  | "summary"
  | "experience"
  | "projects"
  | "education"
  | "certifications"
  | "skills"
  | "custom";

export function classifyHeading(line: string): {
  kind: Exclude<SectionKind, "header">;
  title: string;
} | null {
  const clean = line.replace(/^[#*\-–—•·\d.)\s]+|[#*:.\s]+$/g, "").trim();
  if (!clean || clean.length > 42 || clean.split(/\s+/).length > 5) return null;
  const lower = clean.toLowerCase();

  if (
    /^(profile|summary|professional summary|executive summary|about|about me|career summary|objective)$/.test(
      lower,
    )
  ) {
    return { kind: "summary", title: clean };
  }
  if (
    /^(experience|work experience|professional experience|employment|employment history|work history|career history|relevant experience)$/.test(
      lower,
    )
  ) {
    return { kind: "experience", title: clean };
  }
  if (
    /^(projects|project|selected projects|key projects|personal projects|academic projects|open source)$/.test(
      lower,
    )
  ) {
    return { kind: "projects", title: clean };
  }
  if (
    /^(education|academic background|academics|qualifications)$/.test(lower)
  ) {
    return { kind: "education", title: clean };
  }
  if (
    /^(certifications|certification|licenses|licenses & certifications|licenses and certifications|certificates|credentials)$/.test(
      lower,
    )
  ) {
    return { kind: "certifications", title: clean };
  }
  if (
    /^(skills|technical skills|core skills|core competencies|competencies|technologies|tech stack|expert-level skills|skills & tools|skills and tools)$/.test(
      lower,
    )
  ) {
    return { kind: "skills", title: clean };
  }
  if (
    /^(volunteering|volunteer experience|awards|honors|honors & awards|publications|leadership|involvement|activities|speaking|community)$/.test(
      lower,
    )
  ) {
    return { kind: "custom", title: clean };
  }
  return null;
}

const MONTH_MAP: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

function normalizeSingleDate(raw: string): string {
  const clean = raw.trim();
  if (/^(present|current|now|ongoing)$/i.test(clean)) return "Present";
  const ym = /^(\d{4})[-/](\d{1,2})$/.exec(clean);
  if (ym) {
    const m = Number(ym[2]);
    if (m >= 1 && m <= 12) return `${ym[1]}-${String(m).padStart(2, "0")}`;
  }
  const my = /^([A-Za-z]+)\.?\s+(\d{4})$/.exec(clean);
  if (my) {
    const month = MONTH_MAP[my[1].toLowerCase()];
    if (month) return `${my[2]}-${month}`;
  }
  const slashMy = /^(\d{1,2})\/(\d{4})$/.exec(clean);
  if (slashMy) {
    const m = Number(slashMy[1]);
    if (m >= 1 && m <= 12) {
      return `${slashMy[2]}-${String(m).padStart(2, "0")}`;
    }
  }
  return clean.slice(0, 500);
}

const DATE_TOKEN =
  "(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?\\s+\\d{4}|\\d{4}[-/](?:0?[1-9]|1[0-2])|(?:0?[1-9]|1[0-2])\\/\\d{4}|\\d{4})";
const DATE_RANGE_REGEX = new RegExp(
  `(${DATE_TOKEN})\\s*(?:–|—|-|to)\\s*(${DATE_TOKEN}|Present|Current|Now|Ongoing)`,
  "i",
);

function isBulletLine(line: string): boolean {
  return /^[•·▪◦‣*-]\s+/.test(line);
}

function stripBulletPrefix(line: string): string {
  return line.replace(/^[•·▪◦‣*-]\s+/, "").trim();
}

export function parseExperienceBlocks(lines: string[]): Experience[] {
  const entries: Experience[] = [];
  let current: Experience | null = null;

  const flush = () => {
    if (
      current &&
      (current.role.trim() ||
        current.company.trim() ||
        current.bullets.some((b) => b.trim()))
    ) {
      entries.push({
        ...current,
        role: current.role.slice(0, 500),
        company: current.company.slice(0, 500),
        location: current.location.slice(0, 500),
        bullets: current.bullets.slice(0, 30).map((b) => b.slice(0, 2000)),
      });
    }
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isBulletLine(line)) {
      if (!current) {
        current = {
          id: crypto.randomUUID(),
          role: "",
          company: "",
          location: "",
          startDate: "",
          endDate: "",
          bullets: [],
        };
      }
      current.bullets.push(stripBulletPrefix(line));
      continue;
    }

    const dateMatch = DATE_RANGE_REGEX.exec(line);
    if (dateMatch) {
      const startDate = normalizeSingleDate(dateMatch[1]);
      const endDate = normalizeSingleDate(dateMatch[2]);
      const remainder = line
        .replace(dateMatch[0], "")
        .replace(/^[\s·|—–,-]+|[\s·|—–,-]+$/g, "")
        .trim();

      if (current && !current.startDate && current.bullets.length === 0) {
        current.startDate = startDate;
        current.endDate = endDate;
        if (remainder) {
          if (!current.company) {
            const parts = remainder.split(/\s*(?:·|\||—|,)\s*/);
            current.company = parts[0] ?? "";
            current.location = parts.slice(1).join(", ");
          } else if (!current.location) {
            current.location = remainder;
          }
        }
        continue;
      }

      flush();
      let role = remainder;
      let company = "";
      let location = "";
      if (remainder.includes("|")) {
        const parts = remainder.split("|").map((s) => s.trim());
        role = parts[0] ?? "";
        company = parts[1] ?? "";
        location = parts.slice(2).join(", ");
      } else if (/\s+at\s+/i.test(remainder)) {
        const parts = remainder.split(/\s+at\s+/i);
        role = parts[0]?.trim() ?? "";
        company = parts.slice(1).join(" at ").trim();
      } else if (remainder.includes("  ")) {
        const parts = remainder.split(/\s{2,}/);
        role = parts[0] ?? "";
        company = parts.slice(1).join(" · ");
      }

      current = {
        id: crypto.randomUUID(),
        role,
        company,
        location,
        startDate,
        endDate,
        bullets: [],
      };
      continue;
    }

    if (
      current &&
      current.bullets.length === 0 &&
      !current.company &&
      line.length <= 110
    ) {
      const parts = line.split(/\s*(?:·|\|)\s*/);
      current.company = parts[0] ?? line;
      if (parts.length > 1 && !current.location) {
        current.location = parts.slice(1).join(", ");
      }
      continue;
    }

    const nextLine = lines[i + 1] ?? "";
    if (
      line.length <= 95 &&
      (DATE_RANGE_REGEX.test(nextLine) ||
        !current ||
        current.bullets.length > 0) &&
      !/[.!?]$/.test(line)
    ) {
      flush();
      const pipeParts = line.split(/\s*\|\s*/);
      current = {
        id: crypto.randomUUID(),
        role: pipeParts[0] ?? line,
        company: pipeParts[1] ?? "",
        location: pipeParts.slice(2).join(", "),
        startDate: "",
        endDate: "",
        bullets: [],
      };
      continue;
    }

    if (current && current.bullets.length > 0) {
      const lastIdx = current.bullets.length - 1;
      current.bullets[lastIdx] = `${current.bullets[lastIdx]} ${line}`.trim();
    } else if (!current) {
      current = {
        id: crypto.randomUUID(),
        role: line,
        company: "",
        location: "",
        startDate: "",
        endDate: "",
        bullets: [],
      };
    }
  }

  flush();
  return entries.slice(0, 30);
}

export function parseProjectBlocks(lines: string[]): Project[] {
  const projects: Project[] = [];
  let current: Project | null = null;

  const flush = () => {
    if (
      current &&
      (current.name.trim() || current.bullets.some((b) => b.trim()))
    ) {
      projects.push({
        ...current,
        name: current.name.slice(0, 500),
        subtitle: current.subtitle.slice(0, 500),
        url: current.url.slice(0, 500),
        bullets: current.bullets.slice(0, 30).map((b) => b.slice(0, 2000)),
      });
    }
    current = null;
  };

  for (const line of lines) {
    if (isBulletLine(line)) {
      if (!current) {
        current = {
          id: crypto.randomUUID(),
          name: "Project",
          subtitle: "",
          url: "",
          startDate: "",
          endDate: "",
          bullets: [],
        };
      }
      current.bullets.push(stripBulletPrefix(line));
      continue;
    }
    const dateMatch = DATE_RANGE_REGEX.exec(line);
    const cleaned = dateMatch
      ? line
          .replace(dateMatch[0], "")
          .replace(/^[\s·|—–,-]+|[\s·|—–,-]+$/g, "")
          .trim()
      : line;

    if (
      current &&
      current.bullets.length === 0 &&
      !current.subtitle &&
      !dateMatch &&
      line.length <= 120
    ) {
      const urlMatch = /(https?:\/\/\S+|github\.com\/\S+)/i.exec(line);
      if (urlMatch && !current.url) current.url = urlMatch[1];
      current.subtitle = line
        .replace(urlMatch?.[1] ?? "", "")
        .replace(/^[\s·|]+|[\s·|]+$/g, "");
      continue;
    }

    if (line.length <= 110 && !/[.!?]$/.test(line)) {
      flush();
      const parts = cleaned.split(/\s*(?:·|\||—)\s*/);
      current = {
        id: crypto.randomUUID(),
        name: parts[0] || "Project",
        subtitle: parts.slice(1).join(" · "),
        url: "",
        startDate: dateMatch ? normalizeSingleDate(dateMatch[1]) : "",
        endDate: dateMatch ? normalizeSingleDate(dateMatch[2]) : "",
        bullets: [],
      };
    } else if (current && current.bullets.length > 0) {
      const last = current.bullets.length - 1;
      current.bullets[last] = `${current.bullets[last]} ${line}`.trim();
    } else if (current) {
      current.bullets.push(line);
    }
  }
  flush();
  return projects.slice(0, 20);
}

export function parseEducationBlocks(lines: string[]): Education[] {
  const items: Education[] = [];
  let current: Education | null = null;
  const degreeCue =
    /\b(bachelor|master|ph\.?d|b\.?s\.?|b\.?a\.?|b\.?f\.?a\.?|m\.?s\.?|m\.?a\.?|m\.?b\.?a\.?|associate|diploma|degree|certificate)\b/i;
  const schoolCue =
    /\b(university|college|institute|school|academy|polytechnic)\b/i;

  const flush = () => {
    if (current && (current.school.trim() || current.degree.trim())) {
      items.push({
        id: current.id,
        school: current.school.slice(0, 500),
        degree: current.degree.slice(0, 500),
        graduation: current.graduation.slice(0, 500),
      });
    }
    current = null;
  };

  for (const raw of lines) {
    const line = isBulletLine(raw) ? stripBulletPrefix(raw) : raw;
    const yearMatch = /\b((?:Expected\s+)?(?:19|20)\d{2})\b/i.exec(line);
    const graduation = yearMatch ? yearMatch[1] : "";
    const withoutYear = yearMatch
      ? line
          .replace(yearMatch[0], "")
          .replace(/^[\s·|,–—-]+|[\s·|,–—-]+$/g, "")
          .trim()
      : line;

    const parts = withoutYear.split(/\s*(?:\||·|—)\s*/).filter(Boolean);
    if (parts.length >= 2) {
      flush();
      const firstIsDegree =
        degreeCue.test(parts[0]) && !schoolCue.test(parts[0]);
      items.push({
        id: crypto.randomUUID(),
        school: (firstIsDegree ? parts[1] : parts[0]).slice(0, 500),
        degree: (firstIsDegree ? parts[0] : parts.slice(1).join(" · ")).slice(
          0,
          500,
        ),
        graduation: graduation.slice(0, 500),
      });
      continue;
    }

    if (!current) {
      current = {
        id: crypto.randomUUID(),
        school:
          degreeCue.test(withoutYear) && !schoolCue.test(withoutYear)
            ? ""
            : withoutYear,
        degree:
          degreeCue.test(withoutYear) && !schoolCue.test(withoutYear)
            ? withoutYear
            : "",
        graduation,
      };
    } else if (!current.degree && degreeCue.test(withoutYear)) {
      current.degree = withoutYear;
      if (graduation && !current.graduation) current.graduation = graduation;
      flush();
    } else if (!current.school && schoolCue.test(withoutYear)) {
      current.school = withoutYear;
      if (graduation && !current.graduation) current.graduation = graduation;
      flush();
    } else if (!current.degree) {
      current.degree = withoutYear;
      if (graduation && !current.graduation) current.graduation = graduation;
      flush();
    } else {
      flush();
      current = {
        id: crypto.randomUUID(),
        school: withoutYear,
        degree: "",
        graduation,
      };
    }
  }
  flush();
  return items.slice(0, 20);
}

export function parseCertificationBlocks(lines: string[]): Certification[] {
  const certs: Certification[] = [];
  for (const raw of lines) {
    const line = isBulletLine(raw) ? stripBulletPrefix(raw) : raw;
    if (!line) continue;
    const yearMatch = /\b((?:19|20)\d{2}(?:-(?:0[1-9]|1[0-2]))?)\b/.exec(line);
    const date = yearMatch ? yearMatch[1] : "";
    const withoutDate = yearMatch
      ? line
          .replace(yearMatch[0], "")
          .replace(/^[\s·|,–—-]+|[\s·|,–—-]+$/g, "")
          .trim()
      : line;
    const parts = withoutDate.split(/\s*(?:—|–|\||·|,)\s*/).filter(Boolean);
    certs.push({
      id: crypto.randomUUID(),
      name: (parts[0] ?? withoutDate).slice(0, 500),
      issuer: (parts[1] ?? "").slice(0, 500),
      date: date.slice(0, 500),
      url: "",
    });
  }
  return certs.slice(0, 20);
}

export function parseSkillsBlocks(lines: string[]): {
  skills: string[];
  skillGroups: SkillGroup[];
} {
  const skills: string[] = [];
  const skillGroups: SkillGroup[] = [];

  for (const raw of lines) {
    const line = isBulletLine(raw) ? stripBulletPrefix(raw) : raw;
    const colonMatch = /^([^:]{2,45}):\s*(.+)$/.exec(line);
    if (colonMatch) {
      const category = colonMatch[1].trim();
      const items = colonMatch[2]
        .split(/\s*(?:,|·|\||;)\s*/)
        .map((s) => s.trim().slice(0, 100))
        .filter(Boolean)
        .slice(0, 50);
      if (items.length > 0 && skillGroups.length < 20) {
        if (category.toLowerCase() === "additional") {
          for (const item of items) {
            if (skills.length < 100 && !skills.includes(item))
              skills.push(item);
          }
        } else {
          skillGroups.push({
            id: crypto.randomUUID(),
            category: category.slice(0, 500),
            items,
          });
        }
        continue;
      }
    }

    const tokens = line
      .split(/\s*(?:,|·|\||;|•)\s*/)
      .map((s) => s.trim().slice(0, 100))
      .filter(Boolean);
    for (const token of tokens) {
      if (skills.length < 100 && !skills.includes(token)) {
        skills.push(token);
      }
    }
  }

  return { skills, skillGroups };
}
