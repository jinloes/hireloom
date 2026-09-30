import type { Education, Experience } from "../../model";

export const monthOptions = [
  ["01", "January"],
  ["02", "February"],
  ["03", "March"],
  ["04", "April"],
  ["05", "May"],
  ["06", "June"],
  ["07", "July"],
  ["08", "August"],
  ["09", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
].map(([value, label]) => ({ value, label }));

export const yearOptions = Array.from(
  { length: new Date().getFullYear() + 10 - 1900 + 1 },
  (_, index) => String(new Date().getFullYear() + 10 - index),
);

export function parsePickerDate(value: string): {
  year: string;
  month: string;
} {
  const standard = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (standard) return { year: standard[1], month: standard[2] };

  const named = /^([A-Za-z]+)\s+(\d{4})$/.exec(value.trim());
  if (named) {
    const normalized = named[1].toLowerCase();
    const month = monthOptions.find(
      (option) =>
        option.label.toLowerCase() === normalized ||
        option.label.slice(0, 3).toLowerCase() === normalized,
    );
    if (month) return { year: named[2], month: month.value };
  }

  const year = /^(\d{4})$/.exec(value.trim());
  return { year: year?.[1] ?? "", month: "" };
}

export function move<T>(items: T[], index: number, direction: number): T[] {
  const result = [...items];
  const other = index + direction;
  if (other < 0 || other >= result.length) return result;
  [result[index], result[other]] = [result[other], result[index]];
  return result;
}

export function createExperience(): Experience {
  return {
    id: crypto.randomUUID(),
    role: "",
    company: "",
    location: "",
    startDate: "",
    endDate: "",
    bullets: [""],
  };
}

export function experienceTitle(entry: Experience) {
  const role = entry.role.trim();
  const company = entry.company.trim();
  if (role && company) return `${role} — ${company}`;
  return role || company || "Untitled position";
}

export function educationTitle(entry: Education) {
  return entry.school.trim() || entry.degree.trim() || "Untitled education";
}

function displayResumeDate(value: string) {
  if (!value) return "";
  if (value === "Present") return value;
  const parsed = parsePickerDate(value);
  if (parsed.year && parsed.month) {
    const month = monthOptions.find((option) => option.value === parsed.month);
    return `${month?.label.slice(0, 3) ?? parsed.month} ${parsed.year}`;
  }
  return value;
}

export function experienceDateRange(entry: Experience) {
  const start = displayResumeDate(entry.startDate);
  const end = displayResumeDate(entry.endDate);
  if (start && end) return `${start} – ${end}`;
  return start || end || "Dates not added";
}
