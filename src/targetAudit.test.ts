import { describe, expect, it } from "vitest";
import { createResume, exampleResume } from "./model";
import { auditResume } from "./targetAudit";

describe("target-job audit", () => {
  it("explains missing setup and links every finding to an exact surface", () => {
    const findings = auditResume(createResume());
    expect(findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining([
        "target-title",
        "target-description",
        "identity",
        "summary-depth",
        "experience-empty",
      ]),
    );
    expect(
      findings.every(
        (finding) =>
          finding.observed && finding.why && finding.action && finding.target,
      ),
    ).toBe(true);
  });

  it("distinguishes skills-only evidence from terms absent everywhere", () => {
    const resume = exampleResume();
    resume.targetJob = {
      title: "Product Designer",
      company: "Example",
      sourceUrl: "https://example.com/jobs/1",
      description:
        "Seeking a product designer with Figma, analytics, and compliance experience.",
    };
    resume.skills.push("Compliance");
    const findings = auditResume(resume);
    expect(
      findings.find((finding) => finding.id === "skills-only")?.observed,
    ).toContain("compliance");
    expect(
      findings.find((finding) => finding.id === "keywords-missing")?.observed,
    ).toContain("analytics");
  });

  it("flags reversed dates, unsupported URLs, and unspecific highlights", () => {
    const resume = exampleResume();
    resume.targetJob.title = "Designer";
    resume.targetJob.sourceUrl = "file:///tmp/posting";
    resume.experience[0].startDate = "2025-01";
    resume.experience[0].endDate = "2024-01";
    resume.experience.forEach((entry) => {
      entry.bullets = ["Responsible for product design"];
    });
    const ids = auditResume(resume).map((finding) => finding.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "date-order",
        "source-url",
        "bullet-action",
        "evidence-specificity",
      ]),
    );
  });
});
