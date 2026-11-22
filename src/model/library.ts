import {
  createResume,
  type CareerLibrary,
  type Certification,
  type Education,
  type Experience,
  type Project,
  type Resume,
  type SkillGroup,
  type Workspace,
} from "./schemas";

function stripLibraryId<T extends { libraryId?: string }>(
  entry: T,
): Omit<T, "libraryId"> {
  const copy = { ...entry };
  delete copy.libraryId;
  return copy;
}

export function isExperienceOutOfSync(
  entry: Experience,
  library: CareerLibrary,
): boolean {
  if (!entry.libraryId) return false;
  const canonical = library.experiences.find(
    (item) => item.id === entry.libraryId,
  );
  if (!canonical) return false;
  return (
    canonical.role !== entry.role ||
    canonical.company !== entry.company ||
    canonical.location !== entry.location ||
    canonical.startDate !== entry.startDate ||
    canonical.endDate !== entry.endDate ||
    JSON.stringify(canonical.bullets) !== JSON.stringify(entry.bullets)
  );
}

export function isProjectOutOfSync(
  project: Project,
  library: CareerLibrary,
): boolean {
  if (!project.libraryId) return false;
  const canonical = library.projects.find(
    (item) => item.id === project.libraryId,
  );
  if (!canonical) return false;
  return (
    canonical.name !== project.name ||
    canonical.subtitle !== project.subtitle ||
    canonical.url !== project.url ||
    canonical.startDate !== project.startDate ||
    canonical.endDate !== project.endDate ||
    JSON.stringify(canonical.bullets) !== JSON.stringify(project.bullets)
  );
}

export function saveExperienceToLibrary(
  workspace: Workspace,
  resumeId: string,
  experienceId: string,
): Workspace {
  const resume = workspace.resumes.find((item) => item.id === resumeId);
  const entry = resume?.experience.find((item) => item.id === experienceId);
  if (!resume || !entry) return workspace;

  const existingIndex = entry.libraryId
    ? workspace.careerLibrary.experiences.findIndex(
        (item) => item.id === entry.libraryId,
      )
    : -1;
  const canonicalId =
    existingIndex >= 0
      ? workspace.careerLibrary.experiences[existingIndex].id
      : crypto.randomUUID();
  if (existingIndex < 0 && workspace.careerLibrary.experiences.length >= 50) {
    throw new Error("Your Career Library already holds the maximum 50 roles.");
  }
  const canonical: Experience = {
    ...stripLibraryId(structuredClone(entry)),
    id: canonicalId,
  };
  const experiences =
    existingIndex >= 0
      ? workspace.careerLibrary.experiences.map((item, i) =>
          i === existingIndex ? canonical : item,
        )
      : [...workspace.careerLibrary.experiences, canonical];

  return {
    ...workspace,
    careerLibrary: { ...workspace.careerLibrary, experiences },
    resumes: workspace.resumes.map((item) =>
      item.id === resumeId
        ? {
            ...item,
            updatedAt: new Date().toISOString(),
            experience: item.experience.map((exp) =>
              exp.id === experienceId
                ? { ...exp, libraryId: canonicalId }
                : exp,
            ),
          }
        : item,
    ),
  };
}

export function saveProjectToLibrary(
  workspace: Workspace,
  resumeId: string,
  projectId: string,
): Workspace {
  const resume = workspace.resumes.find((item) => item.id === resumeId);
  const project = resume?.projects.find((item) => item.id === projectId);
  if (!resume || !project) return workspace;

  const existingIndex = project.libraryId
    ? workspace.careerLibrary.projects.findIndex(
        (item) => item.id === project.libraryId,
      )
    : -1;
  const canonicalId =
    existingIndex >= 0
      ? workspace.careerLibrary.projects[existingIndex].id
      : crypto.randomUUID();
  if (existingIndex < 0 && workspace.careerLibrary.projects.length >= 40) {
    throw new Error(
      "Your Career Library already holds the maximum 40 projects.",
    );
  }
  const canonical: Project = {
    ...stripLibraryId(structuredClone(project)),
    id: canonicalId,
  };
  const projects =
    existingIndex >= 0
      ? workspace.careerLibrary.projects.map((item, i) =>
          i === existingIndex ? canonical : item,
        )
      : [...workspace.careerLibrary.projects, canonical];

  return {
    ...workspace,
    careerLibrary: { ...workspace.careerLibrary, projects },
    resumes: workspace.resumes.map((item) =>
      item.id === resumeId
        ? {
            ...item,
            updatedAt: new Date().toISOString(),
            projects: item.projects.map((proj) =>
              proj.id === projectId
                ? { ...proj, libraryId: canonicalId }
                : proj,
            ),
          }
        : item,
    ),
  };
}

export function syncResumeToCareerLibrary(
  workspace: Workspace,
  resumeId: string,
): Workspace {
  let next = workspace;
  const resume = workspace.resumes.find((item) => item.id === resumeId);
  if (!resume) return workspace;

  for (const exp of resume.experience) {
    if (exp.role.trim() || exp.company.trim()) {
      if (exp.libraryId || next.careerLibrary.experiences.length < 50) {
        next = saveExperienceToLibrary(next, resumeId, exp.id);
      }
    }
  }
  for (const proj of resume.projects) {
    if (proj.name.trim()) {
      if (proj.libraryId || next.careerLibrary.projects.length < 40) {
        next = saveProjectToLibrary(next, resumeId, proj.id);
      }
    }
  }

  const latestResume = next.resumes.find((item) => item.id === resumeId)!;
  let educationLibrary = [...next.careerLibrary.education];
  const updatedEducation = latestResume.education.map((edu) => {
    if (!edu.school.trim() && !edu.degree.trim()) return edu;
    const idx = edu.libraryId
      ? educationLibrary.findIndex((item) => item.id === edu.libraryId)
      : -1;
    if (idx < 0 && educationLibrary.length >= 30) return edu;
    const canonicalId =
      idx >= 0 ? educationLibrary[idx].id : crypto.randomUUID();
    const canonical: Education = {
      ...stripLibraryId(structuredClone(edu)),
      id: canonicalId,
    };
    educationLibrary =
      idx >= 0
        ? educationLibrary.map((item, i) => (i === idx ? canonical : item))
        : [...educationLibrary, canonical];
    return { ...edu, libraryId: canonicalId };
  });

  let certLibrary = [...next.careerLibrary.certifications];
  const updatedCerts = latestResume.certifications.map((cert) => {
    if (!cert.name.trim()) return cert;
    const idx = cert.libraryId
      ? certLibrary.findIndex((item) => item.id === cert.libraryId)
      : -1;
    if (idx < 0 && certLibrary.length >= 30) return cert;
    const canonicalId = idx >= 0 ? certLibrary[idx].id : crypto.randomUUID();
    const canonical: Certification = {
      ...stripLibraryId(structuredClone(cert)),
      id: canonicalId,
    };
    certLibrary =
      idx >= 0
        ? certLibrary.map((item, i) => (i === idx ? canonical : item))
        : [...certLibrary, canonical];
    return { ...cert, libraryId: canonicalId };
  });

  let skillLibrary = [...next.careerLibrary.skillGroups];
  const updatedSkillGroups = latestResume.skillGroups.map((group) => {
    if (!group.category.trim() && !group.items.some((s) => s.trim()))
      return group;
    const idx = group.libraryId
      ? skillLibrary.findIndex((item) => item.id === group.libraryId)
      : -1;
    if (idx < 0 && skillLibrary.length >= 30) return group;
    const canonicalId = idx >= 0 ? skillLibrary[idx].id : crypto.randomUUID();
    const canonical: SkillGroup = {
      ...stripLibraryId(structuredClone(group)),
      id: canonicalId,
    };
    skillLibrary =
      idx >= 0
        ? skillLibrary.map((item, i) => (i === idx ? canonical : item))
        : [...skillLibrary, canonical];
    return { ...group, libraryId: canonicalId };
  });

  return {
    ...next,
    careerLibrary: {
      ...next.careerLibrary,
      education: educationLibrary,
      certifications: certLibrary,
      skillGroups: skillLibrary,
    },
    resumes: next.resumes.map((item) =>
      item.id === resumeId
        ? {
            ...item,
            updatedAt: new Date().toISOString(),
            education: updatedEducation,
            certifications: updatedCerts,
            skillGroups: updatedSkillGroups,
          }
        : item,
    ),
  };
}

export function pullExperienceFromLibrary(
  resume: Resume,
  experienceId: string,
  library: CareerLibrary,
): Resume {
  const entry = resume.experience.find((item) => item.id === experienceId);
  if (!entry?.libraryId) return resume;
  const canonical = library.experiences.find(
    (item) => item.id === entry.libraryId,
  );
  if (!canonical) return resume;
  return {
    ...resume,
    updatedAt: new Date().toISOString(),
    experience: resume.experience.map((item) =>
      item.id === experienceId
        ? {
            ...structuredClone(canonical),
            id: entry.id,
            libraryId: canonical.id,
          }
        : item,
    ),
  };
}

export function pullProjectFromLibrary(
  resume: Resume,
  projectId: string,
  library: CareerLibrary,
): Resume {
  const project = resume.projects.find((item) => item.id === projectId);
  if (!project?.libraryId) return resume;
  const canonical = library.projects.find(
    (item) => item.id === project.libraryId,
  );
  if (!canonical) return resume;
  return {
    ...resume,
    updatedAt: new Date().toISOString(),
    projects: resume.projects.map((item) =>
      item.id === projectId
        ? {
            ...structuredClone(canonical),
            id: project.id,
            libraryId: canonical.id,
          }
        : item,
    ),
  };
}

export function buildTailoredResumeFromLibrary(options: {
  baseResume?: Resume;
  library: CareerLibrary;
  title: string;
  experienceIds: string[];
  projectIds: string[];
  educationIds: string[];
  certificationIds: string[];
  skillGroupIds: string[];
  selectedExperienceBullets?: Record<string, number[]>;
  selectedProjectBullets?: Record<string, number[]>;
  jobDescription?: string;
}): Resume {
  const templateBase = options.baseResume ?? createResume();
  const pick = <T extends { id: string }>(items: T[], ids: string[]) =>
    ids
      .map((selectedId) => items.find((item) => item.id === selectedId))
      .filter((item): item is T => Boolean(item))
      .map((item) => ({
        ...structuredClone(item),
        id: crypto.randomUUID(),
        libraryId: item.id,
      }));

  const pickWithBullets = <T extends { id: string; bullets: string[] }>(
    items: T[],
    ids: string[],
    bulletMap?: Record<string, number[]>,
  ) =>
    ids
      .map((selectedId) => items.find((item) => item.id === selectedId))
      .filter((item): item is T => Boolean(item))
      .map((item) => {
        const chosenIndices = bulletMap?.[item.id];
        const filteredBullets = chosenIndices
          ? item.bullets.filter((_, idx) => chosenIndices.includes(idx))
          : item.bullets;
        return {
          ...structuredClone(item),
          id: crypto.randomUUID(),
          libraryId: item.id,
          bullets: [...filteredBullets],
        };
      });

  return {
    ...createResume(),
    title: options.title.trim().slice(0, 120) || "Tailored resume",
    basics: structuredClone(templateBase.basics),
    summary: templateBase.summary,
    skills: structuredClone(templateBase.skills),
    template: templateBase.template,
    accent: templateBase.accent,
    pageSize: templateBase.pageSize,
    density: templateBase.density,
    sectionOrder: [...templateBase.sectionOrder],
    jobDescription: (options.jobDescription ?? "").slice(0, 20_000),
    experience: pickWithBullets(
      options.library.experiences,
      options.experienceIds,
      options.selectedExperienceBullets,
    ).slice(0, 30),
    projects: pickWithBullets(
      options.library.projects,
      options.projectIds,
      options.selectedProjectBullets,
    ).slice(0, 20),
    education: pick(options.library.education, options.educationIds).slice(
      0,
      20,
    ),
    certifications: pick(
      options.library.certifications,
      options.certificationIds,
    ).slice(0, 20),
    skillGroups: pick(options.library.skillGroups, options.skillGroupIds).slice(
      0,
      20,
    ),
  };
}
