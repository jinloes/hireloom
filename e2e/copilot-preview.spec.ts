import { expect, test } from "@playwright/test";
import { openContentSection } from "./helpers";

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

test("opens highlight drafting but keeps it desktop-only in the browser preview", async ({
  page,
}) => {
  await page.goto("/");
  await openContentSection(page, "Experience");
  await page.getByRole("button", { name: "Add experience to end" }).click();
  await page.getByLabel("Job title 1", { exact: true }).fill("Support lead");
  const highlights = page.getByLabel(/^Highlight 1\.\d+$/);
  const highlightCount = await highlights.count();

  await page
    .getByRole("button", { name: "Draft highlights from notes", exact: true })
    .click();
  const notes = page.getByLabel("Rough notes about this job");
  await notes.fill("answered tickets, wrote help articles");
  await expect(notes).toHaveValue("answered tickets, wrote help articles");
  await expect(
    page.getByRole("checkbox", {
      name: /Send these notes and job title to GitHub Copilot/,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Draft highlights", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "Drafting highlights is available only in the desktop app. You can keep editing locally.",
    ),
  ).toBeVisible();
  await expect(highlights).toHaveCount(highlightCount);
});
