import { expect, test } from "@playwright/test";
import { exampleResume } from "../src/model";
import { openContentSection } from "./helpers";

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
    { version: 2, activeResumeId: resume.id, resumes: [resume] },
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
    await expect(contentTabs.getByRole("tab")).toHaveCount(6);
    for (const name of [
      "Personal",
      "Summary",
      "Experience",
      "Education",
      "Skills",
      "More",
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
        contentTabs.getByRole("tab", { name: "More", exact: true }),
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
