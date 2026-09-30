import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function openContentSection(page: Page, name: string) {
  const tabName =
    name === "Personal details"
      ? "Personal"
      : name === "Professional summary"
        ? "Summary"
        : name;
  await page.getByRole("tab", { name: tabName, exact: true }).click();
}

export async function extractPdfText(path: string) {
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
