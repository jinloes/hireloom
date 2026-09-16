import { accents, type Resume } from "../model";

export function ResumePreview({ resume }: { resume: Resume }) {
  const contact = [
    resume.basics.email,
    resume.basics.phone,
    resume.basics.location,
    resume.basics.website,
  ].filter(Boolean);
  return (
    <article
      className={`resume-paper template-${resume.template}`}
      style={
        { "--resume-accent": accents[resume.accent] } as React.CSSProperties
      }
      aria-label="Live resume preview"
      data-testid="resume-preview"
    >
      <header className="resume-heading">
        <h1>
          {resume.basics.name || <span className="placeholder">Your name</span>}
        </h1>
        <p className="resume-headline">
          {resume.basics.headline || (
            <span className="placeholder">Your professional headline</span>
          )}
        </p>
        {contact.length > 0 && (
          <p className="resume-contact">{contact.join("  ·  ")}</p>
        )}
      </header>
      {resume.summary.trim() && (
        <section className="resume-section">
          <h2>Profile</h2>
          <p>{resume.summary}</p>
        </section>
      )}
      {resume.experience.length > 0 && (
        <section className="resume-section">
          <h2>Experience</h2>
          {resume.experience.map((entry) => (
            <div className="resume-entry" key={entry.id}>
              <div className="resume-entry-heading">
                <h3>{entry.role || "Role"}</h3>
                <span>
                  {[entry.startDate, entry.endDate].filter(Boolean).join(" – ")}
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
      )}
      {resume.education.length > 0 && (
        <section className="resume-section">
          <h2>Education</h2>
          {resume.education.map((entry) => (
            <div className="resume-entry" key={entry.id}>
              <div className="resume-entry-heading">
                <h3>{entry.school || "School"}</h3>
                <span>{entry.graduation}</span>
              </div>
              <p>{entry.degree}</p>
            </div>
          ))}
        </section>
      )}
      {resume.skills.length > 0 && (
        <section className="resume-section">
          <h2>Skills</h2>
          <p>{resume.skills.join("  ·  ")}</p>
        </section>
      )}
      {!resume.summary &&
        !resume.experience.length &&
        !resume.education.length &&
        !resume.skills.length && (
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
    </article>
  );
}
