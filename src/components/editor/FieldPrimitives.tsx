import { useId, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { SectionKey } from "../../model";

export type EditorFocusRequest = {
  section: SectionKey | "basics";
  entryId?: string;
  nonce: number;
};

export type ChangeMeta = {
  discrete?: boolean;
  deletedLabel?: string;
};

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  type?: string;
  hint?: string;
};

export function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  rows = 4,
  maxLength = 500,
  type = "text",
  hint,
}: FieldProps) {
  const id = useId();
  const props = {
    id,
    value,
    placeholder,
    maxLength,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(event.target.value),
    "aria-describedby": hint ? `${id}-hint` : undefined,
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea {...props} rows={rows} />
      ) : (
        <input {...props} type={type} />
      )}
      {hint && (
        <span className="field-hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
    </div>
  );
}

const monthOptions = [
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

const yearOptions = Array.from(
  { length: new Date().getFullYear() + 10 - 1900 + 1 },
  (_, index) => String(new Date().getFullYear() + 10 - index),
);

function parsePickerDate(value: string): { year: string; month: string } {
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

export function MonthField({
  label,
  value,
  onChange,
  allowPresent = false,
  presentLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allowPresent?: boolean;
  presentLabel?: string;
}) {
  const groupId = useId();
  const presentId = useId();
  const current = allowPresent && value === "Present";
  const parsed = parsePickerDate(value);
  const legacyValue =
    value && !current && !/^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
  const hintId = legacyValue ? `${groupId}-hint` : undefined;
  const setYear = (year: string) =>
    onChange(year ? `${year}-${parsed.month || "01"}` : "");
  const setMonth = (month: string) =>
    onChange(
      month ? `${parsed.year || new Date().getFullYear()}-${month}` : "",
    );

  return (
    <fieldset className="field month-field" aria-describedby={hintId}>
      <legend>{label}</legend>
      <div className="month-picker">
        <select
          aria-label={`${label} month`}
          value={parsed.month}
          disabled={current}
          onChange={(event) => setMonth(event.target.value)}
        >
          <option value="">Month</option>
          {monthOptions.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} year`}
          value={parsed.year}
          disabled={current}
          onChange={(event) => setYear(event.target.value)}
        >
          <option value="">Year</option>
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
      {legacyValue && (
        <span className="field-hint" id={hintId}>
          Saved as “{legacyValue}”. Changing either dropdown converts it to
          month/year format.
        </span>
      )}
      {allowPresent && (
        <label className="current-role-check" htmlFor={presentId}>
          <input
            id={presentId}
            type="checkbox"
            checked={current}
            onChange={(event) =>
              onChange(event.target.checked ? "Present" : "")
            }
          />
          <span>{presentLabel ?? "Current role"}</span>
        </label>
      )}
    </fieldset>
  );
}

export function EntryControls({
  label,
  index,
  length,
  collapsed,
  onToggleCollapse,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  length: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onMove: (direction: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="entry-controls">
      {onToggleCollapse && (
        <button
          type="button"
          className="icon-button"
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${label}`}
          aria-expanded={!collapsed}
          onClick={onToggleCollapse}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      )}
      <button
        type="button"
        className="icon-button"
        aria-label={`Move ${label} up`}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUp size={14} />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={`Move ${label} down`}
        disabled={index === length - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDown size={14} />
      </button>
      <span className="entry-controls-divider" aria-hidden="true" />
      <button
        type="button"
        className="icon-button danger"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function SkillChipsManager({
  skills,
  onChangeSkills,
}: {
  skills: string[];
  onChangeSkills: (next: string[], discrete?: boolean) => void;
}) {
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const nonEmpty = skills
    .map((skill, index) => ({ text: skill.trim(), index }))
    .filter((item) => item.text.length > 0);

  const commitDraft = () => {
    const tokens = draft
      .split(",")
      .map((s) => s.trim().slice(0, 100))
      .filter(Boolean);
    if (!tokens.length) return;
    const existing = skills.map((s) => s.trim()).filter(Boolean);
    const merged = [...existing];
    for (const token of tokens) {
      if (
        merged.length < 100 &&
        !merged.some((item) => item.toLowerCase() === token.toLowerCase())
      ) {
        merged.push(token);
      }
    }
    setDraft("");
    onChangeSkills(merged, true);
  };

  return (
    <div className="skill-chips-box">
      {nonEmpty.length > 0 && (
        <div className="skill-chips-list" role="list" aria-label="Added skills">
          {nonEmpty.map(({ text, index }) => (
            <span
              className="skill-chip"
              role="listitem"
              key={`${text}-${index}`}
            >
              <span>{text}</span>
              <button
                type="button"
                className="skill-chip-remove"
                aria-label={`Remove skill ${text}`}
                onClick={() =>
                  onChangeSkills(
                    skills.filter((_, i) => i !== index),
                    true,
                  )
                }
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="skill-chip-adder">
        <label className="visually-hidden" htmlFor={inputId}>
          Add skill tag
        </label>
        <input
          id={inputId}
          type="text"
          value={draft}
          maxLength={100}
          placeholder="Type a skill and press Enter…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commitDraft();
            }
          }}
        />
        <button
          type="button"
          className="button secondary small"
          disabled={!draft.trim() || nonEmpty.length >= 100}
          onClick={commitDraft}
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  );
}

export function move<T>(items: T[], index: number, direction: number): T[] {
  const result = [...items];
  const other = index + direction;
  if (other < 0 || other >= result.length) return result;
  [result[index], result[other]] = [result[other], result[index]];
  return result;
}
