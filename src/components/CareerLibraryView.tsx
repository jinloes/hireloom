import { useMemo, useState } from "react";
import {
  BookMarked,
  Check,
  Plus,
  RefreshCw,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { containsPhrase } from "../keywords";
import {
  buildTailoredResumeFromLibrary,
  createResume,
  jobKeywords,
  type CareerLibrary,
  type Resume,
} from "../model";
import { Field } from "./Editor";
import { CareerLibrarySectionCards } from "./studio/CareerLibrarySectionCards";

export function CareerLibraryView({
  library,
  activeResume,
  resumeCount,
  onUpdateLibrary,
  onSyncFromActiveResume,
  onCreateTailoredResume,
}: {
  library: CareerLibrary;
  activeResume: Resume;
  resumeCount: number;
  onUpdateLibrary: (next: CareerLibrary) => void;
  onSyncFromActiveResume: () => void;
  onCreateTailoredResume: (resume: Resume) => void;
}) {
  const [builderTitle, setBuilderTitle] = useState("Tailored application");
  const [builderJob, setBuilderJob] = useState("");
  const [selectedExp, setSelectedExp] = useState<string[]>([]);
  const [selectedProj, setSelectedProj] = useState<string[]>([]);
  const [selectedEdu, setSelectedEdu] = useState<string[]>([]);
  const [selectedCert, setSelectedCert] = useState<string[]>([]);
  const [selectedSkillGroups, setSelectedSkillGroups] = useState<string[]>([]);
  const [expBulletMap, setExpBulletMap] = useState<Record<string, number[]>>(
    {},
  );
  const [projBulletMap, setProjBulletMap] = useState<Record<string, number[]>>(
    {},
  );

  const jdTerms = useMemo(() => {
    if (!builderJob.trim()) return [];
    const probe = { ...createResume(), jobDescription: builderJob };
    return jobKeywords(probe).map((k) => k.term);
  }, [builderJob]);

  const countBulletMatches = (bulletText: string): number => {
    if (!jdTerms.length || !bulletText.trim()) return 0;
    return jdTerms.filter((term) => containsPhrase(bulletText, term)).length;
  };

  const totalItems =
    library.experiences.length +
    library.projects.length +
    library.education.length +
    library.certifications.length +
    library.skillGroups.length;

  const allNonEmptyIndices = (bullets: string[]) =>
    bullets
      .map((text, idx) => ({ text, idx }))
      .filter(({ text }) => text.trim().length > 0)
      .map(({ idx }) => idx);

  const toggle = (
    list: string[],
    setList: (next: string[]) => void,
    id: string,
  ) => {
    setList(
      list.includes(id) ? list.filter((item) => item !== id) : [...list, id],
    );
  };

  const toggleExpRole = (expId: string, bullets: string[]) => {
    if (selectedExp.includes(expId)) {
      setSelectedExp(selectedExp.filter((id) => id !== expId));
    } else {
      setSelectedExp([...selectedExp, expId]);
      if (!expBulletMap[expId]) {
        setExpBulletMap((prev) => ({
          ...prev,
          [expId]: allNonEmptyIndices(bullets),
        }));
      }
    }
  };

  const toggleProjItem = (projId: string, bullets: string[]) => {
    if (selectedProj.includes(projId)) {
      setSelectedProj(selectedProj.filter((id) => id !== projId));
    } else {
      setSelectedProj([...selectedProj, projId]);
      if (!projBulletMap[projId]) {
        setProjBulletMap((prev) => ({
          ...prev,
          [projId]: allNonEmptyIndices(bullets),
        }));
      }
    }
  };

  const toggleBulletIndex = (
    kind: "exp" | "proj",
    entryId: string,
    allBullets: string[],
    bulletIndex: number,
  ) => {
    const map = kind === "exp" ? expBulletMap : projBulletMap;
    const setMap = kind === "exp" ? setExpBulletMap : setProjBulletMap;
    const selectedIds = kind === "exp" ? selectedExp : selectedProj;
    const setSelectedIds = kind === "exp" ? setSelectedExp : setSelectedProj;

    const current = map[entryId] ?? allNonEmptyIndices(allBullets);
    const next = current.includes(bulletIndex)
      ? current.filter((i) => i !== bulletIndex)
      : [...current, bulletIndex].sort((a, b) => a - b);

    setMap((prev) => ({ ...prev, [entryId]: next }));
    if (next.length > 0 && !selectedIds.includes(entryId)) {
      setSelectedIds([...selectedIds, entryId]);
    }
  };

  const selectAll = () => {
    setSelectedExp(library.experiences.map((i) => i.id));
    setSelectedProj(library.projects.map((i) => i.id));
    setSelectedEdu(library.education.map((i) => i.id));
    setSelectedCert(library.certifications.map((i) => i.id));
    setSelectedSkillGroups(library.skillGroups.map((i) => i.id));
    const allExp: Record<string, number[]> = {};
    for (const exp of library.experiences) {
      allExp[exp.id] = allNonEmptyIndices(exp.bullets);
    }
    const allProj: Record<string, number[]> = {};
    for (const proj of library.projects) {
      allProj[proj.id] = allNonEmptyIndices(proj.bullets);
    }
    setExpBulletMap(allExp);
    setProjBulletMap(allProj);
  };

  const autoPickMatching = () => {
    if (!jdTerms.length) {
      selectAll();
      return;
    }
    const nextExpIds: string[] = [];
    const nextExpBullets: Record<string, number[]> = {};
    for (const exp of library.experiences) {
      const scored = exp.bullets
        .map((text, idx) => ({ text, idx, score: countBulletMatches(text) }))
        .filter(({ text }) => text.trim().length > 0);
      const matched = scored.filter((item) => item.score > 0).map((i) => i.idx);
      const chosen =
        matched.length > 0 ? matched : scored.slice(0, 2).map((i) => i.idx);
      if (chosen.length > 0) {
        nextExpIds.push(exp.id);
        nextExpBullets[exp.id] = chosen;
      }
    }

    const nextProjIds: string[] = [];
    const nextProjBullets: Record<string, number[]> = {};
    for (const proj of library.projects) {
      const matched = proj.bullets
        .map((text, idx) => ({ text, idx, score: countBulletMatches(text) }))
        .filter(({ text, score }) => text.trim().length > 0 && score > 0)
        .map((i) => i.idx);
      if (
        matched.length > 0 ||
        jdTerms.some(
          (term) =>
            containsPhrase(proj.name, term) ||
            containsPhrase(proj.subtitle, term),
        )
      ) {
        nextProjIds.push(proj.id);
        nextProjBullets[proj.id] =
          matched.length > 0 ? matched : allNonEmptyIndices(proj.bullets);
      }
    }

    setSelectedExp(nextExpIds);
    setExpBulletMap(nextExpBullets);
    setSelectedProj(nextProjIds);
    setProjBulletMap(nextProjBullets);
    setSelectedEdu(library.education.map((i) => i.id));
    setSelectedCert(library.certifications.map((i) => i.id));
    setSelectedSkillGroups(library.skillGroups.map((i) => i.id));
  };

  const handleBuildVariant = () => {
    const variant = buildTailoredResumeFromLibrary({
      baseResume: activeResume,
      library,
      title: builderTitle,
      experienceIds: selectedExp,
      projectIds: selectedProj,
      educationIds: selectedEdu,
      certificationIds: selectedCert,
      skillGroupIds: selectedSkillGroups,
      selectedExperienceBullets: expBulletMap,
      selectedProjectBullets: projBulletMap,
      jobDescription: builderJob,
    });
    onCreateTailoredResume(variant);
  };

  return (
    <section className="library career-library" aria-label="Career library">
      <div className="library-toolbar">
        <span>
          <BookMarked size={15} /> {totalItems} canonical career item
          {totalItems === 1 ? "" : "s"} saved on this device
        </span>
        <div className="button-row">
          <button
            className="button secondary small"
            onClick={onSyncFromActiveResume}
          >
            <RefreshCw size={14} /> Save items from “{activeResume.title}”
          </button>
        </div>
      </div>

      {totalItems === 0 ? (
        <div className="career-library-empty">
          <BookMarked size={28} />
          <h2>Build once. Tailor for every role.</h2>
          <p>
            Keep your canonical work history, APR-refined bullets, projects,
            education, and skill categories in one master library. Spin up
            focused 1-page resumes without letting versions drift apart.
          </p>
          <button className="button primary" onClick={onSyncFromActiveResume}>
            <Plus size={16} /> Import from current resume
          </button>
        </div>
      ) : (
        <div className="career-library-grid">
          <CareerLibrarySectionCards
            library={library}
            selectedExp={selectedExp}
            selectedProj={selectedProj}
            selectedEdu={selectedEdu}
            selectedCert={selectedCert}
            selectedSkillGroups={selectedSkillGroups}
            expBulletMap={expBulletMap}
            projBulletMap={projBulletMap}
            allNonEmptyIndices={allNonEmptyIndices}
            countBulletMatches={countBulletMatches}
            onToggleExpRole={toggleExpRole}
            onToggleProjItem={toggleProjItem}
            onToggleEdu={(id) => toggle(selectedEdu, setSelectedEdu, id)}
            onToggleCert={(id) => toggle(selectedCert, setSelectedCert, id)}
            onToggleSkillGroup={(id) =>
              toggle(selectedSkillGroups, setSelectedSkillGroups, id)
            }
            onToggleBulletIndex={toggleBulletIndex}
            onUpdateLibrary={onUpdateLibrary}
          />

          <aside className="variant-builder-card">
            <div className="card-heading">
              <strong>
                <WandSparkles size={16} /> Create tailored variant
              </strong>
              <button className="text-button" onClick={selectAll}>
                <Check size={12} /> Select all
              </button>
            </div>
            <p className="fine-print">
              Check the roles, projects, education, and skill groups on the left
              that best fit this opportunity. Your personal details and design
              settings carry over from “{activeResume.title}”.
            </p>
            <Field
              label="Variant resume title"
              value={builderTitle}
              onChange={setBuilderTitle}
              maxLength={120}
              placeholder="e.g. Staff Backend Engineer · Acme"
            />
            <Field
              label="Target job description (optional)"
              value={builderJob}
              onChange={setBuilderJob}
              multiline
              rows={5}
              maxLength={20_000}
              placeholder="Paste the job posting so matching bullets highlight automatically…"
            />
            {jdTerms.length > 0 && (
              <button
                type="button"
                className="button secondary small"
                onClick={autoPickMatching}
              >
                <Sparkles size={13} /> Auto-pick JD-matching bullets
              </button>
            )}
            <button
              className="button primary generate-button"
              disabled={resumeCount >= 50}
              onClick={handleBuildVariant}
            >
              <Plus size={16} /> Create tailored resume
            </button>
          </aside>
        </div>
      )}
    </section>
  );
}
