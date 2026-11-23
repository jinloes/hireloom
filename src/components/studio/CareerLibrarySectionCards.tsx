import {
  Award,
  BriefcaseBusiness,
  FolderGit2,
  GraduationCap,
  Layers,
  Trash2,
} from "lucide-react";
import { formatYearMonth, type CareerLibrary } from "../../model";

export function CareerLibrarySectionCards({
  library,
  selectedExp,
  selectedProj,
  selectedEdu,
  selectedCert,
  selectedSkillGroups,
  expBulletMap,
  projBulletMap,
  allNonEmptyIndices,
  countBulletMatches,
  onToggleExpRole,
  onToggleProjItem,
  onToggleEdu,
  onToggleCert,
  onToggleSkillGroup,
  onToggleBulletIndex,
  onUpdateLibrary,
}: {
  library: CareerLibrary;
  selectedExp: string[];
  selectedProj: string[];
  selectedEdu: string[];
  selectedCert: string[];
  selectedSkillGroups: string[];
  expBulletMap: Record<string, number[]>;
  projBulletMap: Record<string, number[]>;
  allNonEmptyIndices: (bullets: string[]) => number[];
  countBulletMatches: (bulletText: string) => number;
  onToggleExpRole: (expId: string, bullets: string[]) => void;
  onToggleProjItem: (projId: string, bullets: string[]) => void;
  onToggleEdu: (eduId: string) => void;
  onToggleCert: (certId: string) => void;
  onToggleSkillGroup: (groupId: string) => void;
  onToggleBulletIndex: (
    kind: "exp" | "proj",
    entryId: string,
    allBullets: string[],
    bulletIndex: number,
  ) => void;
  onUpdateLibrary: (next: CareerLibrary) => void;
}) {
  return (
    <div className="career-library-items">
      {library.experiences.length > 0 && (
        <div className="library-section-card">
          <h3>
            <BriefcaseBusiness size={16} /> Experience roles (
            {library.experiences.length})
          </h3>
          {library.experiences.map((exp) => {
            const activeIndices =
              expBulletMap[exp.id] ?? allNonEmptyIndices(exp.bullets);
            return (
              <div className="canonical-item" key={exp.id}>
                <label className="canonical-select">
                  <input
                    type="checkbox"
                    checked={selectedExp.includes(exp.id)}
                    onChange={() => onToggleExpRole(exp.id, exp.bullets)}
                  />
                  <div>
                    <strong>{exp.role || "Untitled role"}</strong>
                    <span>
                      {[
                        exp.company,
                        [exp.startDate, exp.endDate]
                          .filter(Boolean)
                          .map(formatYearMonth)
                          .join(" – "),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                </label>
                <button
                  className="icon-button danger"
                  aria-label={`Remove ${exp.role || "role"} from library`}
                  onClick={() =>
                    onUpdateLibrary({
                      ...library,
                      experiences: library.experiences.filter(
                        (item) => item.id !== exp.id,
                      ),
                    })
                  }
                >
                  <Trash2 size={14} />
                </button>
                {exp.bullets.some((b) => b.trim()) && (
                  <ul className="canonical-bullets selectable-bullets">
                    {exp.bullets.map((b, idx) => {
                      if (!b.trim()) return null;
                      const matchCount = countBulletMatches(b);
                      const isChecked =
                        selectedExp.includes(exp.id) &&
                        activeIndices.includes(idx);
                      return (
                        <li key={idx}>
                          <label className="canonical-bullet-check">
                            <input
                              type="checkbox"
                              aria-label={`Include bullet ${idx + 1} from ${exp.role || "role"}`}
                              checked={isChecked}
                              onChange={() =>
                                onToggleBulletIndex(
                                  "exp",
                                  exp.id,
                                  exp.bullets,
                                  idx,
                                )
                              }
                            />
                            <span>{b}</span>
                          </label>
                          {matchCount > 0 && (
                            <span className="jd-match-badge">
                              Matches {matchCount} JD{" "}
                              {matchCount === 1 ? "term" : "terms"}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {library.projects.length > 0 && (
        <div className="library-section-card">
          <h3>
            <FolderGit2 size={16} /> Projects ({library.projects.length})
          </h3>
          {library.projects.map((proj) => {
            const activeIndices =
              projBulletMap[proj.id] ?? allNonEmptyIndices(proj.bullets);
            return (
              <div className="canonical-item" key={proj.id}>
                <label className="canonical-select">
                  <input
                    type="checkbox"
                    checked={selectedProj.includes(proj.id)}
                    onChange={() => onToggleProjItem(proj.id, proj.bullets)}
                  />
                  <div>
                    <strong>{proj.name || "Untitled project"}</strong>
                    {proj.subtitle && <span>{proj.subtitle}</span>}
                  </div>
                </label>
                <button
                  className="icon-button danger"
                  aria-label={`Remove ${proj.name || "project"} from library`}
                  onClick={() =>
                    onUpdateLibrary({
                      ...library,
                      projects: library.projects.filter(
                        (item) => item.id !== proj.id,
                      ),
                    })
                  }
                >
                  <Trash2 size={14} />
                </button>
                {proj.bullets.some((b) => b.trim()) && (
                  <ul className="canonical-bullets selectable-bullets">
                    {proj.bullets.map((b, idx) => {
                      if (!b.trim()) return null;
                      const matchCount = countBulletMatches(b);
                      const isChecked =
                        selectedProj.includes(proj.id) &&
                        activeIndices.includes(idx);
                      return (
                        <li key={idx}>
                          <label className="canonical-bullet-check">
                            <input
                              type="checkbox"
                              aria-label={`Include bullet ${idx + 1} from ${proj.name || "project"}`}
                              checked={isChecked}
                              onChange={() =>
                                onToggleBulletIndex(
                                  "proj",
                                  proj.id,
                                  proj.bullets,
                                  idx,
                                )
                              }
                            />
                            <span>{b}</span>
                          </label>
                          {matchCount > 0 && (
                            <span className="jd-match-badge">
                              Matches {matchCount} JD{" "}
                              {matchCount === 1 ? "term" : "terms"}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {library.education.length > 0 && (
        <div className="library-section-card">
          <h3>
            <GraduationCap size={16} /> Education ({library.education.length})
          </h3>
          {library.education.map((edu) => (
            <div className="canonical-item" key={edu.id}>
              <label className="canonical-select">
                <input
                  type="checkbox"
                  checked={selectedEdu.includes(edu.id)}
                  onChange={() => onToggleEdu(edu.id)}
                />
                <div>
                  <strong>{edu.school || "School"}</strong>
                  <span>
                    {[edu.degree, edu.graduation].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </label>
              <button
                className="icon-button danger"
                aria-label={`Remove ${edu.school || "education"} from library`}
                onClick={() =>
                  onUpdateLibrary({
                    ...library,
                    education: library.education.filter(
                      (item) => item.id !== edu.id,
                    ),
                  })
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {library.certifications.length > 0 && (
        <div className="library-section-card">
          <h3>
            <Award size={16} /> Certifications ({library.certifications.length})
          </h3>
          {library.certifications.map((cert) => (
            <div className="canonical-item" key={cert.id}>
              <label className="canonical-select">
                <input
                  type="checkbox"
                  checked={selectedCert.includes(cert.id)}
                  onChange={() => onToggleCert(cert.id)}
                />
                <div>
                  <strong>{cert.name}</strong>
                  <span>
                    {[cert.issuer, cert.date].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </label>
              <button
                className="icon-button danger"
                aria-label={`Remove ${cert.name || "certification"} from library`}
                onClick={() =>
                  onUpdateLibrary({
                    ...library,
                    certifications: library.certifications.filter(
                      (item) => item.id !== cert.id,
                    ),
                  })
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {library.skillGroups.length > 0 && (
        <div className="library-section-card">
          <h3>
            <Layers size={16} /> Skill categories ({library.skillGroups.length})
          </h3>
          {library.skillGroups.map((group) => (
            <div className="canonical-item" key={group.id}>
              <label className="canonical-select">
                <input
                  type="checkbox"
                  checked={selectedSkillGroups.includes(group.id)}
                  onChange={() => onToggleSkillGroup(group.id)}
                />
                <div>
                  <strong>{group.category || "Category"}</strong>
                  <span>{group.items.join(" · ")}</span>
                </div>
              </label>
              <button
                className="icon-button danger"
                aria-label={`Remove ${group.category || "skill group"} from library`}
                onClick={() =>
                  onUpdateLibrary({
                    ...library,
                    skillGroups: library.skillGroups.filter(
                      (item) => item.id !== group.id,
                    ),
                  })
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
