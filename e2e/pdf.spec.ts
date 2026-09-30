import { expect, test } from "@playwright/test";
import { exampleResume } from "../src/model";
import { extractPdfText } from "./helpers";

test("exports ATS-friendly headings and reading order without losing content", async ({
  page,
}) => {
  const resume = exampleResume();
  resume.basics = {
    name: "Jordan Rivera",
    headline: "Platform Engineer",
    email: "jordan.rivera@example.com",
    phone: "555-0142",
    location: "Denver, CO",
    website: "jordan.example.com",
    github: "github.com/jordanrivera",
  };
  resume.summary =
    "Builds reliable developer platforms for growing engineering teams.";
  resume.experience = [
    {
      id: "experience-current",
      role: "Senior Platform Engineer",
      company: "Northstar Systems",
      location: "Remote",
      startDate: "2023-02",
      endDate: "Present",
      bullets: [
        "Improved deployment reliability through tested delivery automation.",
        "Partnered with product teams to simplify service ownership.",
      ],
    },
    {
      id: "experience-previous",
      role: "Software Engineer",
      company: "Juniper Works",
      location: "Denver, CO",
      startDate: "2020-05",
      endDate: "2023-01",
      bullets: ["Built observable services with clear operational runbooks."],
    },
  ];
  resume.education = [
    {
      id: "education-primary",
      school: "Colorado State University",
      degree: "B.S. Computer Science",
      graduation: "2020",
    },
  ];
  resume.skills = ["TypeScript", "Rust", "Continuous delivery"];
  resume.projects = [
    {
      id: "project-primary",
      name: "Deployment portal",
      role: "Technical lead",
      url: "portal.example.com",
      startDate: "2022-03",
      endDate: "2022-12",
      bullets: ["Shipped a self-service deployment workflow."],
    },
  ];
  resume.certifications = [
    {
      id: "cert-primary",
      name: "Cloud Architecture",
      issuer: "Example Institute",
      date: "2021",
      credentialUrl: "",
    },
  ];
  resume.additionalSectionOrder = [
    "certifications",
    "projects",
    "awards",
    "volunteer",
    "publications",
    "languages",
  ];

  await page.addInitScript(
    (data) => {
      localStorage.setItem("hireloom.workspace.v1", JSON.stringify(data));
    },
    { version: 2, activeResumeId: resume.id, resumes: [resume] },
  );
  await page.goto("/");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  const path = await (await downloadPromise).path();
  if (!path) throw new Error("Missing ATS compatibility PDF.");

  const { text } = await extractPdfText(path);
  const expectedReadingOrder = [
    "Jordan Rivera",
    "Platform Engineer",
    "jordan.rivera@example.com",
    "555-0142",
    "Denver, CO",
    "jordan.example.com",
    "github.com/jordanrivera",
    "Profile",
    "Builds reliable developer platforms for growing engineering teams.",
    "Experience",
    "Senior Platform Engineer",
    "Northstar Systems",
    "Improved deployment reliability through tested delivery automation.",
    "Partnered with product teams to simplify service ownership.",
    "Software Engineer",
    "Juniper Works",
    "Built observable services with clear operational runbooks.",
    "Education",
    "Colorado State University",
    "B.S. Computer Science",
    "Skills",
    "TypeScript",
    "Rust",
    "Continuous delivery",
    "Certifications",
    "Cloud Architecture",
    "Projects",
    "Deployment portal",
    "Shipped a self-service deployment workflow.",
  ];

  let previousIndex = -1;
  for (const expected of expectedReadingOrder) {
    const index = text.indexOf(expected, previousIndex + 1);
    expect(
      index,
      `Expected PDF text in reading order: ${expected}`,
    ).toBeGreaterThan(previousIndex);
    previousIndex = index;
  }
});

test("long resumes paginate without losing text or accented names", async ({
  page,
}) => {
  const resume = exampleResume();
  resume.basics.name = "Zoë Núñez";
  resume.experience = Array.from({ length: 8 }, (_, index) => ({
    ...resume.experience[0],
    id: `entry-${index}`,
    role: `Role ${index + 1}`,
    bullets: Array.from(
      { length: 5 },
      (_, bullet) =>
        `Highlight ${index + 1}.${bullet + 1}: ${"Designed accessible, thoughtful tools in collaboration with a multidisciplinary team. ".repeat(3)}`,
    ),
  }));
  resume.skills = ["Final content marker", "Product design", "Accessibility"];
  await page.addInitScript(
    (data) => {
      localStorage.setItem("hireloom.workspace.v1", JSON.stringify(data));
    },
    { version: 2, activeResumeId: resume.id, resumes: [resume] },
  );
  await page.goto("/");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  const path = await (await downloadPromise).path();
  if (!path) throw new Error("Missing multi-page PDF.");
  const { pageCount, text } = await extractPdfText(path);
  expect(pageCount).toBeGreaterThan(1);
  expect(text).toContain("Zoë Núñez");
  expect(text).toContain("Highlight 8.5:");
  expect(text).toContain("Final content marker");
});
