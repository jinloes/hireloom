import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyAprRewrite,
  applyPartialProposal,
  applyRoleTailorProposal,
  defaultAiSettings,
  defaultProposalSelection,
  normalizeAprAnswers,
  PROVIDER_LABELS,
  validateAprTarget,
  validateProposal,
  type AiProposal,
  type AiSettings,
  type AprAnalysis,
  type AprQuestionAnswer,
  type AprRefinement,
  type AprTarget,
  type ProposalSelection,
  type ProviderKind,
  type Resume,
  type RoleTailorProposal,
  type SummaryOptionsProposal,
} from "../model";
import {
  aiProviderStatus,
  analyzeAccomplishment,
  cancelAiRequest,
  clearProviderApiKey,
  copilotStatus,
  generateResume,
  generateSummaryOptions,
  isAiCancelledError,
  loginToCopilot,
  refineAccomplishment,
  saveAiSettings,
  setProviderApiKey,
  tailorExperienceRole,
  type CopilotStatus,
  type ProviderCredentialStatus,
} from "../platform";
import type { AiBusyKind } from "../components/CopilotPanel";

export type StudioNotice = {
  kind: "success" | "error";
  text: string;
  canUndo?: boolean;
};

type Suggestion = {
  value: AiProposal;
  source: string;
  selection: ProposalSelection;
};
type SummarySuggestion = {
  value: SummaryOptionsProposal;
  source: string;
};
type RoleSuggestion = {
  value: RoleTailorProposal;
  source: string;
  selection: boolean[];
};
type AprSuggestion = { value: AprAnalysis; source: AprTarget };
type AprRefinementSuggestion = {
  value: AprRefinement;
  source: AprTarget;
  answers: AprQuestionAnswer[];
};

function hasDraftFacts(target: Resume): boolean {
  return Boolean(
    target.summary.trim() ||
    target.experience.some(
      (entry) => entry.role.trim() || entry.bullets.some((text) => text.trim()),
    ) ||
    target.projects.some(
      (project) =>
        project.name.trim() || project.bullets.some((text) => text.trim()),
    ) ||
    target.skills.some((skill) => skill.trim()) ||
    target.skillGroups.some((g) => g.items.some((i) => i.trim())),
  );
}

export function useStudioAiWorkflows({
  resume,
  resumeSnapshot,
  applyResumeDirect,
  recordAiHistory,
  setNotice,
  report,
}: {
  resume: Resume | undefined;
  resumeSnapshot: string;
  applyResumeDirect: (next: Resume) => void;
  recordAiHistory: (previous: Resume) => void;
  setNotice: (notice: StudioNotice | null) => void;
  report: (error: unknown) => void;
}) {
  const requestSeq = useRef(0);
  const [aiSettings, setAiSettings] = useState<AiSettings>(() =>
    defaultAiSettings(),
  );
  const [providerStates, setProviderStates] = useState<
    ProviderCredentialStatus[]
  >([]);
  const [copilot, setCopilot] = useState<CopilotStatus | null>(null);
  const [busy, setBusy] = useState<AiBusyKind>(null);
  const [consent, setConsent] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [summarySuggestion, setSummarySuggestion] =
    useState<SummarySuggestion | null>(null);
  const [roleSuggestion, setRoleSuggestion] = useState<RoleSuggestion | null>(
    null,
  );
  const [aprTarget, setAprTarget] = useState<AprTarget | null>(null);
  const [aprConsent, setAprConsent] = useState(false);
  const [aprSuggestion, setAprSuggestion] = useState<AprSuggestion | null>(
    null,
  );
  const [aprAnswers, setAprAnswers] = useState<string[]>([]);
  const [aprRefinementConsent, setAprRefinementConsent] = useState(false);
  const [aprRefinement, setAprRefinement] =
    useState<AprRefinementSuggestion | null>(null);

  function resetApr() {
    setAprTarget(null);
    setAprConsent(false);
    setAprSuggestion(null);
    setAprAnswers([]);
    setAprRefinementConsent(false);
    setAprRefinement(null);
  }

  function resetAiTransientForResumeSwitch(clearAprFull = true) {
    setSuggestion(null);
    setSummarySuggestion(null);
    setRoleSuggestion(null);
    setConsent(false);
    if (clearAprFull) {
      resetApr();
    } else {
      setAprTarget(null);
      setAprConsent(false);
      setAprRefinementConsent(false);
    }
  }

  async function refreshCopilot() {
    setBusy("status");
    try {
      const [status, providerInfo] = await Promise.all([
        copilotStatus(),
        aiProviderStatus(),
      ]);
      setAiSettings(providerInfo.settings);
      setProviderStates(providerInfo.providers);
      setCopilot(
        providerInfo.copilot.version || providerInfo.copilot.available
          ? providerInfo.copilot
          : status,
      );
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void refreshCopilot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveAiSettings(next: AiSettings) {
    setBusy("settings");
    try {
      const saved = await saveAiSettings(next);
      setAiSettings(saved);
      const providerInfo = await aiProviderStatus();
      setProviderStates(providerInfo.providers);
      if (providerInfo.copilot.version || providerInfo.copilot.available) {
        setCopilot(providerInfo.copilot);
      }
      setNotice({
        kind: "success",
        text: `AI settings updated (${PROVIDER_LABELS[saved.primaryProvider]} · ${saved.primaryModel}).`,
      });
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveApiKey(provider: ProviderKind, apiKey: string) {
    setBusy("settings");
    try {
      await setProviderApiKey(provider, apiKey);
      const providerInfo = await aiProviderStatus();
      setAiSettings(providerInfo.settings);
      setProviderStates(providerInfo.providers);
      setNotice({
        kind: "success",
        text: `${PROVIDER_LABELS[provider]} key stored in your OS credential store.`,
      });
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
    }
  }

  async function handleClearApiKey(provider: ProviderKind) {
    setBusy("settings");
    try {
      await clearProviderApiKey(provider);
      const providerInfo = await aiProviderStatus();
      setAiSettings(providerInfo.settings);
      setProviderStates(providerInfo.providers);
      setNotice({
        kind: "success",
        text: `Removed saved ${PROVIDER_LABELS[provider]} key from your OS credential store.`,
      });
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
    }
  }

  function handleAiError(error: unknown) {
    if (isAiCancelledError(error)) {
      setNotice({
        kind: "success",
        text: "AI request cancelled. Your resume has not been changed.",
      });
      return;
    }
    report(error);
  }

  const cancelActiveRequest = useCallback(async () => {
    requestSeq.current += 1;
    setBusy(null);
    await cancelAiRequest();
    setNotice({
      kind: "success",
      text: "AI request cancelled. Your resume has not been changed.",
    });
  }, [setNotice]);

  async function login() {
    requestSeq.current += 1;
    const seq = requestSeq.current;
    setBusy("login");
    try {
      await loginToCopilot();
      if (requestSeq.current !== seq) return;
      setNotice({
        kind: "success",
        text: "GitHub sign-in completed. You can now request a resume rewrite.",
      });
      setCopilot(await copilotStatus());
    } catch (error) {
      if (requestSeq.current === seq) handleAiError(error);
    } finally {
      if (requestSeq.current === seq) setBusy(null);
    }
  }

  async function generate() {
    if (!resume) return;
    if (!hasDraftFacts(resume)) {
      report(
        new Error(
          "Add some experience, projects, skills, or a draft summary first so Copilot has real facts to work with.",
        ),
      );
      return;
    }
    requestSeq.current += 1;
    const seq = requestSeq.current;
    const source = resumeSnapshot;
    setBusy("generate");
    setSuggestion(null);
    try {
      const raw = await generateResume(resume, consent);
      if (requestSeq.current !== seq) return;
      const value = validateProposal(raw, resume);
      setSuggestion({
        value,
        source,
        selection: defaultProposalSelection(resume, value),
      });
      setNotice({
        kind: "success",
        text: "Your suggestions are ready to review. Your resume has not been changed.",
      });
    } catch (error) {
      if (requestSeq.current === seq) handleAiError(error);
    } finally {
      if (requestSeq.current === seq) {
        setBusy(null);
        setConsent(false);
      }
    }
  }

  async function generateSummary() {
    if (!resume) return;
    if (!hasDraftFacts(resume)) {
      report(
        new Error(
          "Add some experience, projects, skills, or a draft summary first so your AI provider has real facts to work with.",
        ),
      );
      return;
    }
    requestSeq.current += 1;
    const seq = requestSeq.current;
    const source = resumeSnapshot;
    setBusy("summaryOptions");
    setSummarySuggestion(null);
    try {
      const value = await generateSummaryOptions(resume, consent);
      if (requestSeq.current !== seq) return;
      setSummarySuggestion({ value, source });
      setNotice({
        kind: "success",
        text: "Three summary angles are ready to review. Your resume has not been changed.",
      });
    } catch (error) {
      if (requestSeq.current === seq) handleAiError(error);
    } finally {
      if (requestSeq.current === seq) {
        setBusy(null);
        setConsent(false);
      }
    }
  }

  function applySummaryOption(nextSummary: string) {
    if (!resume || !summarySuggestion) return;
    if (resumeSnapshot !== summarySuggestion.source) {
      report(
        new Error(
          "Your resume changed. Generate fresh summary options before applying.",
        ),
      );
      return;
    }
    recordAiHistory(resume);
    applyResumeDirect({ ...resume, summary: nextSummary.trim() });
    setSummarySuggestion(null);
    setNotice({
      kind: "success",
      text: "Summary applied. You can undo this anytime from the toolbar.",
      canUndo: true,
    });
  }

  async function tailorRole(entryId: string) {
    if (!resume) return;
    requestSeq.current += 1;
    const seq = requestSeq.current;
    const source = resumeSnapshot;
    setBusy("tailorRole");
    setRoleSuggestion(null);
    try {
      const value = await tailorExperienceRole(resume, entryId, consent);
      if (requestSeq.current !== seq) return;
      setRoleSuggestion({
        value,
        source,
        selection: value.bullets.map(() => true),
      });
      setNotice({
        kind: "success",
        text: "Role suggestions are ready to review. Your resume has not been changed.",
      });
    } catch (error) {
      if (requestSeq.current === seq) handleAiError(error);
    } finally {
      if (requestSeq.current === seq) {
        setBusy(null);
        setConsent(false);
      }
    }
  }

  function applyRoleProposal() {
    if (!resume || !roleSuggestion) return;
    if (resumeSnapshot !== roleSuggestion.source) {
      report(
        new Error(
          "Your resume changed. Regenerate role suggestions before applying.",
        ),
      );
      return;
    }
    try {
      const updated = applyRoleTailorProposal(
        resume,
        roleSuggestion.value,
        roleSuggestion.selection,
      );
      recordAiHistory(resume);
      applyResumeDirect(updated);
      setRoleSuggestion(null);
      setNotice({
        kind: "success",
        text: "Role suggestions applied. You can undo this anytime from the toolbar.",
        canUndo: true,
      });
    } catch (error) {
      report(error);
    }
  }

  function applySuggestions() {
    if (!resume || !suggestion) return;
    if (resumeSnapshot !== suggestion.source) {
      report(
        new Error(
          "Your resume changed. Generate new suggestions before applying.",
        ),
      );
      return;
    }

    try {
      const updated = applyPartialProposal(
        resume,
        suggestion.value,
        suggestion.selection,
      );
      recordAiHistory(resume);
      applyResumeDirect(updated);
      setSuggestion(null);
      setNotice({
        kind: "success",
        text: "Suggestions applied. You can undo this anytime from the toolbar.",
        canUndo: true,
      });
    } catch (error) {
      report(error);
    }
  }

  function selectAccomplishment(target: AprTarget) {
    setAprTarget(target);
    setAprConsent(false);
    setAprSuggestion(null);
    setAprAnswers([]);
    setAprRefinementConsent(false);
    setAprRefinement(null);
  }

  function aprSourceIsCurrent(source: AprTarget): boolean {
    if (!resume) return false;
    try {
      validateAprTarget(source, resume);
      return true;
    } catch {
      return false;
    }
  }

  function currentAprAnswers(): AprQuestionAnswer[] {
    if (!aprSuggestion) return [];
    return normalizeAprAnswers(aprSuggestion.value.questions, aprAnswers);
  }

  function changeAprAnswer(index: number, value: string) {
    setAprAnswers((current) =>
      current.map((answer, answerIndex) =>
        answerIndex === index ? value : answer,
      ),
    );
    setAprRefinementConsent(false);
  }

  function aprRefinementIsCurrent(
    refinement: AprRefinementSuggestion,
  ): boolean {
    return (
      aprSourceIsCurrent(refinement.source) &&
      JSON.stringify(currentAprAnswers()) === JSON.stringify(refinement.answers)
    );
  }

  async function analyzeApr() {
    if (!resume || !aprTarget) return;
    if (!aprSourceIsCurrent(aprTarget)) {
      setAprConsent(false);
      report(
        new Error(
          "This accomplishment changed. Select it again before sending it to Copilot.",
        ),
      );
      return;
    }
    requestSeq.current += 1;
    const seq = requestSeq.current;
    setBusy("analyze");
    setAprSuggestion(null);
    try {
      const value = await analyzeAccomplishment(aprTarget, aprConsent);
      if (requestSeq.current !== seq) return;
      setAprSuggestion({ value, source: aprTarget });
      setAprAnswers(value.questions.map(() => ""));
      setAprRefinementConsent(false);
      setAprRefinement(null);
      setNotice({
        kind: "success",
        text: "Your APR analysis is ready to review. Your resume has not been changed.",
      });
    } catch (error) {
      if (requestSeq.current === seq) handleAiError(error);
    } finally {
      if (requestSeq.current === seq) {
        setBusy(null);
        setAprConsent(false);
      }
    }
  }

  async function refineApr() {
    if (!aprSuggestion) return;
    if (!aprSourceIsCurrent(aprSuggestion.source)) {
      setAprRefinementConsent(false);
      report(
        new Error(
          "This accomplishment changed. Analyze it again before refining.",
        ),
      );
      return;
    }
    const answers = currentAprAnswers();
    if (!answers.length) {
      setAprRefinementConsent(false);
      report(new Error("Answer at least one APR question before refining."));
      return;
    }
    requestSeq.current += 1;
    const seq = requestSeq.current;
    setBusy("refine");
    try {
      const value = await refineAccomplishment(
        aprSuggestion.source,
        aprSuggestion.value.questions,
        answers,
        aprRefinementConsent,
      );
      if (requestSeq.current !== seq) return;
      setAprRefinement({
        value,
        source: aprSuggestion.source,
        answers,
      });
      setNotice({
        kind: "success",
        text: "Your refined rewrite is ready to review. Your resume has not been changed.",
      });
    } catch (error) {
      if (requestSeq.current === seq) handleAiError(error);
    } finally {
      if (requestSeq.current === seq) {
        setBusy(null);
        setAprRefinementConsent(false);
      }
    }
  }

  function applyAprSuggestion() {
    if (!resume || !aprSuggestion) return;
    if (!aprSourceIsCurrent(aprSuggestion.source)) {
      report(
        new Error(
          "This accomplishment changed. Analyze it again before applying.",
        ),
      );
      return;
    }
    const rewrite = aprSuggestion.value.rewrite;
    try {
      const updated = applyAprRewrite(
        resume,
        aprSuggestion.source,
        rewrite ?? "",
      );
      recordAiHistory(resume);
      applyResumeDirect(updated);
      resetApr();
      setNotice({
        kind: "success",
        text: "APR rewrite applied to one accomplishment. You can undo this anytime.",
        canUndo: true,
      });
    } catch (error) {
      report(error);
    }
  }

  function applyAprRefinement() {
    if (!resume || !aprRefinement) return;
    if (!aprRefinementIsCurrent(aprRefinement)) {
      report(
        new Error(
          "This accomplishment or its answers changed. Refine it again before applying.",
        ),
      );
      return;
    }
    try {
      const updated = applyAprRewrite(
        resume,
        aprRefinement.source,
        aprRefinement.value.rewrite,
      );
      recordAiHistory(resume);
      applyResumeDirect(updated);
      resetApr();
      setNotice({
        kind: "success",
        text: "Refined APR rewrite applied to one accomplishment. You can undo this anytime.",
        canUndo: true,
      });
    } catch (error) {
      report(error);
    }
  }

  return {
    aiSettings,
    providerStates,
    copilot,
    busy,
    setBusy,
    consent,
    setConsent,
    suggestion,
    setSuggestion,
    summarySuggestion,
    setSummarySuggestion,
    roleSuggestion,
    setRoleSuggestion,
    aprTarget,
    aprConsent,
    setAprConsent,
    aprSuggestion,
    aprAnswers,
    aprRefinementConsent,
    setAprRefinementConsent,
    aprRefinement,
    resetApr,
    resetAiTransientForResumeSwitch,
    cancelActiveRequest,
    refreshCopilot,
    handleSaveAiSettings,
    handleSaveApiKey,
    handleClearApiKey,
    login,
    generate,
    generateSummary,
    applySummaryOption,
    tailorRole,
    applyRoleProposal,
    applySuggestions,
    selectAccomplishment,
    aprSourceIsCurrent,
    changeAprAnswer,
    aprRefinementIsCurrent,
    analyzeApr,
    refineApr,
    applyAprSuggestion,
    applyAprRefinement,
  };
}
