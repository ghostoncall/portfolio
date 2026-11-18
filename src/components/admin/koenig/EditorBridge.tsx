/* eslint-disable @typescript-eslint/no-explicit-any -- native card properties are described by the upstream registry */
import { useCallback, useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useKoenigHistory, EDIT_CARD_COMMAND } from "@tryghost/koenig-lexical";
import { flushSync } from "react-dom";
import type { BaseSelection, LexicalEditor, LexicalNode, SerializedLexicalNode } from "lexical";
import { L, Html, LexicalReact, Selection, RichText, List, Link, selectCard } from "./runtime";
import { NESTED_FIELDS, type CardClass, type CardNode } from "./nodes";
import type { CardLayout } from "./layout";
import type { PostImageLayout } from "@/content/site";
import { imageLayoutForSource } from "@/lib/blog-image-layout";

export type EditorValue = { lexical: Record<string, unknown>; html: string };
export type EditorHandle = { getSnapshot(): EditorValue };
export type SelectedElement = {
  key: string;
  type: string;
  fields: Record<string, any>;
  layout: CardLayout | null;
  nested: string[];
  isCard: boolean;
  canEdit: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  blockType?: string;
  alignment?: string;
};
export type EditorController = {
  selected: SelectedElement | null;
  update(fields: Record<string, unknown>, merge?: boolean): void;
  layout(layout: CardLayout | null): void;
  resize(layout: CardLayout | null, merge?: boolean): void;
  insert(type: string, fields?: Record<string, unknown>): void;
  action(action: "up" | "down" | "duplicate" | "remove" | "edit"): void;
  focusNested(field: string): void;
  text(
    action: "block" | "align" | "format" | "link" | "size" | "indent" | "outdent",
    value: string,
  ): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
  replace(type: string, fields: Record<string, unknown>, originalKey: string): void;
  current(key: string): Record<string, unknown> | null;
};
type BridgeProps = {
  classes: Map<string, CardClass>;
  initialHtml: string;
  initialImageLayouts: Record<string, PostImageLayout>;
  importHtml: boolean;
  onChange: (value: EditorValue) => void;
  onInitialValue?: ((value: EditorValue) => void) | undefined;
  onReady?: (() => void) | undefined;
  handleRef?: MutableRefObject<EditorHandle | null> | undefined;
  signalRef: MutableRefObject<(() => void) | null>;
  onController: (value: EditorController) => void;
};

function captureEditor(editor: LexicalEditor): EditorValue {
  return editor.getEditorState().read(() => ({
    lexical: editor.getEditorState().toJSON() as unknown as Record<string, unknown>,
    html: Html.$generateHtmlFromNodes(editor, null),
  }));
}

function selectionTarget(selection: BaseSelection | null): LexicalNode | null {
  if (L.$isNodeSelection(selection)) return selection.getNodes()[0] ?? null;
  if (L.$isRangeSelection(selection)) {
    const anchor = selection.anchor.getNode();
    if (L.$isRootNode(anchor))
      return anchor.getChildAtIndex(selection.anchor.offset) ?? anchor.getFirstChild();
    return anchor.getTopLevelElement();
  }
  return null;
}

export function EditorBridge(props: BridgeProps) {
  const [editor] = LexicalReact.useLexicalComposerContext();
  const { historyState } = useKoenigHistory();
  const callbacks = useRef(props);
  callbacks.current = props;
  const initialInput = useRef({
    html: props.initialHtml,
    importHtml: props.importHtml,
    imageLayouts: props.initialImageLayouts,
  });
  const activeKey = useRef<string | null>(null);
  const lastSelection = useRef<BaseSelection | null>(null);
  const fingerprint = useRef("");
  const selectionFingerprint = useRef("");
  const ready = useRef(false);
  const history = useRef({ canUndo: false, canRedo: false });
  const commands = useMemo(
    () => ({
      update: L.createCommand<{
        key: string;
        fields?: Record<string, unknown>;
        layout?: CardLayout | null;
        exact?: boolean;
      }>("portfolio: update card"),
      insert: L.createCommand<{ type: string; fields: Record<string, unknown> }>(
        "portfolio: insert card",
      ),
      action: L.createCommand<{ key: string; action: string }>("portfolio: card action"),
    }),
    [],
  );

  const restoreSelection = useCallback(() => {
    if (lastSelection.current) {
      const copy = lastSelection.current.clone();
      if (copy.getNodes().every((node) => node.isAttached())) L.$setSelection(copy);
    }
  }, []);

  const transact = useCallback(
    (fn: () => void, merge = false) => {
      // Native captions share history with the root, but mounting/focusing one
      // makes its editor the current entry. A root property edit must start from
      // the root's previous state, otherwise Undo only restores that caption.
      if (historyState.current?.editor !== editor)
        historyState.current = { editor, editorState: editor.getEditorState() };
      editor.update(fn, { tag: merge ? "history-merge" : "history-push", discrete: true });
    },
    [editor, historyState],
  );

  const publish = useCallback(
    (initial = false) => {
      if (!ready.current && !initial) return;
      const value = captureEditor(editor);
      const next = JSON.stringify(value);
      if (!initial && next === fingerprint.current) return;
      fingerprint.current = next;
      if (initial) (callbacks.current.onInitialValue ?? callbacks.current.onChange)(value);
      else callbacks.current.onChange(value);
    },
    [editor],
  );

  const refreshController = useCallback(() => {
    if (!ready.current) return;
    let selected: SelectedElement | null = null;
    editor.getEditorState().read(() => {
      const selection = L.$getSelection();
      if (selection) lastSelection.current = selection.clone();
      let node = selectionTarget(selection);
      if (node) activeKey.current = node.getKey();
      else if (activeKey.current) node = L.$getNodeByKey(activeKey.current);
      if (!node || !node.isAttached() || L.$isRootNode(node)) {
        activeKey.current = null;
        return;
      }
      const type = node.getType();
      const Klass = callbacks.current.classes.get(type);
      if (Klass) {
        const card = node as CardNode;
        const json = card.exportJSON() as Record<string, any>;
        const fields = Object.fromEntries(
          Object.keys(Klass.getPropertyDefaults()).map((key) => [
            key,
            key in (NESTED_FIELDS[type] ?? {}) ? json[key] : card[key],
          ]),
        );
        selected = {
          key: node.getKey(),
          type,
          fields,
          layout: card.getPortfolioLayout(),
          nested: Object.keys(NESTED_FIELDS[type] ?? {}),
          isCard: true,
          canEdit: Boolean(card["hasEditMode"]?.()),
          canMoveUp: !!node.getPreviousSibling(),
          canMoveDown: !!node.getNextSibling(),
        };
      } else {
        const element = L.$isElementNode(node) ? node : node.getParent();
        const blockType = List.$isListNode(element)
          ? element.getListType()
          : typeof (node as any).getTag === "function"
            ? (node as any).getTag()
            : type.includes("quote")
              ? "quote"
              : type;
        const range = L.$isRangeSelection(selection)
          ? selection
          : L.$isRangeSelection(lastSelection.current) &&
              L.$getNodeByKey(lastSelection.current.anchor.key)
            ? lastSelection.current
            : null;
        const fields: Record<string, unknown> = {};
        if (range) {
          for (const format of [
            "bold",
            "italic",
            "underline",
            "strikethrough",
            "code",
            "subscript",
            "superscript",
          ] as const)
            fields[format] = range.hasFormat(format);
          fields["fontSize"] = Selection.$getSelectionStyleValueForProperty(range, "font-size", "");
          let linkNode: LexicalNode | null = range.anchor.getNode();
          while (linkNode && !L.$isRootNode(linkNode) && !Link.$isLinkNode(linkNode))
            linkNode = linkNode.getParent();
          fields["link"] = Link.$isLinkNode(linkNode) ? linkNode.getURL() : "";
        }
        selected = {
          key: node.getKey(),
          type,
          fields,
          layout: null,
          nested: [],
          isCard: false,
          canEdit: false,
          canMoveUp: !!node.getPreviousSibling(),
          canMoveDown: !!node.getNextSibling(),
          blockType,
          alignment: element?.getFormatType() ?? "",
        };
      }
    });
    const stateKey = JSON.stringify([selected, history.current]);
    if (stateKey === selectionFingerprint.current) return;
    selectionFingerprint.current = stateKey;
    const key = (selected as SelectedElement | null)?.key ?? "";
    const runCardAction = (action: string) =>
      transact(() => {
        editor.dispatchCommand(commands.action, { key, action });
      });
    callbacks.current.onController({
      selected,
      ...history.current,
      update: (fields, merge) =>
        transact(() => {
          editor.dispatchCommand(commands.update, { key, fields });
        }, merge),
      layout: (layout) =>
        transact(() => {
          editor.dispatchCommand(commands.update, { key, layout });
        }),
      resize: (layout, merge = false) =>
        transact(() => {
          editor.dispatchCommand(commands.update, { key, layout, exact: true });
        }, merge),
      insert: (type, fields = {}) =>
        transact(() => {
          restoreSelection();
          editor.dispatchCommand(commands.insert, { type, fields });
        }),
      action: (action) => {
        if (action === "edit") {
          transact(() => {
            const node = L.$getNodeByKey(key);
            if (node) {
              selectCard(node);
              editor.dispatchCommand(EDIT_CARD_COMMAND, { cardKey: key, focusEditor: false });
            }
          });
        } else runCardAction(action);
      },
      focusNested: (field) => {
        let nested: LexicalEditor | undefined;
        flushSync(() =>
          transact(() => {
            const node = L.$getNodeByKey(key) as CardNode | null;
            const name = NESTED_FIELDS[node?.getType() ?? ""]?.[field];
            if (node && name) {
              selectCard(node);
              if (node["hasEditMode"]?.())
                editor.dispatchCommand(EDIT_CARD_COMMAND, { cardKey: key, focusEditor: false });
              nested = node.getDataset()[name];
            }
          }),
        );
        // The native edit view is mounted before this click returns, so the
        // first keystroke reaches the actual caption/text editor immediately.
        if (nested?.getRootElement()) nested.focus();
        else requestAnimationFrame(() => nested?.focus());
      },
      undo: () => {
        editor.dispatchCommand(L.UNDO_COMMAND, undefined);
      },
      redo: () => {
        editor.dispatchCommand(L.REDO_COMMAND, undefined);
      },
      current: (nodeKey) =>
        editor.getEditorState().read(() => {
          const n = L.$getNodeByKey(nodeKey);
          return (n?.exportJSON() as unknown as Record<string, unknown>) ?? null;
        }),
      replace: (type, fields, originalKey) =>
        transact(() => {
          const old = L.$getNodeByKey(originalKey) as CardNode | null;
          const Klass = callbacks.current.classes.get(type);
          if (!old || !Klass) return;
          const node = new Klass(fields);
          node.setPortfolioLayout(old.getPortfolioLayout());
          old.replace(node);
          selectCard(node);
          activeKey.current = node.getKey();
        }),
      text: (action, value) =>
        transact(() => {
          restoreSelection();
          const selection = L.$getSelection();
          if (!L.$isRangeSelection(selection)) return;
          if (action === "format") editor.dispatchCommand(L.FORMAT_TEXT_COMMAND, value as any);
          if (action === "align") editor.dispatchCommand(L.FORMAT_ELEMENT_COMMAND, value as any);
          if (action === "link") editor.dispatchCommand(Link.TOGGLE_LINK_COMMAND, value || null);
          if (action === "size")
            Selection.$patchStyleText(selection, { "font-size": value || null });
          if (action === "indent") editor.dispatchCommand(L.INDENT_CONTENT_COMMAND, undefined);
          if (action === "outdent") editor.dispatchCommand(L.OUTDENT_CONTENT_COMMAND, undefined);
          if (action === "block") {
            if (value === "bullet" || value === "number")
              editor.dispatchCommand(
                value === "bullet"
                  ? List.INSERT_UNORDERED_LIST_COMMAND
                  : List.INSERT_ORDERED_LIST_COMMAND,
                undefined,
              );
            else {
              Selection.$setBlocksType(selection, () =>
                /^h[1-6]$/.test(value)
                  ? RichText.$createHeadingNode(value as any)
                  : value === "quote"
                    ? RichText.$createQuoteNode()
                    : L.$createParagraphNode(),
              );
            }
          }
        }),
    });
  }, [editor, commands, restoreSelection, transact]);

  useLayoutEffect(() => {
    let disposed = false;
    const off = [
      editor.registerCommand(
        commands.update,
        ({ key, fields, layout, exact }) => {
          const node = L.$getNodeByKey(key) as CardNode | null;
          const Klass = node && props.classes.get(node.getType());
          if (!node || !Klass) return false;
          for (const [field, value] of Object.entries(fields ?? {})) {
            if (
              Object.hasOwn(Klass.getPropertyDefaults(), field) &&
              !(field in (NESTED_FIELDS[node.getType()] ?? {}))
            )
              node[field] = value;
          }
          if (layout !== undefined) {
            if ((layout || !exact) && Object.hasOwn(Klass.getPropertyDefaults(), "cardWidth"))
              node["cardWidth"] =
                layout?.size === "wide"
                  ? "wide"
                  : layout?.size === "full" || layout?.align === "full"
                    ? "full"
                    : "regular";
            node.setPortfolioLayout(
              exact ? layout : (layout ?? { align: "default", size: "full" }),
            );
          }
          return true;
        },
        L.COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        commands.insert,
        ({ type, fields }) => {
          const Klass = props.classes.get(type);
          if (!Klass) return false;
          const node = new Klass({ ...(type === "header" ? { version: 2 } : {}), ...fields });
          L.$insertNodes([node]);
          selectCard(node);
          activeKey.current = node.getKey();
          return true;
        },
        L.COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        commands.action,
        ({ key, action }) => {
          const node = L.$getNodeByKey(key);
          if (!node) return false;
          if (action === "up") node.getPreviousSibling()?.insertBefore(node);
          if (action === "down") node.getNextSibling()?.insertAfter(node);
          if (action === "duplicate") {
            const copy = L.$parseSerializedNode(
              JSON.parse(JSON.stringify(node.exportJSON())) as SerializedLexicalNode,
            );
            if (copy.getType() === "image" && !(copy as CardNode).getPortfolioLayout())
              (copy as CardNode).setPortfolioLayout({ align: "default", size: "full" });
            node.insertAfter(copy);
            if (props.classes.has(copy.getType())) selectCard(copy);
            else if (L.$isElementNode(copy)) copy.selectEnd();
            activeKey.current = copy.getKey();
          }
          if (action === "remove") {
            const neighbour = node.getNextSibling() ?? node.getPreviousSibling();
            node.remove();
            if (neighbour && L.$isElementNode(neighbour)) neighbour.selectEnd();
            else if (neighbour) selectCard(neighbour);
            else {
              const p = L.$createParagraphNode();
              L.$getRoot().append(p);
              p.select();
            }
            activeKey.current = null;
          }
          return true;
        },
        L.COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        L.CAN_UNDO_COMMAND,
        (value) => {
          history.current.canUndo = value;
          queueMicrotask(refreshController);
          return false;
        },
        L.COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        L.CAN_REDO_COMMAND,
        (value) => {
          history.current.canRedo = value;
          queueMicrotask(refreshController);
          return false;
        },
        L.COMMAND_PRIORITY_LOW,
      ),
    ];

    // Discrete Lexical commits can call React.flushSync for decorator views.
    // Initialize after React's commit, rather than flushing inside its effect.
    queueMicrotask(() => {
      if (disposed) return;
      const initial = initialInput.current;
      if (initial.importHtml && initial.html)
        editor.update(
          () => {
            const nodes = Html.$generateNodesFromDOM(
              editor,
              new DOMParser().parseFromString(initial.html, "text/html"),
            );
            const root = L.$getRoot();
            root.clear();
            root.select();
            L.$insertNodes(nodes);
            for (const node of root.getChildren()) {
              if (node.getType() !== "image") continue;
              const image = node as CardNode;
              const old = imageLayoutForSource(initial.imageLayouts, String(image["src"]));
              if (old && !image.getPortfolioLayout())
                image.setPortfolioLayout({
                  align: old.align,
                  size: old.align === "full" ? "full" : (old.size ?? "m"),
                });
            }
          },
          { discrete: true, tag: "history-merge" },
        );

      // Existing posts retain their layout. Newly inserted/pasted/uploaded images
      // start at a manageable article-relative size, including native slash tools.
      const ImageClass = props.classes.get("image");
      if (ImageClass) {
        const existing = editor.getEditorState().read(
          () =>
            new Set(
              L.$getRoot()
                .getChildren()
                .filter((n) => n.getType() === "image")
                .map((n) => n.getKey()),
            ),
        );
        off.push(
          editor.registerNodeTransform(ImageClass as any, (node: CardNode) => {
            if (
              !existing.has(node.getKey()) &&
              !node.getPortfolioLayout() &&
              node["cardWidth"] === "regular"
            )
              node.setPortfolioLayout({ align: "center", size: "m" });
          }),
        );
      }

      // Native HistoryPlugin mounts after the initial state. Seed its existing
      // shared history so the first edit of a reopened post is undoable too.
      if (!historyState.current)
        historyState.current = { editor, editorState: editor.getEditorState() };
      ready.current = true;
      publish(true);
      callbacks.current.onReady?.();
      refreshController();
      const snapshot = () => {
        editor.update(() => {}, { discrete: true });
        return captureEditor(editor);
      };
      if (props.handleRef) props.handleRef.current = { getSnapshot: snapshot };
      props.signalRef.current = () => {
        publish();
        refreshController();
      };
      off.push(
        editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
          if (dirtyElements.size || dirtyLeaves.size) publish();
          refreshController();
        }),
      );
    });
    return () => {
      disposed = true;
      ready.current = false;
      off.forEach((fn) => fn());
      props.signalRef.current = null;
      if (props.handleRef) props.handleRef.current = null;
    };
  }, [
    editor,
    commands,
    props.classes,
    props.handleRef,
    props.signalRef,
    historyState,
    publish,
    refreshController,
  ]);
  return null;
}
