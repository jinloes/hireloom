import { describe, expect, it } from "vitest";
import {
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
  type Resume,
} from "./model";

describe("workspace validation", () => {
  it("round trips a workspace and keeps empty resumes valid", () => {
    const workspace = initialWorkspace();
    expect(parseWorkspace(JSON.stringify(workspace))).toEqual(workspace);
  });

  it("loads version-1 workspaces created before the GitHub field existed", () => {
    const workspace = initialWorkspace();
    const legacy = structuredClone(workspace);
    delete (legacy.resumes[0].basics as Partial<Resume["basics"]>).github;
    expect(
      parseWorkspace(JSON.stringify(legacy)).resumes[0].basics.github,
    ).toBe("");
  });

  it("rejects corrupt data, future versions, missing selections, and duplicate IDs", () => {
    const workspace = initialWorkspace();
    expect(() => parseWorkspace("{broken")).toThrow();
    expect(() =>
      parseWorkspace(JSON.stringify({ ...workspace, version: 2 })),
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
    expect(documentFilename("你好", "pdf")).toBe("hireloom-resume.pdf");
    expect(documentFilename("x".repeat(300), "json").length).toBe(75);
  });
});
