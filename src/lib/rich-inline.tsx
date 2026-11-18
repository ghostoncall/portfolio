// Inline formatting for any text entered in the admin panel.
//
// Marks (inserted by the admin formatting toolbar, or typed by hand):
//   **bold**   *italic*   __underline__   [font:sans]text[/font]
//   \*  \_  \[  — a literal character
// Fonts are the self-hosted families in src/lib/typography.ts (looked up by
// id, never interpolated), and the text is turned into React elements — never
// parsed as HTML — so formatted text can't inject markup, scripts or CSS.
import { Fragment, type ReactNode } from "react";
import { fontCss, HEADING_FONTS } from "@/lib/typography";

export type RichNode =
  | string
  | { t: "b" | "i" | "u"; c: RichNode[] }
  | { t: "f"; font: string; c: RichNode[] };

export const FONT_OPTIONS = HEADING_FONTS.map((f) => ({ id: f.id, label: f.label.split(" — ")[0]! }));

const MARK_CHARS = /[*_[\\]/;

function closeOf(s: string, token: string, from: number): number {
  for (let j = from; j <= s.length - token.length; j++) {
    if (s[j] === "\\") {
      j++;
      continue;
    }
    if (s.startsWith(token, j)) return j;
  }
  return -1;
}

export function parseRich(s: string): RichNode[] {
  const out: RichNode[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push(buf);
    buf = "";
  };
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;
    if (ch === "\\" && i + 1 < s.length && /[*_[\]\\]/.test(s[i + 1]!)) {
      buf += s[i + 1];
      i += 2;
      continue;
    }
    if (s.startsWith("[font:", i)) {
      const close = s.indexOf("]", i);
      const id = close > 0 ? s.slice(i + 6, close) : "";
      const end = close > 0 ? s.indexOf("[/font]", close) : -1;
      if (end > close && fontCss(id)) {
        flush();
        out.push({ t: "f", font: id, c: parseRich(s.slice(close + 1, end)) });
        i = end + 7;
        continue;
      }
    }
    const pair = s.startsWith("**", i) ? "**" : s.startsWith("__", i) ? "__" : null;
    if (pair) {
      const end = closeOf(s, pair, i + 2);
      if (end > i + 2) {
        flush();
        out.push({ t: pair === "**" ? "b" : "u", c: parseRich(s.slice(i + 2, end)) });
        i = end + 2;
      } else {
        // An unmatched pair is literal text.
        buf += pair;
        i += 2;
      }
      continue;
    }
    if (ch === "*" && s[i + 1] && s[i + 1] !== " ") {
      const end = closeOf(s, "*", i + 1);
      if (end > i + 1 && s[end - 1] !== " ") {
        flush();
        out.push({ t: "i", c: parseRich(s.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

function toPlain(nodes: RichNode[]): string {
  return nodes.map((n) => (typeof n === "string" ? n : toPlain(n.c))).join("");
}

/** The text without formatting marks (for <title>, meta, alt text, search). */
export function plainText(value: unknown): string {
  if (typeof value !== "string") return value == null ? "" : String(value);
  return MARK_CHARS.test(value) ? toPlain(parseRich(value)) : value;
}

/** Does the text contain any formatting? */
export function hasRich(value: unknown): boolean {
  return typeof value === "string" && MARK_CHARS.test(value) && plainText(value) !== value;
}

function render(nodes: RichNode[], key = "r"): ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${key}.${i}`;
    if (typeof n === "string") return <Fragment key={k}>{n}</Fragment>;
    const kids = render(n.c, k);
    if (n.t === "b") return <strong key={k} className="font-bold">{kids}</strong>;
    if (n.t === "i") return <em key={k} className="italic">{kids}</em>;
    if (n.t === "u") return <u key={k} className="underline underline-offset-2">{kids}</u>;
    if (n.t !== "f") return kids;
    return (
      <span key={k} style={{ fontFamily: fontCss(n.font) }}>
        {kids}
      </span>
    );
  });
}

/** Render admin-entered text with its formatting. Plain strings pass straight through. */
export function Rich({ text }: { text: unknown }): ReactNode {
  if (text == null || text === "") return null;
  const s = String(text);
  if (!MARK_CHARS.test(s)) return s;
  return <>{render(parseRich(s))}</>;
}
