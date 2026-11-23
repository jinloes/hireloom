export const UI_PREFS_KEY = "hireloom.ui-prefs.v1";

export type StudioTheme = "light" | "dark";

export type PreviewZoom = 90 | 100 | 125;

export type UiPreferences = {
  theme: StudioTheme;
  editorWidthPct: number;
  previewZoom: PreviewZoom;
  sidebarCollapsed: boolean;
  aiPromoDismissed: boolean;
};

const VALID_ZOOMS = new Set<PreviewZoom>([90, 100, 125]);

function systemDefaultTheme(): StudioTheme {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function defaultUiPreferences(): UiPreferences {
  return {
    theme: systemDefaultTheme(),
    editorWidthPct: 40,
    previewZoom: 100,
    sidebarCollapsed: false,
    aiPromoDismissed: false,
  };
}

export function loadUiPreferences(): UiPreferences {
  const defaults = defaultUiPreferences();
  try {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(UI_PREFS_KEY)
        : null;
    if (!raw) return defaults;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaults;
    const record = parsed as Record<string, unknown>;
    const theme: StudioTheme =
      record.theme === "dark" || record.theme === "light"
        ? record.theme
        : defaults.theme;
    const editorWidthPct =
      typeof record.editorWidthPct === "number" &&
      Number.isFinite(record.editorWidthPct)
        ? Math.min(58, Math.max(28, Math.round(record.editorWidthPct)))
        : defaults.editorWidthPct;
    const previewZoom: PreviewZoom =
      typeof record.previewZoom === "number" &&
      VALID_ZOOMS.has(record.previewZoom as PreviewZoom)
        ? (record.previewZoom as PreviewZoom)
        : defaults.previewZoom;
    const sidebarCollapsed =
      typeof record.sidebarCollapsed === "boolean"
        ? record.sidebarCollapsed
        : defaults.sidebarCollapsed;
    const aiPromoDismissed =
      typeof record.aiPromoDismissed === "boolean"
        ? record.aiPromoDismissed
        : defaults.aiPromoDismissed;
    return {
      theme,
      editorWidthPct,
      previewZoom,
      sidebarCollapsed,
      aiPromoDismissed,
    };
  } catch {
    return defaults;
  }
}

export function saveUiPreferences(prefs: UiPreferences): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
    }
  } catch {
    // Ignore storage quota or restricted-context failures for non-critical UI state.
  }
}
