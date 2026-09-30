import { Plus } from "lucide-react";
import type { Experience, Resume } from "../../model";
import type { HighlightGuidanceController } from "../HighlightGuidance";
import type { ContentRemovalRequest, HighlightReviewController } from "./types";
import { experienceDateRange, experienceTitle } from "./helpers";
import { ExperienceEditor } from "./ExperienceEditor";
import { HighlightReviewAction } from "./HighlightReviewAction";

type ExperienceSectionProps = {
  resume: Resume;
  selectedExperience: Experience | null;
  selectedExperienceIndex: number;
  onChange: (resume: Resume) => void;
  onRemove: (request: ContentRemovalRequest) => void;
  experience: (id: string, patch: Partial<Experience>) => void;
  addExperience: (position: "top" | "end") => void;
  selectExperience: (id: string) => void;
  highlightGuidance: HighlightGuidanceController;
  highlightReview: HighlightReviewController;
};

export function ExperienceSection({
  resume,
  selectedExperience,
  selectedExperienceIndex,
  onChange,
  onRemove,
  experience,
  addExperience,
  selectExperience,
  highlightGuidance,
  highlightReview,
}: ExperienceSectionProps) {
  return (
    <div className="section-fields experience-section-fields">
      <HighlightReviewAction
        resume={resume}
        highlightReview={highlightReview}
      />
      {resume.experience.length > 0 && (
        <div className="experience-workspace">
          <div className="experience-summary-rail">
            <button
              className="add-button"
              disabled={resume.experience.length >= 30}
              onClick={() => addExperience("top")}
            >
              <Plus size={16} /> Add experience to top
            </button>
            <ul className="experience-summary-list" aria-label="Experience">
              {resume.experience.map((entry) => (
                <li key={entry.id}>
                  <button
                    id={`experience-summary-${entry.id}`}
                    aria-current={
                      entry.id === selectedExperience?.id ? "true" : undefined
                    }
                    onClick={() => selectExperience(entry.id)}
                  >
                    <strong>{experienceTitle(entry)}</strong>
                    <span>
                      {experienceDateRange(entry)} · {entry.bullets.length}{" "}
                      {entry.bullets.length === 1 ? "highlight" : "highlights"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              className="add-button"
              id="add-experience"
              disabled={resume.experience.length >= 30}
              onClick={() => addExperience("end")}
            >
              <Plus size={16} /> Add experience to end
            </button>
          </div>

          {selectedExperience && (
            <ExperienceEditor
              resume={resume}
              selectedExperience={selectedExperience}
              selectedExperienceIndex={selectedExperienceIndex}
              onChange={onChange}
              onRemove={onRemove}
              experience={experience}
              highlightGuidance={highlightGuidance}
              highlightReview={highlightReview}
            />
          )}
        </div>
      )}
      {!resume.experience.length && (
        <p className="empty-hint">
          Paid work, internships, freelance projects, or volunteering. Every
          chapter counts.
        </p>
      )}
      {!resume.experience.length && (
        <button
          className="add-button"
          id="add-experience"
          disabled={resume.experience.length >= 30}
          onClick={() => addExperience("end")}
        >
          <Plus size={16} /> Add experience to end
        </button>
      )}
    </div>
  );
}
