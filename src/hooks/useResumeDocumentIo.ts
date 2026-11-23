import { useRef, useState } from "react";
import {
  documentFilename,
  MAX_WORKSPACE_BYTES,
  mergeAiImportedStructure,
  parseWorkspace,
  type Resume,
  type Workspace,
} from "../model";
import {
  cancelAiRequest,
  desktop,
  exportDocument,
  isAiCancelledError,
  structureImportedResume,
} from "../platform";
import type { ImportedResumeDraft } from "../resumeImport";
import type { AiBusyKind } from "../components/CopilotPanel";
import type { StudioNotice } from "./useStudioAiWorkflows";

export function useResumeDocumentIo({
  workspace,
  resume,
  update,
  addResume,
  resetAiForImport,
  clearHistory,
  setViewStudio,
  setAiBusy,
  setNotice,
  report,
}: {
  workspace: Workspace | null;
  resume: Resume | undefined;
  update: (next: Workspace | ((current: Workspace) => Workspace)) => void;
  addResume: (next?: Resume) => void;
  resetAiForImport: () => void;
  clearHistory: () => void;
  setViewStudio: () => void;
  setAiBusy: (busy: AiBusyKind) => void;
  setNotice: (notice: StudioNotice | null) => void;
  report: (error: unknown) => void;
}) {
  const importCleanupSeq = useRef(0);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [importingFile, setImportingFile] = useState(false);
  const [importDraft, setImportDraft] = useState<ImportedResumeDraft | null>(
    null,
  );

  async function exportPdf() {
    if (!resume) return;
    if (!resume.basics.name.trim()) {
      report(new Error("Add your name before exporting your resume."));
      return;
    }
    setExporting("pdf");
    try {
      const { createPdf } = await import("../ResumeDocument");
      const blob = await createPdf(resume);
      const saved = await exportDocument(
        blob,
        documentFilename(resume.title, "pdf"),
        "pdf",
      );
      if (saved)
        setNotice({
          kind: "success",
          text: desktop
            ? "Your PDF has been saved."
            : "Your PDF download has started.",
        });
    } catch (error) {
      report(error);
    } finally {
      setExporting(null);
    }
  }

  async function exportDocx() {
    if (!resume) return;
    if (!resume.basics.name.trim()) {
      report(new Error("Add your name before exporting your resume."));
      return;
    }
    setExporting("docx");
    try {
      const { createDocx } = await import("../docxExport");
      const blob = await createDocx(resume);
      const saved = await exportDocument(
        blob,
        documentFilename(resume.title, "docx"),
        "docx",
      );
      if (saved)
        setNotice({
          kind: "success",
          text: desktop
            ? "Your Word (.docx) document has been saved."
            : "Your Word (.docx) download has started.",
        });
    } catch (error) {
      report(error);
    } finally {
      setExporting(null);
    }
  }

  async function exportBackup() {
    if (!workspace) return;
    try {
      const blob = new Blob([JSON.stringify(workspace, null, 2)], {
        type: "application/json",
      });
      const saved = await exportDocument(blob, "hireloom-backup.json", "json");
      if (saved)
        setNotice({
          kind: "success",
          text: "Workspace backup exported. It contains personal data; store it somewhere safe.",
        });
    } catch (error) {
      report(error);
    }
  }

  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !workspace) return;
    try {
      if (file.size > MAX_WORKSPACE_BYTES)
        throw new Error("Choose a Hireloom JSON backup under 2 MB.");
      const imported = parseWorkspace(await file.text());
      const copies = imported.resumes.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
      }));
      update((current) => {
        if (current.resumes.length + copies.length > 50)
          throw new Error(
            "This import would exceed the 50-resume limit. Your existing resumes are unchanged.",
          );
        return {
          ...current,
          resumes: [...current.resumes, ...copies],
          activeResumeId: copies[0].id,
        };
      });
      resetAiForImport();
      clearHistory();
      setViewStudio();
      setNotice({
        kind: "success",
        text: `Imported ${copies.length} resume${copies.length === 1 ? "" : "s"} without replacing your existing work.`,
      });
    } catch (error) {
      report(error);
    }
  }

  async function importResumeDocument(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !workspace) return;
    if (workspace.resumes.length >= 50) {
      report(
        new Error(
          "You already have 50 resumes. Export a backup and remove one before importing.",
        ),
      );
      return;
    }
    setImportingFile(true);
    try {
      const { importResumeFile } = await import("../resumeImport");
      const draft = await importResumeFile(file);
      setImportDraft(draft);
    } catch (error) {
      report(error);
    } finally {
      setImportingFile(false);
    }
  }

  async function cancelImportCleanup() {
    importCleanupSeq.current += 1;
    setAiBusy(null);
    await cancelAiRequest();
    setNotice({
      kind: "success",
      text: "AI import cleanup cancelled. Your locally parsed draft is unchanged.",
    });
  }

  async function cleanUpImportWithAi(importConsent: boolean) {
    if (!importDraft) return;
    importCleanupSeq.current += 1;
    const seq = importCleanupSeq.current;
    setAiBusy("importCleanup");
    try {
      const { redactImportLinesForAi } = await import("../resumeImport");
      const redacted = redactImportLinesForAi(importDraft.rawLines);
      const structured = await structureImportedResume(redacted, importConsent);
      if (importCleanupSeq.current !== seq) return;
      const merged = mergeAiImportedStructure(importDraft.resume, structured);
      setImportDraft({
        ...importDraft,
        resume: merged,
        warnings: [
          ...importDraft.warnings,
          "AI structure cleanup applied — review sections before adding.",
        ],
        stats: {
          experiences: merged.experience.length,
          projects: merged.projects.length,
          education: merged.education.length,
          certifications: merged.certifications.length,
          skills:
            merged.skills.length +
            merged.skillGroups.reduce(
              (acc, group) => acc + group.items.length,
              0,
            ),
        },
      });
    } catch (error) {
      if (importCleanupSeq.current !== seq) return;
      if (isAiCancelledError(error)) {
        setNotice({
          kind: "success",
          text: "AI import cleanup cancelled. Your locally parsed draft is unchanged.",
        });
      } else {
        report(error);
      }
    } finally {
      if (importCleanupSeq.current === seq) setAiBusy(null);
    }
  }

  function confirmImportedResume(editedTitle: string) {
    if (!importDraft) return;
    const next: Resume = {
      ...importDraft.resume,
      id: crypto.randomUUID(),
      title: editedTitle.trim().slice(0, 120) || importDraft.resume.title,
      updatedAt: new Date().toISOString(),
    };
    setImportDraft(null);
    addResume(next);
    setNotice({
      kind: "success",
      text: `Imported “${next.title}” from ${importDraft.sourceFormat.toUpperCase()}. Review your details before exporting.`,
    });
  }

  return {
    exporting,
    importingFile,
    importDraft,
    setImportDraft,
    exportPdf,
    exportDocx,
    exportBackup,
    importBackup,
    importResumeDocument,
    cleanUpImportWithAi,
    cancelImportCleanup,
    confirmImportedResume,
  };
}
