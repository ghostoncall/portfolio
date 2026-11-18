import type { CardLayout } from "./layout";

export const SIZE_TYPES = new Set([
  "image",
  "embed",
  "bookmark",
  "gallery",
  "video",
  "audio",
  "file",
  "codeblock",
  "html",
  "markdown",
  "button",
  "callout",
  "toggle",
  "header",
  "product",
  "horizontalrule",
]);
export const PROPORTIONAL_TYPES = new Set(["image", "embed", "video", "gallery"]);
export type SizeMetrics = {
  key: string;
  width: number;
  height: number;
  containerWidth: number;
  left: number;
  top: number;
  scale: number;
};
export type ResizeEdge = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";
export const RESIZE_EDGES: { edge: ResizeEdge; label: string }[] = [
  { edge: "nw", label: "top left" },
  { edge: "n", label: "top" },
  { edge: "ne", label: "top right" },
  { edge: "w", label: "left" },
  { edge: "e", label: "right" },
  { edge: "sw", label: "bottom left" },
  { edge: "s", label: "bottom" },
  { edge: "se", label: "bottom right" },
];

/** Native views differ: measure/resize the visible element, not its caption or toolbar. */
export function sizingTarget(root: HTMLElement, type: string): HTMLElement {
  const card = root.querySelector<HTMLElement>(`[data-kg-card="${type}"]`);
  if (!card) return root;
  const selectors: Record<string, string> = {
    image: "figure img",
    embed: "iframe",
    gallery: "figure > div:first-child",
    video: '[data-testid="video-card-populated"], video, figure > div:first-child',
    codeblock: "pre, .CodeMirror",
    button: ":scope > div:first-child > div:first-child > :first-child",
    audio: ":scope > div:first-child > div:first-child",
    file: ":scope > div:first-child > div:first-child",
    bookmark: ":scope > div:first-child > div:first-child",
    html: ":scope > div:first-child > div:first-child",
    markdown: ":scope > div:first-child > div:first-child",
    horizontalrule: "hr",
  };
  return card.querySelector<HTMLElement>(selectors[type] ?? ":scope > div:first-child") ?? card;
}

export function resizeLimits(type: string) {
  return {
    minWidth: type === "horizontalrule" ? 24 : 48,
    minHeight: type === "horizontalrule" ? 1 : 24,
    maxHeight: type === "horizontalrule" ? 32 : 8192,
  };
}

export function sizingRatio(
  layout: CardLayout | null,
  fields: Record<string, unknown>,
  width: number,
  height: number,
): number {
  if (layout?.aspectRatio) return layout.aspectRatio;
  const metadata = fields["metadata"] as Record<string, unknown> | undefined;
  const naturalWidth = Number(fields["width"] ?? metadata?.["width"]),
    naturalHeight = Number(fields["height"] ?? metadata?.["height"]);
  return naturalWidth > 0 && naturalHeight > 0
    ? naturalWidth / naturalHeight
    : width / Math.max(height, 1);
}

export function layoutHeight(layout: CardLayout, type: string): string | undefined {
  if (!layout.height) return undefined;
  if (layout.width && PROPORTIONAL_TYPES.has(type)) {
    if (layout.unit === "%" && layout.locked && layout.aspectRatio)
      return `calc(100cqw * ${layout.width / 100 / layout.aspectRatio})`;
    if (layout.unit !== "%")
      return `min(${layout.height}px, calc(100cqw * ${layout.height / layout.width}))`;
  }
  return `${layout.height}px`;
}

export function resizedDimensions(
  width: number,
  height: number,
  dx: number,
  dy: number,
  edge: ResizeEdge,
  locked: boolean,
  ratio: number,
  type: string,
  containerWidth: number,
) {
  const limits = resizeLimits(type);
  let w = width + (edge.includes("w") ? -dx : edge.includes("e") ? dx : 0);
  let h = height + (edge.includes("n") ? -dy : edge.includes("s") ? dy : 0);
  if (locked) {
    if (edge === "n" || edge === "s") w = h * ratio;
    else if (
      edge.length === 2 &&
      Math.abs(dy / Math.max(height, 1)) > Math.abs(dx / Math.max(width, 1))
    )
      w = h * ratio;
    else h = w / ratio;
    const minimum = Math.max(
      limits.minWidth / Math.max(w, 1),
      limits.minHeight / Math.max(h, 1),
      1,
    );
    w *= minimum;
    h *= minimum;
    const maximum = Math.min(containerWidth / w, limits.maxHeight / h, 1);
    w *= maximum;
    h *= maximum;
  } else {
    w = Math.max(limits.minWidth, Math.min(containerWidth, w));
    h = Math.max(limits.minHeight, Math.min(limits.maxHeight, h));
  }
  return { width: Math.round(w), height: Math.round(h) };
}

export function customLayout(
  before: CardLayout | null,
  dimensions: { width?: number; height?: number },
  locked: boolean,
  aspectRatio: number,
): CardLayout {
  return {
    align: before?.align && !["default", "full"].includes(before.align) ? before.align : "center",
    size: "custom",
    ...dimensions,
    unit: "px",
    locked,
    aspectRatio,
  };
}

/** Card-local export styles, so published pages need no new global stylesheet. */
export function sizeExport(element: HTMLElement, type: string, layout: CardLayout): HTMLElement {
  if (layout.size !== "custom") return element;
  element.setAttribute("data-portfolio-sized", type);
  Object.assign(element.style, {
    width: layout.width ? `min(100%, ${layout.width}${layout.unit ?? "px"})` : "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
  });
  const selectors: Record<string, string> = {
    image: "img",
    embed: "iframe, .kg-facade",
    video: "video",
    audio: ".kg-audio-card",
    gallery: ".kg-gallery-container",
    file: ".kg-file-card",
    codeblock: "pre",
    button: "a",
    horizontalrule: "hr",
    html: ".kg-html-card",
    markdown: ".kg-markdown-card",
    bookmark: ".kg-bookmark-container",
  };
  const target =
    element.querySelector<HTMLElement>(selectors[type] ?? `.kg-${type}-card`) ??
    (element.firstElementChild as HTMLElement) ??
    element;
  target.setAttribute("data-portfolio-element", type);
  if (type === "bookmark") target.style.display = "flex";
  Object.assign(target.style, {
    width: "100%",
    maxWidth: "100%",
    minWidth: "0",
    boxSizing: "border-box",
    marginInline: "0",
  });
  if (layout.height) {
    const height = layoutHeight(layout, type)!;
    Object.assign(target.style, {
      height,
      minHeight: "0",
      overflow: ["image", "embed", "video", "button", "horizontalrule"].includes(type)
        ? "hidden"
        : "auto",
    });
    if (type === "embed" && target.tagName === "IFRAME") {
      target.setAttribute("data-portfolio-frame-height", String(layout.height));
      if (layout.width && layout.unit !== "%")
        target.setAttribute("data-portfolio-frame-width", String(layout.width));
      if (layout.width && layout.unit === "%" && layout.locked && layout.aspectRatio) {
        target.setAttribute("data-portfolio-frame-percent", String(layout.width));
        target.setAttribute("data-portfolio-frame-ratio", String(layout.aspectRatio));
      }
    }
    if (["image", "video"].includes(type))
      Object.assign(target.style, { objectFit: "contain", aspectRatio: "auto" });
    if (type === "button")
      Object.assign(target.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      });
    if (type === "horizontalrule")
      Object.assign(target.style, {
        borderTopWidth: `${layout.height}px`,
        margin: "0",
        padding: "0",
      });
  }
  return element;
}
