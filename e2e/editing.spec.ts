import { expect, test } from "@playwright/test";
import { exampleResume } from "../src/model";
import { openContentSection } from "./helpers";

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
    { version: 2, activeResumeId: resume.id, resumes: [resume] },
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

test("edits optional sections and navigates from the local audit", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Copilot", exact: true }).click();
  await page.getByLabel("Role title").fill("Product Designer");
  await page
    .getByLabel("Job description")
    .fill("Seeking a product designer with analytics experience.");
  await page
    .getByRole("button", {
      name: /Complete the name and professional headline/,
    })
    .click();
  await expect(page.getByRole("tab", { name: "Content" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByLabel("Full name", { exact: true })).toBeFocused();

  await openContentSection(page, "More");
  await page.getByRole("button", { name: "Add project" }).click();
  await page.getByLabel("Project name").fill("Accessible design system");
  await page.getByLabel("Role", { exact: true }).fill("Lead designer");
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
  await expect(page.getByTestId("resume-preview")).toContainText("Projects");
  await expect(page.getByTestId("resume-preview")).toContainText(
    "Accessible design system",
  );
});
