import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from "react";
import { DEFAULT_NODES, KoenigComposer, KoenigEditor } from "@tryghost/koenig-lexical";
import "@tryghost/koenig-lexical/style.css";
import "./koenig-editor.css";
import { KOENIG_FILE_TYPES } from "@/lib/media-upload";
import type { PostImageLayout } from "@/content/site";
import { installCardExtensions } from "./koenig/nodes";
import { withLegacyLayouts } from "./koenig/layout";
import {
  EditorBridge,
  type EditorController,
  type EditorHandle,
  type EditorValue,
} from "./koenig/EditorBridge";
import { ElementControls } from "./koenig/ElementControls";
import { useKoenigServices } from "./koenig/services";
import { ResizeSystem } from "./koenig/ResizeSystem";

export type KoenigValue = EditorValue;
type Props = {
  initialLexical?: Record<string, unknown> | null;
  initialHtml?: string;
  imageLayouts?: Record<string, PostImageLayout>;
  themeVars?: Record<string, string>;
  onChange: (value: KoenigValue) => void;
  onInitialValue?: (value: KoenigValue) => void;
  onReady?: () => void;
  editorRef?: MutableRefObject<EditorHandle | null>;
  siteTitle?: string;
  siteDescription?: string;
  siteUrl?: string;
  fontBody?: string;
  fontHeading?: string;
  fontBodyScale?: number;
  fontHeadingScale?: number;
  fontSize?: string;
};
const NO_LAYOUTS: Record<string, PostImageLayout> = {};

export default function KoenigInner({
  initialLexical,
  initialHtml,
  imageLayouts = NO_LAYOUTS,
  themeVars,
  onChange,
  onInitialValue,
  onReady,
  editorRef,
  siteTitle = "",
  siteDescription = "",
  siteUrl = "",
  fontBody,
  fontHeading,
  fontBodyScale,
  fontHeadingScale,
  fontSize,
}: Props) {
  const classes = useMemo(installCardExtensions, []);
  const [initialState] = useState(() => withLegacyLayouts(initialLexical, imageLayouts));
  const [controller, setController] = useState<EditorController | null>(null);
  const signalRef = useRef<(() => void) | null>(null);
  const nativeChanged = useCallback(() => {
    signalRef.current?.();
  }, []);
  const services = useKoenigServices();
  const style = {
    ...themeVars,
    ...(fontSize ? { "--blog-font-size": fontSize, "--portfolio-editor-font-size": fontSize } : {}),
    ...(fontBody ? { "--kg-font-body": fontBody } : {}),
    ...(fontHeading ? { "--kg-font-heading": fontHeading } : {}),
    ...(fontBodyScale ? { "--kg-font-body-scale": String(fontBodyScale) } : {}),
    ...(fontHeadingScale ? { "--kg-font-heading-scale": String(fontHeadingScale) } : {}),
  } as CSSProperties;

  return (
    <div className="koenig-host blog-theme" style={style}>
      <KoenigComposer
        nodes={DEFAULT_NODES}
        initialEditorState={initialState}
        fileUploader={{ useFileUpload: services.useFileUpload, fileTypes: KOENIG_FILE_TYPES }}
        cardConfig={{
          siteTitle,
          siteDescription,
          siteUrl,
          membersEnabled: false,
          stripeEnabled: false,
          renderLabels: false,
          feature: { transistor: false },
          post: { displayName: "post", visibility: "public" },
          fetchEmbed: services.resolveEmbed,
        }}
        onError={(error: unknown) => console.error("[koenig]", error)}
      >
        <KoenigEditor className="portfolio-koenig" onChange={nativeChanged}>
          <ResizeSystem controller={controller}>
            <ElementControls controller={controller} services={services} />
            <EditorBridge
              classes={classes}
              initialHtml={initialHtml ?? ""}
              initialImageLayouts={imageLayouts}
              importHtml={!initialState}
              onChange={onChange}
              onInitialValue={onInitialValue}
              onReady={onReady}
              handleRef={editorRef}
              signalRef={signalRef}
              onController={setController}
            />
          </ResizeSystem>
        </KoenigEditor>
      </KoenigComposer>
    </div>
  );
}
