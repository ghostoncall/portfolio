/* eslint-disable @typescript-eslint/no-explicit-any */
// One listing for both blog sections (Tech Blogs at /blog, My Journal at
// /blog/journal). Everything a visitor sees here — headings, introductions,
// images, card options, order, empty states — comes from Blog settings in the
// admin panel; the posts come from the database, filtered by their section.
import type { CSSProperties, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { blogThemeVars } from "@/lib/blog-settings";
import type { BlogSettings } from "@/lib/blog-settings";
import type { Post } from "@/content/site";
import type { SiteIdentity } from "@/db/schema";
import { formatDate } from "@/lib/format-date";
import { plainText, Rich } from "@/lib/rich-inline";
import { sectionPath, switcherSections, type BlogSectionId } from "@/lib/blog-sections";
import { pageCopy } from "@/lib/site-copy";

/** Order posts as configured: newest / oldest by date, or the admin's manual order. */
export function orderPosts(posts: Post[], settings: BlogSettings): Post[] {
  if (settings.listingOrder === "manual") return [...posts]; // the server returns the admin order
  const byDate = [...posts].sort((a, b) => b.date.localeCompare(a.date));
  return settings.listingOrder === "oldest" ? byDate.reverse() : byDate;
}

/** <head> meta for a section page, from its admin settings. */
export function sectionMeta(
  site: SiteIdentity | undefined,
  settings: BlogSettings | undefined,
  id: BlogSectionId,
) {
  const name = plainText(site?.name ?? "Portfolio");
  const sec = settings?.sections[id];
  const title = plainText(sec?.seoTitle || `${sec?.title ?? "Blog"} — ${name}`);
  const description = plainText(sec?.seoDescription || sec?.intro || "");
  const image = sec?.ogImage || sec?.image || "";
  return [
    { title },
    ...(description ? [{ name: "description", content: description }] : []),
    { property: "og:title", content: title },
    ...(description ? [{ property: "og:description", content: description }] : []),
    { property: "og:type", content: "website" },
    ...(image ? [{ property: "og:image", content: image }] : []),
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
  ];
}

/** Two big, obvious tabs right under the heading: Tech Blogs | My Journal. */
export function SectionSwitcher({
  settings,
  current,
}: {
  settings: BlogSettings;
  current: BlogSectionId;
}) {
  const items = switcherSections(settings.sections);
  if (items.length < 2) return null;
  return (
    <nav aria-label="Blog sections" className="mt-6">
      <ul className="flex w-full max-w-md border border-foreground/60 sm:inline-flex sm:w-auto">
        {items.map(({ id, section }, i) => {
          const active = id === current;
          return (
            <li
              key={id}
              className={`flex-1 sm:flex-none ${i > 0 ? "border-l border-foreground/60" : ""}`}
            >
              <Link
                to={sectionPath(id)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[48px] items-center justify-center px-6 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted active:bg-muted"
                }`}
              >
                <Rich text={section.name} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function BlogSectionPage({
  section,
  posts,
  settings,
  site,
  page,
}: {
  section: BlogSectionId;
  posts: Post[];
  settings: BlogSettings;
  site: SiteIdentity;
  page: number;
}) {
  const sec = settings.sections[section];
  const vars = blogThemeVars(settings) as CSSProperties;

  const sorted = orderPosts(posts, settings);
  const featuredPost =
    settings.featured.enabled && settings.featured.position === "hero"
      ? sorted.find((post) => post.featured)
      : undefined;
  const listable = featuredPost ? sorted.filter((post) => post.slug !== featuredPost.slug) : sorted;

  const perPage = Math.max(1, settings.postsPerPage || 10);
  const totalPages = Math.max(1, Math.ceil(listable.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pagePosts = settings.pagination.enabled
    ? listable.slice((currentPage - 1) * perPage, currentPage * perPage)
    : listable;
  const blogLabel = pageCopy(site, "blog").navLabel;

  return (
    <div style={vars} className="blog-theme">
      <PageShell
        crumbs={section === "tech" ? [blogLabel] : [blogLabel, plainText(sec.name)]}
        title={sec.title}
        site={site}
      >
        {sec.subtitle && (
          <p className="font-display text-2xl leading-snug text-foreground">
            <Rich text={sec.subtitle} />
          </p>
        )}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <SectionSwitcher settings={settings} current={section} />
          <Link
            to="/blog/search"
            search={{ section } as any}
            className="inline-flex min-h-[44px] items-center text-sm font-semibold text-link hover:underline"
          >
            Search articles →
          </Link>
        </div>
        {sec.showIntro && (sec.intro || sec.image) && (
          <div className="mt-6 space-y-5">
            {sec.intro && (
              <p className="max-w-2xl whitespace-pre-line font-serif text-lg text-muted-foreground">
                <Rich text={sec.intro} />
              </p>
            )}
            {sec.image && (
              <img
                src={sec.image}
                alt={sec.imageAlt}
                className="w-full border border-border object-cover"
                style={{ aspectRatio: "21/9" }}
                loading="lazy"
                decoding="async"
              />
            )}
          </div>
        )}

        {sorted.length === 0 ? (
          <EmptyState heading={sec.emptyHeading} body={sec.emptyBody} image={settings.empty.image} />
        ) : (
          <>
            {featuredPost && <FeaturedCard post={featuredPost} settings={settings} />}

            {settings.layout === "grid" ? (
              <div className="mt-10 grid gap-8 sm:grid-cols-2">
                {pagePosts.map((post) => (
                  <PostCard key={post.slug} post={post} settings={settings} variant="grid" />
                ))}
              </div>
            ) : (
              <ul className="mt-8 border-t border-border">
                {pagePosts.map((post, i) => (
                  <li key={post.slug} className="border-b border-border">
                    <PostCard post={post} settings={settings} variant="list" eager={i < 2} />
                  </li>
                ))}
              </ul>
            )}

            {settings.pagination.enabled && totalPages > 1 && (
              <nav
                className="mt-10 flex items-center justify-between border-t border-border pt-5 text-sm"
                aria-label="Pagination"
              >
                <PageLink section={section} page={currentPage - 1} disabled={currentPage <= 1}>
                  ← Newer
                </PageLink>
                <span className="label-caps text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <PageLink
                  section={section}
                  page={currentPage + 1}
                  disabled={currentPage >= totalPages}
                >
                  Older →
                </PageLink>
              </nav>
            )}
          </>
        )}
      </PageShell>
    </div>
  );
}

function EmptyState({ heading, body, image }: { heading: string; body: string; image: string }) {
  return (
    <div className="mt-12 flex flex-col items-center gap-4 border border-dashed border-border py-20 text-center">
      {image && (
        <img
          src={image}
          alt=""
          className="max-h-40 w-auto object-contain"
          loading="lazy"
        />
      )}
      {heading && (
        <h2 className="font-display text-3xl text-foreground">
          <Rich text={heading} />
        </h2>
      )}
      {body && (
        <p className="max-w-md font-serif text-muted-foreground">
          <Rich text={body} />
        </p>
      )}
    </div>
  );
}

function PageLink({
  section,
  page,
  disabled,
  children,
}: {
  section: BlogSectionId;
  page: number;
  disabled: boolean;
  children: ReactNode;
}) {
  if (disabled) {
    return <span className="text-muted-foreground/50">{children}</span>;
  }
  return (
    <Link
      to={sectionPath(section)}
      search={{ page } as any}
      className="inline-flex min-h-[44px] items-center text-link hover:underline"
    >
      {children}
    </Link>
  );
}

function CardImage({ post, settings }: { post: Post; settings: BlogSettings }) {
  if (!settings.card.showImage || !post.cover?.src) return null;
  return (
    <div
      className="overflow-hidden border border-border bg-muted"
      style={{ aspectRatio: settings.card.imageRatio }}
    >
      <img
        src={post.cover.src}
        alt={post.cover.alt ?? ""}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  );
}

function CardMeta({
  post,
  settings,
  showDate = true,
  showTags = true,
}: {
  post: Post;
  settings: BlogSettings;
  showDate?: boolean;
  showTags?: boolean;
}) {
  const parts: string[] = [];
  if (settings.card.showDate && showDate) parts.push(formatDate(post.date));
  if (settings.card.showAuthor && post.author) parts.push(post.author);
  if (settings.card.showTags && showTags && post.tags.length) parts.push(post.tags.join(" · "));
  if (!parts.length) return null;
  return <span className="label-caps text-muted-foreground">{parts.join(" · ")}</span>;
}

function excerpt(post: Post, settings: BlogSettings): string | null {
  if (!settings.card.showExcerpt || !post.dek) return null;
  const limit = Math.max(0, settings.card.excerptLength || 180);
  const dek = plainText(post.dek);
  if (dek.length <= limit) return post.dek;
  return `${dek.slice(0, limit).trimEnd()}…`;
}

function PostCard({
  post,
  settings,
  variant,
  eager,
}: {
  post: Post;
  settings: BlogSettings;
  variant: "list" | "grid";
  /** First rows are above the fold: load their thumbnails immediately. */
  eager?: boolean | undefined;
}) {
  const border =
    settings.card.style === "bordered"
      ? "border border-border p-4"
      : settings.card.style === "divided"
        ? ""
        : "";
  const body = (
    <>
      <CardImage post={post} settings={settings} />
      <CardMeta
        post={post}
        settings={settings}
        showDate={variant !== "list"}
        showTags={variant === "list"}
      />
      <span className="mt-1 block font-display text-2xl leading-tight text-foreground group-hover:underline">
        <Rich text={post.title} />
      </span>
      {excerpt(post, settings) && (
        <span className="mt-2 block font-serif text-muted-foreground">
          <Rich text={excerpt(post, settings)} />
        </span>
      )}
      {settings.card.showReadTime && post.readTime && (
        <span className="mt-3 block text-sm text-link">{post.readTime}</span>
      )}
    </>
  );

  if (variant === "list") {
    return (
      <Link
        to="/blog/$slug"
        params={{ slug: post.slug }}
        className={`group grid grid-cols-[4.5rem_1fr] items-start gap-4 py-6 sm:grid-cols-[7.5rem_1fr] sm:gap-6 ${border}`}
      >
        <PostThumb post={post} eager={eager} />
        <span className="min-w-0">
          <ListMeta post={post} settings={settings} />
          <span className="mt-1 block font-display text-2xl leading-tight text-foreground group-hover:underline">
            <Rich text={post.title} />
          </span>
          {excerpt(post, settings) && (
            <span className="mt-2 block font-serif text-muted-foreground">
              <Rich text={excerpt(post, settings)} />
            </span>
          )}
          {settings.card.showReadTime && post.readTime && (
        <span className="mt-3 block text-sm text-link">{post.readTime}</span>
      )}
        </span>
      </Link>
    );
  }

  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className={`group flex h-full flex-col gap-3 ${border}`}
    >
      {body}
    </Link>
  );
}

const isImageUrl = (src?: string) => !!src && /\.(avif|webp|png|jpe?g|gif)(\?|#|$)/i.test(src);

/**
 * Small 4:3 thumbnail in the list's left column. Uses the post's thumbnail
 * (small WebP variant), else an image cover, else a quiet initial-letter tile
 * so the column stays aligned. Fixed box + width/height → no layout shift.
 */
function PostThumb({ post, eager }: { post: Post; eager?: boolean | undefined }) {
  const t = post.thumbnail;
  const src = t?.thumb || t?.src || (isImageUrl(post.cover?.src) ? post.cover?.src : undefined);
  return (
    <span className="block aspect-[4/3] w-full overflow-hidden border border-border bg-muted">
      {src ? (
        <img
          src={src}
          alt=""
          width={t?.thumbWidth ?? 240}
          height={t?.thumbHeight ?? 180}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-90"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center font-display text-3xl text-muted-foreground/70"
        >
          {plainText(post.title).trim().charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/** Tags · date in one quiet line (date in secondary type, wraps naturally). */
function ListMeta({ post, settings }: { post: Post; settings: BlogSettings }) {
  const tags = settings.card.showTags ? post.tags : [];
  const showDate = settings.card.showDate && post.date;
  const parts: ReactNode[] = tags.map((t) => <span key={`t-${t}`}>{t}</span>);
  if (showDate) {
    parts.push(
      <time key="date" dateTime={post.date}>
        {formatDate(post.date)}
      </time>,
    );
  }
  if (settings.card.showAuthor && post.author) parts.push(<span key="author">{post.author}</span>);
  if (!parts.length) return null;
  return (
    <span className="label-caps flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-muted-foreground">
      {parts.flatMap((p, i) =>
        i === 0
          ? [p]
          : [
              <span key={`sep-${i}`} aria-hidden="true">
                ·
              </span>,
              p,
            ],
      )}
    </span>
  );
}

function FeaturedCard({ post, settings }: { post: Post; settings: BlogSettings }) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className="group mt-10 block border-y border-border py-8"
    >
      <span className="label-caps text-muted-foreground">Featured</span>
      <div className="mt-4 grid gap-6 md:grid-cols-[1fr_18rem] md:items-center">
        <div>
          <span className="block font-display text-4xl leading-tight text-foreground group-hover:underline">
            <Rich text={post.title} />
          </span>
          {excerpt(post, settings) && (
            <span className="mt-3 block font-serif text-lg text-muted-foreground">
              <Rich text={excerpt(post, settings)} />
            </span>
          )}
          <span className="mt-4 block">
            <CardMeta post={post} settings={settings} />
          </span>
        </div>
        {settings.card.showImage && post.cover?.src && (
          <div
            className="overflow-hidden border border-border bg-muted"
            style={{ aspectRatio: settings.card.imageRatio }}
          >
            <img
              src={post.cover.src}
              alt={post.cover.alt ?? ""}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </Link>
  );
}
