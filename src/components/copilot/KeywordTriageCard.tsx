import { Check, Plus, RotateCcw, Sparkles } from "lucide-react";
import {
  addKeywordToSkills,
  restoreJobKeyword,
  skipJobKeyword,
  type Resume,
} from "../../model";

export type KeywordEntry = {
  term: string;
  matched: boolean;
  skipped: boolean;
};

export function KeywordTriageCard({
  resume,
  activeKeywords,
  matchedKeywords,
  missingKeywords,
  skippedKeywords,
  onChange,
  onFocusKeywordInApr,
}: {
  resume: Resume;
  activeKeywords: KeywordEntry[];
  matchedKeywords: KeywordEntry[];
  missingKeywords: KeywordEntry[];
  skippedKeywords: KeywordEntry[];
  onChange: (resume: Resume) => void;
  onFocusKeywordInApr: (term: string) => void;
}) {
  return (
    <div className="keyword-card">
      <div className="card-heading">
        <strong>Keyword targeting</strong>
        <span>
          {matchedKeywords.length} of {activeKeywords.length} matched
        </span>
      </div>
      {activeKeywords.length > 0 ? (
        <>
          {matchedKeywords.length > 0 && (
            <div className="keyword-list">
              {matchedKeywords.map(({ term }) => (
                <span key={term} className="keyword matched">
                  <Check size={11} />
                  {term}
                </span>
              ))}
            </div>
          )}
          {missingKeywords.length > 0 && (
            <div className="missing-keywords-section">
              <p className="fine-print">
                Missing from your resume — add skills you genuinely have, coach
                a bullet with APR, or skip irrelevant terms:
              </p>
              <ul className="keyword-triage-list">
                {missingKeywords.map(({ term }) => (
                  <li key={term} className="keyword-triage-row">
                    <span className="keyword-term">{term}</span>
                    <div className="keyword-actions">
                      <button
                        type="button"
                        className="text-button"
                        aria-label={`Add ${term} to skills`}
                        onClick={() =>
                          onChange(addKeywordToSkills(resume, term))
                        }
                      >
                        <Plus size={11} /> Add skill
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        aria-label={`Coach accomplishment for ${term}`}
                        onClick={() => onFocusKeywordInApr(term)}
                      >
                        <Sparkles size={11} /> Coach APR
                      </button>
                      <button
                        type="button"
                        className="text-button muted-action"
                        aria-label={`Skip ${term}`}
                        onClick={() => onChange(skipJobKeyword(resume, term))}
                      >
                        Skip
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="fine-print">
          {skippedKeywords.length > 0
            ? "All detected job terms have been skipped."
            : "No specific technical or domain terms were detected yet."}
        </p>
      )}
      {skippedKeywords.length > 0 && (
        <div className="skipped-keywords-bar">
          <span className="fine-print">Skipped:</span>
          <div className="keyword-list">
            {skippedKeywords.map(({ term }) => (
              <button
                type="button"
                key={term}
                className="keyword skipped"
                aria-label={`Restore ${term}`}
                onClick={() => onChange(restoreJobKeyword(resume, term))}
              >
                <RotateCcw size={10} /> {term}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="fine-print">
        Local keyword extraction, not a proprietary ATS score or hiring
        guarantee. Never add skills you cannot back up in an interview.
      </p>
    </div>
  );
}
