import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import {
  accents,
  formatYearMonth,
  type Density,
  type Resume,
  type SectionKey,
} from "./model";
import sansRegular from "./assets/fonts/NotoSans-Regular.ttf";
import sansBold from "./assets/fonts/NotoSans-Bold.ttf";
import serifRegular from "./assets/fonts/NotoSerif-Regular.ttf";
import serifBold from "./assets/fonts/NotoSerif-Bold.ttf";

Font.register({
  family: "Noto Sans",
  fonts: [
    { src: sansRegular, fontWeight: 400 },
    { src: sansBold, fontWeight: 700 },
  ],
});
Font.register({
  family: "Noto Serif",
  fonts: [
    { src: serifRegular, fontWeight: 400 },
    { src: serifBold, fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

function getDensityMetrics(density: Density) {
  if (density === "compact") {
    return {
      padding: 30,
      paddingBottom: 34,
      fontSize: 8,
      lineHeight: 1.33,
      nameSize: 19.5,
      headlineSize: 9.5,
      smallSize: 7,
      sectionTop: 9,
      sectionBottom: 3.5,
      entryBottom: 4,
    };
  }
  if (density === "spacious") {
    return {
      padding: 46,
      paddingBottom: 50,
      fontSize: 9,
      lineHeight: 1.5,
      nameSize: 23,
      headlineSize: 11,
      smallSize: 8,
      sectionTop: 16,
      sectionBottom: 6,
      entryBottom: 8,
    };
  }
  return {
    padding: 40,
    paddingBottom: 44,
    fontSize: 8.5,
    lineHeight: 1.42,
    nameSize: 22,
    headlineSize: 10.5,
    smallSize: 7.5,
    sectionTop: 13,
    sectionBottom: 5,
    entryBottom: 6,
  };
}

const styles = StyleSheet.create({
  header: { borderBottomWidth: 1.2, paddingBottom: 10, marginBottom: 2 },
  name: { fontWeight: 700, lineHeight: 1.2 },
  headline: { marginTop: 3 },
  contact: { marginTop: 5, color: "#57605e" },
  sectionTitle: { fontWeight: 700 },
  entryHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "baseline",
  },
  role: { fontWeight: 700, flexShrink: 1 },
  dates: { color: "#57605e", maxWidth: "40%" },
  company: { color: "#57605e", marginBottom: 2 },
  bullet: { flexDirection: "row", marginBottom: 1 },
  bulletMark: { width: 9 },
  bulletText: { flex: 1 },
  skillRow: { marginBottom: 2 },
  skillCategory: { fontWeight: 700 },
  pageNumber: {
    position: "absolute",
    bottom: 20,
    right: 40,
    color: "#87918e",
    fontSize: 7,
  },
});

export function ResumeDocument({ resume }: { resume: Resume }) {
  const accent = accents[resume.accent];
  const titleFamily =
    resume.template === "editorial" ? "Noto Serif" : "Noto Sans";
  const metrics = getDensityMetrics(resume.density);
  const pdfSize = resume.pageSize === "letter" ? "LETTER" : "A4";

  const sectionHeadingStyle = [
    styles.sectionTitle,
    {
      color: accent,
      fontSize: metrics.fontSize,
      marginTop: metrics.sectionTop,
      marginBottom: metrics.sectionBottom,
    },
  ];

  const renderSection = (key: SectionKey) => {
    switch (key) {
      case "summary":
        if (!resume.summary.trim()) return null;
        return (
          <View key="summary">
            <Text style={sectionHeadingStyle} minPresenceAhead={30}>
              Profile
            </Text>
            <Text orphans={2} widows={2}>
              {resume.summary}
            </Text>
          </View>
        );

      case "experience":
        if (!resume.experience.length) return null;
        return (
          <View key="experience">
            <Text style={sectionHeadingStyle} minPresenceAhead={60}>
              Experience
            </Text>
            {resume.experience.map((entry) => (
              <View
                key={entry.id}
                style={{ marginBottom: metrics.entryBottom }}
              >
                <View style={styles.entryHeading} minPresenceAhead={35}>
                  <Text style={styles.role}>{entry.role}</Text>
                  <Text style={[styles.dates, { fontSize: metrics.smallSize }]}>
                    {[entry.startDate, entry.endDate]
                      .filter(Boolean)
                      .map(formatYearMonth)
                      .join(" – ")}
                  </Text>
                </View>
                <Text style={styles.company} minPresenceAhead={20}>
                  {[entry.company, entry.location].filter(Boolean).join(" · ")}
                </Text>
                {entry.bullets
                  .filter((text) => text.trim())
                  .map((text, index) => (
                    <View key={index} style={styles.bullet}>
                      <Text style={styles.bulletMark}>•</Text>
                      <Text style={styles.bulletText} orphans={2} widows={2}>
                        {text}
                      </Text>
                    </View>
                  ))}
              </View>
            ))}
          </View>
        );

      case "projects":
        if (!resume.projects.length) return null;
        return (
          <View key="projects">
            <Text style={sectionHeadingStyle} minPresenceAhead={50}>
              Projects
            </Text>
            {resume.projects.map((project) => (
              <View
                key={project.id}
                style={{ marginBottom: metrics.entryBottom }}
              >
                <View style={styles.entryHeading} minPresenceAhead={35}>
                  <Text style={styles.role}>{project.name}</Text>
                  <Text style={[styles.dates, { fontSize: metrics.smallSize }]}>
                    {[project.startDate, project.endDate]
                      .filter(Boolean)
                      .map(formatYearMonth)
                      .join(" – ")}
                  </Text>
                </View>
                {(project.subtitle.trim() || project.url.trim()) && (
                  <Text style={styles.company} minPresenceAhead={20}>
                    {[project.subtitle, project.url]
                      .filter((item) => item.trim())
                      .join(" · ")}
                  </Text>
                )}
                {project.bullets
                  .filter((text) => text.trim())
                  .map((text, index) => (
                    <View key={index} style={styles.bullet}>
                      <Text style={styles.bulletMark}>•</Text>
                      <Text style={styles.bulletText} orphans={2} widows={2}>
                        {text}
                      </Text>
                    </View>
                  ))}
              </View>
            ))}
          </View>
        );

      case "education":
        if (!resume.education.length) return null;
        return (
          <View key="education">
            <Text style={sectionHeadingStyle} minPresenceAhead={45}>
              Education
            </Text>
            {resume.education.map((entry) => (
              <View
                key={entry.id}
                style={{ marginBottom: metrics.entryBottom }}
                wrap={false}
              >
                <View style={styles.entryHeading}>
                  <Text style={styles.role}>{entry.school}</Text>
                  <Text style={[styles.dates, { fontSize: metrics.smallSize }]}>
                    {entry.graduation}
                  </Text>
                </View>
                <Text>{entry.degree}</Text>
              </View>
            ))}
          </View>
        );

      case "certifications":
        if (!resume.certifications.length) return null;
        return (
          <View key="certifications">
            <Text style={sectionHeadingStyle} minPresenceAhead={40}>
              Certifications
            </Text>
            {resume.certifications.map((cert) => (
              <View
                key={cert.id}
                style={{ marginBottom: metrics.entryBottom - 2 }}
                wrap={false}
              >
                <View style={styles.entryHeading}>
                  <Text style={styles.role}>{cert.name}</Text>
                  <Text style={[styles.dates, { fontSize: metrics.smallSize }]}>
                    {cert.date}
                  </Text>
                </View>
                {(cert.issuer.trim() || cert.url.trim()) && (
                  <Text style={styles.company}>
                    {[cert.issuer, cert.url]
                      .filter((item) => item.trim())
                      .join(" · ")}
                  </Text>
                )}
              </View>
            ))}
          </View>
        );

      case "skills": {
        const groups = resume.skillGroups.filter(
          (g) => g.category.trim() || g.items.some((i) => i.trim()),
        );
        const flat = resume.skills.filter((s) => s.trim());
        if (!groups.length && !flat.length) return null;
        return (
          <View key="skills">
            <Text style={sectionHeadingStyle} minPresenceAhead={30}>
              Skills
            </Text>
            {groups.map((group) => (
              <Text key={group.id} style={styles.skillRow}>
                {group.category.trim() ? (
                  <Text style={styles.skillCategory}>
                    {group.category.trim()}:{" "}
                  </Text>
                ) : null}
                {group.items.filter((i) => i.trim()).join("  ·  ")}
              </Text>
            ))}
            {flat.length > 0 && (
              <Text style={styles.skillRow}>
                {groups.length > 0 ? (
                  <Text style={styles.skillCategory}>Additional: </Text>
                ) : null}
                {flat.join("  ·  ")}
              </Text>
            )}
          </View>
        );
      }

      case "custom":
        if (!resume.customSections.length) return null;
        return (
          <View key="custom">
            {resume.customSections.map((section) => {
              if (!section.title.trim() && !section.entries.length) return null;
              return (
                <View key={section.id}>
                  <Text style={sectionHeadingStyle} minPresenceAhead={45}>
                    {section.title.trim() || "Additional"}
                  </Text>
                  {section.entries.map((entry) => (
                    <View
                      key={entry.id}
                      style={{ marginBottom: metrics.entryBottom }}
                    >
                      <View style={styles.entryHeading} minPresenceAhead={30}>
                        <Text style={styles.role}>{entry.heading}</Text>
                        <Text
                          style={[
                            styles.dates,
                            { fontSize: metrics.smallSize },
                          ]}
                        >
                          {entry.date}
                        </Text>
                      </View>
                      {entry.subheading.trim() && (
                        <Text style={styles.company}>{entry.subheading}</Text>
                      )}
                      {entry.bullets
                        .filter((text) => text.trim())
                        .map((text, index) => (
                          <View key={index} style={styles.bullet}>
                            <Text style={styles.bulletMark}>•</Text>
                            <Text
                              style={styles.bulletText}
                              orphans={2}
                              widows={2}
                            >
                              {text}
                            </Text>
                          </View>
                        ))}
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        );
    }
  };

  return (
    <Document
      title={resume.title}
      author={resume.basics.name}
      creator="Hireloom"
    >
      <Page
        size={pdfSize}
        style={{
          padding: metrics.padding,
          paddingBottom: metrics.paddingBottom,
          fontFamily: "Noto Sans",
          fontSize: metrics.fontSize,
          lineHeight: metrics.lineHeight,
          color: "#303c39",
        }}
        wrap
      >
        <View style={[styles.header, { borderBottomColor: accent }]}>
          <Text
            style={[
              styles.name,
              {
                color: accent,
                fontFamily: titleFamily,
                fontSize: metrics.nameSize,
              },
            ]}
          >
            {resume.basics.name}
          </Text>
          {resume.basics.headline && (
            <Text style={[styles.headline, { fontSize: metrics.headlineSize }]}>
              {resume.basics.headline}
            </Text>
          )}
          <Text style={[styles.contact, { fontSize: metrics.smallSize }]}>
            {[
              resume.basics.email,
              resume.basics.phone,
              resume.basics.location,
              resume.basics.website,
              resume.basics.github,
            ]
              .filter(Boolean)
              .join("  ·  ")}
          </Text>
        </View>
        {resume.sectionOrder.map((key) => renderSection(key))}
        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `${pageNumber} / ${totalPages}` : ""
          }
        />
      </Page>
    </Document>
  );
}

export async function createPdf(resume: Resume): Promise<Blob> {
  return pdf(<ResumeDocument resume={resume} />).toBlob();
}
