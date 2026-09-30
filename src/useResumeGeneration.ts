import { useState } from "react";
import { applyProposal, type AiProposal, type Resume } from "./model";
import { generateResume } from "./platform";
import type { Notice } from "./components/WorkspaceHeader";

type Suggestion = { value: AiProposal; source: string };

/** Whole-resume proposal state: per-request consent, review, and stale guard. */
export function useResumeGeneration({
  resume,
  setBusy,
  report,
  notify,
  changeResume,
  setUndo,
}: {
  resume: Resume | undefined;
  setBusy: (busy: "generate" | null) => void;
  report: (error: unknown) => void;
  notify: (notice: Notice) => void;
  changeResume: (next: Resume) => void;
  setUndo: (resume: Resume) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  async function generate() {
    if (!resume) return;
    if (
      !resume.summary.trim() &&
      !resume.experience.some(
        (entry) =>
          entry.role.trim() || entry.bullets.some((text) => text.trim()),
      ) &&
      !resume.skills.some((skill) => skill.trim())
    ) {
      report(
        new Error(
          "Add some experience, skills, or a draft summary first so Copilot has real facts to work with.",
        ),
      );
      return;
    }
    const source = JSON.stringify(resume);
    setBusy("generate");
    setSuggestion(null);
    try {
      const value = await generateResume(resume, consent);
      setSuggestion({ value, source });
      notify({
        kind: "success",
        text: "Your suggestions are ready to review. Your resume has not been changed.",
      });
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
      setConsent(false);
    }
  }

  function applySuggestions() {
    if (!resume || !suggestion) return;
    if (JSON.stringify(resume) !== suggestion.source) {
      report(
        new Error(
          "Your resume changed. Generate new suggestions before applying.",
        ),
      );
      return;
    }

    try {
      changeResume(applyProposal(resume, suggestion.value));
      setUndo(resume);
      setSuggestion(null);
      notify({
        kind: "success",
        text: "Suggestions applied. You can undo this until your next edit.",
      });
    } catch (error) {
      report(error);
    }
  }

  return {
    consent,
    setConsent,
    proposal: suggestion?.value ?? null,
    stale: suggestion !== null && suggestion.source !== JSON.stringify(resume),
    generate,
    apply: applySuggestions,
    discard: () => setSuggestion(null),
    reset: () => {
      setSuggestion(null);
      setConsent(false);
    },
  };
}
