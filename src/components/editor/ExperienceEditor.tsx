import { Plus, Sparkles } from "lucide-react";
import type { Experience, Resume } from "../../model";
import {
  HighlightGuidance,
  type HighlightGuidanceController,
} from "../HighlightGuidance";
import type { ContentRemovalRequest, HighlightReviewController } from "./types";
import { EntryControls, Field, MonthField } from "./fields";
import { experienceTitle, move } from "./helpers";

const REVIEW_DIMENSIONS = [
  { key: "action", label: "action" },
  { key: "project", label: "project" },
  { key: "result", label: "result" },
] as const;

function weakDimensions(
  review: NonNullable<ReturnType<HighlightReviewController["reviewFor"]>>,
): string[] {
  return REVIEW_DIMENSIONS.filter(
    (dimension) => review[dimension.key] !== "clear",
  ).map((dimension) => dimension.label);
}

type ExperienceEditorProps = {
  resume: Resume;
  selectedExperience: Experience;
  selectedExperienceIndex: number;
  onChange: (resume: Resume) => void;
  onRemove: (request: ContentRemovalRequest) => void;
  experience: (id: string, patch: Partial<Experience>) => void;
  highlightGuidance: HighlightGuidanceController;
  highlightReview: HighlightReviewController;
};

export function ExperienceEditor({
  resume,
  selectedExperience,
  selectedExperienceIndex,
  onChange,
  onRemove,
  experience,
  highlightGuidance,
  highlightReview,
}: ExperienceEditorProps) {
  return (
    <div
      className="entry-card selected-experience-editor"
      role="region"
      aria-labelledby={`experience-summary-${selectedExperience.id}`}
    >
      <div className="entry-topline">
        <strong>{experienceTitle(selectedExperience)}</strong>
        <EntryControls
          label={`position ${selectedExperienceIndex + 1}`}
          index={selectedExperienceIndex}
          length={resume.experience.length}
          onMove={(direction) =>
            onChange({
              ...resume,
              experience: move(
                resume.experience,
                selectedExperienceIndex,
                direction,
              ),
            })
          }
          onRemove={() =>
            onRemove({
              kind: "experience",
              item: selectedExperience,
              index: selectedExperienceIndex,
              label: experienceTitle(selectedExperience),
            })
          }
        />
      </div>
      <Field
        id={`job-title-${selectedExperience.id}`}
        label={`Job title ${selectedExperienceIndex + 1}`}
        value={selectedExperience.role}
        onChange={(role) => experience(selectedExperience.id, { role })}
        placeholder="Senior Product Designer"
      />
      <Field
        label={`Company ${selectedExperienceIndex + 1}`}
        value={selectedExperience.company}
        onChange={(company) => experience(selectedExperience.id, { company })}
        placeholder="Company name"
      />
      <Field
        label={`Work location ${selectedExperienceIndex + 1}`}
        value={selectedExperience.location}
        onChange={(location) => experience(selectedExperience.id, { location })}
        placeholder="City or remote"
      />
      <div className="field-grid">
        <MonthField
          label={`Start month ${selectedExperienceIndex + 1}`}
          value={selectedExperience.startDate}
          onChange={(startDate) =>
            experience(selectedExperience.id, { startDate })
          }
        />
        <MonthField
          label={`End month ${selectedExperienceIndex + 1}`}
          value={selectedExperience.endDate}
          onChange={(endDate) => experience(selectedExperience.id, { endDate })}
          allowPresent
        />
      </div>
      {selectedExperience.bullets.map((text, bulletIndex) => (
        <div className="bullet-editor" key={bulletIndex}>
          <EntryControls
            label={`highlight ${selectedExperienceIndex + 1}.${bulletIndex + 1}`}
            index={bulletIndex}
            length={selectedExperience.bullets.length}
            onMove={(direction) => {
              if (
                highlightGuidance.target?.resumeId === resume.id &&
                highlightGuidance.target.experienceId === selectedExperience.id
              ) {
                highlightGuidance.onKeep();
              }
              experience(selectedExperience.id, {
                bullets: move(
                  selectedExperience.bullets,
                  bulletIndex,
                  direction,
                ),
              });
            }}
            onRemove={() => {
              if (
                highlightGuidance.target?.resumeId === resume.id &&
                highlightGuidance.target.experienceId === selectedExperience.id
              ) {
                highlightGuidance.onKeep();
              }
              onRemove({
                kind: "highlight",
                item: text,
                index: bulletIndex,
                parentExperienceId: selectedExperience.id,
                label: `highlight from ${experienceTitle(selectedExperience)}`,
              });
            }}
          />
          <Field
            id={`highlight-${selectedExperience.id}-${bulletIndex}`}
            label={`Highlight ${selectedExperienceIndex + 1}.${bulletIndex + 1}`}
            value={text}
            multiline
            rows={3}
            maxLength={2_000}
            placeholder="What did you do, and what changed because of it?"
            onChange={(value) =>
              experience(selectedExperience.id, {
                bullets: selectedExperience.bullets.map((item, i) =>
                  i === bulletIndex ? value : item,
                ),
              })
            }
          />
          {text.trim() && (
            <>
              {(() => {
                const review = highlightReview.reviewFor(
                  selectedExperience.id,
                  bulletIndex,
                );
                const weak = review ? weakDimensions(review) : [];
                if (weak.length === 0) return null;
                return (
                  <p className="highlight-review-badge">
                    <span className="apr-status partial">
                      Weak {weak.join(", ")}
                    </span>
                  </p>
                );
              })()}
              <button
                className="text-button highlight-help-button"
                aria-expanded={
                  highlightGuidance.target?.resumeId === resume.id &&
                  highlightGuidance.target.experienceId ===
                    selectedExperience.id &&
                  highlightGuidance.target.bulletIndex === bulletIndex
                }
                aria-controls={`highlight-guidance-${selectedExperienceIndex}-${bulletIndex}`}
                onClick={() =>
                  highlightGuidance.onSelect({
                    resumeId: resume.id,
                    experienceId: selectedExperience.id,
                    bulletIndex,
                    role: selectedExperience.role,
                    bullet: text,
                  })
                }
              >
                <Sparkles size={13} /> Help me strengthen this highlight
              </button>
              {highlightGuidance.target?.resumeId === resume.id &&
                highlightGuidance.target.experienceId ===
                  selectedExperience.id &&
                highlightGuidance.target.bulletIndex === bulletIndex && (
                  <HighlightGuidance
                    controller={highlightGuidance}
                    currentHighlight={text}
                    regionId={`highlight-guidance-${selectedExperienceIndex}-${bulletIndex}`}
                  />
                )}
            </>
          )}
        </div>
      ))}
      <button
        className="text-button add-inline"
        id={`add-highlight-${selectedExperience.id}`}
        disabled={selectedExperience.bullets.length >= 30}
        onClick={() =>
          experience(selectedExperience.id, {
            bullets: [...selectedExperience.bullets, ""],
          })
        }
      >
        <Plus size={14} /> Add highlight
      </button>
    </div>
  );
}
