import { useId } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { monthOptions, parsePickerDate, yearOptions } from "./helpers";

type FieldProps = {
  id?: string;
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
  id: requestedId,
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
  const generatedId = useId();
  const id = requestedId ?? generatedId;
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

export function MonthField({
  label,
  value,
  onChange,
  allowPresent = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allowPresent?: boolean;
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
          <span>Current role</span>
        </label>
      )}
    </fieldset>
  );
}

export function EntryControls({
  label,
  index,
  length,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  length: number;
  onMove: (direction: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="entry-controls">
      <button
        className="icon-button"
        aria-label={`Move ${label} up`}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUp size={14} />
      </button>
      <button
        className="icon-button"
        aria-label={`Move ${label} down`}
        disabled={index === length - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDown size={14} />
      </button>
      <button
        className="icon-button danger"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
