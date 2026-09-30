import { Eye, FileText, LayoutTemplate, Sparkles } from "lucide-react";

export type WorkspaceMode = "content" | "copilot" | "style" | "preview";

export function WorkspaceTabs({
  tab,
  blocked,
  onSelect,
}: {
  tab: WorkspaceMode;
  blocked: boolean;
  onSelect: (mode: WorkspaceMode, focusTab?: boolean) => void;
}) {
  return (
    <div
      className="workspace-tabs"
      role="tablist"
      aria-label="Resume workspace"
    >
      {(
        [
          { id: "content", label: "Content", Icon: FileText },
          { id: "copilot", label: "Copilot", Icon: Sparkles },
          { id: "style", label: "Design", Icon: LayoutTemplate },
          { id: "preview", label: "Preview", Icon: Eye },
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
          onClick={() => onSelect(id)}
          onKeyDown={(event) => {
            const tabs: WorkspaceMode[] = [
              "content",
              "copilot",
              "style",
              "preview",
            ];
            const currentIndex = tabs.indexOf(id);
            const nextIndex =
              event.key === "ArrowRight"
                ? (currentIndex + 1) % tabs.length
                : event.key === "ArrowLeft"
                  ? (currentIndex - 1 + tabs.length) % tabs.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? tabs.length - 1
                      : -1;
            if (nextIndex >= 0) {
              event.preventDefault();
              onSelect(tabs[nextIndex], true);
            }
          }}
        >
          <Icon size={15} />
          {label}
        </button>
      ))}
    </div>
  );
}
