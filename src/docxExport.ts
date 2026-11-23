import {
  accents,
  formatYearMonth,
  normalizeExternalUrl,
  type Resume,
  type SectionKey,
} from "./model";
import {
  buildZipArchive,
  escapeXml,
  renderParagraph,
  type RunSpec,
} from "./docx/zipArchive";

function buildDocumentXml(resume: Resume): {
  documentXml: string;
  stylesXml: string;
  externalLinks: { id: string; target: string }[];
} {
  const accentHex = accents[resume.accent].replace("#", "");
  const bodyFont = "Calibri";
  const headingFont = resume.template === "editorial" ? "Georgia" : "Calibri";
  const hyperlinkIds = new Map<string, string>();
  const externalLinks: { id: string; target: string }[] = [];

  const registerHyperlink = (raw: string): string | undefined => {
    const normalized = normalizeExternalUrl(raw);
    if (!normalized) return undefined;
    const existing = hyperlinkIds.get(normalized);
    if (existing) return existing;
    const id = `rId${externalLinks.length + 2}`;
    hyperlinkIds.set(normalized, id);
    externalLinks.push({ id, target: normalized });
    return id;
  };

  const buildInlineRuns = (
    items: { text: string; link?: boolean }[],
    separator: string,
    sizeHalfPt: number,
    color = "57605E",
  ): RunSpec[] => {
    const visible = items
      .map((item) => ({ text: item.text.trim(), link: item.link }))
      .filter((item) => item.text.length > 0);
    const runs: RunSpec[] = [];
    visible.forEach((item, index) => {
      if (index > 0) {
        runs.push({ text: separator, sizeHalfPt, color });
      }
      const hyperlinkId = item.link ? registerHyperlink(item.text) : undefined;
      runs.push({
        text: item.text,
        sizeHalfPt,
        color: hyperlinkId ? accentHex : color,
        underline: Boolean(hyperlinkId),
        hyperlinkId,
      });
    });
    return runs;
  };

  const pageWidthTwips = resume.pageSize === "letter" ? 12240 : 11906;
  const pageHeightTwips = resume.pageSize === "letter" ? 15840 : 16838;
  const marginTwips =
    resume.density === "compact"
      ? 720
      : resume.density === "spacious"
        ? 1220
        : 1000;
  const contentWidthTwips = pageWidthTwips - marginTwips * 2;

  const bodyHalfPt =
    resume.density === "compact" ? 18 : resume.density === "spacious" ? 21 : 20;
  const smallHalfPt = bodyHalfPt - 2;
  const lineTwips =
    resume.density === "compact"
      ? 256
      : resume.density === "spacious"
        ? 300
        : 276;
  const sectionGapBefore =
    resume.density === "compact"
      ? 150
      : resume.density === "spacious"
        ? 240
        : 190;
  const entryGapBefore =
    resume.density === "compact"
      ? 80
      : resume.density === "spacious"
        ? 140
        : 110;

  const paragraphs: string[] = [];

  paragraphs.push(
    renderParagraph(
      [
        {
          text: resume.basics.name || "Untitled Resume",
          bold: true,
          color: accentHex,
          sizeHalfPt: 40,
          font: headingFont,
        },
      ],
      { styleId: "Title", spaceBefore: 0, spaceAfter: 40 },
    ),
  );

  const contactRuns = buildInlineRuns(
    [
      { text: resume.basics.email },
      { text: resume.basics.phone },
      { text: resume.basics.location },
      { text: resume.basics.website, link: true },
      { text: resume.basics.github, link: true },
    ],
    "  ·  ",
    smallHalfPt,
  );

  if (resume.basics.headline.trim()) {
    paragraphs.push(
      renderParagraph(
        [
          {
            text: resume.basics.headline.trim(),
            sizeHalfPt: bodyHalfPt + 2,
            color: "3E4943",
          },
        ],
        {
          spaceBefore: 0,
          spaceAfter: contactRuns.length ? 40 : 120,
          borderBottomColor: contactRuns.length ? undefined : accentHex,
        },
      ),
    );
  }

  if (contactRuns.length > 0) {
    paragraphs.push(
      renderParagraph(contactRuns, {
        spaceBefore: 0,
        spaceAfter: 120,
        borderBottomColor: accentHex,
      }),
    );
  }

  const pushSectionHeading = (title: string) => {
    paragraphs.push(
      renderParagraph(
        [
          {
            text: title,
            bold: true,
            color: accentHex,
            sizeHalfPt: bodyHalfPt,
            font: headingFont,
          },
        ],
        {
          styleId: "Heading1",
          spaceBefore: sectionGapBefore,
          spaceAfter: 60,
          keepNext: true,
        },
      ),
    );
  };

  const pushBullet = (text: string) => {
    paragraphs.push(
      renderParagraph(
        [
          { text: "•\t", sizeHalfPt: bodyHalfPt, color: accentHex },
          { text: text.trim(), sizeHalfPt: bodyHalfPt, color: "303C39" },
        ],
        {
          hangingBullet: true,
          spaceBefore: 0,
          spaceAfter: 30,
          lineTwips,
        },
      ),
    );
  };

  const renderSection = (key: SectionKey) => {
    switch (key) {
      case "summary": {
        if (!resume.summary.trim()) return;
        pushSectionHeading("Profile");
        paragraphs.push(
          renderParagraph(
            [
              {
                text: resume.summary.trim(),
                sizeHalfPt: bodyHalfPt,
                color: "303C39",
              },
            ],
            { spaceBefore: 0, spaceAfter: 60, lineTwips },
          ),
        );
        return;
      }
      case "experience": {
        if (!resume.experience.length) return;
        pushSectionHeading("Experience");
        resume.experience.forEach((entry, index) => {
          const dates = [entry.startDate, entry.endDate]
            .filter(Boolean)
            .map(formatYearMonth)
            .join(" – ");
          paragraphs.push(
            renderParagraph(
              [
                {
                  text: entry.role || "Role",
                  bold: true,
                  sizeHalfPt: bodyHalfPt,
                  color: "303C39",
                },
                ...(dates
                  ? [
                      {
                        text: `\t${dates}`,
                        sizeHalfPt: smallHalfPt,
                        color: "57605E",
                      },
                    ]
                  : []),
              ],
              {
                styleId: "Heading2",
                rightTabStopTwips: contentWidthTwips,
                spaceBefore: index === 0 ? 0 : entryGapBefore,
                spaceAfter: 20,
                keepNext: true,
              },
            ),
          );
          const companyLine = [entry.company, entry.location]
            .filter((v) => v.trim())
            .join(" · ");
          if (companyLine) {
            paragraphs.push(
              renderParagraph(
                [
                  {
                    text: companyLine,
                    sizeHalfPt: smallHalfPt,
                    color: "57605E",
                  },
                ],
                { spaceBefore: 0, spaceAfter: 40, keepNext: true },
              ),
            );
          }
          for (const bullet of entry.bullets) {
            if (bullet.trim()) pushBullet(bullet);
          }
        });
        return;
      }
      case "projects": {
        if (!resume.projects.length) return;
        pushSectionHeading("Projects");
        resume.projects.forEach((project, index) => {
          const dates = [project.startDate, project.endDate]
            .filter(Boolean)
            .map(formatYearMonth)
            .join(" – ");
          paragraphs.push(
            renderParagraph(
              [
                {
                  text: project.name || "Project",
                  bold: true,
                  sizeHalfPt: bodyHalfPt,
                  color: "303C39",
                },
                ...(dates
                  ? [
                      {
                        text: `\t${dates}`,
                        sizeHalfPt: smallHalfPt,
                        color: "57605E",
                      },
                    ]
                  : []),
              ],
              {
                styleId: "Heading2",
                rightTabStopTwips: contentWidthTwips,
                spaceBefore: index === 0 ? 0 : entryGapBefore,
                spaceAfter: 20,
                keepNext: true,
              },
            ),
          );
          const subRuns = buildInlineRuns(
            [{ text: project.subtitle }, { text: project.url, link: true }],
            " · ",
            smallHalfPt,
          );
          if (subRuns.length > 0) {
            paragraphs.push(
              renderParagraph(subRuns, {
                spaceBefore: 0,
                spaceAfter: 40,
                keepNext: true,
              }),
            );
          }
          for (const bullet of project.bullets) {
            if (bullet.trim()) pushBullet(bullet);
          }
        });
        return;
      }
      case "education": {
        if (!resume.education.length) return;
        pushSectionHeading("Education");
        resume.education.forEach((entry, index) => {
          paragraphs.push(
            renderParagraph(
              [
                {
                  text: entry.school || "School",
                  bold: true,
                  sizeHalfPt: bodyHalfPt,
                  color: "303C39",
                },
                ...(entry.graduation.trim()
                  ? [
                      {
                        text: `\t${entry.graduation.trim()}`,
                        sizeHalfPt: smallHalfPt,
                        color: "57605E",
                      },
                    ]
                  : []),
              ],
              {
                styleId: "Heading2",
                rightTabStopTwips: contentWidthTwips,
                spaceBefore: index === 0 ? 0 : entryGapBefore,
                spaceAfter: 20,
                keepNext: true,
              },
            ),
          );
          if (entry.degree.trim()) {
            paragraphs.push(
              renderParagraph(
                [
                  {
                    text: entry.degree.trim(),
                    sizeHalfPt: bodyHalfPt,
                    color: "303C39",
                  },
                ],
                { spaceBefore: 0, spaceAfter: 40 },
              ),
            );
          }
        });
        return;
      }
      case "certifications": {
        if (!resume.certifications.length) return;
        pushSectionHeading("Certifications");
        resume.certifications.forEach((cert, index) => {
          const metaRuns = buildInlineRuns(
            [{ text: cert.issuer }, { text: cert.url, link: true }],
            " · ",
            bodyHalfPt,
          );
          paragraphs.push(
            renderParagraph(
              [
                {
                  text: cert.name || "Certification",
                  bold: true,
                  sizeHalfPt: bodyHalfPt,
                  color: "303C39",
                },
                ...(metaRuns.length > 0
                  ? [
                      {
                        text: " — ",
                        sizeHalfPt: bodyHalfPt,
                        color: "57605E",
                      },
                      ...metaRuns,
                    ]
                  : []),
                ...(cert.date.trim()
                  ? [
                      {
                        text: `\t${cert.date.trim()}`,
                        sizeHalfPt: smallHalfPt,
                        color: "57605E",
                      },
                    ]
                  : []),
              ],
              {
                rightTabStopTwips: contentWidthTwips,
                spaceBefore: index === 0 ? 0 : 60,
                spaceAfter: 30,
              },
            ),
          );
        });
        return;
      }
      case "skills": {
        const groups = resume.skillGroups.filter(
          (g) => g.category.trim() || g.items.some((i) => i.trim()),
        );
        const flat = resume.skills.map((s) => s.trim()).filter(Boolean);
        if (!groups.length && !flat.length) return;
        pushSectionHeading("Skills");
        for (const group of groups) {
          const items = group.items.map((i) => i.trim()).filter(Boolean);
          if (!items.length && !group.category.trim()) continue;
          paragraphs.push(
            renderParagraph(
              [
                ...(group.category.trim()
                  ? [
                      {
                        text: `${group.category.trim()}: `,
                        bold: true,
                        sizeHalfPt: bodyHalfPt,
                        color: "303C39",
                      },
                    ]
                  : []),
                {
                  text: items.join("  ·  "),
                  sizeHalfPt: bodyHalfPt,
                  color: "303C39",
                },
              ],
              { spaceBefore: 0, spaceAfter: 40, lineTwips },
            ),
          );
        }
        if (flat.length > 0) {
          paragraphs.push(
            renderParagraph(
              [
                ...(groups.length > 0
                  ? [
                      {
                        text: "Additional: ",
                        bold: true,
                        sizeHalfPt: bodyHalfPt,
                        color: "303C39",
                      },
                    ]
                  : []),
                {
                  text: flat.join("  ·  "),
                  sizeHalfPt: bodyHalfPt,
                  color: "303C39",
                },
              ],
              { spaceBefore: 0, spaceAfter: 40, lineTwips },
            ),
          );
        }
        return;
      }
      case "custom": {
        for (const section of resume.customSections) {
          if (!section.title.trim() && !section.entries.length) continue;
          pushSectionHeading(section.title.trim() || "Additional");
          section.entries.forEach((entry, index) => {
            if (entry.heading.trim() || entry.date.trim()) {
              paragraphs.push(
                renderParagraph(
                  [
                    {
                      text: entry.heading.trim() || "Entry",
                      bold: true,
                      sizeHalfPt: bodyHalfPt,
                      color: "303C39",
                    },
                    ...(entry.date.trim()
                      ? [
                          {
                            text: `\t${entry.date.trim()}`,
                            sizeHalfPt: smallHalfPt,
                            color: "57605E",
                          },
                        ]
                      : []),
                  ],
                  {
                    rightTabStopTwips: contentWidthTwips,
                    spaceBefore: index === 0 ? 0 : entryGapBefore,
                    spaceAfter: 20,
                    keepNext: true,
                  },
                ),
              );
            }
            if (entry.subheading.trim()) {
              paragraphs.push(
                renderParagraph(
                  [
                    {
                      text: entry.subheading.trim(),
                      sizeHalfPt: smallHalfPt,
                      color: "57605E",
                    },
                  ],
                  { spaceBefore: 0, spaceAfter: 40 },
                ),
              );
            }
            for (const bullet of entry.bullets) {
              if (bullet.trim()) pushBullet(bullet);
            }
          });
        }
        return;
      }
    }
  };

  for (const key of resume.sectionOrder) {
    renderSection(key);
  }

  const sectPr = `<w:sectPr><w:pgSz w:w="${pageWidthTwips}" w:h="${pageHeightTwips}"/><w:pgMar w:top="${marginTwips}" w:right="${marginTwips}" w:bottom="${marginTwips}" w:left="${marginTwips}" w:header="480" w:footer="480" w:gutter="0"/></w:sectPr>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraphs.join("\n    ")}
    ${sectPr}
  </w:body>
</w:document>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="${bodyFont}" w:hAnsi="${bodyFont}" w:cs="${bodyFont}"/>
        <w:sz w:val="${bodyHalfPt}"/>
        <w:szCs w:val="${bodyHalfPt}"/>
        <w:lang w:val="en-US"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
  </w:style>
</w:styles>`;

  return { documentXml, stylesXml, externalLinks };
}

export async function createDocxBytes(resume: Resume): Promise<Uint8Array> {
  const { documentXml, stylesXml, externalLinks } = buildDocumentXml(resume);
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const externalRelsXml = externalLinks
    .map(
      (link) =>
        `  <Relationship Id="${escapeXml(link.id)}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(link.target)}" TargetMode="External"/>`,
    )
    .join("\n");

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${externalRelsXml ? `\n${externalRelsXml}` : ""}
</Relationships>`;

  return buildZipArchive([
    { name: "[Content_Types].xml", content: contentTypesXml },
    { name: "_rels/.rels", content: rootRelsXml },
    { name: "word/_rels/document.xml.rels", content: docRelsXml },
    { name: "word/styles.xml", content: stylesXml },
    { name: "word/document.xml", content: documentXml },
  ]);
}

export async function createDocx(resume: Resume): Promise<Blob> {
  const bytes = await createDocxBytes(resume);
  return new Blob([new Uint8Array(bytes)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
