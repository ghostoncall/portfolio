import type { PostImageLayout } from "@/content/site";
import { imageLayoutForSource } from "@/lib/blog-image-layout";

export type CardLayout = {
  align: "default" | "left" | "center" | "right" | "full";
  size: "s" | "m" | "l" | "wide" | "full" | "original" | "custom";
  width?: number;
  unit?: "px" | "%";
  height?: number;
  locked?: boolean;
  aspectRatio?: number;
};

export function normalizeLayout(value: unknown): CardLayout | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!["default", "left", "center", "right", "full"].includes(String(v["align"]))) return null;
  if (!["s", "m", "l", "wide", "full", "original", "custom"].includes(String(v["size"])))
    return null;
  const layout = { align: v["align"], size: v["size"] } as CardLayout;
  if (layout.size === "custom") {
    const width = Number(v["width"]);
    const height = Number(v["height"]);
    if (v["width"] != null && (!Number.isFinite(width) || width <= 0 || width > 8192)) return null;
    if (v["height"] != null && (!Number.isFinite(height) || height <= 0 || height > 8192))
      return null;
    if (width > 0) layout.width = width;
    if (height > 0) layout.height = height;
    layout.unit = v["unit"] === "%" ? "%" : "px";
  }
  if (typeof v["locked"] === "boolean") layout.locked = v["locked"];
  const aspectRatio = Number(v["aspectRatio"]);
  if (Number.isFinite(aspectRatio) && aspectRatio > 0 && aspectRatio <= 8192)
    layout.aspectRatio = aspectRatio;
  return layout;
}

export function layoutWidth(layout: CardLayout, naturalWidth?: unknown): string {
  if (layout.size === "custom")
    return layout.width ? `min(100%, ${layout.width}${layout.unit ?? "px"})` : "100%";
  if (layout.align === "default" || layout.align === "full" || layout.size === "full")
    return "100%";
  const presets = { s: "34%", m: "45%", l: "58%", wide: "90%" };
  if (layout.size in presets) return presets[layout.size as keyof typeof presets];
  const original = Number(naturalWidth);
  return original > 0 ? `min(100%, ${original}px)` : "100%";
}

/** In-memory compatibility only. Saved legacy fields remain readable. */
export function withLegacyLayouts(
  lexical: Record<string, unknown> | null | undefined,
  layouts: Record<string, PostImageLayout>,
): Record<string, unknown> | null {
  if (!lexical || !lexical["root"]) return null;
  const copy = JSON.parse(JSON.stringify(lexical)) as Record<string, unknown>;
  const visit = (node: Record<string, unknown>) => {
    if (node["type"] === "image" && !node["portfolioLayout"] && typeof node["src"] === "string") {
      const old = imageLayoutForSource(layouts, node["src"]);
      if (old)
        node["portfolioLayout"] = {
          align: old.align,
          size: old.align === "full" ? "full" : (old.size ?? "m"),
        };
    }
    if (Array.isArray(node["children"])) node["children"].forEach(visit);
  };
  visit(copy["root"] as Record<string, unknown>);
  return copy;
}
