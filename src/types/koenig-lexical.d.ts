// The package ships no type declarations. We use a narrow surface only.
declare module "@tryghost/koenig-lexical" {
  import type { ComponentType, ReactNode } from "react";

  export type KoenigJson = Record<string, unknown>;

  type NativeProps = { children?: ReactNode; [key: string]: unknown };
  export const KoenigComposer: ComponentType<NativeProps>;
  export const KoenigEditor: ComponentType<{
    onChange?: (json: KoenigJson) => void;
    children?: ReactNode;
    [key: string]: unknown;
  }>;
  export const KoenigComposableEditor: ComponentType<NativeProps>;
  export const HtmlOutputPlugin: ComponentType<{
    html?: string;
    setHtml?: (html: string) => void;
  }>;
  export const DEFAULT_NODES: unknown[];
  export const KoenigLexical: typeof import("lexical");
  export const KoenigHtml: typeof import("@lexical/html");
  export const KoenigReact: typeof import("@lexical/react/LexicalComposerContext");
  export const KoenigSelection: typeof import("@lexical/selection");
  export const KoenigRichText: typeof import("@lexical/rich-text");
  export const KoenigList: typeof import("@lexical/list");
  export const KoenigLink: typeof import("@lexical/link");
  export const ExternalControlPlugin: ComponentType<{
    registerAPI: (api: { editorInstance: import("lexical").LexicalEditor } | null) => void;
  }>;
  export const BASIC_NODES: unknown[];
  export const DEFAULT_TRANSFORMERS: unknown[];
  export const BASIC_TRANSFORMERS: unknown[];
  export const AllDefaultPlugins: ComponentType<NativeProps>;
  export const version: string;
  export const $selectDecoratorNode: (node: import("lexical").LexicalNode) => void;
  export const useKoenigHistory: () => { historyState: import("@lexical/history").HistoryState };
  export const EDIT_CARD_COMMAND: import("lexical").LexicalCommand<{
    cardKey: string;
    focusEditor?: boolean;
  }>;
}

declare module "@tryghost/koenig-lexical/style.css";
