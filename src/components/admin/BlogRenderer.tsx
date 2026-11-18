// Shared blog renderer.
//
// Renders Koenig-compatible content (HTML body or legacy Blocks) using the
// actual website design system. Used by:
//   - Admin preview (/onlyme/preview/$slug)
//   - Editor live preview (split-screen mode)
//   - Public blog detail page (/blog/$slug)
//
// This ensures the preview matches the published output exactly.
//
import { useMemo, type CSSProperties, type MouseEvent } from "react";
import { prepareBlogHtml } from "@/lib/blog-html";
import { readTimeLabel } from "@/lib/reading-time";
import { Blocks } from "@/components/blocks";
import { Media } from "@/components/media";
import {
  blogThemeVars,
  DEFAULT_BLOG_SETTINGS,
  validBodyFontSize,
  type BlogSettings,
} from "@/lib/blog-settings";
import { formatDate } from "@/lib/format-date";
import type { Post } from "@/content/site";
import { Rich } from "@/lib/rich-inline";

const FALLBACK_SETTINGS: BlogSettings = DEFAULT_BLOG_SETTINGS;

type BlogRendererProps = {
  post: Post;
  themeVars?: CSSProperties;
  className?: string;
  /** Section label shown first in the metadata line ("Tech Blogs"). */
  sectionName?: string | undefined;
};

const SITE_HOST = (() => {
  try {
    const url = (import.meta.env as Record<string, string | undefined>)["VITE_SITE_URL"];
    return url ? new URL(url).hostname : undefined;
  } catch {
    return undefined;
  }
})();

/** Click-to-play: swap a video placeholder for the real player iframe. */
function activateFacade(event: MouseEvent<HTMLDivElement>) {
  const el = (event.target as HTMLElement).closest<HTMLElement>(".kg-facade");
  if (!el || el.dataset["loaded"]) return;
  const src = el.dataset["embed"];
  if (!src) return;
  const iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.title = el.dataset["title"] || "Embedded video";
  iframe.allow =
    "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
  iframe.allowFullscreen = true;
  el.dataset["loaded"] = "1";
  el.replaceChildren(iframe);
  iframe.focus();
}

export function BlogRenderer({ post, themeVars, className, sectionName }: BlogRendererProps) {
  const bodyFontSize = validBodyFontSize(post.body?.fontSize);
  const vars = {
    ...(themeVars ?? blogThemeVars(FALLBACK_SETTINGS)),
    ...(bodyFontSize ? { "--blog-font-size": bodyFontSize } : {}),
  } as CSSProperties;
  const html = useMemo(
    () =>
      post.body?.html
        ? prepareBlogHtml(post.body.html, {
            imageLayouts: post.imageLayouts,
            externalLinksNewTab: post.externalLinksNewTab,
            siteHost: SITE_HOST,
          })
        : "",
    [post.body?.html, post.imageLayouts, post.externalLinksNewTab],
  );

  return (
    <div style={vars} className={`blog-theme ${className ?? ""}`}>
      {post.dek && (
        <p className="font-serif text-xl italic text-muted-foreground">
          <Rich text={post.dek} />
        </p>
      )}
      <p className="label-caps mt-6 flex flex-wrap gap-x-2 gap-y-1 border-y border-border py-3 text-muted-foreground">
        {[
          sectionName ? (
            <span key="s" className="text-foreground">
              {sectionName}
            </span>
          ) : null,
          post.date ? (
            <time key="d" dateTime={post.date}>
              {formatDate(post.date)}
            </time>
          ) : null,
          post.updated && post.updated > post.date ? (
            <span key="u">
              Updated <time dateTime={post.updated}>{formatDate(post.updated)}</time>
            </span>
          ) : null,
          <span key="r">{readTimeLabel(post)}</span>,
          post.author ? <span key="a">By {post.author}</span> : null,
          post.tags.length ? <span key="t">{post.tags.join(", ")}</span> : null,
        ]
          .filter(Boolean)
          .flatMap((part, i) =>
            i === 0
              ? [part]
              : [
                  <span key={`sep${i}`} aria-hidden="true">
                    ·
                  </span>,
                  part,
                ],
          )}
      </p>
      {post.cover?.src && <Media items={[post.cover]} />}
      {html ? (
        // Click delegation only activates video placeholders; each placeholder
        // contains a real <button>, so it works from the keyboard too.
        <div
          className="kg-content prose-editorial"
          onClick={activateFacade}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <Blocks blocks={post.blocks} />
      )}
    </div>
  );
}
