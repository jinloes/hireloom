export const MAX_RESUME_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_DOCX_XML_BYTES = 8 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 250;
const MAX_PDF_PAGES = 40;

export function redactImportLinesForAi(lines: string[]): string[] {
  return lines.slice(0, 600).map((line) =>
    line
      .replace(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        "[REDACTED_EMAIL]",
      )
      .replace(
        /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}/g,
        "[REDACTED_PHONE]",
      )
      .replace(
        /(?:https?:\/\/\S+|(?:www\.)?(?:linkedin|github)\.com\/\S+)/gi,
        "[REDACTED_URL]",
      )
      .slice(0, 2_000),
  );
}

export function sanitizeLine(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\u00A0/g, " ")
    .trim();
}

async function inflateRawBounded(
  compressed: Uint8Array,
  maxBytes: number,
): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "This browser environment cannot decompress DOCX archives.",
    );
  }
  const stream = new DecompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  const writePromise = writer
    .write(new Uint8Array(compressed))
    .then(() => writer.close());

  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("DOCX content exceeds the 8 MB safety limit.");
      }
      chunks.push(value);
    }
    await writePromise;
  } catch (error) {
    await writePromise.catch(() => undefined);
    throw error;
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export async function extractDocxLines(bytes: Uint8Array): Promise<string[]> {
  if (bytes.length > MAX_RESUME_IMPORT_BYTES) {
    throw new Error("Choose a resume file under 5 MB.");
  }
  if (
    bytes.length < 22 ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    bytes[2] !== 0x03 ||
    bytes[3] !== 0x04
  ) {
    throw new Error("This file is not a valid Word (.docx) document.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocdOffset = -1;
  const minEocd = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minEocd; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error("Could not read the DOCX archive directory.");
  }

  const entryCount = view.getUint16(eocdOffset + 10, true);
  if (entryCount > MAX_ZIP_ENTRIES) {
    throw new Error("DOCX archive contains too many entries.");
  }
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder("utf-8");

  let cursor = centralDirOffset;
  let documentXmlBytes: Uint8Array | null = null;

  for (let idx = 0; idx < entryCount; idx++) {
    if (
      cursor + 46 > bytes.length ||
      view.getUint32(cursor, true) !== 0x02014b50
    ) {
      throw new Error("Malformed DOCX central directory.");
    }
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);

    const name = decoder.decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameLen),
    );
    cursor += 46 + nameLen + extraLen + commentLen;

    if (name === "word/document.xml") {
      if (uncompressedSize > MAX_DOCX_XML_BYTES) {
        throw new Error("DOCX document XML exceeds the 8 MB limit.");
      }
      if (
        localHeaderOffset + 30 > bytes.length ||
        view.getUint32(localHeaderOffset, true) !== 0x04034b50
      ) {
        throw new Error("Malformed DOCX local file header.");
      }
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > bytes.length) {
        throw new Error("Truncated DOCX document entry.");
      }
      const slice = bytes.subarray(dataStart, dataEnd);
      if (method === 0) {
        documentXmlBytes = slice;
      } else if (method === 8) {
        documentXmlBytes = await inflateRawBounded(slice, MAX_DOCX_XML_BYTES);
      } else {
        throw new Error(
          `Unsupported DOCX compression method (${method}). Export as standard .docx or PDF.`,
        );
      }
      break;
    }
  }

  if (!documentXmlBytes) {
    throw new Error("Word document does not contain word/document.xml.");
  }

  const xmlText = decoder.decode(documentXmlBytes);
  const dom = new DOMParser().parseFromString(xmlText, "application/xml");
  if (dom.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Could not parse DOCX XML content.");
  }

  const lines: string[] = [];
  const paragraphs = Array.from(dom.getElementsByTagNameNS("*", "p"));
  for (const p of paragraphs) {
    const hasNumPr = p.getElementsByTagNameNS("*", "numPr").length > 0;
    let text = "";
    const walk = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const local = el.localName;
        if (local === "t") {
          text += el.textContent ?? "";
          return;
        }
        if (local === "tab") {
          text += "  ";
          return;
        }
        if (local === "br" || local === "cr") {
          text += "\n";
          return;
        }
      }
      for (const child of Array.from(node.childNodes)) {
        walk(child);
      }
    };
    walk(p);
    for (const rawSubLine of text.split(/\n/)) {
      const cleaned = sanitizeLine(rawSubLine);
      if (!cleaned) continue;
      if (hasNumPr && !/^[•·\-*▪◦]/.test(cleaned)) {
        lines.push(`• ${cleaned}`);
      } else {
        lines.push(cleaned);
      }
    }
  }
  return lines;
}

export async function extractPdfLines(bytes: Uint8Array): Promise<string[]> {
  if (bytes.length > MAX_RESUME_IMPORT_BYTES) {
    throw new Error("Choose a resume file under 5 MB.");
  }
  const header = new TextDecoder("ascii").decode(bytes.subarray(0, 5));
  if (header !== "%PDF-") {
    throw new Error("This file is not a valid PDF document.");
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    const workerModule =
      await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
    if (workerModule.default && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
    }
  } catch {
    // Node/Vitest environments fall back to fake worker automatically.
  }

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
  }).promise;

  try {
    if (doc.numPages > MAX_PDF_PAGES) {
      throw new Error(
        `PDF has ${doc.numPages} pages (maximum ${MAX_PDF_PAGES} pages supported).`,
      );
    }

    const lines: string[] = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      type Positioned = { str: string; x: number; y: number };
      const items: Positioned[] = [];

      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const transform =
          "transform" in item ? item.transform : [1, 0, 0, 1, 0, 0];
        items.push({
          str: item.str,
          x: Number(transform[4] ?? 0),
          y: Number(transform[5] ?? 0),
        });
      }

      // Group items on the same baseline (within 3pt Y tolerance), sorted top-to-bottom.
      items.sort((a, b) => (Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x));
      const rowGroups: Positioned[][] = [];
      for (const item of items) {
        const last = rowGroups[rowGroups.length - 1];
        if (last && Math.abs(last[0].y - item.y) <= 3) {
          last.push(item);
        } else {
          rowGroups.push([item]);
        }
      }

      for (const group of rowGroups) {
        group.sort((a, b) => a.x - b.x);
        let rowText = "";
        for (let i = 0; i < group.length; i++) {
          if (i > 0) {
            const gap = group[i].x - group[i - 1].x;
            rowText += gap > 40 ? "  " : " ";
          }
          rowText += group[i].str;
        }
        const cleaned = sanitizeLine(rowText.replace(/\s{3,}/g, "  "));
        if (cleaned && !/^\d+\s*\/\s*\d+$/.test(cleaned)) {
          lines.push(cleaned);
        }
      }
    }
    return lines;
  } finally {
    await doc.destroy();
  }
}
