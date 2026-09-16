import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { errorMessage, initialWorkspace, type Workspace } from "./model";
import { desktop, loadWorkspace, saveWorkspace } from "./platform";

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const latest = useRef<Workspace | null>(null);
  const persisted = useRef<string | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const saved = await loadWorkspace();
      const next = saved ?? initialWorkspace();
      persisted.current = saved ? JSON.stringify(saved) : null;
      setSavedSnapshot(persisted.current);
      latest.current = next;
      setWorkspace(next);
      setLoaded(true);
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flush = useCallback(async () => {
    // Serialize snapshots so an older, slower disk write cannot replace newer edits.
    const operation = queue.current.then(async () => {
      const next = latest.current;
      if (!next || JSON.stringify(next) === persisted.current) return;
      setSaving(true);
      try {
        await saveWorkspace(next);
        persisted.current = JSON.stringify(next);
        setSavedSnapshot(persisted.current);
        setSaveError(null);
      } catch (error) {
        setSaveError(errorMessage(error));
        throw error;
      } finally {
        setSaving(false);
      }
    });
    queue.current = operation.catch(() => {
      /* The error is surfaced in saveError; keep future retries usable. */
    });
    return operation;
  }, []);

  const update = useCallback(
    (next: Workspace | ((current: Workspace) => Workspace)) => {
      const current = latest.current;
      if (!current) return;
      const result = typeof next === "function" ? next(current) : next;
      latest.current = result;
      setWorkspace(result);
    },
    [],
  );

  useEffect(() => {
    if (!loaded || !workspace) return;
    const timer = window.setTimeout(() => {
      void flush().catch(() => {
        /* The save error is rendered with retry and backup actions. */
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [workspace, loaded, flush]);

  useEffect(() => {
    const preventUnsavedClose = (event: BeforeUnloadEvent) => {
      if (
        latest.current &&
        JSON.stringify(latest.current) !== persisted.current
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", preventUnsavedClose);
    let disposed = false;
    let unlisten: (() => void) | undefined;
    if (desktop) {
      void getCurrentWindow()
        .onCloseRequested(async (event) => {
          event.preventDefault();
          try {
            while (
              latest.current &&
              JSON.stringify(latest.current) !== persisted.current
            ) {
              await flush();
            }
            await getCurrentWindow().destroy();
          } catch (error) {
            setSaveError(
              `Could not close safely: ${errorMessage(error)}. Retry saving or export a backup.`,
            );
          }
        })
        .then((cleanup) => {
          if (disposed) cleanup();
          else unlisten = cleanup;
        })
        .catch((error: unknown) =>
          setSaveError(
            `Close protection is unavailable: ${errorMessage(error)}`,
          ),
        );
    }
    return () => {
      disposed = true;
      unlisten?.();
      window.removeEventListener("beforeunload", preventUnsavedClose);
    };
  }, [flush]);

  const dirty =
    workspace !== null && JSON.stringify(workspace) !== savedSnapshot;
  return {
    workspace,
    update,
    loadError,
    saveError,
    saving,
    dirty,
    flush,
    reload: load,
  };
}
