import { describe, expect, it } from "vitest";
import { auditResume } from "./audit";
import { computeWordDiff } from "./diff";
import { createDocxBytes } from "./docxExport";
import {
  addKeywordToSkills,
  applyAprRewrite,
  applyPartialProposal,
  applyProposal,
  applyRoleTailorProposal,
  buildTailoredResumeFromLibrary,
  createResume,
  defaultProposalSelection,
  documentFilename,
  exampleResume,
  formatYearMonth,
  initialWorkspace,
  isExperienceOutOfSync,
  jobKeywords,
  MAX_WORKSPACE_BYTES,
  mergeAiImportedStructure,
  normalizeAprAnswers,
  parseWorkspace,
  pullExperienceFromLibrary,
  restoreJobKeyword,
  resumeReadiness,
  skipJobKeyword,
  syncResumeToCareerLibrary,
  validateProposal,
  validateAprAnalysis,
  validateAprQuestionAnswers,
  validateAprRefinement,
  validateAprTarget,
  WORKSPACE_VERSION,
} from "./model";
import {
  extractDocxLines,
  parseResumeLinesToDraft,
  redactImportLinesForAi,
} from "./resumeImport";

describe("workspace validation", () => {
  it("round trips a workspace and keeps empty resumes valid", () => {
    const workspace = initialWorkspace();
    expect(parseWorkspace(JSON.stringify(workspace))).toEqual(workspace);
  });

  it("upgrades version-1 workspaces created before v2 fields existed", () => {
    const legacyV1 = {
      version: 1,
      activeResumeId: "legacy-1",
      resumes: [
        {
          id: "legacy-1",
          title: "Legacy Resume",
          updatedAt: "2026-09-15T00:00:00.000Z",
          basics: {
            name: "Alex",
            headline: "Designer",
            email: "alex@example.com",
            phone: "",
            location: "Remote",
            website: "",
          },
          summary: "Thoughtful product designer.",
          experience: [],
          education: [],
          skills: ["Figma"],
          jobDescription: "",
          template: "editorial",
          accent: "teal",
        },
      ],
    };
    const migrated = parseWorkspace(JSON.stringify(legacyV1));
    expect(migrated.version).toBe(WORKSPACE_VERSION);
    expect(migrated.resumes[0].basics.github).toBe("");
    expect(migrated.resumes[0].pageSize).toBe("a4");
    expect(migrated.resumes[0].density).toBe("standard");
    expect(migrated.resumes[0].projects).toEqual([]);
    expect(migrated.careerLibrary.experiences).toEqual([]);
  });

  it("rejects corrupt data, future versions, missing selections, and duplicate IDs", () => {
    const workspace = initialWorkspace();
    expect(() => parseWorkspace("{broken")).toThrow();
    expect(() =>
      parseWorkspace(JSON.stringify({ ...workspace, version: 3 })),
    ).toThrow();
    expect(() =>
      parseWorkspace(
        JSON.stringify({ ...workspace, activeResumeId: "missing" }),
      ),
    ).toThrow();
    expect(() =>
      parseWorkspace(
        JSON.stringify({
          ...workspace,
          resumes: [workspace.resumes[0], workspace.resumes[0]],
        }),
      ),
    ).toThrow();
  });

  it("rejects oversized imports before parsing", () => {
    expect(() => parseWorkspace("x".repeat(MAX_WORKSPACE_BYTES + 1))).toThrow(
      "2 MB",
    );
  });

  it("rejects duplicate entries and unknown fields", () => {
    const resume = exampleResume();
    const workspace = {
      version: 1,
      activeResumeId: resume.id,
      resumes: [resume],
    };
    resume.experience.push(resume.experience[0]);
    expect(() => parseWorkspace(JSON.stringify(workspace))).toThrow(
      "Duplicate experience",
    );
    expect(() =>
      parseWorkspace(
        JSON.stringify({ ...initialWorkspace(), token: "not-supported" }),
      ),
    ).toThrow();
  });
});

describe("AI proposals", () => {
  it("applies only summary and matched highlights, preserving facts and order", () => {
    const resume = exampleResume();
    const proposal = {
      summary: "A clearer, factual summary.",
      experience: [...resume.experience].reverse().map((entry) => ({
        id: entry.id,
        bullets: [`Rewritten ${entry.role}`],
      })),
      notes: ["Review this text."],
    };
    const updated = applyProposal(resume, proposal);
    expect(updated.basics).toEqual(resume.basics);
    expect(updated.skills).toEqual(resume.skills);
    expect(updated.education).toEqual(resume.education);
    expect(updated.experience[0].company).toEqual(resume.experience[0].company);
    expect(updated.experience[0].bullets).toEqual([
      `Rewritten ${resume.experience[0].role}`,
    ]);
    expect(resume.summary).not.toEqual(updated.summary);
  });

  describe("APR accomplishment analysis", () => {
    it("validates exact targets and applies only the selected bullet", () => {
      const resume = exampleResume();
      const target = {
        resumeId: resume.id,
        experienceId: resume.experience[0].id,
        bulletIndex: 1,
        role: resume.experience[0].role,
        bullet: resume.experience[0].bullets[1],
      };
      expect(validateAprTarget(target, resume)).toEqual(target);
      const updated = applyAprRewrite(
        resume,
        target,
        "Built a shared, accessible design system with engineering partners.",
      );
      expect(updated.experience[0].bullets[1]).toContain("accessible");
      expect(updated.experience[0].bullets[0]).toBe(
        resume.experience[0].bullets[0],
      );
      expect(updated.experience[1]).toEqual(resume.experience[1]);
      expect(updated.basics).toEqual(resume.basics);
      expect(updated.summary).toBe(resume.summary);
    });

    it("rejects stale, malformed, oversized, and mismatched APR data", () => {
      const resume = exampleResume();
      const target = {
        resumeId: resume.id,
        experienceId: resume.experience[0].id,
        bulletIndex: 0,
        role: resume.experience[0].role,
        bullet: resume.experience[0].bullets[0],
      };
      const analysis = {
        target,
        action: { status: "clear" as const, feedback: "Specific action." },
        project: { status: "partial" as const, feedback: "Add context." },
        result: {
          status: "missing" as const,
          feedback: "Add supported impact.",
        },
        rewrite: "Led a focused onboarding redesign.",
        questions: ["What changed after the redesign?"],
      };
      expect(validateAprAnalysis(analysis, target)).toEqual(analysis);
      const { rewrite: _omitted, ...analysisWithoutRewrite } = analysis;
      expect(
        validateAprAnalysis(analysisWithoutRewrite, target).rewrite,
      ).toBeUndefined();
      expect(() =>
        validateAprAnalysis(
          { ...analysis, target: { ...target, bulletIndex: 1 } },
          target,
        ),
      ).toThrow("different accomplishment");
      expect(() =>
        validateAprAnalysis({ ...analysis, invented: true }, target),
      ).toThrow();
      expect(() =>
        validateAprAnalysis(
          { ...analysis, questions: Array(6).fill("Question?") },
          target,
        ),
      ).toThrow();
      expect(() =>
        validateAprAnalysis(
          { ...analysis, questions: ["Duplicate?", "Duplicate?"] },
          target,
        ),
      ).toThrow("unique");
      expect(() =>
        validateAprTarget({ ...target, bullet: "x".repeat(2_001) }, resume),
      ).toThrow();
      expect(() => applyAprRewrite(resume, target, target.bullet)).toThrow(
        "changed",
      );
      expect(() =>
        validateAprTarget({ ...target, role: "Changed role" }, resume),
      ).toThrow("no longer matches");
    });

    it("normalizes ordered nonblank APR answers and validates refinement echoes", () => {
      const resume = exampleResume();
      const target = {
        resumeId: resume.id,
        experienceId: resume.experience[0].id,
        bulletIndex: 0,
        role: resume.experience[0].role,
        bullet: resume.experience[0].bullets[0],
      };
      const questions = ["What changed?", "Who benefited?", "How was it done?"];
      const answers = normalizeAprAnswers(questions, [
        "  Faster onboarding.  ",
        "",
        " With usability tests. ",
      ]);
      expect(answers).toEqual([
        { question: questions[0], answer: "Faster onboarding." },
        { question: questions[2], answer: "With usability tests." },
      ]);
      expect(validateAprQuestionAnswers(questions, answers)).toEqual(answers);
      const refinement = {
        target,
        answers,
        rewrite:
          "Led an onboarding redesign validated through usability testing.",
      };
      expect(validateAprRefinement(refinement, target, answers)).toEqual(
        refinement,
      );
    });

    it("rejects invalid APR answer binding, limits, and refinement data", () => {
      const resume = exampleResume();
      const target = {
        resumeId: resume.id,
        experienceId: resume.experience[0].id,
        bulletIndex: 0,
        role: resume.experience[0].role,
        bullet: resume.experience[0].bullets[0],
      };
      const questions = ["First?", "Second?"];
      expect(() => normalizeAprAnswers(questions, [""])).toThrow("match");
      expect(() =>
        normalizeAprAnswers(["Duplicate?", "Duplicate?"], ["a", "b"]),
      ).toThrow("unique");
      expect(() =>
        validateAprQuestionAnswers(questions, [
          { question: "Second?", answer: "two" },
          { question: "First?", answer: "one" },
        ]),
      ).toThrow("display order");
      expect(() =>
        validateAprQuestionAnswers(questions, [
          { question: "First?", answer: "one" },
          { question: "First?", answer: "again" },
        ]),
      ).toThrow("duplicated");
      expect(() =>
        validateAprQuestionAnswers(questions, [
          { question: "Unknown?", answer: "one" },
        ]),
      ).toThrow("unknown");
      expect(() =>
        validateAprQuestionAnswers(questions, [
          { question: "First?", answer: " untrimmed " },
        ]),
      ).toThrow("trimmed");
      expect(() =>
        validateAprQuestionAnswers(questions, [
          { question: "First?", answer: "x".repeat(2_001) },
        ]),
      ).toThrow();
      expect(() => validateAprQuestionAnswers(questions, [])).toThrow();
      const answers = [{ question: "First?", answer: "one" }];
      expect(() =>
        validateAprRefinement(
          { target, answers, rewrite: target.bullet },
          target,
          answers,
        ),
      ).toThrow("changed");
      expect(() =>
        validateAprRefinement(
          {
            target: { ...target, bulletIndex: 1 },
            answers,
            rewrite: "Changed.",
          },
          target,
          answers,
        ),
      ).toThrow("different accomplishment");
      expect(() =>
        validateAprRefinement(
          {
            target,
            answers: [{ question: "First?", answer: "other" }],
            rewrite: "Changed.",
          },
          target,
          answers,
        ),
      ).toThrow("different answers");
      expect(() =>
        validateAprRefinement(
          { target, answers, rewrite: "Changed.", extra: true },
          target,
          answers,
        ),
      ).toThrow();
    });
  });

  it("rejects unknown, duplicate, missing and extra factual fields", () => {
    const resume = exampleResume();
    const entries = resume.experience.map((entry) => ({
      id: entry.id,
      bullets: [],
    }));
    expect(() =>
      validateProposal({ summary: "", experience: [], notes: [] }, resume),
    ).toThrow("mismatched");
    expect(() =>
      validateProposal(
        { summary: "", experience: [entries[0], entries[0]], notes: [] },
        resume,
      ),
    ).toThrow("mismatched");
    expect(() =>
      validateProposal(
        {
          summary: "",
          experience: [{ id: "wrong", bullets: [] }, entries[1]],
          notes: [],
        },
        resume,
      ),
    ).toThrow("mismatched");
    expect(() =>
      validateProposal(
        { summary: "", experience: entries, notes: [], skills: ["invented"] },
        resume,
      ),
    ).toThrow();
  });
});

describe("local feedback", () => {
  it("formats picker dates and preserves legacy date text", () => {
    expect(formatYearMonth("2026-09")).toBe("Sep 2026");
    expect(formatYearMonth("Present")).toBe("Present");
    expect(formatYearMonth("Spring 2024")).toBe("Spring 2024");
    expect(formatYearMonth("")).toBe("");
  });

  it("does not match partial technical terms or the job description against itself", () => {
    const resume = createResume();
    resume.jobDescription =
      "Java, JavaScript, C++, C#, .NET and React experience.";
    resume.skills = ["JavaScript", "C++"];
    const keywords = jobKeywords(resume);
    expect(keywords.find((item) => item.term === "java")?.matched).toBe(false);
    expect(keywords.find((item) => item.term === "javascript")?.matched).toBe(
      true,
    );
    expect(keywords.find((item) => item.term === "c++")?.matched).toBe(true);
    expect(keywords.find((item) => item.term === "react")?.matched).toBe(false);
  });

  it("handles an empty job and does not manufacture a match score", () => {
    expect(jobKeywords(createResume())).toEqual([]);
    expect(
      resumeReadiness(createResume()).every((item) => !item.complete),
    ).toBe(true);
    expect(
      resumeReadiness(exampleResume()).every((item) => item.complete),
    ).toBe(true);
  });

  it("creates safe, bounded export filenames", () => {
    expect(documentFilename("../../my:resume", "pdf")).toBe("my-resume.pdf");
    expect(documentFilename("My Resume", "docx")).toBe("My-Resume.docx");
    expect(documentFilename("你好", "pdf")).toBe("hireloom-resume.pdf");
    expect(documentFilename("x".repeat(300), "json").length).toBe(75);
  });

  it("extracts dynamic job keywords and supports skip, restore, and add-skill triage", () => {
    let resume = exampleResume();
    resume.jobDescription =
      "Seeking a Senior Engineer with experience in FastAPI, GraphQL, Kubernetes, and Figma.";
    const initial = jobKeywords(resume);
    expect(initial.find((k) => k.term === "figma")?.matched).toBe(true);
    expect(initial.find((k) => k.term === "fastapi")?.matched).toBe(false);
    expect(initial.find((k) => k.term === "graphql")?.matched).toBe(false);

    resume = skipJobKeyword(resume, "Kubernetes");
    expect(
      jobKeywords(resume).find((k) => k.term === "kubernetes")?.skipped,
    ).toBe(true);

    resume = restoreJobKeyword(resume, "kubernetes");
    expect(
      jobKeywords(resume).find((k) => k.term === "kubernetes")?.skipped,
    ).toBe(false);

    resume = addKeywordToSkills(resume, "FastAPI");
    expect(jobKeywords(resume).find((k) => k.term === "fastapi")?.matched).toBe(
      true,
    );
  });

  it("supports per-bullet selective AI proposal application and word diffs", () => {
    const resume = exampleResume();
    const proposal = {
      summary: "Updated summary.",
      experience: resume.experience.map((entry, idx) => ({
        id: entry.id,
        bullets: entry.bullets.map(
          (b, bIdx) => `Polished ${idx}.${bIdx}: ${b}`,
        ),
      })),
      projects: [],
      notes: [],
    };
    const selection = defaultProposalSelection(resume, proposal);
    selection.summary = false;
    selection.experienceBullets[resume.experience[0].id][0] = false;

    const updated = applyPartialProposal(resume, proposal, selection);
    expect(updated.summary).toBe(resume.summary);
    expect(updated.experience[0].bullets[0]).toBe(
      resume.experience[0].bullets[0],
    );
    expect(updated.experience[0].bullets[1]).toContain("Polished 0.1:");

    const diff = computeWordDiff("Built a tool", "Architected a local tool");
    expect(
      diff.some((s) => s.kind === "removed" && s.text.includes("Built")),
    ).toBe(true);
    expect(diff.some((s) => s.kind === "added")).toBe(true);
  });

  it("runs deterministic resume quality checks without manufacturing fake scores", () => {
    const weak = createResume();
    weak.basics.name = "Casey";
    weak.basics.email = "casey@example.com";
    weak.experience = [
      {
        id: "exp-1",
        role: "Engineer",
        company: "Acme",
        location: "Remote",
        startDate: "2024-06",
        endDate: "2023-01",
        bullets: ["Responsible for backend tasks."],
      },
    ];
    const report = auditResume(weak);
    expect(
      report.items.find((i) => i.id === "strong-action-verbs")?.status,
    ).toBe("warn");
    expect(report.items.find((i) => i.id === "date-consistency")?.status).toBe(
      "warn",
    );
  });

  it("syncs items to Career Library, detects drift, pulls updates, and builds variants", () => {
    let workspace = initialWorkspace();
    const resume = {
      ...exampleResume(),
      id: workspace.activeResumeId,
      projects: [
        {
          id: "proj-1",
          name: "Hireloom",
          subtitle: "Creator",
          url: "github.com/jinloes/hireloom",
          startDate: "2025-01",
          endDate: "Present",
          bullets: ["Built local-first resume studio."],
        },
      ],
    };
    workspace = { ...workspace, resumes: [resume] };
    workspace = syncResumeToCareerLibrary(workspace, resume.id);
    expect(workspace.careerLibrary.experiences).toHaveLength(2);
    expect(workspace.careerLibrary.projects).toHaveLength(1);

    const linkedExp = workspace.resumes[0].experience[0];
    expect(linkedExp.libraryId).toBeDefined();
    expect(isExperienceOutOfSync(linkedExp, workspace.careerLibrary)).toBe(
      false,
    );

    const edited = { ...linkedExp, role: "Principal Product Designer" };
    expect(isExperienceOutOfSync(edited, workspace.careerLibrary)).toBe(true);

    const restored = pullExperienceFromLibrary(
      {
        ...workspace.resumes[0],
        experience: [edited, workspace.resumes[0].experience[1]],
      },
      edited.id,
      workspace.careerLibrary,
    );
    expect(restored.experience[0].role).toBe("Senior Product Designer");

    const variant = buildTailoredResumeFromLibrary({
      baseResume: workspace.resumes[0],
      library: workspace.careerLibrary,
      title: "Focused Design Variant",
      experienceIds: [workspace.careerLibrary.experiences[0].id],
      projectIds: [workspace.careerLibrary.projects[0].id],
      educationIds: [workspace.careerLibrary.education[0].id],
      certificationIds: [],
      skillGroupIds: [],
      jobDescription: "Staff Product Designer with Figma",
    });
    expect(variant.experience).toHaveLength(1);
    expect(variant.projects).toHaveLength(1);
    expect(variant.title).toBe("Focused Design Variant");
  });

  it("exports valid DOCX archives and imports DOCX resume content locally", async () => {
    const source = exampleResume();
    source.projects = [
      {
        id: "proj-docx",
        name: "Design System Kit",
        subtitle: "Maintainer · Figma, React",
        url: "",
        startDate: "2023-03",
        endDate: "Present",
        bullets: ["Adopted across 4 product squads."],
      },
    ];
    source.skillGroups = [
      {
        id: "sg-1",
        category: "Design",
        items: ["Figma", "Prototyping", "Accessibility"],
      },
    ];
    source.pageSize = "letter";
    source.density = "compact";

    const bytes = await createDocxBytes(source);
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const lines = await extractDocxLines(bytes);
    const imported = parseResumeLinesToDraft(
      lines,
      "Alex_Morgan_Resume.docx",
      "docx",
    );
    expect(imported.resume.basics.name).toBe("Alex Morgan");
    expect(imported.resume.basics.email).toBe("alex@example.com");
    expect(imported.resume.experience.length).toBeGreaterThanOrEqual(2);
    expect(imported.resume.projects).toHaveLength(1);
    expect(imported.resume.education).toHaveLength(1);
    expect(
      imported.resume.skillGroups.some((g) => g.category === "Design"),
    ).toBe(true);
  });

  it("redacts contact PII before AI import cleanup and preserves local contact fields on merge", () => {
    const rawLines = [
      "Alex Morgan",
      "alex.morgan@example.com | (555) 234-5678 | https://linkedin.com/in/alex-morgan | github.com/alexm",
      "Senior Engineer · Acme Corp · 2023-01 – Present",
      "• Built distributed Rust services.",
    ];
    const redacted = redactImportLinesForAi(rawLines);
    expect(redacted.join("\n")).not.toContain("alex.morgan@example.com");
    expect(redacted.join("\n")).not.toContain("234-5678");
    expect(redacted.join("\n")).not.toContain("linkedin.com");
    expect(redacted.join("\n")).not.toContain("github.com");
    expect(redacted[1]).toContain("[REDACTED_EMAIL]");
    expect(redacted[1]).toContain("[REDACTED_PHONE]");
    expect(redacted[1]).toContain("[REDACTED_URL]");

    const base = createResume();
    base.basics.name = "Alex Morgan";
    base.basics.email = "alex.morgan@example.com";
    base.basics.phone = "555-234-5678";
    base.basics.website = "https://linkedin.com/in/alex-morgan";
    base.basics.github = "https://github.com/alexm";

    const merged = mergeAiImportedStructure(base, {
      headline: "Senior Systems Engineer",
      summary: "Distributed systems specialist.",
      experience: [
        {
          role: "Senior Engineer",
          company: "Acme Corp",
          location: "Remote",
          startDate: "2023-01",
          endDate: "Present",
          bullets: ["Built distributed Rust services."],
        },
      ],
      projects: [],
      education: [],
      certifications: [],
      skillGroups: [{ category: "Languages", items: ["Rust", "TypeScript"] }],
      skills: ["gRPC"],
    });
    expect(merged.basics.email).toBe("alex.morgan@example.com");
    expect(merged.basics.phone).toBe("555-234-5678");
    expect(merged.basics.website).toBe("https://linkedin.com/in/alex-morgan");
    expect(merged.basics.github).toBe("https://github.com/alexm");
    expect(merged.basics.headline).toBe("Senior Systems Engineer");
    expect(merged.experience[0].role).toBe("Senior Engineer");
    expect(merged.skillGroups[0].items).toEqual(["Rust", "TypeScript"]);
  });

  it("supports single-role tailoring and per-bullet Career Library cherry-picking", () => {
    const resume = exampleResume();
    const targetExp = resume.experience[0];
    const roleUpdated = applyRoleTailorProposal(
      resume,
      {
        entryId: targetExp.id,
        bullets: targetExp.bullets.map((b, i) => `Tailored ${i}: ${b}`),
        notes: [],
      },
      [true, false, true],
    );
    expect(roleUpdated.experience[0].bullets[0]).toContain("Tailored 0:");
    expect(roleUpdated.experience[0].bullets[1]).toBe(targetExp.bullets[1]);
    expect(roleUpdated.experience[1].bullets).toEqual(
      resume.experience[1].bullets,
    );

    let workspace = initialWorkspace();
    workspace = syncResumeToCareerLibrary(
      {
        ...workspace,
        resumes: [{ ...resume, id: workspace.activeResumeId }],
      },
      workspace.activeResumeId,
    );
    const libExp = workspace.careerLibrary.experiences[0];
    const cherryPicked = buildTailoredResumeFromLibrary({
      baseResume: workspace.resumes[0],
      library: workspace.careerLibrary,
      title: "1-Page Cherry-Picked",
      experienceIds: [libExp.id],
      projectIds: [],
      educationIds: [],
      certificationIds: [],
      skillGroupIds: [],
      selectedExperienceBullets: { [libExp.id]: [1] },
      jobDescription: "",
    });
    expect(cherryPicked.experience).toHaveLength(1);
    expect(cherryPicked.experience[0].bullets).toEqual([libExp.bullets[1]]);
  });
});
