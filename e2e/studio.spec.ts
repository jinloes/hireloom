import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { exampleResume } from "../src/model";

async function extractPdfText(path: string) {
  const document = await getDocument({
    data: new Uint8Array(await readFile(path)),
    useSystemFonts: false,
  }).promise;
  const pages: string[] = [];
  for (let pageIndex = 1; pageIndex <= document.numPages; pageIndex++) {
    const content = await (await document.getPage(pageIndex)).getTextContent();
    pages.push(
      content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
    );
  }
  const pageCount = document.numPages;
  await document.destroy();
  return { pageCount, text: pages.join(" ").replace(/\s+/g, " ").trim() };
}

test("edits, saves, and reloads a local resume", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Full name", { exact: true }).fill("Taylor Example");
  await page
    .getByLabel("Professional headline", { exact: true })
    .fill("Software Engineer");
  await page.getByLabel("Email", { exact: true }).fill("taylor@example.com");
  await page
    .getByLabel("GitHub URL", { exact: true })
    .fill("https://github.com/taylor-example");
  await page.getByLabel("Resume title").fill("Engineering application");
  await expect(page.getByTestId("resume-preview")).toContainText(
    "Taylor Example",
  );
  await expect(page.getByTestId("resume-preview")).toContainText(
    "https://github.com/taylor-example",
  );
  await expect(
    page.getByText("Autosaved in this browser", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Taylor Example",
  );
  await expect(page.getByLabel("Resume title")).toHaveValue(
    "Engineering application",
  );
  await expect(page.getByLabel("GitHub URL", { exact: true })).toHaveValue(
    "https://github.com/taylor-example",
  );
  await page.getByRole("tab", { name: "Copilot", exact: true }).click();
  await expect(
    page.getByText("Copilot is available in the desktop app.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Polish my resume" }),
  ).toBeDisabled();
});

test("example, design, PDF text, backups, duplicate and delete", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "try a fictional example" }).click();
  await expect(page.getByTestId("resume-preview")).toContainText("Alex Morgan");
  const startMonth = page.getByLabel("Start month 1 month", { exact: true });
  const startYear = page.getByLabel("Start month 1 year", { exact: true });
  const endMonth = page.getByLabel("End month 1 month", { exact: true });
  const endYear = page.getByLabel("End month 1 year", { exact: true });
  const currentRole = page.getByLabel("Current role", { exact: true }).first();
  await expect(startMonth).toHaveValue("01");
  await expect(startYear).toHaveValue("2022");
  await expect(currentRole).toBeChecked();
  await expect(endMonth).toBeDisabled();
  await expect(endYear).toBeDisabled();
  await currentRole.uncheck();
  await expect(endMonth).toBeEnabled();
  await expect(endYear).toBeEnabled();
  await startYear.selectOption("2021");
  await startMonth.selectOption("03");
  await endYear.selectOption("2025");
  await endMonth.selectOption("09");
  await expect(page.getByTestId("resume-preview")).toContainText(
    "Mar 2021 – Sep 2025",
  );
  await page.getByRole("tab", { name: "Design", exact: true }).click();
  await page
    .getByRole("button", { name: "Modern A crisp", exact: false })
    .click();
  await page.getByRole("button", { name: "indigo accent" }).click();
  await expect(page.getByTestId("resume-preview")).toHaveClass(
    /template-modern/,
  );
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  const pdf = await pdfDownload;
  const pdfPath = await pdf.path();
  if (!pdfPath) throw new Error("PDF download has no file.");
  const bytes = new Uint8Array(await readFile(pdfPath));
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  const document = await getDocument({ data: bytes, useSystemFonts: false })
    .promise;
  expect(document.numPages).toBeGreaterThan(0);
  const firstPage = await document.getPage(1);
  const content = await firstPage.getTextContent();
  const text = content.items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ");
  expect(text).toContain("Alex Morgan");
  expect(text).toContain("Senior Product Designer");
  expect(text).toContain("alex@example.com");
  expect(text).toContain("Mar 2021");
  expect(text).toContain("Sep 2025");
  await document.destroy();

  await page.getByRole("tab", { name: "Content", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("hireloom-studio.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Document actions" }).click();
  const backupDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Back up workspace" }).click();
  const backup = await backupDownload;
  const path = await backup.path();
  if (!path) throw new Error("Backup has no file.");
  const parsed = JSON.parse(await readFile(path, "utf8")) as {
    version: number;
    resumes: unknown[];
  };
  expect(parsed.version).toBe(1);
  expect(parsed.resumes).toHaveLength(2);
  await page.getByLabel("Import Hireloom backup").setInputFiles(path);
  await expect(page.getByRole("status")).toContainText("Imported 2 resumes");
  await page.getByRole("button", { name: "My resumes", exact: false }).click();
  await expect(
    page.getByText("4 local documents", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Duplicate", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Document actions" }).click();
  await page
    .getByRole("button", { name: "Delete resume", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete resume", exact: true })
    .click();
  await page.getByRole("button", { name: "My resumes", exact: false }).click();
  await expect(
    page.getByText("4 local documents", { exact: true }),
  ).toBeVisible();
});

test("shows legacy named dates in the month and year dropdowns", async ({
  page,
}) => {
  const resume = exampleResume();
  resume.experience[0].startDate = "January 2011";
  resume.experience[0].endDate = "June 2012";
  await page.addInitScript(
    (data) => {
      localStorage.setItem("hireloom.workspace.v1", JSON.stringify(data));
    },
    { version: 1, activeResumeId: resume.id, resumes: [resume] },
  );

  await page.goto("/");
  await expect(
    page.getByLabel("Start month 1 month", { exact: true }),
  ).toHaveValue("01");
  await expect(
    page.getByLabel("Start month 1 year", { exact: true }),
  ).toHaveValue("2011");
  await expect(
    page.getByLabel("End month 1 month", { exact: true }),
  ).toHaveValue("06");
  await expect(
    page.getByLabel("End month 1 year", { exact: true }),
  ).toHaveValue("2012");

  await page
    .getByLabel("Start month 1 month", { exact: true })
    .selectOption("02");
  await expect(page.getByTestId("resume-preview")).toContainText(
    "Feb 2011 – June 2012",
  );
});

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

  await page.addInitScript(
    (data) => {
      localStorage.setItem("hireloom.workspace.v1", JSON.stringify(data));
    },
    { version: 1, activeResumeId: resume.id, resumes: [resume] },
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

test("corrupt saved data is not silently overwritten", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("hireloom.workspace.v1", "{broken"),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Your saved data has not been changed",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("hireloom.workspace.v1")),
  ).toBe("{broken");
});

test("rejects malformed imports without changing the current resume", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Full name", { exact: true }).fill("Keep My Resume");
  await page.getByLabel("Import Hireloom backup").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole("alert")).toContainText(
    "not a supported Hireloom workspace",
  );
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Keep My Resume",
  );
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
    { version: 1, activeResumeId: resume.id, resumes: [resume] },
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
