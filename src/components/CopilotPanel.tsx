import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Cpu,
  Github,
  LoaderCircle,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import {
  defaultAiSettings,
  jobKeywords,
  PROVIDER_LABELS,
  type AiProposal,
  type AiSettings,
  type AprAnalysis,
  type AprRefinement,
  type AprTarget,
  type ProposalSelection,
  type ProviderKind,
  type Resume,
  type RoleTailorProposal,
  type SummaryOptionsProposal,
} from "../model";
import {
  desktop,
  type CopilotStatus,
  type ProviderCredentialStatus,
} from "../platform";
import { AprCoachingSection } from "./copilot/AprCoachingSection";
import { KeywordTriageCard } from "./copilot/KeywordTriageCard";
import type { AiBusyKind } from "./copilot/ProposalPrimitives";
import { ProviderConnectionCard } from "./copilot/ProviderConnectionCard";
import { RewriteProposalsSection } from "./copilot/RewriteProposalsSection";
import { Field } from "./Editor";

export type { AiBusyKind };
export type CoachSubView = "tailor" | "apr" | "provider";

export function CopilotPanel({
  resume,
  onChange,
  status,
  aiSettings = defaultAiSettings(),
  providerStates = [],
  onSaveAiSettings,
  onSaveApiKey,
  onClearApiKey,
  busy,
  consent,
  onConsent,
  onRefresh,
  onLogin,
  onGenerate,
  onGenerateSummaryOptions,
  summaryOptions,
  summaryOptionsStale,
  onApplySummaryOption,
  onDiscardSummaryOptions,
  onTailorRole,
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
  aprTarget,
  onSelectApr,
  aprConsent,
  onAprConsent,
  onAnalyzeApr,
  aprAnalysis,
  aprStale,
  onApplyApr,
  onDiscardApr,
  aprAnswers,
  onAprAnswer,
  aprRefinementConsent,
  onAprRefinementConsent,
  onRefineApr,
  aprRefinement,
  aprRefinementStale,
  onApplyAprRefinement,
}: {
  resume: Resume;
  onChange: (resume: Resume) => void;
  status: CopilotStatus | null;
  aiSettings?: AiSettings;
  providerStates?: ProviderCredentialStatus[];
  onSaveAiSettings?: (next: AiSettings) => void;
  onSaveApiKey?: (provider: ProviderKind, apiKey: string) => void;
  onClearApiKey?: (provider: ProviderKind) => void;
  busy: AiBusyKind;
  consent: boolean;
  onConsent: (value: boolean) => void;
  onRefresh: () => void;
  onLogin: () => void;
  onGenerate: () => void;
  onGenerateSummaryOptions?: () => void;
  summaryOptions?: SummaryOptionsProposal | null;
  summaryOptionsStale?: boolean;
  onApplySummaryOption?: (summary: string) => void;
  onDiscardSummaryOptions?: () => void;
  onTailorRole?: (entryId: string) => void;
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
  aprTarget: AprTarget | null;
  onSelectApr: (target: AprTarget) => void;
  aprConsent: boolean;
  onAprConsent: (value: boolean) => void;
  onAnalyzeApr: () => void;
  aprAnalysis: AprAnalysis | null;
  aprStale: boolean;
  onApplyApr: () => void;
  onDiscardApr: () => void;
  aprAnswers: string[];
  onAprAnswer: (index: number, value: string) => void;
  aprRefinementConsent: boolean;
  onAprRefinementConsent: (value: boolean) => void;
  onRefineApr: () => void;
  aprRefinement: AprRefinement | null;
  aprRefinementStale: boolean;
  onApplyAprRefinement: () => void;
}) {
  const [subView, setSubView] = useState<CoachSubView>(() =>
    aprTarget || aprAnalysis ? "apr" : "tailor",
  );
  const [selectedRoleEntryId, setSelectedRoleEntryId] = useState<string>(
    () => resume.experience[0]?.id ?? resume.projects[0]?.id ?? "",
  );
  const [aprFocusKeyword, setAprFocusKeyword] = useState<string>("");
  const aprSectionRef = useRef<HTMLElement>(null);
  const lastAprTargetRef = useRef<AprTarget | null>(aprTarget);

  useEffect(() => {
    if (aprTarget && aprTarget !== lastAprTargetRef.current) {
      setSubView("apr");
    }
    lastAprTargetRef.current = aprTarget;
  }, [aprTarget]);

  const allKeywords = jobKeywords(resume);
  const activeKeywords = allKeywords.filter((item) => !item.skipped);
  const matchedKeywords = activeKeywords.filter((item) => item.matched);
  const missingKeywords = activeKeywords.filter((item) => !item.matched);
  const skippedKeywords = allKeywords.filter((item) => item.skipped);

  const activeProvider = aiSettings.primaryProvider;
  const activeProviderLabel = PROVIDER_LABELS[activeProvider];
  const activeProviderInfo = providerStates.find(
    (item) => item.provider === activeProvider,
  );
  const providerReady =
    activeProvider === "copilot"
      ? Boolean(status?.available)
      : activeProviderInfo
        ? activeProviderInfo.configured
        : activeProvider === "ollama";

  const providerSummaryText =
    activeProvider === "copilot"
      ? (status?.detail ?? "Checking the local Copilot CLI…")
      : !desktop
        ? "AI providers are available in the desktop app."
        : activeProvider === "ollama"
          ? `Local Ollama (${aiSettings.ollamaBaseUrl})`
          : activeProviderInfo?.hasStoredKey || activeProviderInfo?.hasEnvKey
            ? "API key configured"
            : "API key required — open Provider Setup";

  const roleEntries = [
    ...resume.experience.map((e) => ({
      id: e.id,
      label: `${e.role || "Untitled role"}${e.company ? ` · ${e.company}` : ""}`,
      bullets: e.bullets,
    })),
    ...resume.projects.map((p) => ({
      id: p.id,
      label: `Project: ${p.name || "Untitled project"}`,
      bullets: p.bullets,
    })),
  ];
  const effectiveRoleId = roleEntries.some((r) => r.id === selectedRoleEntryId)
    ? selectedRoleEntryId
    : (roleEntries[0]?.id ?? "");

  const hasTailorDraft = Boolean(proposal || summaryOptions || roleProposal);
  const hasAprDraft = Boolean(aprTarget || aprAnalysis || aprRefinement);

  const handleFocusKeywordInApr = (term: string) => {
    setAprFocusKeyword(term);
    if (aprTarget) {
      onSelectApr({ ...aprTarget, focusKeyword: term });
    }
    setSubView("apr");
    window.setTimeout(() => {
      aprSectionRef.current?.scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  return (
    <div className="assistant-content">
      <div className="assistant-intro">
        <span className="assistant-orb">
          <Sparkles size={24} />
        </span>
        <span className="eyebrow">
          YOUR EXPERIENCE. A LITTLE EXTRA CLARITY.
        </span>
        <h2>Tailor &amp; coach.</h2>
        <p>
          Align your resume to a target role, coach individual accomplishments
          with APR, or configure your local or cloud AI provider.
        </p>
      </div>

      <div
        className="coach-subview-tabs"
        role="group"
        aria-label="Tailor and coach sections"
      >
        <button
          type="button"
          className={subView === "tailor" ? "active" : ""}
          aria-pressed={subView === "tailor"}
          onClick={() => setSubView("tailor")}
        >
          <Sparkles size={13} />
          Role Tailoring
          {hasTailorDraft && (
            <span className="subview-dot" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className={subView === "apr" ? "active" : ""}
          aria-pressed={subView === "apr"}
          onClick={() => setSubView("apr")}
        >
          <Target size={13} />
          APR Bullet Coach
          {hasAprDraft && <span className="subview-dot" aria-hidden="true" />}
        </button>
        <button
          type="button"
          className={subView === "provider" ? "active" : ""}
          aria-pressed={subView === "provider"}
          onClick={() => setSubView("provider")}
        >
          <Settings2 size={13} />
          Provider Setup
        </button>
      </div>

      {subView !== "provider" && (
        <div className="provider-summary-strip">
          <div className="provider-summary-main">
            <span
              className={`status-dot ${providerReady ? "available" : ""}`}
              role="img"
              aria-label={
                providerReady ? "Provider ready" : "Provider not configured"
              }
            />
            {activeProvider === "copilot" ? (
              <Github size={15} />
            ) : activeProvider === "ollama" ? (
              <Cpu size={15} />
            ) : (
              <Bot size={15} />
            )}
            <strong>{activeProviderLabel}</strong>
            <code className="model-pill">{aiSettings.primaryModel}</code>
            <button
              type="button"
              className="text-button provider-jump-btn"
              onClick={() => setSubView("provider")}
            >
              Configure
            </button>
          </div>
          <p className="provider-summary-detail">{providerSummaryText}</p>
        </div>
      )}

      {subView === "provider" && (
        <>
          <ProviderConnectionCard
            status={status}
            aiSettings={aiSettings}
            providerStates={providerStates}
            providerReady={providerReady}
            busy={busy}
            defaultExpanded
            onRefresh={onRefresh}
            onLogin={onLogin}
            onSaveAiSettings={onSaveAiSettings}
            onSaveApiKey={onSaveApiKey}
            onClearApiKey={onClearApiKey}
          />
          <div className="setup-note">
            <strong>Provider options</strong>
            <p>
              Use GitHub Copilot CLI (
              <code>npm install -g @github/copilot</code>), save an OpenAI,
              Anthropic, or Gemini API key in your OS credential store, or run
              local models offline via Ollama at <code>127.0.0.1:11434</code>.
            </p>
          </div>
        </>
      )}

      {subView === "tailor" && (
        <>
          <Field
            label="Job description"
            value={resume.jobDescription}
            onChange={(jobDescription) =>
              onChange({ ...resume, jobDescription })
            }
            multiline
            rows={8}
            maxLength={20_000}
            placeholder="Paste the job description here to tailor your summary and experience highlights to the role…"
            hint="Optional. Leave this blank for a general resume polish."
          />
          {resume.jobDescription.trim() && (
            <KeywordTriageCard
              resume={resume}
              activeKeywords={activeKeywords}
              matchedKeywords={matchedKeywords}
              missingKeywords={missingKeywords}
              skippedKeywords={skippedKeywords}
              onChange={onChange}
              onFocusKeywordInApr={handleFocusKeywordInApr}
            />
          )}
          <div className="privacy-note">
            <ShieldCheck size={19} />
            <p>
              Your contact fields and personal URLs stay out of the prompt.
              Summary, work history, projects, education, skills, headline, and
              job description are sent to {activeProviderLabel} only when you
              ask.
            </p>
          </div>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => onConsent(event.target.checked)}
              disabled={
                busy === "generate" ||
                busy === "summaryOptions" ||
                busy === "tailorRole"
              }
            />
            <span>
              Send this content to {activeProviderLabel} for this request. I
              understand this uses my configured provider account and is subject
              to its data policies.
            </span>
          </label>
          <button
            type="button"
            className="button primary generate-button"
            disabled={!providerReady || !consent || Boolean(busy)}
            onClick={onGenerate}
          >
            {busy === "generate" ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Sparkles size={17} />
            )}
            {busy === "generate"
              ? "Finding your best words…"
              : resume.jobDescription.trim()
                ? "Tailor to this role"
                : "Polish my resume"}
          </button>

          {(onGenerateSummaryOptions ||
            (onTailorRole && roleEntries.length > 0)) && (
            <div className="focused-ai-actions">
              {onGenerateSummaryOptions && (
                <button
                  type="button"
                  className="button secondary small"
                  disabled={!providerReady || !consent || Boolean(busy)}
                  onClick={onGenerateSummaryOptions}
                >
                  {busy === "summaryOptions" ? (
                    <LoaderCircle className="spin" size={14} />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {busy === "summaryOptions"
                    ? "Drafting summaries…"
                    : "Suggest 3 summary angles"}
                </button>
              )}
              {onTailorRole && roleEntries.length > 0 && (
                <div className="role-tailor-bar">
                  <label
                    className="visually-hidden"
                    htmlFor="role-tailor-select"
                  >
                    Role or project to tailor
                  </label>
                  <select
                    id="role-tailor-select"
                    value={effectiveRoleId}
                    disabled={Boolean(busy)}
                    onChange={(e) => setSelectedRoleEntryId(e.target.value)}
                  >
                    {roleEntries.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="button secondary small"
                    disabled={
                      !providerReady ||
                      !consent ||
                      !effectiveRoleId ||
                      Boolean(busy)
                    }
                    onClick={() => onTailorRole(effectiveRoleId)}
                  >
                    {busy === "tailorRole" ? (
                      <LoaderCircle className="spin" size={14} />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    {busy === "tailorRole" ? "Tailoring role…" : "Tailor role"}
                  </button>
                </div>
              )}
            </div>
          )}

          <p className="fine-print center">
            {busy === "generate" ||
            busy === "summaryOptions" ||
            busy === "tailorRole"
              ? "This can take up to 3 minutes. No changes are applied automatically."
              : "No invented experience. No automatic edits. You're in control."}
          </p>

          <RewriteProposalsSection
            resume={resume}
            busy={busy}
            roleEntries={roleEntries}
            summaryOptions={summaryOptions}
            summaryOptionsStale={summaryOptionsStale}
            onApplySummaryOption={onApplySummaryOption}
            onDiscardSummaryOptions={onDiscardSummaryOptions}
            roleProposal={roleProposal}
            roleSelection={roleSelection}
            onChangeRoleSelection={onChangeRoleSelection}
            roleStale={roleStale}
            onApplyRoleProposal={onApplyRoleProposal}
            onDiscardRoleProposal={onDiscardRoleProposal}
            proposal={proposal}
            proposalSelection={proposalSelection}
            onChangeProposalSelection={onChangeProposalSelection}
            stale={stale}
            onApply={onApply}
            onDiscard={onDiscard}
          />
        </>
      )}

      {subView === "apr" && (
        <AprCoachingSection
          sectionRef={aprSectionRef}
          resume={resume}
          activeProviderLabel={activeProviderLabel}
          providerReady={providerReady}
          busy={busy}
          missingKeywords={missingKeywords}
          aprFocusKeyword={aprFocusKeyword}
          onSetAprFocusKeyword={setAprFocusKeyword}
          aprTarget={aprTarget}
          onSelectApr={onSelectApr}
          aprConsent={aprConsent}
          onAprConsent={onAprConsent}
          onAnalyzeApr={onAnalyzeApr}
          aprAnalysis={aprAnalysis}
          aprStale={aprStale}
          onApplyApr={onApplyApr}
          onDiscardApr={onDiscardApr}
          aprAnswers={aprAnswers}
          onAprAnswer={onAprAnswer}
          aprRefinementConsent={aprRefinementConsent}
          onAprRefinementConsent={onAprRefinementConsent}
          onRefineApr={onRefineApr}
          aprRefinement={aprRefinement}
          aprRefinementStale={aprRefinementStale}
          onApplyAprRefinement={onApplyAprRefinement}
        />
      )}
    </div>
  );
}
