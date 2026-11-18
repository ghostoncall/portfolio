import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import { useKoenigHistory } from "@tryghost/koenig-lexical";
import type { EditorController } from "./EditorBridge";
import { L, LexicalReact } from "./runtime";
import type { CardLayout } from "./layout";
import {
  SIZE_TYPES,
  PROPORTIONAL_TYPES,
  RESIZE_EDGES,
  sizingTarget,
  resizeLimits,
  resizedDimensions,
  customLayout,
  sizingRatio,
  type SizeMetrics,
  type ResizeEdge,
} from "./sizing";

const SizingContext = createContext<{ metrics: SizeMetrics | null }>({ metrics: null });

export function ResizeSystem({
  controller,
  children,
}: {
  controller: EditorController | null;
  children: ReactNode;
}) {
  const [editor] = LexicalReact.useLexicalComposerContext();
  const { historyState } = useKoenigHistory();
  const [metrics, setMetrics] = useState<SizeMetrics | null>(null);
  const selected = controller?.selected;
  const selectedKey = selected?.key,
    selectedType = selected?.type,
    selectedIsCard = selected?.isCard;
  const live = useRef(controller);
  live.current = controller;
  const measure = useRef<() => SizeMetrics | null>(() => null);
  const gesture = useRef<null | {
    id: number;
    edge: ResizeEdge;
    x: number;
    y: number;
    start: SizeMetrics;
    before: CardLayout | null;
    controller: EditorController;
    locked: boolean;
    ratio: number;
    moved: boolean;
    cardWidth: unknown;
    history: {
      undoStack: typeof historyState.undoStack;
      redoStack: typeof historyState.redoStack;
      current: typeof historyState.current;
    };
    pending?: CardLayout;
    raf?: number;
  }>(null);

  useLayoutEffect(() => {
    if (!selectedKey || !selectedType || !selectedIsCard || !SIZE_TYPES.has(selectedType)) {
      setMetrics(null);
      return;
    }
    const root = editor.getRootElement()?.closest<HTMLElement>(".portfolio-koenig");
    const node = editor.getElementByKey(selectedKey);
    const canvas = editor.getRootElement();
    if (!root || !node || !canvas) {
      setMetrics(null);
      return;
    }
    let raf = 0,
      disposed = false;
    const read = () => {
      const target = sizingTarget(node, selectedType),
        box = target.getBoundingClientRect(),
        origin = root.getBoundingClientRect();
      if (!node.isConnected || !origin.width || !root.offsetWidth || !box.width) return null;
      const scale = origin.width / Math.max(root.offsetWidth, 1);
      return {
        key: selectedKey,
        width: box.width / scale,
        height: box.height / scale,
        containerWidth: canvas.clientWidth,
        left: (box.left - origin.left) / scale,
        top: (box.top - origin.top) / scale,
        scale,
      };
    };
    const update = () => {
      if (disposed) return;
      const next = read();
      if (!next) return;
      setMetrics((old) =>
        old &&
        Object.keys(next).every(
          (key) =>
            Math.abs(
              Number(old[key as keyof SizeMetrics]) - Number(next[key as keyof SizeMetrics]),
            ) < 0.2 || old[key as keyof SizeMetrics] === next[key as keyof SizeMetrics],
        )
          ? old
          : next,
      );
    };
    measure.current = read;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    observer.observe(canvas);
    observer.observe(node);
    observer.observe(sizingTarget(node, selectedType));
    update();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      measure.current = () => null;
    };
  }, [editor, selectedKey, selectedType, selectedIsCard]);

  const flush = () => {
    const current = gesture.current;
    if (!current?.pending) return;
    current.controller.resize(current.pending, current.moved);
    current.moved = true;
    delete current.pending;
  };
  const finish = (cancel = false) => {
    const current = gesture.current;
    if (!current) return;
    if (current.raf) cancelAnimationFrame(current.raf);
    if (cancel) {
      if (current.moved) {
        if (current.cardWidth) current.controller.update({ cardWidth: current.cardWidth }, true);
        current.controller.resize(current.before, true);
        // The public native history state permits restoring an aborted gesture.
        // Changes to other cards are never replaced with an older document.
        historyState.undoStack = current.history.undoStack;
        historyState.redoStack = current.history.redoStack;
        historyState.current = { editor, editorState: editor.getEditorState() };
        editor.dispatchCommand(L.CAN_UNDO_COMMAND, historyState.undoStack.length > 0);
        editor.dispatchCommand(L.CAN_REDO_COMMAND, historyState.redoStack.length > 0);
      }
    } else flush();
    gesture.current = null;
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useLayoutEffect(() => () => finishRef.current(true), [selectedKey]);

  const start = (event: PointerEvent<HTMLButtonElement>, edge: ResizeEdge) => {
    const value = live.current,
      start = measure.current();
    if (!value?.selected || !start || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const before = value.selected.layout;
    gesture.current = {
      id: event.pointerId,
      edge,
      x: event.clientX,
      y: event.clientY,
      start,
      before,
      controller: value,
      locked: before?.locked ?? PROPORTIONAL_TYPES.has(value.selected.type),
      ratio: sizingRatio(before, value.selected.fields, start.width, start.height),
      moved: false,
      cardWidth: value.selected.fields["cardWidth"],
      history: {
        undoStack: [...historyState.undoStack],
        redoStack: [...historyState.redoStack],
        current: historyState.current,
      },
    };
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const value = gesture.current;
    if (!value || value.id !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const dx = (event.clientX - value.x) / value.start.scale,
      dy = (event.clientY - value.y) / value.start.scale;
    if (!value.moved && Math.abs(dx) + Math.abs(dy) < 2) return;
    const dimensions = resizedDimensions(
      value.start.width,
      value.start.height,
      dx,
      dy,
      value.edge,
      value.locked,
      value.ratio,
      value.controller.selected!.type,
      value.start.containerWidth,
    );
    value.pending = customLayout(value.before, dimensions, value.locked, value.ratio);
    if (value.raf) cancelAnimationFrame(value.raf);
    value.raf = requestAnimationFrame(flush);
  };
  const key = (event: KeyboardEvent<HTMLButtonElement>, edge: ResizeEdge) => {
    if (event.key === "Escape" && gesture.current) {
      event.preventDefault();
      event.stopPropagation();
      finish(true);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase())) {
      event.preventDefault();
      event.stopPropagation();
      if (gesture.current) finish(true);
      else
        editor.dispatchCommand(
          event.key.toLowerCase() === "y" || event.shiftKey ? L.REDO_COMMAND : L.UNDO_COMMAND,
          undefined,
        );
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const value = live.current,
      size = measure.current();
    if (!value?.selected || !size) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 10 : 1;
    const dx = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
    const dy = event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0;
    const locked = value.selected.layout?.locked ?? PROPORTIONAL_TYPES.has(value.selected.type),
      ratio = sizingRatio(value.selected.layout, value.selected.fields, size.width, size.height);
    value.resize(
      customLayout(
        value.selected.layout,
        resizedDimensions(
          size.width,
          size.height,
          dx,
          dy,
          edge,
          locked,
          ratio,
          value.selected.type,
          size.containerWidth,
        ),
        locked,
        ratio,
      ),
    );
  };

  return (
    <SizingContext.Provider value={{ metrics }}>
      {children}
      {metrics && selected?.key === metrics.key && (
        <div
          className="koenig-resize-boundary"
          data-kg-settings-panel="true"
          aria-label="Selected element dimensions"
          style={{
            left: metrics.left,
            top: metrics.top,
            width: metrics.width,
            height: Math.max(metrics.height, 12),
          }}
        >
          <span className="koenig-resize-measurement">
            {Math.round(metrics.width)} × {Math.round(metrics.height)}
          </span>
          {RESIZE_EDGES.map(({ edge, label }) => (
            <button
              key={edge}
              type="button"
              className={`koenig-resize-handle koenig-resize-${edge}`}
              aria-label={`Resize ${label}`}
              title={`Resize ${label}. Arrow keys adjust; Shift is 10 pixels; Escape cancels.`}
              data-resize-handle={edge}
              onPointerDown={(event) => start(event, edge)}
              onPointerMove={move}
              onPointerUp={(event) => {
                event.preventDefault();
                event.stopPropagation();
                finish();
              }}
              onPointerCancel={() => finish(true)}
              onLostPointerCapture={() => {
                if (gesture.current) finish(true);
              }}
              onKeyDown={(event) => key(event, edge)}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            />
          ))}
        </div>
      )}
    </SizingContext.Provider>
  );
}

export function SizeControls({ controller }: { controller: EditorController }) {
  const { metrics } = useContext(SizingContext),
    selected = controller.selected!;
  const before = selected.layout;
  const actual = metrics?.key === selected.key ? metrics : null;
  const width =
    before?.size === "custom" ? before.width : actual ? Math.round(actual.width) : undefined;
  const height =
    before?.size === "custom" ? before.height : actual ? Math.round(actual.height) : undefined;
  const unit = before?.unit ?? "px";
  const locked = before?.locked ?? PROPORTIONAL_TYPES.has(selected.type);
  const ratio = sizingRatio(before, selected.fields, actual?.width ?? 1, actual?.height ?? 1);
  const limits = resizeLimits(selected.type);
  const change = (axis: "width" | "height", value: number | undefined, merge: boolean) => {
    if (!actual) return;
    const next = customLayout(
      before,
      { ...(width !== undefined ? { width } : {}), ...(height !== undefined ? { height } : {}) },
      locked,
      ratio,
    );
    next.unit = unit;
    if (value === undefined) delete next[axis];
    else next[axis] = value;
    if (locked && value !== undefined) {
      const requestedWidth = unit === "%" ? (actual.containerWidth * value) / 100 : value;
      const result = resizedDimensions(
        actual.width,
        actual.height,
        axis === "width" ? requestedWidth - actual.width : 0,
        axis === "height" ? value - actual.height : 0,
        axis === "width" ? "e" : "s",
        true,
        ratio,
        selected.type,
        unit === "%" ? actual.containerWidth : 8192,
      );
      next.width =
        unit === "%"
          ? Math.round((result.width / actual.containerWidth) * 10000) / 100
          : result.width;
      next.height = result.height;
    }
    controller.resize(next, merge);
  };
  return (
    <div className="koenig-controls-grid" aria-label="Element dimensions">
      <DimensionInput
        key={`${selected.key}:width`}
        label="Custom width"
        value={width}
        min={unit === "%" ? 1 : limits.minWidth}
        max={unit === "%" ? 100 : 8192}
        onValue={(value, merge) => change("width", value, merge)}
      />
      <label>
        Width unit
        <select
          aria-label="Width unit"
          value={unit}
          onChange={(event) => {
            if (!actual) return;
            const next = customLayout(
              before,
              { width: Math.round(actual.width), ...(height !== undefined ? { height } : {}) },
              locked,
              ratio,
            );
            next.unit = event.target.value as "px" | "%";
            if (next.unit === "%")
              next.width = Math.round((actual.width / actual.containerWidth) * 10000) / 100;
            controller.resize(next);
          }}
        >
          <option value="px">Pixels</option>
          <option value="%">Percent of article</option>
        </select>
      </label>
      <DimensionInput
        key={`${selected.key}:height`}
        label={selected.type === "horizontalrule" ? "Divider thickness" : "Custom height"}
        value={height}
        min={limits.minHeight}
        max={limits.maxHeight}
        onValue={(value, merge) => change("height", value, merge)}
      />
      {selected.type !== "horizontalrule" && (
        <label className="koenig-control-check">
          <input
            type="checkbox"
            aria-label="Lock aspect ratio"
            checked={locked}
            onChange={(event) => {
              if (!actual) return;
              const savedWidth =
                width ??
                (unit === "%"
                  ? Math.round((actual.width / actual.containerWidth) * 10000) / 100
                  : Math.round(actual.width));
              const savedHeight = height ?? Math.round(actual.height);
              const next = customLayout(
                before,
                { width: savedWidth, height: savedHeight },
                event.target.checked,
                unit === "%"
                  ? actual.width / Math.max(actual.height, 1)
                  : savedWidth / Math.max(savedHeight, 1),
              );
              next.unit = unit;
              controller.resize(next);
            }}
          />
          Lock aspect ratio
        </label>
      )}
      <button
        type="button"
        onClick={() =>
          controller.resize({ align: before?.align ?? "center", size: "custom", locked })
        }
      >
        Auto dimensions
      </button>
      <button type="button" onClick={() => controller.layout(null)}>
        Reset dimensions
      </button>
      {actual && (
        <output aria-label="Rendered dimensions">
          Displayed {Math.round(actual.width)} × {Math.round(actual.height)} px
          {before?.size === "custom" && before.width
            ? ` · Saved ${before.width}${unit}${before.height ? ` × ${before.height}px` : " × auto"}`
            : ""}
        </output>
      )}
    </div>
  );
}

function DimensionInput({
  label,
  value,
  min,
  max,
  onValue,
}: {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  onValue: (value: number | undefined, merge: boolean) => void;
}) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  const first = useRef(true);
  useLayoutEffect(() => {
    setDraft(value === undefined ? "" : String(value));
  }, [value]);
  return (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        placeholder="Auto"
        value={draft}
        onFocus={() => {
          first.current = true;
        }}
        onBlur={() => {
          setDraft(value === undefined ? "" : String(value));
        }}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          const parsed = Number(text);
          if (!text || (Number.isFinite(parsed) && parsed >= min && parsed <= max)) {
            onValue(text ? parsed : undefined, !first.current);
            first.current = false;
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
