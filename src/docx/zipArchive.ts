export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function sanitizeXmlText(value: string): string {
  // Strip XML 1.0 disallowed control chars while keeping \t and \n.
  let clean = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd) ||
      code >= 0x10000
    ) {
      clean += ch;
    }
  }
  return escapeXml(clean);
}

export type RunSpec = {
  text: string;
  bold?: boolean;
  color?: string;
  sizeHalfPt?: number;
  font?: string;
};

export function renderRun(spec: RunSpec): string {
  const props: string[] = [];
  if (spec.font) {
    const f = escapeXml(spec.font);
    props.push(`<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}"/>`);
  }
  if (spec.bold) props.push("<w:b/>");
  if (spec.color) props.push(`<w:color w:val="${spec.color}"/>`);
  if (spec.sizeHalfPt) {
    props.push(
      `<w:sz w:val="${spec.sizeHalfPt}"/><w:szCs w:val="${spec.sizeHalfPt}"/>`,
    );
  }
  const rPr = props.length ? `<w:rPr>${props.join("")}</w:rPr>` : "";
  const lines = spec.text.split(/\r?\n/);
  const inner = lines
    .map((line, index) => {
      const prefix = index > 0 ? "<w:br/>" : "";
      return `${prefix}<w:t xml:space="preserve">${sanitizeXmlText(line)}</w:t>`;
    })
    .join("");
  return `<w:r>${rPr}${inner}</w:r>`;
}

export function renderParagraph(
  runs: RunSpec[],
  options: {
    styleId?: string;
    spaceBefore?: number;
    spaceAfter?: number;
    lineTwips?: number;
    borderBottomColor?: string;
    rightTabStopTwips?: number;
    hangingBullet?: boolean;
    keepNext?: boolean;
  } = {},
): string {
  const pPr: string[] = [];
  if (options.styleId) pPr.push(`<w:pStyle w:val="${options.styleId}"/>`);
  if (options.keepNext) pPr.push("<w:keepNext/>");
  if (options.rightTabStopTwips) {
    pPr.push(
      `<w:tabs><w:tab w:val="right" w:pos="${options.rightTabStopTwips}"/></w:tabs>`,
    );
  }
  if (options.hangingBullet) {
    pPr.push('<w:ind w:left="280" w:hanging="180"/>');
  }
  const spacingAttrs: string[] = [];
  if (options.spaceBefore !== undefined)
    spacingAttrs.push(`w:before="${options.spaceBefore}"`);
  if (options.spaceAfter !== undefined)
    spacingAttrs.push(`w:after="${options.spaceAfter}"`);
  if (options.lineTwips !== undefined)
    spacingAttrs.push(`w:line="${options.lineTwips}" w:lineRule="auto"`);
  if (spacingAttrs.length) {
    pPr.push(`<w:spacing ${spacingAttrs.join(" ")}/>`);
  }
  if (options.borderBottomColor) {
    pPr.push(
      `<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="6" w:color="${options.borderBottomColor}"/></w:pBdr>`,
    );
  }
  const pPrXml = pPr.length ? `<w:pPr>${pPr.join("")}</w:pPr>` : "";
  return `<w:p>${pPrXml}${runs.map(renderRun).join("")}</w:p>`;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflateRawIfSupported(
  raw: Uint8Array,
): Promise<{ method: 0 | 8; data: Uint8Array }> {
  if (typeof CompressionStream === "undefined") {
    return { method: 0, data: raw };
  }
  try {
    const stream = new CompressionStream("deflate-raw");
    const readPromise = new Response(stream.readable).arrayBuffer();
    const writer = stream.writable.getWriter();
    await writer.write(new Uint8Array(raw));
    await writer.close();
    const compressed = new Uint8Array(await readPromise);
    if (compressed.length > 0 && compressed.length < raw.length) {
      return { method: 8, data: compressed };
    }
  } catch {
    // Fall back to STORE if CompressionStream("deflate-raw") is unavailable.
  }
  return { method: 0, data: raw };
}

export async function buildZipArchive(
  files: { name: string; content: string }[],
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const entries: {
    nameBytes: Uint8Array;
    rawSize: number;
    compressed: Uint8Array;
    method: 0 | 8;
    crc: number;
    offset: number;
  }[] = [];

  let offset = 0;
  const localChunks: Uint8Array[] = [];

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const raw = encoder.encode(file.content);
    const crc = crc32(raw);
    const { method, data: compressed } = await deflateRawIfSupported(raw);

    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); // Local file header signature PK\x03\x04
    view.setUint16(4, 20, true); // Version needed to extract (2.0)
    view.setUint16(6, 0x0800, true); // General purpose bit flag (UTF-8)
    view.setUint16(8, method, true); // Compression method
    view.setUint16(10, 0, true); // Mod time
    view.setUint16(12, 0x21, true); // Mod date
    view.setUint32(14, crc, true);
    view.setUint32(18, compressed.length, true);
    view.setUint32(22, raw.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(nameBytes, 30);

    entries.push({
      nameBytes,
      rawSize: raw.length,
      compressed,
      method,
      crc,
      offset,
    });

    localChunks.push(header, compressed);
    offset += header.length + compressed.length;
  }

  const centralChunks: Uint8Array[] = [];
  let centralSize = 0;

  for (const entry of entries) {
    const central = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(central.buffer);
    view.setUint32(0, 0x02014b50, true); // Central directory signature PK\x01\x02
    view.setUint16(4, 20, true); // Version made by
    view.setUint16(6, 20, true); // Version needed
    view.setUint16(8, 0x0800, true); // UTF-8
    view.setUint16(10, entry.method, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0x21, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.compressed.length, true);
    view.setUint32(24, entry.rawSize, true);
    view.setUint16(28, entry.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, entry.offset, true);
    central.set(entry.nameBytes, 46);
    centralChunks.push(central);
    centralSize += central.length;
  }

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // End of central directory PK\x05\x06
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, centralSize, true);
  eocdView.setUint32(16, offset, true);
  eocdView.setUint16(20, 0, true);

  const totalLength = offset + centralSize + eocd.length;
  const archive = new Uint8Array(totalLength);
  let cursor = 0;
  for (const chunk of [...localChunks, ...centralChunks, eocd]) {
    archive.set(chunk, cursor);
    cursor += chunk.length;
  }
  return archive;
}
