// Preview pane: editor / split / preview toggle, remembered in localStorage.
//
// The pane owns its mode. (It used to read the mode from props, and every
// caller passed a fixed "editor" with a no-op change handler, so the Split and
// Preview buttons did nothing.) `mode` is only the initial value now, and
// `onModeChange` is an optional notification.

import * as React from "react";

export type CmsPreviewMode = "editor" | "split" | "preview";

const STORAGE_KEY = "onlyme:cmsPreviewMode";
const MODES: { value: CmsPreviewMode; label: string }[] = [
  { value: "editor", label: "Editor" },
  { value: "split", label: "Split" },
  { value: "preview", label: "Preview" },
];

export function PreviewPane({
  mode = "editor",
  onModeChange,
  renderEditor,
  renderPreview,
}: {
  mode?: CmsPreviewMode;
  onModeChange?: (mode: CmsPreviewMode) => void;
  renderEditor: () => React.ReactNode;
  renderPreview: () => React.ReactNode;
}) {
  const [current, setCurrent] = React.useState<CmsPreviewMode>(mode);

  // Restore the last choice after hydration (localStorage isn't on the server).
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "editor" || saved === "split" || saved === "preview") setCurrent(saved);
    } catch {
      // Storage unavailable — keep the default.
    }
  }, []);

  const choose = (m: CmsPreviewMode) => {
    setCurrent(m);
    onModeChange?.(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // Ignore storage errors.
    }
  };

  return (
    <div className="flex flex-col gap-2 border border-border p-4 bg-muted/30" data-testid="cms-preview">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">View:</span>
        <div role="group" aria-label="Editor view" className="inline-flex border border-border">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={current === m.value}
              onClick={() => choose(m.value)}
              className={`min-h-[40px] px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                current === m.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground hover:bg-accent"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {current === "split" && (
          <span className="text-xs text-muted-foreground">
            Side by side on wide screens; stacked on narrow ones.
          </span>
        )}
      </div>
      <div className="flex-1">
        {current === "split" ? (
          <div className="grid min-h-[400px] gap-4 xl:grid-cols-2">
            <div className="min-w-0 border border-border bg-background p-3">{renderEditor()}</div>
            <div className="min-w-0 border border-border bg-background p-3" aria-label="Live preview">
              {renderPreview()}
            </div>
          </div>
        ) : current === "preview" ? (
          <div className="min-h-[400px] border border-border bg-background p-3" aria-label="Live preview">
            {renderPreview()}
          </div>
        ) : (
          <div className="min-h-[400px] border border-border bg-background p-3">{renderEditor()}</div>
        )}
      </div>
    </div>
  );
}
