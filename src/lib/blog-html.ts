// Prepares a post's Koenig HTML for display. Pure string → string, so the
// server render and client hydration produce identical markup.
//
//  • Safety: strips <script>, inline on* handlers and javascript: URLs, and
//    only keeps iframes from an allowlist (others become a plain link).
//  • Images: first image is the likely LCP → eager + fetchpriority=high;
//    every other image lazy-loads, all decode async. Readers never wait for
//    the whole article's images.
//  • Layouts: per-image layout (left/right float, centered, full) chosen in
//    the editor, applied to the image's <figure> as CSS classes.
//  • Embeds: YouTube/Vimeo become click-to-play placeholders (a thumbnail
//    and a button). No third-party player JS loads until the visitor asks.
//  • Links: external links open in a new tab with rel="noopener noreferrer".
import type { PostImageLayout } from "@/content/site";

export type BlogHtmlOptions = {
  imageLayouts?: Record<string, PostImageLayout> | undefined;
  externalLinksNewTab?: boolean | undefined;
  siteHost?: string | undefined;
};

/** Hosts whose iframes may be shown as-is (lazy-loaded). */
const IFRAME_ALLOW = [
  "open.spotify.com",
  "codepen.io",
  "www.google.com",
  "docs.google.com",
  "player.vimeo.com",
  "www.youtube.com",
  "www.youtube-nocookie.com",
  "youtube.com",
];

const escAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
  return m ? (m[2] ?? m[3]) : undefined;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url, "https://x.invalid").hostname.toLowerCase();
  } catch {
    return null;
  }
}

function sanitize(html: string): string {
  return (
    html
      .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
      .replace(/<script\b[^>]*\/?>/gi, "")
      // Attribute cleanup only inside tags, never in article text.
      .replace(/<[a-z][^<>]*>/gi, (tag) =>
        tag
          .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
          .replace(
            /\s(href|src|xlink:href)\s*=\s*(["'])\s*(javascript|vbscript|data:text\/html)[^"']*\2/gi,
            ' $1="#"',
          ),
      )
  );
}

function facade(embedSrc: string, title: string, thumb?: string): string {
  const t = escAttr(title || "Embedded video");
  return (
    `<div class="kg-facade" data-embed="${escAttr(embedSrc)}" data-title="${t}">` +
    (thumb
      ? `<img src="${escAttr(thumb)}" alt="" width="480" height="360" loading="lazy" decoding="async">`
      : "") +
    `<button type="button" class="kg-facade__play" aria-label="Play video: ${t}"></button>` +
    `</div>`
  );
}

function transformIframe(tag: string): string {
  const src = attr(tag, "src") ?? "";
  const title = attr(tag, "title") ?? "";
  const yt = /(?:youtube(?:-nocookie)?\.com\/embed\/|youtu\.be\/)([\w-]{11})/i.exec(src);
  if (yt) {
    const id = yt[1];
    return facade(
      `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
      title,
      `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    );
  }
  const vimeo = /player\.vimeo\.com\/video\/(\d+)/i.exec(src);
  if (vimeo) {
    return facade(`https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&dnt=1`, title);
  }
  const host = hostOf(src);
  if (src.startsWith("https://") && host && IFRAME_ALLOW.includes(host)) {
    const safe = tag.replace(/\sloading\s*=\s*("[^"]*"|'[^']*')/i, "");
    return `${safe.replace(/^<iframe\b/i, '<iframe loading="lazy"')}</iframe>`;
  }
  return src
    ? `<a href="${escAttr(src)}" target="_blank" rel="noopener noreferrer">View embedded content ↗</a>`
    : "";
}

export function prepareBlogHtml(html: string, opts: BlogHtmlOptions = {}): string {
  let out = sanitize(html);

  // Embeds: iframes (with or without a closing tag).
  out = out.replace(/<iframe\b[^>]*>(?:[\s\S]*?<\/iframe>)?/gi, (m) => {
    const open = /^<iframe\b[^>]*>/i.exec(m)?.[0] ?? m;
    return transformIframe(open);
  });

  // Image layouts on Koenig image-card figures.
  const layouts = opts.imageLayouts ?? {};
  if (Object.keys(layouts).length) {
    out = out.replace(
      /<figure\b([^>]*)>([\s\S]*?)<\/figure>/gi,
      (whole, attrs: string, inner: string) => {
        const img = /<img\b[^>]*>/i.exec(inner)?.[0];
        const src = img ? attr(img, "src") : undefined;
        const layout = src ? layouts[src] : undefined;
        if (!layout) return whole;
        const cls = `kg-layout-${layout.align}${layout.size ? ` kg-size-${layout.size}` : ""}`;
        const withClass = /\sclass\s*=\s*"/i.test(attrs)
          ? attrs.replace(/\sclass\s*=\s*"([^"]*)"/i, (_c, v: string) => ` class="${v} ${cls}"`)
          : `${attrs} class="${cls}"`;
        return `<figure${withClass}>${inner}</figure>`;
      },
    );
  }

  // Images: first eager/high priority, the rest lazy; all async decode.
  let index = 0;
  out = out.replace(/<img\b([^>]*?)(\/?)>/gi, (_m, attrs: string, slash: string) => {
    let a = attrs;
    const first = index === 0;
    index += 1;
    if (!/\sloading\s*=/i.test(a)) a += first ? ' loading="eager"' : ' loading="lazy"';
    if (first && !/\sfetchpriority\s*=/i.test(a)) a += ' fetchpriority="high"';
    if (!/\sdecoding\s*=/i.test(a)) a += ' decoding="async"';
    return `<img${a}${slash}>`;
  });

  // External links.
  if (opts.externalLinksNewTab !== false) {
    const own = opts.siteHost?.replace(/^www\./, "");
    out = out.replace(/<a\b([^>]*)>/gi, (m, attrs: string) => {
      const href = attr(m, "href") ?? "";
      if (!/^https?:\/\//i.test(href)) return m;
      const host = hostOf(href)?.replace(/^www\./, "");
      if (own && host === own) return m;
      let a = attrs;
      if (!/\starget\s*=/i.test(a)) a += ' target="_blank"';
      if (!/\srel\s*=/i.test(a)) a += ' rel="noopener noreferrer"';
      return `<a${a}>`;
    });
  }

  return out;
}

/** Image sources in a post body, in order — used by the editor's layout panel. */
export function bodyImages(html: string): { src: string; alt: string }[] {
  const seen = new Set<string>();
  const list: { src: string; alt: string }[] = [];
  for (const m of html.matchAll(/<figure\b[^>]*kg-image-card[^>]*>[\s\S]*?<\/figure>/gi)) {
    const img = /<img\b[^>]*>/i.exec(m[0])?.[0];
    const src = img ? attr(img, "src") : undefined;
    if (src && !seen.has(src)) {
      seen.add(src);
      list.push({ src, alt: attr(img!, "alt") ?? "" });
    }
  }
  return list;
}
