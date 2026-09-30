import { expect, test } from "@playwright/test";
import { exampleResume } from "../src/model";
import { openContentSection } from "./helpers";

test("undoes item removals before and after autosave", async ({ page }) => {
  const resume = exampleResume();
  await page.addInitScript(
    (data) => {
      localStorage.setItem("hireloom.workspace.v1", JSON.stringify(data));
    },
    { version: 2, activeResumeId: resume.id, resumes: [resume] },
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
    { version: 2, activeResumeId: resume.id, resumes: [resume] },
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
