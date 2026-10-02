import { useRef, useState } from "react";
import { draftHighlights, type CopilotStatus } from "./platform";
import {
  appendDraftedHighlights,
  highlightDraftTargetSchema,
  sameDraftTarget,
  type HighlightDraft,
} from "./highlightDrafts";
import type { Resume } from "./model";
import type {
  HighlightDraftOwner,
  HighlightDraftsController,
} from "./components/editor/types";
import type { Notice } from "./components/WorkspaceHeader";

const sameOwner = (
  left: HighlightDraftOwner | null,
  right: HighlightDraftOwner | null,
) =>
  left !== null &&
  right !== null &&
  left.resumeId === right.resumeId &&
  left.experienceId === right.experienceId;

/**
 * Transient "draft highlights from notes" state. Notes and drafts are never
 * persisted; drafts are bound to the exact notes and job they came from.
 */
export function useHighlightDrafts({
  resume,
  status,
  busy,
  setBusy,
  report,
  notify,
  changeResume,
  setUndo,
}: {
  resume: Resume | undefined;
  status: CopilotStatus | null;
  busy: HighlightDraftsController["busy"];
  setBusy: (busy: "draft" | null) => void;
  report: (error: unknown) => void;
  notify: (notice: Notice) => void;
  changeResume: (next: Resume) => void;
  setUndo: (resume: Resume) => void;
}) {
  const [owner, setOwnerState] = useState<HighlightDraftOwner | null>(null);
  const ownerRef = useRef<HighlightDraftOwner | null>(null);
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [draft, setDraft] = useState<HighlightDraft | null>(null);
  const [selected, setSelected] = useState<number[]>([]);

  function open(next: HighlightDraftOwner | null) {
    ownerRef.current = next;
    setOwnerState(next);
    setNotes("");
    setConsent(false);
    setDraft(null);
    setSelected([]);
  }

  const reset = () => open(null);

  function currentTarget() {
    if (!resume || !owner || resume.id !== owner.resumeId) return null;
    const experience = resume.experience.find(
      (entry) => entry.id === owner.experienceId,
    );
    return experience
      ? {
          resumeId: resume.id,
          experienceId: experience.id,
          role: experience.role,
          notes,
        }
      : null;
  }

  const target = currentTarget();
  const stale =
    draft !== null &&
    (target === null || !sameDraftTarget(draft.target, target));

  async function requestDraft() {
    if (!owner) return;
    if (!target) {
      setConsent(false);
      report(new Error("This job no longer exists. Nothing has been changed."));
      return;
    }
    const parsed = highlightDraftTargetSchema.safeParse(target);
    if (!parsed.success) {
      setConsent(false);
      report(new Error(parsed.error.issues[0].message));
      return;
    }
    const requestOwner = owner;
    setBusy("draft");
    try {
      const value = await draftHighlights(parsed.data, consent);
      if (!sameOwner(ownerRef.current, requestOwner)) return;
      setDraft(value);
      setSelected([]);
      notify({
        kind: "success",
        text: "Your drafted highlights are ready to review. Your resume has not been changed.",
      });
    } catch (error) {
      if (sameOwner(ownerRef.current, requestOwner)) report(error);
    } finally {
      setBusy(null);
      setConsent(false);
    }
  }

  function apply() {
    if (!resume || !draft) return;
    if (stale) {
      report(
        new Error(
          "Your notes or this job changed after drafting. Draft again before adding highlights.",
        ),
      );
      return;
    }
    try {
      const next = appendDraftedHighlights(resume, draft, selected);
      changeResume(next);
      setUndo(resume);
      reset();
      const count = selected.length;
      notify({
        kind: "success",
        text: `Added ${count} highlight${count === 1 ? "" : "s"}. You can undo this until your next edit.`,
      });
    } catch (error) {
      report(error);
    }
  }

  const controller: HighlightDraftsController = {
    owner,
    onToggle: (next) => open(sameOwner(owner, next) ? null : next),
    onDiscard: reset,
    notes,
    onNotes: (value) => {
      setNotes(value);
      setConsent(false);
    },
    consent,
    onConsent: setConsent,
    onDraft: () => void requestDraft(),
    bullets: draft?.bullets ?? null,
    selected,
    onSelect: (index, checked) =>
      setSelected((current) =>
        checked
          ? [...current.filter((value) => value !== index), index]
          : current.filter((value) => value !== index),
      ),
    stale,
    onApply: apply,
    status,
    busy,
  };

  return { controller, reset };
}
