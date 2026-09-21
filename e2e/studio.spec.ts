import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { exampleResume } from "../src/model";

async function openContentSection(page: Page, name: string) {
  const tabName =
    name === "Personal details"
      ? "Personal"
      : name === "Professional summary"
        ? "Summary"
        : name;
  await page.getByRole("tab", { name: tabName, exact: true }).click();
}

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
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("resume-preview")).toContainText(
    "Taylor Example",
  );
  await expect(page.getByTestId("resume-preview")).toContainText(
    "https://github.com/taylor-example",
  );
  await page.getByRole("tab", { name: "Content", exact: true }).click();
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

test("adds experience entries to the top or end", async ({ page }) => {
  await page.goto("/");
  await openContentSection(page, "Experience");

  await expect(
    page.getByRole("button", { name: "Add experience to top" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Add experience to end" }).click();
  await page.getByLabel("Job title 1", { exact: true }).fill("Earlier role");

  await page.getByRole("button", { name: "Add experience to top" }).click();
  await expect(page.getByLabel("Job title 1", { exact: true })).toHaveValue("");
  await page
    .getByRole("button", { name: /Earlier role/, exact: false })
    .click();
  await expect(page.getByLabel("Job title 2", { exact: true })).toHaveValue(
    "Earlier role",
  );

  await page.getByRole("button", { name: "Add experience to end" }).click();
  const lastTitle = page.getByRole("textbox", {
    name: "Job title 3",
    exact: true,
  });
  await lastTitle.waitFor();
  expect(await lastTitle.inputValue()).toBe("");
});

test("navigates Content and preserves one Experience editor at supported sizes", async ({
  page,
}) => {
  const resume = exampleResume();
  resume.experience = Array.from({ length: 8 }, (_, index) => ({
    ...structuredClone(resume.experience[index % resume.experience.length]),
    id: `experience-${index + 1}`,
    role: `Role ${index + 1}`,
    company: `Company ${index + 1}`,
  }));
  await page.addInitScript(
    (data) => {
      localStorage.setItem("hireloom.workspace.v1", JSON.stringify(data));
    },
    { version: 1, activeResumeId: resume.id, resumes: [resume] },
  );

  for (const viewport of [
    { width: 1440, height: 940, stacked: false },
    { width: 1024, height: 720, stacked: false },
    { width: 720, height: 720, stacked: true },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const workspaceTabs = page.getByRole("tablist", {
      name: "Resume workspace",
    });
    const contentTabs = page.getByRole("tablist", {
      name: "Content sections",
    });
    await expect(workspaceTabs.getByRole("tab")).toHaveCount(4);
    await expect(contentTabs.getByRole("tab")).toHaveCount(5);
    for (const name of [
      "Personal",
      "Summary",
      "Experience",
      "Education",
      "Skills",
    ]) {
      await expect(
        contentTabs.getByRole("tab", { name, exact: true }),
      ).toBeVisible();
    }

    if (viewport.width === 1440) {
      const content = workspaceTabs.getByRole("tab", {
        name: "Content",
        exact: true,
      });
      await content.focus();
      await content.press("End");
      await expect(
        workspaceTabs.getByRole("tab", { name: "Preview", exact: true }),
      ).toBeFocused();
      await workspaceTabs
        .getByRole("tab", { name: "Preview", exact: true })
        .press("Home");
      await expect(content).toBeFocused();

      const personal = contentTabs.getByRole("tab", {
        name: "Personal",
        exact: true,
      });
      await personal.focus();
      await personal.press("ArrowRight");
      await expect(
        contentTabs.getByRole("tab", { name: "Summary", exact: true }),
      ).toBeFocused();
      await contentTabs
        .getByRole("tab", { name: "Summary", exact: true })
        .press("End");
      await expect(
        contentTabs.getByRole("tab", { name: "Skills", exact: true }),
      ).toBeFocused();
    }
    await openContentSection(page, "Experience");

    await expect(
      page.getByRole("region", { name: "Experience" }).first(),
    ).toBeVisible();
    await expect(page.getByRole("list", { name: "Experience" })).toBeVisible();
    await expect(page.getByLabel(/^Job title \d+$/)).toHaveCount(1);
    await page.getByRole("button", { name: /Role 7 — Company 7/ }).click();
    await expect(page.getByLabel("Job title 7", { exact: true })).toHaveValue(
      "Role 7",
    );

    await page.getByRole("tab", { name: "Design" }).click();
    await page.getByRole("tab", { name: "Content" }).click();
    await expect(page.getByLabel("Job title 7", { exact: true })).toBeVisible();

    const contentScroll = page.getByTestId("content-section-scroll");
    const sectionTabs = page.getByRole("tablist", {
      name: "Content sections",
    });
    const studioBox = await page.locator(".studio").boundingBox();
    const contentPanelBox = await page.locator("#panel-content").boundingBox();
    expect(studioBox).not.toBeNull();
    expect(contentPanelBox).not.toBeNull();
    expect(Math.abs(contentPanelBox!.width - studioBox!.width)).toBeLessThan(2);

    const summaryBox = await page
      .locator(".experience-summary-rail")
      .boundingBox();
    const editorBox = await page
      .locator(".selected-experience-editor")
      .boundingBox();
    expect(summaryBox).not.toBeNull();
    expect(editorBox).not.toBeNull();
    if (viewport.stacked) {
      expect(editorBox!.y).toBeGreaterThan(summaryBox!.y);
    } else {
      expect(editorBox!.x).toBeGreaterThan(summaryBox!.x);
    }

    await contentScroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(sectionTabs).toBeVisible();
    expect(await page.locator(".workspace-panel:not([hidden])").count()).toBe(
      1,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const contentTop = await contentScroll.evaluate(
      (element) => element.scrollTop,
    );
    expect(contentTop).toBeGreaterThan(0);

    await page.getByRole("tab", { name: "Preview", exact: true }).click();
    await expect(page.getByTestId("resume-preview")).toBeVisible();
    const previewScroll = page.locator(".paper-scroll");
    await previewScroll.evaluate((element) => {
      element.scrollTop = Math.min(80, element.scrollHeight);
    });
    const previewTop = await previewScroll.evaluate(
      (element) => element.scrollTop,
    );
    expect(previewTop).toBeGreaterThan(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    await page.getByRole("tab", { name: "Content", exact: true }).click();
    expect(await contentScroll.evaluate((element) => element.scrollTop)).toBe(
      contentTop,
    );
    await page.getByRole("tab", { name: "Preview", exact: true }).click();
    expect(await previewScroll.evaluate((element) => element.scrollTop)).toBe(
      previewTop,
    );
  }
});

test("undoes item removals before and after autosave", async ({ page }) => {
  const resume = exampleResume();
  await page.addInitScript(
    (data) => {
      localStorage.setItem("hireloom.workspace.v1", JSON.stringify(data));
    },
    { version: 1, activeResumeId: resume.id, resumes: [resume] },
  );
  await page.goto("/");
  await openContentSection(page, "Experience");

  await page.getByRole("button", { name: "Remove position 1" }).click();
  await expect(
    page.locator(".content-undo").getByText(/Removed Senior Product Designer/),
  ).toBeVisible();
  await page.waitForTimeout(600);
  await expect(
    page.getByText("Autosaved in this browser", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
  await expect(page.locator(".content-undo")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(
    page.getByRole("tab", { name: "Content", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("button", {
      name: /Senior Product Designer — Morrow Studio/,
    }),
  ).toBeFocused();

  const firstHighlight = resume.experience[0].bullets[0];
  await page
    .getByRole("button", { name: "Remove highlight 1.1" })
    .press("Enter");
  await page.getByRole("button", { name: "Undo" }).click();
  const restoredHighlight = page.getByRole("textbox", {
    name: "Highlight 1.1",
    exact: true,
  });
  await expect(restoredHighlight).toHaveValue(firstHighlight);
  await expect(restoredHighlight).toBeFocused();

  await openContentSection(page, "Education");
  await page.getByRole("button", { name: "Remove education 1" }).click();
  await page.getByRole("button", { name: "Undo" }).press("Enter");
  await expect(page.getByLabel("School 1")).toHaveValue(
    resume.education[0].school,
  );
  await expect(page.getByLabel("School 1")).toBeFocused();

  await expect(
    page.getByText("Autosaved in this browser", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await openContentSection(page, "Experience");
  await expect(
    page.getByRole("button", {
      name: /Senior Product Designer — Morrow Studio/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Highlight 1.1", exact: true }),
  ).toHaveValue(firstHighlight);
});

test("announces consecutive removals with identical labels", async ({
  page,
}) => {
  const resume = exampleResume();
  const education = resume.education[0];
  resume.education = [
    education,
    { ...structuredClone(education), id: "education-duplicate" },
  ];
  await page.addInitScript(
    (data) => {
      localStorage.setItem("hireloom.workspace.v1", JSON.stringify(data));
    },
    { version: 1, activeResumeId: resume.id, resumes: [resume] },
  );
  await page.goto("/");
  await openContentSection(page, "Education");

  const status = page.getByRole("status");
  await status.evaluate((element) => {
    const contentStatusWindow = window as Window & {
      contentStatusUpdates?: string[];
    };
    contentStatusWindow.contentStatusUpdates = [];
    new MutationObserver(() => {
      contentStatusWindow.contentStatusUpdates?.push(element.textContent ?? "");
    }).observe(element, { childList: true, subtree: true });
  });

  await page.getByRole("button", { name: "Remove education 1" }).click();
  await page.getByRole("button", { name: "Remove education 1" }).click();

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              contentStatusUpdates?: string[];
            }
          ).contentStatusUpdates,
      ),
    )
    .toEqual([`Removed ${education.school}.`, `Removed ${education.school}.`]);
});

test("example, design, PDF text, backups, duplicate and delete", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "try a fictional example" }).click();
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("resume-preview")).toContainText("Alex Morgan");
  await page.getByRole("tab", { name: "Content", exact: true }).click();
  await openContentSection(page, "Experience");
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
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("resume-preview")).toContainText(
    "Mar 2021 – Sep 2025",
  );
  await page.getByRole("tab", { name: "Content", exact: true }).click();
  const guidanceActions = page.getByRole("button", {
    name: "Help me strengthen this highlight",
  });
  const firstHighlight = page.getByLabel("Highlight 1.1", { exact: true });
  const secondHighlight = page.getByLabel("Highlight 1.2", { exact: true });
  const firstHighlightText = await firstHighlight.inputValue();
  const secondHighlightText = await secondHighlight.inputValue();
  await expect(
    page.getByRole("button", { name: "Move highlight 1.1 up" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Move highlight 1.1 down" }).click();
  await expect(firstHighlight).toHaveValue(secondHighlightText);
  await expect(secondHighlight).toHaveValue(firstHighlightText);
  await expect(
    page.getByRole("button", { name: "Move highlight 1.3 down" }),
  ).toBeDisabled();
  await expect(guidanceActions.first()).toBeVisible();
  await guidanceActions.first().click();
  await expect(
    page.getByText("Only this highlight and the role", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", {
      name: /Send this highlight and role/,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Send for guidance" }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "Highlight guidance is available only in the desktop app. You can keep editing locally.",
    ),
  ).toBeVisible();
  const highlight = page.getByRole("textbox", {
    name: "Highlight 1.1",
    exact: true,
  });
  await highlight.fill(
    "Kept editing this highlight locally in the browser preview.",
  );
  await expect(highlight).toHaveValue(
    "Kept editing this highlight locally in the browser preview.",
  );
  await expect(
    page.getByRole("radiogroup", { name: "Rewrite options" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Apply selected option" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Refine with my details" }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("resume-preview")).toContainText(
    "Kept editing this highlight locally in the browser preview.",
  );
  await page.getByRole("tab", { name: "Design", exact: true }).click();
  await page
    .getByRole("button", { name: "Modern A crisp", exact: false })
    .click();
  await page.getByRole("button", { name: "indigo accent" }).click();
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
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
  await expect(
    page.getByRole("status").filter({ hasText: "Imported 2 resumes" }),
  ).toContainText("Imported 2 resumes");
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
  await openContentSection(page, "Experience");
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
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
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

test("offers the resume-wide highlight review but disables it in the browser preview", async ({
  page,
}) => {
  await page.goto("/");
  await openContentSection(page, "Experience");
  await page.getByRole("button", { name: "Add experience to end" }).click();
  await page.getByLabel("Job title 1", { exact: true }).fill("Support lead");
  await page.getByRole("button", { name: "Add highlight" }).click();
  await page
    .getByLabel("Highlight 1.1", { exact: true })
    .fill("Answered tickets.");

  const consent = page.getByRole("checkbox", {
    name: /Send every highlight and role in this resume/,
  });
  const review = page.getByRole("button", {
    name: "Review all highlights",
    exact: true,
  });
  await expect(review).toBeVisible();
  await expect(consent).toBeDisabled();
  await expect(review).toBeDisabled();
  await expect(
    page.getByText(
      "Reviewing every highlight is available only in the desktop app. You can keep editing locally.",
    ),
  ).toBeVisible();
  await expect(page.getByText(/^Weak /)).toHaveCount(0);
});
