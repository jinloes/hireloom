import { useEffect, useRef, useState } from "react";
import { AlignLeft, Sparkles, Upload, UserRound } from "lucide-react";
import type { AprTarget, CareerLibrary, Resume, SectionKey } from "../model";
import {
  CertificationsSection,
  EducationSection,
} from "./editor/CredentialsSections";
import { ExperienceSection } from "./editor/ExperienceSection";
import {
  Field,
  type ChangeMeta,
  type EditorFocusRequest,
} from "./editor/FieldPrimitives";
import { ProjectsSection } from "./editor/ProjectsSection";
import {
  CustomSectionsEditor,
  SkillsSection,
} from "./editor/SkillsAndCustomSections";

export { Field, type ChangeMeta, type EditorFocusRequest };

export function Editor({
  resume,
  onChange,
  onAi,
  onExample,
  onImportResume,
  onCoachBullet,
  careerLibrary,
  onSaveExperienceToLibrary,
  onPullExperienceFromLibrary,
  onSaveProjectToLibrary,
  onPullProjectFromLibrary,
  focusRequest,
}: {
  resume: Resume;
  onChange: (resume: Resume, meta?: ChangeMeta) => void;
  onAi: () => void;
  onExample: () => void;
  onImportResume?: () => void;
  onCoachBullet?: (target: AprTarget) => void;
  careerLibrary?: CareerLibrary;
  onSaveExperienceToLibrary?: (experienceId: string) => void;
  onPullExperienceFromLibrary?: (experienceId: string) => void;
  onSaveProjectToLibrary?: (projectId: string) => void;
  onPullProjectFromLibrary?: (projectId: string) => void;
  focusRequest?: EditorFocusRequest | null;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [openSections, setOpenSections] = useState<
    Record<SectionKey | "basics", boolean>
  >({
    basics: true,
    summary: true,
    experience: true,
    projects: resume.projects.length > 0,
    education: resume.education.length > 0,
    certifications: resume.certifications.length > 0,
    skills: true,
    custom: resume.customSections.length > 0,
  });
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});

  const toggleCollapsed = (entryId: string) =>
    setCollapsedIds((prev) => ({ ...prev, [entryId]: !prev[entryId] }));

  const handleSectionToggle = (
    section: SectionKey | "basics",
    event: React.SyntheticEvent<HTMLDetailsElement>,
  ) => {
    const isOpen = event.currentTarget.open;
    setOpenSections((prev) =>
      prev[section] === isOpen ? prev : { ...prev, [section]: isOpen },
    );
  };

  useEffect(() => {
    if (!focusRequest) return;
    setOpenSections((prev) => ({ ...prev, [focusRequest.section]: true }));
    if (focusRequest.entryId) {
      const targetEntryId = focusRequest.entryId;
      setCollapsedIds((prev) => ({ ...prev, [targetEntryId]: false }));
    }
    const timer = window.setTimeout(() => {
      const container = rootRef.current;
      if (!container) return;
      const safeId =
        focusRequest.entryId &&
        typeof CSS !== "undefined" &&
        typeof CSS.escape === "function"
          ? CSS.escape(focusRequest.entryId)
          : focusRequest.entryId;
      const target = safeId
        ? container.querySelector<HTMLElement>(`[data-entry-id="${safeId}"]`)
        : container.querySelector<HTMLElement>(
            `[data-editor-section="${focusRequest.section}"]`,
          );
      target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      const firstInput = target?.querySelector<HTMLElement>(
        "input, textarea, select, summary",
      );
      firstInput?.focus({ preventScroll: true });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [focusRequest]);

  const basics = (key: keyof Resume["basics"], value: string) =>
    onChange({ ...resume, basics: { ...resume.basics, [key]: value } });

  const empty =
    !resume.basics.name &&
    !resume.experience.length &&
    !resume.projects.length &&
    !resume.summary;

  const renderOrderedSection = (key: SectionKey, badgeNumber: string) => {
    switch (key) {
      case "summary":
        return (
          <details
            key="summary"
            className="editor-section"
            data-editor-section="summary"
            open={openSections.summary}
            onToggle={(e) => handleSectionToggle("summary", e)}
          >
            <summary>
              <span>
                <AlignLeft size={17} /> Professional summary
              </span>
              <span className="section-number">{badgeNumber}</span>
            </summary>
            <div className="section-fields">
              <Field
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
          </details>
        );

      case "experience":
        return (
          <ExperienceSection
            key="experience"
            resume={resume}
            badgeNumber={badgeNumber}
            open={openSections.experience}
            onToggleSection={(e) => handleSectionToggle("experience", e)}
            collapsedIds={collapsedIds}
            onToggleCollapsed={toggleCollapsed}
            onChange={onChange}
            onCoachBullet={onCoachBullet}
            careerLibrary={careerLibrary}
            onSaveExperienceToLibrary={onSaveExperienceToLibrary}
            onPullExperienceFromLibrary={onPullExperienceFromLibrary}
          />
        );

      case "projects":
        return (
          <ProjectsSection
            key="projects"
            resume={resume}
            badgeNumber={badgeNumber}
            open={openSections.projects}
            onToggleSection={(e) => handleSectionToggle("projects", e)}
            collapsedIds={collapsedIds}
            onToggleCollapsed={toggleCollapsed}
            onChange={onChange}
            onCoachBullet={onCoachBullet}
            careerLibrary={careerLibrary}
            onSaveProjectToLibrary={onSaveProjectToLibrary}
            onPullProjectFromLibrary={onPullProjectFromLibrary}
          />
        );

      case "education":
        return (
          <EducationSection
            key="education"
            resume={resume}
            badgeNumber={badgeNumber}
            open={openSections.education}
            onToggleSection={(e) => handleSectionToggle("education", e)}
            collapsedIds={collapsedIds}
            onToggleCollapsed={toggleCollapsed}
            onChange={onChange}
          />
        );

      case "certifications":
        return (
          <CertificationsSection
            key="certifications"
            resume={resume}
            badgeNumber={badgeNumber}
            open={openSections.certifications}
            onToggleSection={(e) => handleSectionToggle("certifications", e)}
            collapsedIds={collapsedIds}
            onToggleCollapsed={toggleCollapsed}
            onChange={onChange}
          />
        );

      case "skills":
        return (
          <SkillsSection
            key="skills"
            resume={resume}
            badgeNumber={badgeNumber}
            open={openSections.skills}
            onToggleSection={(e) => handleSectionToggle("skills", e)}
            onChange={onChange}
          />
        );

      case "custom":
        return (
          <CustomSectionsEditor
            key="custom"
            resume={resume}
            badgeNumber={badgeNumber}
            open={openSections.custom}
            onToggleSection={(e) => handleSectionToggle("custom", e)}
            onChange={onChange}
          />
        );
    }
  };

  return (
    <div className="editor-content" ref={rootRef}>
      {empty && (
        <div className="start-note">
          <span className="small-icon">
            <Sparkles size={18} />
          </span>
          <div>
            <strong>A good story starts with you.</strong>
            <p>
              Add your details below,{" "}
              {onImportResume && (
                <>
                  <button
                    type="button"
                    className="text-button"
                    onClick={onImportResume}
                  >
                    <Upload size={11} /> upload an existing PDF or DOCX resume
                  </button>
                  ,{" "}
                </>
              )}
              or{" "}
              <button type="button" className="text-button" onClick={onExample}>
                try a fictional example
              </button>
              .
            </p>
          </div>
        </div>
      )}
      <details
        className="editor-section"
        data-editor-section="basics"
        open={openSections.basics}
        onToggle={(e) => handleSectionToggle("basics", e)}
      >
        <summary>
          <span>
            <UserRound size={17} /> Personal details
          </span>
          <span className="section-number">01</span>
        </summary>
        <div className="section-fields">
          <Field
            label="Full name"
            value={resume.basics.name}
            onChange={(value) => basics("name", value)}
            placeholder="e.g. Alex Morgan"
          />
          <Field
            label="Professional headline"
            value={resume.basics.headline}
            onChange={(value) => basics("headline", value)}
            placeholder="e.g. Product Designer"
          />
          <div className="field-grid">
            <Field
              label="Email"
              type="email"
              value={resume.basics.email}
              onChange={(value) => basics("email", value)}
              placeholder="you@example.com"
            />
            <Field
              label="Phone"
              type="tel"
              value={resume.basics.phone}
              onChange={(value) => basics("phone", value)}
              placeholder="Optional"
            />
          </div>
          <Field
            label="Location"
            value={resume.basics.location}
            onChange={(value) => basics("location", value)}
            placeholder="City, country"
          />
          <Field
            label="Portfolio or LinkedIn"
            value={resume.basics.website}
            onChange={(value) => basics("website", value)}
            placeholder="Your website or profile URL"
          />
          <Field
            label="GitHub URL"
            type="url"
            value={resume.basics.github}
            onChange={(value) => basics("github", value)}
            placeholder="https://github.com/username"
          />
        </div>
      </details>
      {resume.sectionOrder.map((key, idx) =>
        renderOrderedSection(key, String(idx + 2).padStart(2, "0")),
      )}
    </div>
  );
}
