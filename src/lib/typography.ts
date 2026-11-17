// Heading typography the admin can customize.
//
//  • Site-wide (Settings → Headings): page titles (h1) and section headings
//    (h2/h3) each get a font, bold and italic. Emitted as CSS variables in
//    <head>, read by the base heading rules in styles.css — so every page
//    picks them up on first paint with no flash.
//  • Per heading (page editor heading blocks): the same three options as
//    inline style, overriding the site default for that one heading.
//
// Fonts are limited to the self-hosted families (src/fonts.css) and system
// fonts, so choosing one never adds a third-party request. Values are looked
// up by id from this list — never interpolated from user input — so stored
// settings can't inject CSS.
import type { CSSProperties } from "react";

export const HEADING_FONTS = [
  {
    id: "display",
    label: "Cormorant Garamond — display serif",
    css: '"Cormorant Garamond", Georgia, serif',
  },
  { id: "serif", label: "Libre Baskerville — serif", css: '"Libre Baskerville", Georgia, serif' },
  { id: "sans", label: "Lato — sans-serif", css: '"Lato", system-ui, sans-serif' },
  { id: "georgia", label: "Georgia — system serif", css: "Georgia, serif" },
  { id: "system", label: "System UI — system sans-serif", css: "system-ui, sans-serif" },
] as const;

export type HeadingFontId = (typeof HEADING_FONTS)[number]["id"];

export type HeadingStyle = {
  font?: HeadingFontId | undefined;
  bold?: boolean | undefined;
  italic?: boolean | undefined;
};

export type SiteTypography = {
  /** Page titles (the large h1 on every page). */
  titles?: HeadingStyle | undefined;
  /** Section headings (h2/h3) across the site. */
  headings?: HeadingStyle | undefined;
};

export function fontCss(id: unknown): string | undefined {
  return HEADING_FONTS.find((f) => f.id === id)?.css;
}

function vars(prefix: string, s: HeadingStyle | undefined): string[] {
  if (!s) return [];
  const out: string[] = [];
  const font = fontCss(s.font);
  if (font) out.push(`--${prefix}-font:${font}`);
  if (s.bold === true) out.push(`--${prefix}-weight:700`);
  if (s.italic === true) out.push(`--${prefix}-style:italic`);
  return out;
}

/** `:root{…}` declaration for the site-wide heading styles ("" when unset). */
export function typographyCss(t: SiteTypography | undefined): string {
  const decls = [...vars("title", t?.titles), ...vars("heading", t?.headings)];
  return decls.length ? `:root{${decls.join(";")}}` : "";
}

/** Inline style for one heading that overrides the site default. */
export function headingInlineStyle(s: HeadingStyle | undefined): CSSProperties | undefined {
  if (!s) return undefined;
  const style: CSSProperties = {};
  const font = fontCss(s.font);
  if (font) style.fontFamily = font;
  if (s.bold !== undefined) style.fontWeight = s.bold ? 700 : 400;
  if (s.italic !== undefined) style.fontStyle = s.italic ? "italic" : "normal";
  return Object.keys(style).length ? style : undefined;
}

/** Keep only known values (used when saving settings). */
export function cleanHeadingStyle(raw: unknown): HeadingStyle | undefined {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: HeadingStyle = {};
  if (fontCss(r["font"])) out.font = r["font"] as HeadingFontId;
  if (typeof r["bold"] === "boolean") out.bold = r["bold"];
  if (typeof r["italic"] === "boolean") out.italic = r["italic"];
  return Object.keys(out).length ? out : undefined;
}
