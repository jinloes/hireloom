import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import { accents, formatYearMonth, type Resume } from "./model";
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

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 44,
    fontFamily: "Noto Sans",
    fontSize: 8.5,
    lineHeight: 1.42,
    color: "#303c39",
  },
  header: { borderBottomWidth: 1.2, paddingBottom: 10, marginBottom: 2 },
  name: { fontSize: 22, fontWeight: 700, lineHeight: 1.2 },
  headline: { marginTop: 3, fontSize: 10.5 },
  contact: { marginTop: 5, fontSize: 7.5, color: "#57605e" },
  sectionTitle: {
    fontSize: 8.5,
    fontWeight: 700,
    marginTop: 13,
    marginBottom: 5,
  },
  entry: { marginBottom: 6 },
  entryHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "baseline",
  },
  role: { fontWeight: 700, flexShrink: 1 },
  dates: { fontSize: 7.5, color: "#57605e", maxWidth: "40%" },
  company: { color: "#57605e", marginBottom: 2 },
  bullet: { flexDirection: "row", marginBottom: 1 },
  bulletMark: { width: 9 },
  bulletText: { flex: 1 },
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
  return (
    <Document
      title={resume.title}
      author={resume.basics.name}
      creator="Hireloom"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={[styles.header, { borderBottomColor: accent }]}>
          <Text
            style={[styles.name, { color: accent, fontFamily: titleFamily }]}
          >
            {resume.basics.name}
          </Text>
          {resume.basics.headline && (
            <Text style={styles.headline}>{resume.basics.headline}</Text>
          )}
          <Text style={styles.contact}>
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
        {resume.summary.trim() && (
          <>
            <Text
              style={[styles.sectionTitle, { color: accent }]}
              minPresenceAhead={30}
            >
              Profile
            </Text>
            <Text orphans={2} widows={2}>
              {resume.summary}
            </Text>
          </>
        )}
        {resume.experience.length > 0 && (
          <>
            <Text
              style={[styles.sectionTitle, { color: accent }]}
              minPresenceAhead={60}
            >
              Experience
            </Text>
            {resume.experience.map((entry) => (
              <View key={entry.id} style={styles.entry}>
                <View style={styles.entryHeading} minPresenceAhead={35}>
                  <Text style={styles.role}>{entry.role}</Text>
                  <Text style={styles.dates}>
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
          </>
        )}
        {resume.education.length > 0 && (
          <>
            <Text
              style={[styles.sectionTitle, { color: accent }]}
              minPresenceAhead={45}
            >
              Education
            </Text>
            {resume.education.map((entry) => (
              <View key={entry.id} style={styles.entry} wrap={false}>
                <View style={styles.entryHeading}>
                  <Text style={styles.role}>{entry.school}</Text>
                  <Text style={styles.dates}>{entry.graduation}</Text>
                </View>
                <Text>{entry.degree}</Text>
              </View>
            ))}
          </>
        )}
        {resume.skills.length > 0 && (
          <>
            <Text
              style={[styles.sectionTitle, { color: accent }]}
              minPresenceAhead={30}
            >
              Skills
            </Text>
            <Text>{resume.skills.join("  ·  ")}</Text>
          </>
        )}
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
