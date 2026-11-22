import { useEffect, useRef, useState } from "react";
import {
  accents,
  estimatePageCount,
  formatYearMonth,
  type Resume,
  type SectionKey,
} from "../model";

export function ResumePreview({
  resume,
  zoom = 100,
  onSelectSection,
}: {
  resume: Resume;
  zoom?: number;
  onSelectSection?: (section: SectionKey | "basics", entryId?: string) => void;
}) {
  const articleRef = useRef<HTMLElement>(null);
  const [measuredBreaks, setMeasuredBreaks] = useState<number[]>([]);

  const aspectRatio = resume.pageSize === "letter" ? 11 / 8.5 : 297 / 210;
  const fallbackEstimate = estimatePageCount(resume);

  const handleSurfaceClick = (
    event: React.MouseEvent,
    section: SectionKey | "basics",
    entryId?: string,
  ) => {
    if (!onSelectSection) return;
    if ((window.getSelection()?.toString() ?? "").length > 0) return;
    event.stopPropagation();
    onSelectSection(section, entryId);
  };

  useEffect(() => {
    const el = articleRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      setMeasuredBreaks([]);
      return;
    }

    const computeBreaks = () => {
      const width = el.clientWidth;
      const height = el.scrollHeight;
      if (width <= 0 || height <= 0) {
        setMeasuredBreaks([]);
        return;
      }
      const singlePageHeight = Math.round(width * aspectRatio);
      if (singlePageHeight <= 0) {
        setMeasuredBreaks([]);
        return;
      }
      const breaks: number[] = [];
      for (
        let y = singlePageHeight;
        y < height - 24 && breaks.length < 15;
        y += singlePageHeight
      ) {
        breaks.push(y);
      }
      setMeasuredBreaks(breaks);
    };

    computeBreaks();
    const observer = new ResizeObserver(computeBreaks);
    observer.observe(el);
    return () => observer.disconnect();
  }, [resume, aspectRatio]);

  const contact = [
    resume.basics.email,
    resume.basics.phone,
    resume.basics.location,
    resume.basics.website,
    resume.basics.github,
  ].filter(Boolean);

  const renderSectionHeader = (title: string, section: SectionKey) => (
    <div className="resume-section-header">
      <h2>{title}</h2>
      {onSelectSection && (
        <button
          type="button"
          className="preview-jump-btn"
          aria-label={`Edit ${title} section`}
          onClick={(e) => {
            e.stopPropagation();
            onSelectSection(section);
          }}
        >
          Edit
        </button>
      )}
    </div>
  );

  const renderSection = (key: SectionKey) => {
    switch (key) {
      case "summary":
        if (!resume.summary.trim()) return null;
        return (
          <section
            className={`resume-section ${onSelectSection ? "interactive-preview-block" : ""}`}
            key="summary"
            onClick={(e) => handleSurfaceClick(e, "summary")}
          >
            {renderSectionHeader("Profile", "summary")}
            <p>{resume.summary}</p>
          </section>
        );

      case "experience":
        if (!resume.experience.length) return null;
        return (
          <section
            className={`resume-section ${onSelectSection ? "interactive-preview-block" : ""}`}
            key="experience"
            onClick={(e) => handleSurfaceClick(e, "experience")}
          >
            {renderSectionHeader("Experience", "experience")}
            {resume.experience.map((entry) => (
              <div
                className="resume-entry"
                key={entry.id}
                onClick={(e) => handleSurfaceClick(e, "experience", entry.id)}
              >
                <div className="resume-entry-heading">
                  <h3>{entry.role || "Role"}</h3>
                  <span>
                    {[entry.startDate, entry.endDate]
                      .filter(Boolean)
                      .map(formatYearMonth)
                      .join(" – ")}
                  </span>
                </div>
                <p className="resume-company">
                  {[entry.company, entry.location].filter(Boolean).join(" · ")}
                </p>
                <ul>
                  {entry.bullets
                    .filter((text) => text.trim())
                    .map((text, index) => (
                      <li key={index}>{text}</li>
                    ))}
                </ul>
              </div>
            ))}
          </section>
        );

      case "projects":
        if (!resume.projects.length) return null;
        return (
          <section
            className={`resume-section ${onSelectSection ? "interactive-preview-block" : ""}`}
            key="projects"
            onClick={(e) => handleSurfaceClick(e, "projects")}
          >
            {renderSectionHeader("Projects", "projects")}
            {resume.projects.map((project) => (
              <div
                className="resume-entry"
                key={project.id}
                onClick={(e) => handleSurfaceClick(e, "projects", project.id)}
              >
                <div className="resume-entry-heading">
                  <h3>{project.name || "Project"}</h3>
                  <span>
                    {[project.startDate, project.endDate]
                      .filter(Boolean)
                      .map(formatYearMonth)
                      .join(" – ")}
                  </span>
                </div>
                {(project.subtitle.trim() || project.url.trim()) && (
                  <p className="resume-company">
                    {[project.subtitle, project.url]
                      .filter((v) => v.trim())
                      .join(" · ")}
                  </p>
                )}
                <ul>
                  {project.bullets
                    .filter((text) => text.trim())
                    .map((text, index) => (
                      <li key={index}>{text}</li>
                    ))}
                </ul>
              </div>
            ))}
          </section>
        );

      case "education":
        if (!resume.education.length) return null;
        return (
          <section
            className={`resume-section ${onSelectSection ? "interactive-preview-block" : ""}`}
            key="education"
            onClick={(e) => handleSurfaceClick(e, "education")}
          >
            {renderSectionHeader("Education", "education")}
            {resume.education.map((entry) => (
              <div
                className="resume-entry"
                key={entry.id}
                onClick={(e) => handleSurfaceClick(e, "education", entry.id)}
              >
                <div className="resume-entry-heading">
                  <h3>{entry.school || "School"}</h3>
                  <span>{entry.graduation}</span>
                </div>
                <p>{entry.degree}</p>
              </div>
            ))}
          </section>
        );

      case "certifications":
        if (!resume.certifications.length) return null;
        return (
          <section
            className={`resume-section ${onSelectSection ? "interactive-preview-block" : ""}`}
            key="certifications"
            onClick={(e) => handleSurfaceClick(e, "certifications")}
          >
            {renderSectionHeader("Certifications", "certifications")}
            {resume.certifications.map((cert) => (
              <div
                className="resume-entry"
                key={cert.id}
                onClick={(e) =>
                  handleSurfaceClick(e, "certifications", cert.id)
                }
              >
                <div className="resume-entry-heading">
                  <h3>{cert.name || "Certification"}</h3>
                  <span>{cert.date}</span>
                </div>
                {(cert.issuer.trim() || cert.url.trim()) && (
                  <p className="resume-company">
                    {[cert.issuer, cert.url]
                      .filter((v) => v.trim())
                      .join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </section>
        );

      case "skills": {
        const groups = resume.skillGroups.filter(
          (g) => g.category.trim() || g.items.some((i) => i.trim()),
        );
        const flat = resume.skills.filter((s) => s.trim());
        if (!groups.length && !flat.length) return null;
        return (
          <section
            className={`resume-section ${onSelectSection ? "interactive-preview-block" : ""}`}
            key="skills"
            onClick={(e) => handleSurfaceClick(e, "skills")}
          >
            {renderSectionHeader("Skills", "skills")}
            {groups.map((group) => (
              <p className="skill-group-line" key={group.id}>
                {group.category.trim() && (
                  <strong>{group.category.trim()}: </strong>
                )}
                {group.items.filter((i) => i.trim()).join("  ·  ")}
              </p>
            ))}
            {flat.length > 0 && (
              <p className="skill-group-line">
                {groups.length > 0 && <strong>Additional: </strong>}
                {flat.join("  ·  ")}
              </p>
            )}
          </section>
        );
      }

      case "custom":
        if (!resume.customSections.length) return null;
        return (
          <div key="custom">
            {resume.customSections.map((section) => {
              if (!section.title.trim() && !section.entries.length) return null;
              return (
                <section
                  className={`resume-section ${onSelectSection ? "interactive-preview-block" : ""}`}
                  key={section.id}
                  onClick={(e) => handleSurfaceClick(e, "custom", section.id)}
                >
                  {renderSectionHeader(
                    section.title.trim() || "Additional",
                    "custom",
                  )}
                  {section.entries.map((entry) => (
                    <div className="resume-entry" key={entry.id}>
                      <div className="resume-entry-heading">
                        <h3>{entry.heading || "Entry"}</h3>
                        <span>{entry.date}</span>
                      </div>
                      {entry.subheading.trim() && (
                        <p className="resume-company">{entry.subheading}</p>
                      )}
                      <ul>
                        {entry.bullets
                          .filter((text) => text.trim())
                          .map((text, index) => (
                            <li key={index}>{text}</li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
        );
    }
  };

  const isEmpty =
    !resume.summary &&
    !resume.experience.length &&
    !resume.projects.length &&
    !resume.education.length &&
    !resume.certifications.length &&
    !resume.skills.length &&
    !resume.skillGroups.length &&
    !resume.customSections.length;

  const breakPositions =
    measuredBreaks.length > 0
      ? measuredBreaks
      : fallbackEstimate.pages > 1
        ? Array.from(
            { length: fallbackEstimate.pages - 1 },
            (_, idx) => (idx + 1) * (resume.pageSize === "letter" ? 860 : 940),
          )
        : [];

  return (
    <div
      className="resume-paper-zoom-frame"
      style={
        zoom !== 100
          ? ({ "--paper-zoom": zoom / 100 } as React.CSSProperties)
          : undefined
      }
    >
      <article
        ref={articleRef}
        className={`resume-paper template-${resume.template} density-${resume.density} page-${resume.pageSize} ${zoom !== 100 ? "zoomed" : ""}`}
        style={
          { "--resume-accent": accents[resume.accent] } as React.CSSProperties
        }
        aria-label="Live resume preview"
        data-testid="resume-preview"
      >
        <header
          className={`resume-heading ${onSelectSection ? "interactive-preview-block" : ""}`}
          onClick={(e) => handleSurfaceClick(e, "basics")}
        >
          <div className="resume-heading-topline">
            <h1>
              {resume.basics.name || (
                <span className="placeholder">Your name</span>
              )}
            </h1>
            {onSelectSection && (
              <button
                type="button"
                className="preview-jump-btn"
                aria-label="Edit Personal details section"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSection("basics");
                }}
              >
                Edit
              </button>
            )}
          </div>
          <p className="resume-headline">
            {resume.basics.headline || (
              <span className="placeholder">Your professional headline</span>
            )}
          </p>
          {contact.length > 0 && (
            <p className="resume-contact">{contact.join("  ·  ")}</p>
          )}
        </header>
        {resume.sectionOrder.map((key) => renderSection(key))}
        {isEmpty && (
          <div className="paper-empty" aria-hidden="true">
            <div />
            <div />
            <div />
            <p>A fresh page for your next chapter.</p>
            <div />
            <div />
            <div />
          </div>
        )}
        {breakPositions.map((y, index) => (
          <div
            key={index}
            className="page-break-marker"
            style={{ top: `${y}px` }}
            aria-hidden="true"
            data-testid={`page-break-${index + 1}`}
          >
            <span>
              End of page {index + 1} · flows to page {index + 2}
            </span>
          </div>
        ))}
      </article>
    </div>
  );
}
