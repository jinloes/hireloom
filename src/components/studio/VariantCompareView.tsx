import { useMemo, useState } from "react";
import { GitCompareArrows } from "lucide-react";
import type { CareerLibrary, Experience, Project, Resume } from "../../model";
import { DiffView } from "../copilot/ProposalPrimitives";

type CompareBaselineOption = {
  id: string;
  label: string;
  kind: "library" | "resume";
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function flattenResumeSkills(resume: Resume): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of [
    ...resume.skills,
    ...resume.skillGroups.flatMap((group) => group.items),
  ]) {
    const trimmed = item.trim();
    const key = normalizeKey(trimmed);
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  }
  return result;
}

function flattenLibrarySkills(library: CareerLibrary): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of library.skillGroups.flatMap((group) => group.items)) {
    const trimmed = item.trim();
    const key = normalizeKey(trimmed);
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  }
  return result;
}

function matchExperience<
  T extends Pick<Experience, "id" | "role" | "company"> & {
    libraryId?: string;
  },
>(item: Experience, candidates: T[]): T | undefined {
  if (item.libraryId) {
    const byLib = candidates.find(
      (candidate) =>
        candidate.id === item.libraryId ||
        candidate.libraryId === item.libraryId,
    );
    if (byLib) return byLib;
  }
  const byId = candidates.find((candidate) => candidate.id === item.id);
  if (byId) return byId;
  const roleKey = normalizeKey(item.role);
  const companyKey = normalizeKey(item.company);
  return candidates.find(
    (candidate) =>
      normalizeKey(candidate.role) === roleKey &&
      normalizeKey(candidate.company) === companyKey,
  );
}

function matchProject<
  T extends Pick<Project, "id" | "name"> & {
    libraryId?: string;
  },
>(item: Project, candidates: T[]): T | undefined {
  if (item.libraryId) {
    const byLib = candidates.find(
      (candidate) =>
        candidate.id === item.libraryId ||
        candidate.libraryId === item.libraryId,
    );
    if (byLib) return byLib;
  }
  const byId = candidates.find((candidate) => candidate.id === item.id);
  if (byId) return byId;
  const nameKey = normalizeKey(item.name);
  return candidates.find(
    (candidate) => normalizeKey(candidate.name) === nameKey,
  );
}

export function VariantCompareView({
  resume,
  resumes,
  careerLibrary,
}: {
  resume: Resume;
  resumes: Resume[];
  careerLibrary: CareerLibrary;
}) {
  const otherResumes = useMemo(
    () => resumes.filter((item) => item.id !== resume.id),
    [resumes, resume.id],
  );

  const options = useMemo<CompareBaselineOption[]>(
    () => [
      {
        id: "library",
        label: "Master Career Library",
        kind: "library",
      },
      ...otherResumes.map((item) => ({
        id: item.id,
        label: item.title || "Untitled resume",
        kind: "resume" as const,
      })),
    ],
    [otherResumes],
  );

  const defaultBaselineId = useMemo(() => {
    const hasLibraryItems =
      careerLibrary.experiences.length > 0 ||
      careerLibrary.projects.length > 0 ||
      careerLibrary.skillGroups.length > 0;
    if (!hasLibraryItems && otherResumes.length > 0) {
      return otherResumes[0].id;
    }
    return "library";
  }, [careerLibrary, otherResumes]);

  const [selectedId, setSelectedId] = useState<string>(defaultBaselineId);
  const activeOption =
    options.find((opt) => opt.id === selectedId) ?? options[0];

  const baselineResume =
    activeOption.kind === "resume"
      ? otherResumes.find((item) => item.id === activeOption.id)
      : undefined;

  const comparison = useMemo(() => {
    const baseExperience = baselineResume
      ? baselineResume.experience
      : careerLibrary.experiences;
    const baseProjects = baselineResume
      ? baselineResume.projects
      : careerLibrary.projects;
    const baseSkills = baselineResume
      ? flattenResumeSkills(baselineResume)
      : flattenLibrarySkills(careerLibrary);

    const headlineChanged =
      Boolean(baselineResume) &&
      baselineResume!.basics.headline.trim() !== resume.basics.headline.trim();
    const summaryChanged =
      Boolean(baselineResume) &&
      baselineResume!.summary.trim() !== resume.summary.trim();

    const currentSkills = flattenResumeSkills(resume);
    const baseSkillKeys = new Set(baseSkills.map(normalizeKey));
    const currentSkillKeys = new Set(currentSkills.map(normalizeKey));
    const addedSkills = currentSkills.filter(
      (skill) => !baseSkillKeys.has(normalizeKey(skill)),
    );
    const omittedSkills = baseSkills.filter(
      (skill) => !currentSkillKeys.has(normalizeKey(skill)),
    );

    const experienceDiffs = resume.experience
      .map((role) => {
        const baseline = matchExperience(role, baseExperience);
        const currentHighlights = role.bullets.filter((b) => b.trim());
        const baseHighlights = (baseline?.bullets ?? []).filter((b) =>
          b.trim(),
        );
        const changed =
          !baseline ||
          currentHighlights.length !== baseHighlights.length ||
          currentHighlights.some(
            (b, idx) => b.trim() !== baseHighlights[idx]?.trim(),
          );
        return {
          role,
          baseline,
          currentHighlights,
          baseHighlights,
          changed,
        };
      })
      .filter((entry) => entry.changed);

    const projectDiffs = resume.projects
      .map((project) => {
        const baseline = matchProject(project, baseProjects);
        const currentHighlights = project.bullets.filter((b) => b.trim());
        const baseHighlights = (baseline?.bullets ?? []).filter((b) =>
          b.trim(),
        );
        const subtitleDiffers =
          Boolean(baseline) &&
          baseline!.subtitle.trim() !== project.subtitle.trim();
        const changed =
          !baseline ||
          subtitleDiffers ||
          currentHighlights.length !== baseHighlights.length ||
          currentHighlights.some(
            (b, idx) => b.trim() !== baseHighlights[idx]?.trim(),
          );
        return {
          project,
          baseline,
          currentHighlights,
          baseHighlights,
          subtitleDiffers,
          changed,
        };
      })
      .filter((entry) => entry.changed);

    const changeCount =
      (headlineChanged ? 1 : 0) +
      (summaryChanged ? 1 : 0) +
      (addedSkills.length > 0 || omittedSkills.length > 0 ? 1 : 0) +
      experienceDiffs.length +
      projectDiffs.length;

    const baselineEmpty =
      !baselineResume &&
      baseExperience.length === 0 &&
      baseProjects.length === 0 &&
      baseSkills.length === 0;

    return {
      headlineChanged,
      summaryChanged,
      addedSkills,
      omittedSkills,
      experienceDiffs,
      projectDiffs,
      changeCount,
      baselineEmpty,
    };
  }, [baselineResume, careerLibrary, resume]);

  return (
    <section
      className="variant-compare-sheet"
      data-testid="variant-compare-view"
      aria-label="Resume variant comparison"
    >
      <header className="variant-compare-header">
        <div>
          <span className="eyebrow">
            <GitCompareArrows size={13} /> Variant diff
          </span>
          <h3>Compare “{resume.title || "Untitled resume"}”</h3>
          <p className="muted-caption">
            Inspect word-level tailoring differences against another resume
            variant or your Master Career Library.
          </p>
        </div>
        <div className="field variant-compare-select">
          <label htmlFor="compare-baseline-select">Baseline</label>
          <select
            id="compare-baseline-select"
            value={activeOption.id}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.kind === "library" ? opt.label : `Resume: ${opt.label}`}
              </option>
            ))}
          </select>
        </div>
      </header>

      {comparison.baselineEmpty ? (
        <div className="variant-compare-empty">
          <strong>Your Master Career Library is empty.</strong>
          <p>
            Save roles, projects, or skills to your Career Library — or
            duplicate this resume before tailoring — to see word-level diffs
            here.
          </p>
        </div>
      ) : comparison.changeCount === 0 ? (
        <div className="variant-compare-empty">
          <strong>No wording differences found.</strong>
          <p>
            “{resume.title || "Untitled resume"}” matches {activeOption.label}{" "}
            across compared sections.
          </p>
        </div>
      ) : (
        <div className="variant-compare-body">
          <p className="variant-compare-summary" role="status">
            {comparison.changeCount} tailored section
            {comparison.changeCount === 1 ? "" : "s"} differ from{" "}
            <strong>{activeOption.label}</strong>.
          </p>

          {comparison.headlineChanged && baselineResume && (
            <article className="variant-diff-card">
              <h4>Target headline</h4>
              <DiffView
                original={baselineResume.basics.headline}
                proposed={resume.basics.headline}
              />
            </article>
          )}

          {comparison.summaryChanged && baselineResume && (
            <article className="variant-diff-card">
              <h4>Professional summary</h4>
              <DiffView
                original={baselineResume.summary}
                proposed={resume.summary}
              />
            </article>
          )}

          {(comparison.addedSkills.length > 0 ||
            comparison.omittedSkills.length > 0) && (
            <article className="variant-diff-card">
              <h4>Skills coverage</h4>
              {comparison.addedSkills.length > 0 && (
                <div className="variant-skill-group">
                  <span className="diff-tag added">
                    Added in this variant ({comparison.addedSkills.length})
                  </span>
                  <div className="chip-list">
                    {comparison.addedSkills.map((skill) => (
                      <span key={skill} className="keyword-chip matched">
                        + {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {comparison.omittedSkills.length > 0 && (
                <div className="variant-skill-group">
                  <span className="diff-tag omitted">
                    In {activeOption.label} only (
                    {comparison.omittedSkills.length})
                  </span>
                  <div className="chip-list">
                    {comparison.omittedSkills.map((skill) => (
                      <span key={skill} className="keyword-chip neutral">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </article>
          )}

          {comparison.experienceDiffs.map(
            ({ role, baseline, currentHighlights, baseHighlights }) => (
              <article key={role.id} className="variant-diff-card">
                <div className="variant-diff-card-head">
                  <h4>
                    {role.role || "Role"} · {role.company || "Company"}
                  </h4>
                  {!baseline && (
                    <span className="diff-tag added">Only in this variant</span>
                  )}
                </div>
                <div className="variant-bullet-diffs">
                  {Array.from({
                    length: Math.max(
                      currentHighlights.length,
                      baseHighlights.length,
                    ),
                  }).map((_, idx) => {
                    const orig = baseHighlights[idx] ?? "";
                    const next = currentHighlights[idx] ?? "";
                    if (orig.trim() === next.trim()) return null;
                    return (
                      <DiffView key={idx} original={orig} proposed={next} />
                    );
                  })}
                </div>
              </article>
            ),
          )}

          {comparison.projectDiffs.map(
            ({
              project,
              baseline,
              currentHighlights,
              baseHighlights,
              subtitleDiffers,
            }) => (
              <article key={project.id} className="variant-diff-card">
                <div className="variant-diff-card-head">
                  <h4>{project.name || "Project"}</h4>
                  {!baseline && (
                    <span className="diff-tag added">Only in this variant</span>
                  )}
                </div>
                {subtitleDiffers && baseline && (
                  <DiffView
                    original={baseline.subtitle}
                    proposed={project.subtitle}
                  />
                )}
                <div className="variant-bullet-diffs">
                  {Array.from({
                    length: Math.max(
                      currentHighlights.length,
                      baseHighlights.length,
                    ),
                  }).map((_, idx) => {
                    const orig = baseHighlights[idx] ?? "";
                    const next = currentHighlights[idx] ?? "";
                    if (orig.trim() === next.trim()) return null;
                    return (
                      <DiffView key={idx} original={orig} proposed={next} />
                    );
                  })}
                </div>
              </article>
            ),
          )}
        </div>
      )}
    </section>
  );
}
