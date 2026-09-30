import { useState, type ChangeEvent } from "react";
import {
  documentFilename,
  MAX_WORKSPACE_BYTES,
  parseWorkspace,
  type Resume,
  type Workspace,
} from "./model";
import { desktop, exportDocument } from "./platform";
import type { Notice } from "./components/WorkspaceHeader";

/** Local PDF export plus workspace backup export and append-only import. */
export function useWorkspaceTransfer({
  workspace,
  resume,
  update,
  report,
  notify,
  onImported,
}: {
  workspace: Workspace | null;
  resume: Resume | undefined;
  update: (updater: (current: Workspace) => Workspace) => void;
  report: (error: unknown) => void;
  notify: (notice: Notice) => void;
  onImported: () => void;
}) {
  const [exporting, setExporting] = useState(false);

  async function exportPdf() {
    if (!resume) return;
    if (!resume.basics.name.trim()) {
      report(new Error("Add your name before exporting your resume."));
      return;
    }
    setExporting(true);
    try {
      const { createPdf } = await import("./ResumeDocument");
      const blob = await createPdf(resume);
      const saved = await exportDocument(
        blob,
        documentFilename(resume.title, "pdf"),
        "pdf",
      );
      if (saved)
        notify({
          kind: "success",
          text: desktop
            ? "Your PDF has been saved."
            : "Your PDF download has started.",
        });
    } catch (error) {
      report(error);
    } finally {
      setExporting(false);
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
        notify({
          kind: "success",
          text: "Workspace backup exported. It contains personal data; store it somewhere safe.",
        });
    } catch (error) {
      report(error);
    }
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
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
      onImported();
      notify({
        kind: "success",
        text: `Imported ${copies.length} resume${copies.length === 1 ? "" : "s"} without replacing your existing work.`,
      });
    } catch (error) {
      report(error);
    }
  }

  return { exporting, exportPdf, exportBackup, importBackup };
}
