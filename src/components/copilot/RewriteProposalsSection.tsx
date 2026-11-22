import { CheckCheck, Sparkles, X } from "lucide-react";
import {
  PROVIDER_LABELS,
  type AiProposal,
  type ProposalSelection,
  type Resume,
  type RoleTailorProposal,
  type SummaryOptionsProposal,
} from "../../model";
import {
  DiffView,
  findGroundingItem,
  GroundingBadge,
  type AiBusyKind,
} from "./ProposalPrimitives";

export type RoleEntryOption = {
  id: string;
  label: string;
  bullets: string[];
};

export function RewriteProposalsSection({
  resume,
  busy,
  roleEntries,
  summaryOptions,
  summaryOptionsStale,
  onApplySummaryOption,
  onDiscardSummaryOptions,
  roleProposal,
  roleSelection,
  onChangeRoleSelection,
  roleStale,
  onApplyRoleProposal,
  onDiscardRoleProposal,
  proposal,
  proposalSelection,
  onChangeProposalSelection,
  stale,
  onApply,
  onDiscard,
}: {
  resume: Resume;
  busy: AiBusyKind;
  roleEntries: RoleEntryOption[];
  summaryOptions?: SummaryOptionsProposal | null;
  summaryOptionsStale?: boolean;
  onApplySummaryOption?: (summary: string) => void;
  onDiscardSummaryOptions?: () => void;
  roleProposal?: RoleTailorProposal | null;
  roleSelection?: boolean[] | null;
  onChangeRoleSelection?: (next: boolean[]) => void;
  roleStale?: boolean;
  onApplyRoleProposal?: () => void;
  onDiscardRoleProposal?: () => void;
  proposal: AiProposal | null;
  proposalSelection: ProposalSelection | null;
  onChangeProposalSelection: (next: ProposalSelection) => void;
  stale: boolean;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const toggleBulletSelection = (
    kind: "experienceBullets" | "projectBullets",
    entryId: string,
    index: number,
  ) => {
    if (!proposalSelection) return;
    const current = proposalSelection[kind][entryId] ?? [];
    const nextFlags = [...current];
    nextFlags[index] = !(nextFlags[index] ?? true);
    onChangeProposalSelection({
      ...proposalSelection,
      [kind]: {
        ...proposalSelection[kind],
        [entryId]: nextFlags,
      },
    });
  };

  const anyProposalItemSelected = proposalSelection
    ? proposalSelection.summary ||
      Object.values(proposalSelection.experienceBullets).some((arr) =>
        arr.some(Boolean),
      ) ||
      Object.values(proposalSelection.projectBullets).some((arr) =>
        arr.some(Boolean),
      )
    : true;

  return (
    <>
      {summaryOptions && (
        <section className="proposal-card" aria-label="Summary options">
          <div className="card-heading">
            <strong>
              <Sparkles size={16} /> Summary angles
            </strong>
            <button
              type="button"
              className="icon-button"
              aria-label="Discard summary options"
              onClick={onDiscardSummaryOptions}
            >
              <X size={16} />
            </button>
          </div>
          {summaryOptionsStale && (
            <p className="inline-error">
              This resume changed after generation. Generate fresh summary
              options before applying.
            </p>
          )}
          <div className="summary-options-list">
            {summaryOptions.options.map((opt, idx) => (
              <div className="summary-option-item" key={idx}>
                <div className="proposal-item-header">
                  <h3>{opt.label}</h3>
                  <button
                    type="button"
                    className="button secondary small"
                    disabled={Boolean(summaryOptionsStale) || Boolean(busy)}
                    onClick={() => onApplySummaryOption?.(opt.summary)}
                  >
                    <CheckCheck size={13} /> Use summary
                  </button>
                </div>
                <p className="proposal-text">{opt.summary}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {roleProposal && (
        <section className="proposal-card" aria-label="Role suggestions">
          <div className="card-heading">
            <strong>
              <Sparkles size={16} /> Suggested role highlights
            </strong>
            <button
              type="button"
              className="icon-button"
              aria-label="Discard role suggestions"
              onClick={onDiscardRoleProposal}
            >
              <X size={16} />
            </button>
          </div>
          {roleProposal.verificationWarning && (
            <p className="inline-error">{roleProposal.verificationWarning}</p>
          )}
          {(() => {
            const origBullets =
              roleEntries.find((r) => r.id === roleProposal.entryId)?.bullets ??
              [];
            const maxLen = Math.max(
              origBullets.length,
              roleProposal.bullets.length,
            );
            return (
              <ul className="proposal-diff-list">
                {Array.from({ length: maxLen }, (_, idx) => {
                  const included = roleSelection?.[idx] ?? true;
                  return (
                    <li
                      key={idx}
                      className={included ? "" : "excluded-suggestion"}
                    >
                      <div className="proposal-bullet-row">
                        <div>
                          <DiffView
                            original={origBullets[idx] ?? ""}
                            proposed={roleProposal.bullets[idx] ?? ""}
                          />
                          <GroundingBadge
                            item={findGroundingItem(
                              roleProposal.verification,
                              `bullet:${idx}`,
                            )}
                          />
                        </div>
                        {roleSelection && onChangeRoleSelection && (
                          <button
                            type="button"
                            className="pill-toggle"
                            aria-pressed={included}
                            aria-label={`Include tailored highlight ${idx + 1}`}
                            onClick={() => {
                              const next = [...roleSelection];
                              next[idx] = !included;
                              onChangeRoleSelection(next);
                            }}
                          >
                            {included ? "Included" : "Keep original"}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
          {roleStale && (
            <p className="inline-error">
              This resume changed after generation. Regenerate role suggestions
              before applying.
            </p>
          )}
          <button
            type="button"
            className="button primary"
            disabled={
              Boolean(roleStale) ||
              Boolean(busy) ||
              (roleSelection ? !roleSelection.some(Boolean) : false)
            }
            onClick={onApplyRoleProposal}
          >
            <CheckCheck size={16} /> Apply role suggestions
          </button>
        </section>
      )}

      {proposal && (
        <section className="proposal-card" aria-label="Copilot suggestions">
          <div className="card-heading">
            <strong>
              <Sparkles size={16} /> Your suggested rewrite
            </strong>
            <button
              type="button"
              className="icon-button"
              aria-label="Discard suggestions"
              onClick={onDiscard}
            >
              <X size={16} />
            </button>
          </div>
          <p className="fine-print">
            Check every claim before applying. Toggle individual items to keep
            your original wording wherever you prefer.
          </p>
          {proposal.verification && (
            <p className="fine-print">
              Factual grounding audited by{" "}
              <strong>
                {PROVIDER_LABELS[proposal.verification.provider]} ·{" "}
                {proposal.verification.model}
              </strong>
              .
            </p>
          )}
          {proposal.verificationWarning && (
            <p className="inline-error">{proposal.verificationWarning}</p>
          )}
          <div className="proposal-item-header">
            <h3>Summary</h3>
            {proposalSelection && (
              <button
                type="button"
                className="pill-toggle"
                aria-pressed={proposalSelection.summary}
                aria-label="Include summary suggestion"
                onClick={() =>
                  onChangeProposalSelection({
                    ...proposalSelection,
                    summary: !proposalSelection.summary,
                  })
                }
              >
                {proposalSelection.summary ? "Included" : "Keep original"}
              </button>
            )}
          </div>
          <p className="proposal-text">
            {proposal.summary ? (
              <DiffView original={resume.summary} proposed={proposal.summary} />
            ) : (
              "(No summary suggested)"
            )}
          </p>
          <GroundingBadge
            item={findGroundingItem(proposal.verification, "summary")}
          />
          {proposal.experience.map((entry) => {
            const originalEntry = resume.experience.find(
              (original) => original.id === entry.id,
            );
            const maxLen = Math.max(
              originalEntry?.bullets.length ?? 0,
              entry.bullets.length,
            );
            return (
              <div key={entry.id}>
                <h3>{originalEntry?.role || "Experience"}</h3>
                <ul className="proposal-diff-list">
                  {Array.from({ length: maxLen }, (_, index) => {
                    const origText = originalEntry?.bullets[index] ?? "";
                    const propText = entry.bullets[index] ?? "";
                    const included =
                      proposalSelection?.experienceBullets[entry.id]?.[index] ??
                      true;
                    return (
                      <li
                        key={index}
                        className={included ? "" : "excluded-suggestion"}
                      >
                        <div className="proposal-bullet-row">
                          <div>
                            <DiffView original={origText} proposed={propText} />
                            <GroundingBadge
                              item={findGroundingItem(
                                proposal.verification,
                                `experience:${entry.id}:${index}`,
                              )}
                            />
                          </div>
                          {proposalSelection && (
                            <button
                              type="button"
                              className="pill-toggle"
                              aria-pressed={included}
                              aria-label={`Include suggestion for ${originalEntry?.role || "experience"} highlight ${index + 1}`}
                              onClick={() =>
                                toggleBulletSelection(
                                  "experienceBullets",
                                  entry.id,
                                  index,
                                )
                              }
                            >
                              {included ? "Included" : "Keep original"}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {(proposal.projects ?? []).map((entry) => {
            const originalProj = resume.projects.find(
              (original) => original.id === entry.id,
            );
            const maxLen = Math.max(
              originalProj?.bullets.length ?? 0,
              entry.bullets.length,
            );
            return (
              <div key={entry.id}>
                <h3>{originalProj?.name || "Project"}</h3>
                <ul className="proposal-diff-list">
                  {Array.from({ length: maxLen }, (_, index) => {
                    const origText = originalProj?.bullets[index] ?? "";
                    const propText = entry.bullets[index] ?? "";
                    const included =
                      proposalSelection?.projectBullets[entry.id]?.[index] ??
                      true;
                    return (
                      <li
                        key={index}
                        className={included ? "" : "excluded-suggestion"}
                      >
                        <div className="proposal-bullet-row">
                          <div>
                            <DiffView original={origText} proposed={propText} />
                            <GroundingBadge
                              item={findGroundingItem(
                                proposal.verification,
                                `project:${entry.id}:${index}`,
                              )}
                            />
                          </div>
                          {proposalSelection && (
                            <button
                              type="button"
                              className="pill-toggle"
                              aria-pressed={included}
                              aria-label={`Include suggestion for ${originalProj?.name || "project"} highlight ${index + 1}`}
                              onClick={() =>
                                toggleBulletSelection(
                                  "projectBullets",
                                  entry.id,
                                  index,
                                )
                              }
                            >
                              {included ? "Included" : "Keep original"}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {proposal.notes.length > 0 && (
            <div className="proposal-notes">
              <h3>Things to consider</h3>
              <ul>
                {proposal.notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </div>
          )}
          {stale && (
            <p className="inline-error">
              This resume changed after generation. Generate fresh suggestions
              to avoid replacing newer work.
            </p>
          )}
          <button
            type="button"
            className="button primary"
            disabled={stale || Boolean(busy) || !anyProposalItemSelected}
            onClick={onApply}
          >
            <CheckCheck size={16} /> Apply reviewed suggestions
          </button>
        </section>
      )}
    </>
  );
}
