// SSR-safe wrapper around the Ghost Koenig editor.
//
// Koenig touches DOM APIs during import, so it must only render in the
// browser. React.lazy keeps it in its own chunk; nothing loads until the
// admin editor is opened.
import { Suspense, lazy, useEffect, useState, type MutableRefObject } from "react";
import type { EditorHandle } from "./koenig/EditorBridge";
export type { EditorHandle } from "./koenig/EditorBridge";
import type { KoenigValue } from "./KoenigInner";
import type { PostImageLayout } from "@/content/site";

const KoenigInner = lazy(() => import("./KoenigInner"));

export type KoenigBodyEditorProps = {
  initialLexical?: Record<string, unknown> | null;
  initialHtml?: string;
  imageLayouts?: Record<string, PostImageLayout>;
  themeVars?: Record<string, string>;
  onChange: (value: KoenigValue) => void;
  onInitialValue?: (value: KoenigValue) => void;
  editorRef?: MutableRefObject<EditorHandle | null>;
  onReady?: () => void;
  siteTitle?: string;
  siteDescription?: string;
  siteUrl?: string;
  fontBody?: string;
  fontHeading?: string;
  fontBodyScale?: number;
  fontHeadingScale?: number;
  fontSize?: string;
  heightClassName?: string;
};

export function KoenigBodyEditor({
  heightClassName = "min-h-[60vh]",
  ...props
}: KoenigBodyEditorProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className={`flex ${heightClassName} items-center justify-center border border-border bg-muted/20`}
      >
        <span className="text-sm text-muted-foreground">Loading editor…</span>
      </div>
    );
  }

  return (
    <div className={`${heightClassName} border border-border bg-background`}>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center">
            <span className="text-sm text-muted-foreground">Loading editor…</span>
          </div>
        }
      >
        <KoenigInner {...props} />
      </Suspense>
    </div>
  );
}
