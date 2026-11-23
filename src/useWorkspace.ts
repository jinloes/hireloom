import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  errorMessage,
  initialWorkspace,
  upgradeWorkspace,
  type Workspace,
} from "./model";
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
  const snapshotCache = useRef<{ ws: Workspace; json: string } | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const snapshotOf = useCallback((ws: Workspace | null): string | null => {
    if (!ws) return null;
    if (snapshotCache.current?.ws === ws) return snapshotCache.current.json;
    const json = JSON.stringify(ws);
    snapshotCache.current = { ws, json };
    return json;
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const rawSaved = await loadWorkspace();
      const saved = rawSaved ? upgradeWorkspace(rawSaved) : null;
      const next = saved ?? initialWorkspace();
      persisted.current = saved ? snapshotOf(saved) : null;
      setSavedSnapshot(persisted.current);
      latest.current = next;
      setWorkspace(next);
      setLoaded(true);
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, [snapshotOf]);

  useEffect(() => {
    void load();
  }, [load]);

  const flush = useCallback(async () => {
    // Serialize snapshots so an older, slower disk write cannot replace newer edits.
    const operation = queue.current.then(async () => {
      const next = latest.current;
      const nextSnapshot = snapshotOf(next);
      if (!next || nextSnapshot === persisted.current) return;
      setSaving(true);
      try {
        await saveWorkspace(next);
        persisted.current = nextSnapshot;
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
  }, [snapshotOf]);

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
      if (latest.current && snapshotOf(latest.current) !== persisted.current) {
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
              snapshotOf(latest.current) !== persisted.current
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
  }, [flush, snapshotOf]);

  const dirty = workspace !== null && snapshotOf(workspace) !== savedSnapshot;
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
