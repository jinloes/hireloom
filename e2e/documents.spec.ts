import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { openContentSection } from "./helpers";

test("example, design, PDF text, backups, duplicate and delete", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(45_000);
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
  expect(parsed.version).toBe(2);
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
