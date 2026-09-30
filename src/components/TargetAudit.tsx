import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { Resume } from "../model";
import { auditResume, type AuditFinding } from "../targetAudit";

export function TargetAudit({
  resume,
  onNavigate,
}: {
  resume: Resume;
  onNavigate: (target: AuditFinding["target"]) => void;
}) {
  const findings = auditResume(resume);
  return (
    <section className="audit-card" aria-labelledby="audit-heading">
      <div className="card-heading">
        <strong id="audit-heading">Local resume audit</strong>
        <span>
          {findings.length
            ? `${findings.length} ${findings.length === 1 ? "finding" : "findings"}`
            : "Ready"}
        </span>
      </div>
      <p className="fine-print">
        Deterministic checks only—not an ATS score or hiring prediction. Review
        every suggestion against your real experience.
      </p>
      {!findings.length && (
        <div className="audit-ready">
          <CheckCircle2 size={18} />
          <p>No issues were found by the current checks.</p>
        </div>
      )}
      <div className="audit-findings">
        {findings.map((finding) => (
          <article
            className={`audit-finding ${finding.level}`}
            key={finding.id}
          >
            <span className="audit-category">{finding.category}</span>
            <h3>{finding.title}</h3>
            <p>
              <strong>Observed:</strong> {finding.observed}
            </p>
            <p>
              <strong>Why it matters:</strong> {finding.why}
            </p>
            <button
              className="text-button"
              onClick={() => onNavigate(finding.target)}
            >
              {finding.action} <ArrowRight size={13} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
