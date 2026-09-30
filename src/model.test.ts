import { describe, expect, it } from "vitest";
import {
  applyAprOption,
  applyProposal,
  createResume,
  documentFilename,
  exampleResume,
  formatYearMonth,
  initialWorkspace,
  jobKeywords,
  MAX_WORKSPACE_BYTES,
  parseWorkspace,
  resumeReadiness,
  validateProposal,
  validateAprAnalysis,
  validateAprTarget,
  validateHighlightReviews,
  type Resume,
} from "./model";

describe("workspace validation", () => {
  it("round trips a workspace and keeps empty resumes valid", () => {
    const workspace = initialWorkspace();
    expect(parseWorkspace(JSON.stringify(workspace))).toEqual(workspace);
  });

  it("migrates version-1 workspaces without losing the job description", () => {
    const resume = createResume();
    const legacyResume = {
      ...resume,
      jobDescription: "Build reliable distributed systems.",
    };
    delete (legacyResume.basics as Partial<Resume["basics"]>).github;
    for (const key of [
      "targetJob",
      "projects",
      "certifications",
      "awards",
      "volunteer",
      "publications",
      "languages",
      "additionalSectionOrder",
    ] as const) {
      delete (legacyResume as Partial<Resume>)[key];
    }
    const migrated = parseWorkspace(
      JSON.stringify({
        version: 1,
        activeResumeId: resume.id,
        resumes: [legacyResume],
      }),
    );
    expect(migrated.version).toBe(2);
    expect(migrated.resumes[0].basics.github).toBe("");
    expect(migrated.resumes[0].targetJob.description).toBe(
      "Build reliable distributed systems.",
    );
    expect(migrated.resumes[0].projects).toEqual([]);
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
      version: 2,
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

  it("validates new section IDs and the complete section order", () => {
    const workspace = initialWorkspace();
    const resume = workspace.resumes[0];
    const project = {
      id: "project-1",
      name: "Portfolio",
      role: "Designer",
      url: "",
      startDate: "",
      endDate: "",
      bullets: [],
    };
    resume.projects = [project, project];
    expect(() => parseWorkspace(JSON.stringify(workspace))).toThrow(
      "Duplicate projects",
    );
    resume.projects = [];
    resume.additionalSectionOrder = [
      "projects",
      "projects",
      "awards",
      "volunteer",
      "publications",
      "languages",
    ];
    expect(() => parseWorkspace(JSON.stringify(workspace))).toThrow(
      "every section once",
    );
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
    const coreResult = (target: {
      resumeId: string;
      experienceId: string;
      bulletIndex: number;
      role: string;
      bullet: string;
    }) => ({
      target,
      action: { status: "clear" as const, feedback: "Specific action." },
      project: { status: "partial" as const, feedback: "Add context." },
      result: {
        status: "missing" as const,
        feedback: "Add supported impact.",
      },
      options: [
        {
          id: "concise" as const,
          bullets: ["Led a focused onboarding redesign."],
        },
        {
          id: "detail-forward" as const,
          bullets: [
            "Led a customer onboarding redesign through research, prototyping, and usability testing.",
          ],
        },
        {
          id: "split" as const,
          bullets: [
            "Led a customer onboarding redesign.",
            "Validated the redesigned flow through usability testing.",
          ],
        },
      ],
    });

    it("validates exact targets and atomically applies unified and split options", () => {
      const resume = exampleResume();
      const target = {
        resumeId: resume.id,
        experienceId: resume.experience[0].id,
        bulletIndex: 1,
        role: resume.experience[0].role,
        bullet: resume.experience[0].bullets[1],
      };
      expect(validateAprTarget(target, resume)).toEqual(target);
      const unified = applyAprOption(resume, target, {
        id: "concise",
        bullets: [
          "Built a shared, accessible design system with engineering partners.",
        ],
      });
      expect(unified.experience[0].bullets[1]).toContain("accessible");
      const split = applyAprOption(resume, target, {
        id: "split",
        bullets: [
          "Built a shared design system.",
          "Partnered with engineering.",
        ],
      });
      expect(split.experience[0].bullets.slice(1, 3)).toEqual([
        "Built a shared design system.",
        "Partnered with engineering.",
      ]);
      expect(split.experience[0].bullets[3]).toBe(
        resume.experience[0].bullets[2],
      );
      expect(split.experience[0].bullets[0]).toBe(
        resume.experience[0].bullets[0],
      );
      expect(split.experience[1]).toEqual(resume.experience[1]);
      expect(split.basics).toEqual(resume.basics);
      expect(split.summary).toBe(resume.summary);
    });

    it("accepts only bounded canonical fact groups and option strategies", () => {
      const resume = exampleResume();
      const target = {
        resumeId: resume.id,
        experienceId: resume.experience[0].id,
        bulletIndex: 0,
        role: resume.experience[0].role,
        bullet: resume.experience[0].bullets[0],
      };
      const analysis = coreResult(target);
      expect(validateAprAnalysis(analysis, target)).toEqual(analysis);
      expect(() =>
        validateAprAnalysis(
          { ...analysis, target: { ...target, bulletIndex: 1 } },
          target,
        ),
      ).toThrow("different accomplishment");
      expect(() =>
        validateAprAnalysis({ ...analysis, invented: true }, target),
      ).toThrow();
      expect(
        validateAprAnalysis(
          { ...analysis, options: [analysis.options[0]] },
          target,
        ).options,
      ).toEqual([analysis.options[0]]);
      expect(
        validateAprAnalysis(
          { ...analysis, options: [analysis.options[1]] },
          target,
        ).options,
      ).toEqual([analysis.options[1]]);
      expect(() =>
        validateAprAnalysis({ ...analysis, options: [] }, target),
      ).toThrow();
      expect(() =>
        validateAprAnalysis(
          {
            ...analysis,
            options: [analysis.options[1], analysis.options[0]],
          },
          target,
        ),
      ).toThrow("canonical");
      expect(() =>
        validateAprAnalysis(
          {
            ...analysis,
            options: [
              analysis.options[0],
              { id: "split", bullets: ["Only one."] },
            ],
          },
          target,
        ),
      ).toThrow("exactly 2");
      expect(() =>
        validateAprAnalysis(
          {
            ...analysis,
            options: [
              { id: "concise", bullets: ["Same rewrite."] },
              { id: "detail-forward", bullets: ["Same rewrite."] },
            ],
          },
          target,
        ),
      ).toThrow("distinct");
      expect(() =>
        validateAprAnalysis(
          { ...analysis, questions: ["What changed?"] },
          target,
        ),
      ).toThrow();
      expect(() =>
        validateAprAnalysis(
          {
            ...analysis,
            options: [
              { id: "concise", bullets: [target.bullet] },
              analysis.options[1],
            ],
          },
          target,
        ),
      ).toThrow("change");
      expect(() =>
        validateAprTarget({ ...target, bullet: "é".repeat(1_001) }, resume),
      ).toThrow();
      expect(() =>
        applyAprOption(resume, target, {
          id: "concise",
          bullets: [target.bullet],
        }),
      ).toThrow("changed");
      expect(() =>
        validateAprTarget({ ...target, role: "Changed role" }, resume),
      ).toThrow("no longer matches");
    });

    it("rejects split options that exceed the experience highlight cap", () => {
      const capped = exampleResume();
      capped.experience[0].bullets = Array(30).fill("Existing.");
      const cappedTarget = {
        resumeId: capped.id,
        experienceId: capped.experience[0].id,
        bulletIndex: 0,
        role: capped.experience[0].role,
        bullet: "Existing.",
      };
      expect(() =>
        applyAprOption(capped, cappedTarget, {
          id: "split",
          bullets: ["First.", "Second."],
        }),
      ).toThrow("30-highlight");
    });

    it("binds batch highlight reviews to the exact requested highlights", () => {
      const resume = exampleResume();
      const targets = resume.experience.flatMap((entry) =>
        entry.bullets.map((bullet, bulletIndex) => ({
          resumeId: resume.id,
          experienceId: entry.id,
          bulletIndex,
          role: entry.role,
          bullet,
        })),
      );
      const reviews = targets.map((target, index) => ({
        target,
        action: index % 2 === 0 ? ("clear" as const) : ("partial" as const),
        project: "partial" as const,
        result: "missing" as const,
      }));

      expect(validateHighlightReviews(reviews, targets)).toEqual(reviews);

      // Diagnosis only: rewrite text, feedback prose and unknown keys are rejected.
      expect(() =>
        validateHighlightReviews(
          [
            { ...reviews[0], feedback: "Add supported impact." },
            ...reviews.slice(1),
          ],
          targets,
        ),
      ).toThrow();
      expect(() =>
        validateHighlightReviews(
          [
            {
              ...reviews[0],
              options: [{ id: "concise", bullets: ["A rewrite."] }],
            },
            ...reviews.slice(1),
          ],
          targets,
        ),
      ).toThrow();
      expect(() =>
        validateHighlightReviews(
          [{ ...reviews[0], action: "strong" }, ...reviews.slice(1)],
          targets,
        ),
      ).toThrow();

      // Count and per-highlight identity mismatches are refused, never guessed.
      expect(() => validateHighlightReviews(reviews.slice(1), targets)).toThrow(
        "different highlights",
      );
      expect(() =>
        validateHighlightReviews([...reviews, reviews[0]], targets),
      ).toThrow("different highlights");
      expect(() =>
        validateHighlightReviews(
          [
            {
              ...reviews[0],
              target: { ...targets[0], bullet: "An edited highlight." },
            },
            ...reviews.slice(1),
          ],
          targets,
        ),
      ).toThrow("different highlights");
      expect(() =>
        validateHighlightReviews([...reviews].reverse(), targets),
      ).toThrow("different highlights");
      expect(validateHighlightReviews([], [])).toEqual([]);
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
    resume.targetJob.description =
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
    expect(documentFilename("你好", "pdf")).toBe("hireloom-resume.pdf");
    expect(documentFilename("x".repeat(300), "json").length).toBe(75);
  });
});
