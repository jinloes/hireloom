import {
  accents,
  formatYearMonth,
  type AdditionalSection,
  type Resume,
} from "../model";

export function ResumePreview({ resume }: { resume: Resume }) {
  const contact = [
    resume.basics.email,
    resume.basics.phone,
    resume.basics.location,
    resume.basics.website,
    resume.basics.github,
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
      {resume.additionalSectionOrder.map((section) => (
        <AdditionalPreview key={section} resume={resume} section={section} />
      ))}
      {!resume.summary &&
        !resume.experience.length &&
        !resume.education.length &&
        !resume.skills.length &&
        !resume.additionalSectionOrder.some(
          (section) => resume[section].length,
        ) && (
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

function AdditionalPreview({
  resume,
  section,
}: {
  resume: Resume;
  section: AdditionalSection;
}) {
  if (!resume[section].length) return null;
  if (section === "projects")
    return (
      <PreviewSection title="Projects">
        {resume.projects.map((entry) => (
          <PreviewEntry
            key={entry.id}
            title={entry.name}
            dates={[entry.startDate, entry.endDate]}
            subtitle={[entry.role, entry.url]}
            bullets={entry.bullets}
          />
        ))}
      </PreviewSection>
    );
  if (section === "certifications")
    return (
      <PreviewSection title="Certifications">
        {resume.certifications.map((entry) => (
          <PreviewEntry
            key={entry.id}
            title={entry.name}
            dates={[entry.date]}
            subtitle={[entry.issuer, entry.credentialUrl]}
          />
        ))}
      </PreviewSection>
    );
  if (section === "awards")
    return (
      <PreviewSection title="Awards">
        {resume.awards.map((entry) => (
          <PreviewEntry
            key={entry.id}
            title={entry.title}
            dates={[entry.date]}
            subtitle={[entry.issuer]}
            body={entry.description}
          />
        ))}
      </PreviewSection>
    );
  if (section === "volunteer")
    return (
      <PreviewSection title="Volunteer Experience">
        {resume.volunteer.map((entry) => (
          <PreviewEntry
            key={entry.id}
            title={entry.role}
            dates={[entry.startDate, entry.endDate]}
            subtitle={[entry.organization]}
            bullets={entry.bullets}
          />
        ))}
      </PreviewSection>
    );
  if (section === "publications")
    return (
      <PreviewSection title="Publications">
        {resume.publications.map((entry) => (
          <PreviewEntry
            key={entry.id}
            title={entry.title}
            dates={[entry.date]}
            subtitle={[entry.publisher, entry.url]}
          />
        ))}
      </PreviewSection>
    );
  return (
    <PreviewSection title="Languages">
      <p>
        {resume.languages
          .map((entry) =>
            [entry.name, entry.proficiency].filter(Boolean).join(" — "),
          )
          .join("  ·  ")}
      </p>
    </PreviewSection>
  );
}

function PreviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="resume-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function PreviewEntry({
  title,
  dates,
  subtitle,
  body,
  bullets = [],
}: {
  title: string;
  dates: string[];
  subtitle: string[];
  body?: string;
  bullets?: string[];
}) {
  return (
    <div className="resume-entry">
      <div className="resume-entry-heading">
        <h3>{title}</h3>
        <span>{dates.filter(Boolean).map(formatYearMonth).join(" – ")}</span>
      </div>
      {subtitle.some(Boolean) && (
        <p className="resume-company">{subtitle.filter(Boolean).join(" · ")}</p>
      )}
      {body && <p>{body}</p>}
      {bullets.some((bullet) => bullet.trim()) && (
        <ul>
          {bullets
            .filter((bullet) => bullet.trim())
            .map((bullet, index) => (
              <li key={index}>{bullet}</li>
            ))}
        </ul>
      )}
    </div>
  );
}
