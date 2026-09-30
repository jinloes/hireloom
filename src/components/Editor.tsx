import { useEffect, useRef } from "react";
import {
  AlignLeft,
  BriefcaseBusiness,
  GraduationCap,
  Shapes,
  Sparkles,
  SquareStack,
  UserRound,
} from "lucide-react";
import type { Education, Experience, Resume } from "../model";
import type { HighlightGuidanceController } from "./HighlightGuidance";
import { EducationSection } from "./editor/EducationSection";
import { ExperienceSection } from "./editor/ExperienceSection";
import { PersonalSection } from "./editor/PersonalSection";
import { SkillsSection } from "./editor/SkillsSection";
import { SummarySection } from "./editor/SummarySection";
import { AdditionalSection } from "./editor/AdditionalSection";
import { createExperience } from "./editor/helpers";
import type {
  ContentRemovalRequest,
  ContentSection,
  ContentViewState,
  HighlightReviewController,
} from "./editor/types";
export { Field } from "./editor/fields";
export type {
  ContentRemovalRequest,
  ContentSection,
  ContentViewState,
  HighlightReviewController,
} from "./editor/types";

const contentSections: Array<{
  id: ContentSection;
  tabLabel: string;
  label: string;
  number: string;
}> = [
  {
    id: "personal",
    tabLabel: "Personal",
    label: "Personal details",
    number: "01",
  },
  {
    id: "summary",
    tabLabel: "Summary",
    label: "Professional summary",
    number: "02",
  },
  {
    id: "experience",
    tabLabel: "Experience",
    label: "Experience",
    number: "03",
  },
  {
    id: "education",
    tabLabel: "Education",
    label: "Education",
    number: "04",
  },
  { id: "skills", tabLabel: "Skills", label: "Skills", number: "05" },
  {
    id: "additional",
    tabLabel: "More",
    label: "Additional sections",
    number: "06",
  },
];

export function Editor({
  resume,
  onChange,
  onAi,
  onExample,
  highlightGuidance,
  highlightReview,
  viewState,
  onViewStateChange,
  onRemove,
  focusTarget,
  onFocusTargetHandled,
}: {
  resume: Resume;
  onChange: (resume: Resume) => void;
  onAi: () => void;
  onExample: () => void;
  highlightGuidance: HighlightGuidanceController;
  highlightReview: HighlightReviewController;
  viewState: ContentViewState;
  onViewStateChange: (state: ContentViewState) => void;
  onRemove: (request: ContentRemovalRequest) => void;
  focusTarget: string | null;
  onFocusTargetHandled: () => void;
}) {
  const pendingElementFocus = useRef<string | null>(null);
  const basics = (key: keyof Resume["basics"], value: string) =>
    onChange({ ...resume, basics: { ...resume.basics, [key]: value } });
  const experience = (id: string, patch: Partial<Experience>) =>
    onChange({
      ...resume,
      experience: resume.experience.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    });
  const education = (id: string, patch: Partial<Education>) =>
    onChange({
      ...resume,
      education: resume.education.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    });
  const empty =
    !resume.basics.name && !resume.experience.length && !resume.summary;
  const activeSection =
    contentSections.find((section) => section.id === viewState.section) ??
    contentSections[0];
  const selectedExperience =
    resume.experience.find(
      (entry) => entry.id === viewState.selectedExperienceId,
    ) ?? null;
  const selectedExperienceIndex = selectedExperience
    ? resume.experience.indexOf(selectedExperience)
    : -1;
  const sectionHeadingId = `content-section-${activeSection.id}`;

  useEffect(() => {
    const target = focusTarget ?? pendingElementFocus.current;
    if (!target) return;
    document.getElementById(target)?.focus();
    pendingElementFocus.current = null;
    if (focusTarget) onFocusTargetHandled();
  }, [focusTarget, onFocusTargetHandled, resume, viewState]);

  const selectSection = (section: ContentSection) => {
    onViewStateChange({ ...viewState, section });
  };

  const selectSectionFromKeyboard = (section: ContentSection) => {
    selectSection(section);
    const tab = document.getElementById(`content-tab-${section}`);
    tab?.focus();
    tab?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };

  const addExperience = (position: "top" | "end") => {
    const entry = createExperience();
    pendingElementFocus.current = `job-title-${entry.id}`;
    onViewStateChange({ ...viewState, selectedExperienceId: entry.id });
    onChange({
      ...resume,
      experience:
        position === "top"
          ? [entry, ...resume.experience]
          : [...resume.experience, entry],
    });
  };

  const selectExperience = (id: string) => {
    if (
      viewState.selectedExperienceId !== id &&
      highlightGuidance.target?.resumeId === resume.id
    ) {
      highlightGuidance.onKeep();
    }
    onViewStateChange({ ...viewState, selectedExperienceId: id });
  };

  const sectionCount = (section: ContentSection) => {
    if (section === "experience") return resume.experience.length;
    if (section === "education") return resume.education.length;
    if (section === "additional")
      return (
        resume.projects.length +
        resume.certifications.length +
        resume.awards.length +
        resume.volunteer.length +
        resume.publications.length +
        resume.languages.length
      );
    return null;
  };

  const sectionIcon = (section: ContentSection) => {
    if (section === "personal") return <UserRound size={17} />;
    if (section === "summary") return <AlignLeft size={17} />;
    if (section === "experience") return <BriefcaseBusiness size={17} />;
    if (section === "education") return <GraduationCap size={17} />;
    if (section === "additional") return <SquareStack size={17} />;
    return <Shapes size={17} />;
  };

  return (
    <div className="editor-content content-workspace">
      <div
        className="content-tabs"
        role="tablist"
        aria-label="Content sections"
      >
        {contentSections.map((section, index) => {
          const count = sectionCount(section.id);
          return (
            <button
              key={section.id}
              id={`content-tab-${section.id}`}
              role="tab"
              aria-label={section.tabLabel}
              aria-controls={`content-panel-${section.id}`}
              aria-selected={viewState.section === section.id}
              tabIndex={viewState.section === section.id ? 0 : -1}
              onClick={() => selectSection(section.id)}
              onKeyDown={(event) => {
                const nextIndex =
                  event.key === "ArrowRight"
                    ? (index + 1) % contentSections.length
                    : event.key === "ArrowLeft"
                      ? (index - 1 + contentSections.length) %
                        contentSections.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? contentSections.length - 1
                          : -1;
                if (nextIndex >= 0) {
                  event.preventDefault();
                  selectSectionFromKeyboard(contentSections[nextIndex].id);
                }
              }}
            >
              <span className="section-number" aria-hidden="true">
                {section.number}
              </span>
              <span>{section.tabLabel}</span>
              {count !== null && (
                <span className="count" aria-hidden="true">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {contentSections
        .filter((section) => section.id !== activeSection.id)
        .map((section) => (
          <div
            key={section.id}
            role="tabpanel"
            id={`content-panel-${section.id}`}
            aria-labelledby={`content-tab-${section.id}`}
            hidden
          />
        ))}
      <div
        className={`content-section-scroll content-section-${activeSection.id}`}
        role="tabpanel"
        id={`content-panel-${activeSection.id}`}
        aria-labelledby={`content-tab-${activeSection.id}`}
        data-testid="content-section-scroll"
      >
        {empty && viewState.section === "personal" && (
          <div className="start-note">
            <span className="small-icon">
              <Sparkles size={18} />
            </span>
            <div>
              <strong>A good story starts with you.</strong>
              <p>
                Add your details below, or{" "}
                <button className="text-button" onClick={onExample}>
                  try a fictional example
                </button>
                .
              </p>
            </div>
          </div>
        )}
        <section className="editor-section" aria-labelledby={sectionHeadingId}>
          <h2 id={sectionHeadingId}>
            {sectionIcon(activeSection.id)}
            {activeSection.label}
          </h2>
          {viewState.section === "personal" && (
            <PersonalSection resume={resume} basics={basics} />
          )}
          {viewState.section === "summary" && (
            <SummarySection resume={resume} onChange={onChange} onAi={onAi} />
          )}
          {viewState.section === "experience" && (
            <ExperienceSection
              resume={resume}
              selectedExperience={selectedExperience}
              selectedExperienceIndex={selectedExperienceIndex}
              onChange={onChange}
              onRemove={onRemove}
              experience={experience}
              addExperience={addExperience}
              selectExperience={selectExperience}
              highlightGuidance={highlightGuidance}
              highlightReview={highlightReview}
            />
          )}
          {viewState.section === "education" && (
            <EducationSection
              resume={resume}
              onChange={onChange}
              education={education}
              onRemove={onRemove}
            />
          )}
          {viewState.section === "skills" && (
            <SkillsSection resume={resume} onChange={onChange} />
          )}
          {viewState.section === "additional" && (
            <AdditionalSection resume={resume} onChange={onChange} />
          )}
        </section>
      </div>
    </div>
  );
}
