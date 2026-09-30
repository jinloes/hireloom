import { Sparkles } from "lucide-react";
import type { Resume } from "../../model";
import { Field } from "./fields";

type SummarySectionProps = {
  resume: Resume;
  onChange: (resume: Resume) => void;
  onAi: () => void;
};

export function SummarySection({
  resume,
  onChange,
  onAi,
}: SummarySectionProps) {
  return (
    <div className="section-fields">
      <Field
        id="summary"
        label="Your story, in a few lines"
        value={resume.summary}
        onChange={(summary) => onChange({ ...resume, summary })}
        multiline
        rows={5}
        maxLength={10_000}
        placeholder="What do you do well? What experience and perspective will you bring to your next team?"
      />
      <button className="ai-text-button" onClick={onAi}>
        <Sparkles size={14} /> Find the right words with Copilot
      </button>
    </div>
  );
}
