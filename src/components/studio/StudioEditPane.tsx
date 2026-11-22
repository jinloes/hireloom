import { FileText, LayoutTemplate, LockKeyhole, Sparkles } from "lucide-react";
import {
  exampleResume,
  pullExperienceFromLibrary,
  pullProjectFromLibrary,
  saveExperienceToLibrary,
  saveProjectToLibrary,
  type CareerLibrary,
  type Resume,
  type Workspace,
} from "../../model";
import type {
  StudioNotice,
  useStudioAiWorkflows,
} from "../../hooks/useStudioAiWorkflows";
import { CopilotPanel } from "../CopilotPanel";
import { Editor, type ChangeMeta, type EditorFocusRequest } from "../Editor";
import { StylePanel } from "../StylePanel";
import type { StudioTab } from "./StudioPreviewPane";

export function StudioEditPane({
  resume,
  careerLibrary,
  tab,
  blocked,
  focusRequest,
  ai,
  onSetTab,
  onChangeResume,
  onAddResume,
  onTriggerResumeImport,
  onUpdateWorkspace,
  onSetNotice,
  onReport,
  onShowLicense,
}: {
  resume: Resume;
  careerLibrary: CareerLibrary;
  tab: StudioTab;
  blocked: boolean;
  focusRequest: EditorFocusRequest | null;
  ai: ReturnType<typeof useStudioAiWorkflows>;
  onSetTab: (tab: StudioTab) => void;
  onChangeResume: (next: Resume, meta?: ChangeMeta) => void;
  onAddResume: (next?: Resume) => void;
  onTriggerResumeImport: () => void;
  onUpdateWorkspace: (
    next: Workspace | ((current: Workspace) => Workspace),
  ) => void;
  onSetNotice: (notice: StudioNotice | null) => void;
  onReport: (error: unknown) => void;
  onShowLicense: () => void;
}) {
  return (
    <div className="edit-pane">
      <div className="editor-tabs" role="tablist" aria-label="Resume tools">
        {(
          [
            { id: "content", label: "Content", Icon: FileText },
            { id: "copilot", label: "Copilot", Icon: Sparkles },
            { id: "style", label: "Design", Icon: LayoutTemplate },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            id={`tab-${id}`}
            role="tab"
            aria-controls={`panel-${id}`}
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            disabled={blocked}
            onClick={() => onSetTab(id)}
            onKeyDown={(event) => {
              const tabs: StudioTab[] = ["content", "copilot", "style"];
              const direction =
                event.key === "ArrowRight"
                  ? 1
                  : event.key === "ArrowLeft"
                    ? -1
                    : 0;
              if (direction) {
                event.preventDefault();
                const next =
                  tabs[
                    (tabs.indexOf(tab) + direction + tabs.length) % tabs.length
                  ];
                onSetTab(next);
                document.getElementById(`tab-${next}`)?.focus();
              }
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
      <div className="editor-scroll">
        {tab === "content" && (
          <div role="tabpanel" id="panel-content" aria-labelledby="tab-content">
            <Editor
              resume={resume}
              onChange={onChangeResume}
              onAi={() => onSetTab("copilot")}
              onExample={() => onAddResume(exampleResume())}
              onImportResume={onTriggerResumeImport}
              onCoachBullet={(target) => {
                ai.selectAccomplishment(target);
                onSetTab("copilot");
              }}
              careerLibrary={careerLibrary}
              focusRequest={focusRequest}
              onSaveExperienceToLibrary={(experienceId) => {
                try {
                  onUpdateWorkspace((current) =>
                    saveExperienceToLibrary(current, resume.id, experienceId),
                  );
                  onSetNotice({
                    kind: "success",
                    text: "Saved role to your Career Library.",
                  });
                } catch (error) {
                  onReport(error);
                }
              }}
              onPullExperienceFromLibrary={(experienceId) => {
                onChangeResume(
                  pullExperienceFromLibrary(
                    resume,
                    experienceId,
                    careerLibrary,
                  ),
                );
                onSetNotice({
                  kind: "success",
                  text: "Updated role from your Career Library.",
                });
              }}
              onSaveProjectToLibrary={(projectId) => {
                try {
                  onUpdateWorkspace((current) =>
                    saveProjectToLibrary(current, resume.id, projectId),
                  );
                  onSetNotice({
                    kind: "success",
                    text: "Saved project to your Career Library.",
                  });
                } catch (error) {
                  onReport(error);
                }
              }}
              onPullProjectFromLibrary={(projectId) => {
                onChangeResume(
                  pullProjectFromLibrary(resume, projectId, careerLibrary),
                );
                onSetNotice({
                  kind: "success",
                  text: "Updated project from your Career Library.",
                });
              }}
            />
          </div>
        )}
        {tab === "copilot" && (
          <div role="tabpanel" id="panel-copilot" aria-labelledby="tab-copilot">
            <fieldset
              className="assistant-fieldset"
              disabled={
                ai.busy === "generate" ||
                ai.busy === "summaryOptions" ||
                ai.busy === "tailorRole" ||
                ai.busy === "analyze" ||
                ai.busy === "refine"
              }
            >
              <CopilotPanel
                resume={resume}
                onChange={onChangeResume}
                status={ai.copilot}
                aiSettings={ai.aiSettings}
                providerStates={ai.providerStates}
                onSaveAiSettings={(next) => void ai.handleSaveAiSettings(next)}
                onSaveApiKey={(provider, apiKey) =>
                  void ai.handleSaveApiKey(provider, apiKey)
                }
                onClearApiKey={(provider) =>
                  void ai.handleClearApiKey(provider)
                }
                busy={ai.busy}
                consent={ai.consent}
                onConsent={ai.setConsent}
                onRefresh={() => void ai.refreshCopilot()}
                onLogin={() => void ai.login()}
                onGenerate={() => void ai.generate()}
                onGenerateSummaryOptions={() => void ai.generateSummary()}
                summaryOptions={ai.summarySuggestion?.value ?? null}
                summaryOptionsStale={
                  ai.summarySuggestion !== null &&
                  ai.summarySuggestion.source !== JSON.stringify(resume)
                }
                onApplySummaryOption={ai.applySummaryOption}
                onDiscardSummaryOptions={() => ai.setSummarySuggestion(null)}
                onTailorRole={(entryId) => void ai.tailorRole(entryId)}
                roleProposal={ai.roleSuggestion?.value ?? null}
                roleSelection={ai.roleSuggestion?.selection ?? null}
                onChangeRoleSelection={(selection) =>
                  ai.setRoleSuggestion((current) =>
                    current ? { ...current, selection } : null,
                  )
                }
                roleStale={
                  ai.roleSuggestion !== null &&
                  ai.roleSuggestion.source !== JSON.stringify(resume)
                }
                onApplyRoleProposal={ai.applyRoleProposal}
                onDiscardRoleProposal={() => ai.setRoleSuggestion(null)}
                proposal={ai.suggestion?.value ?? null}
                proposalSelection={ai.suggestion?.selection ?? null}
                onChangeProposalSelection={(selection) =>
                  ai.setSuggestion((current) =>
                    current ? { ...current, selection } : null,
                  )
                }
                stale={
                  ai.suggestion !== null &&
                  ai.suggestion.source !== JSON.stringify(resume)
                }
                onApply={ai.applySuggestions}
                onDiscard={() => ai.setSuggestion(null)}
                aprTarget={ai.aprTarget}
                onSelectApr={ai.selectAccomplishment}
                aprConsent={ai.aprConsent}
                onAprConsent={ai.setAprConsent}
                onAnalyzeApr={() => void ai.analyzeApr()}
                aprAnalysis={ai.aprSuggestion?.value ?? null}
                aprStale={
                  ai.aprSuggestion !== null &&
                  !ai.aprSourceIsCurrent(ai.aprSuggestion.source)
                }
                onApplyApr={ai.applyAprSuggestion}
                onDiscardApr={ai.resetApr}
                aprAnswers={ai.aprAnswers}
                onAprAnswer={ai.changeAprAnswer}
                aprRefinementConsent={ai.aprRefinementConsent}
                onAprRefinementConsent={ai.setAprRefinementConsent}
                onRefineApr={() => void ai.refineApr()}
                aprRefinement={ai.aprRefinement?.value ?? null}
                aprRefinementStale={
                  ai.aprRefinement !== null &&
                  !ai.aprRefinementIsCurrent(ai.aprRefinement)
                }
                onApplyAprRefinement={ai.applyAprRefinement}
              />
            </fieldset>
          </div>
        )}
        {tab === "style" && (
          <div role="tabpanel" id="panel-style" aria-labelledby="tab-style">
            <StylePanel resume={resume} onChange={onChangeResume} />
          </div>
        )}
      </div>
      <div className="editor-footer">
        <LockKeyhole size={12} /> No account needed to create, save, or export.{" "}
        <button
          type="button"
          className="text-button footer-license-btn"
          onClick={onShowLicense}
        >
          Font licenses
        </button>
      </div>
    </div>
  );
}
