import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { computeWordDiff } from "../../diff";
import type { GroundingItem, GroundingReport } from "../../model";

export type AiBusyKind =
  | "login"
  | "generate"
  | "summaryOptions"
  | "tailorRole"
  | "importCleanup"
  | "analyze"
  | "refine"
  | "status"
  | "settings"
  | null;

export function DiffView({
  original,
  proposed,
}: {
  original: string;
  proposed: string;
}) {
  if (!original.trim() || original === proposed) {
    return <span className="proposal-clean">{proposed || "(Empty)"}</span>;
  }
  const spans = computeWordDiff(original, proposed);
  return (
    <span className="diff-line">
      {spans.map((span, idx) =>
        span.kind === "added" ? (
          <ins key={idx} className="diff-added">
            {span.text}
          </ins>
        ) : span.kind === "removed" ? (
          <del key={idx} className="diff-removed">
            {span.text}
          </del>
        ) : (
          <span key={idx}>{span.text}</span>
        ),
      )}
    </span>
  );
}

export function GroundingBadge({ item }: { item?: GroundingItem }) {
  if (!item) return null;
  const label =
    item.status === "supported"
      ? "Supported"
      : item.status === "inferred"
        ? "Inferred — check"
        : "Unsupported claim";
  return (
    <div className={`grounding-note grounding-${item.status}`}>
      <span className={`grounding-pill status-${item.status}`}>
        {item.status === "supported" ? (
          <ShieldCheck size={11} />
        ) : item.status === "inferred" ? (
          <AlertTriangle size={11} />
        ) : (
          <ShieldAlert size={11} />
        )}
        {label}
      </span>
      <span>{item.note}</span>
    </div>
  );
}

export function findGroundingItem(
  report: GroundingReport | undefined,
  key: string,
): GroundingItem | undefined {
  return report?.items.find((item) => item.key === key);
}
