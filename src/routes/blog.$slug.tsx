/* eslint-disable @typescript-eslint/no-explicit-any */
// Public blog post page.
import type { CSSProperties } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { siteFromRoot } from "@/lib/root-data";
import { BlogRenderer } from "@/components/admin/BlogRenderer";
import { getBlogSettings, getPublishedPost } from "@/lib/server-fns";
import { blogThemeVars } from "@/lib/blog-settings";
import { formatDate } from "@/lib/format-date";
import { plainText } from "@/lib/rich-inline";
import { getRouteApi } from "@tanstack/react-router";
import { sectionOf, sectionPath } from "@/lib/blog-sections";
import type { BlogSettings } from "@/lib/blog-settings";

const rootApi = getRouteApi("__root__");
const sectionButtonClassName =
  "inline-flex min-h-[48px] items-center border border-foreground/60 px-5 font-semibold text-foreground transition-colors hover:bg-muted";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params, parentMatchPromise }) => {
    const [post, site, settings] = await Promise.all([
      (getPublishedPost as any)({ data: { slug: params.slug } }),
      siteFromRoot(parentMatchPromise, "blog"),
      (getBlogSettings as any)(),
    ]);
    if (!post) throw notFound();
    // A post in a hidden section is hidden too.
    if (!(settings as BlogSettings).sections[sectionOf(post)].visible) throw notFound();
    return { post, site, settings };
  },
  head: ({ loaderData }) => {
    const { post, site } = loaderData || {};
    if (!post) {
      return { meta: [{ title: "Post not found" }, { name: "robots", content: "noindex" }] };
    }
    const title = plainText(post.seo?.title || post.title);
    const description = plainText(post.seo?.description || post.dek || "");
    const image = post.seo?.socialImage || post.cover?.src || "";
    const canonical = post.seo?.canonical || "";
    const unlisted = post.visibility === "unlisted";

    return {
      meta: [
        { title: `${title} — ${site?.name ?? "Portfolio"}` },
        { name: "description", content: description },
        ...(unlisted ? [{ name: "robots", content: "noindex, follow" }] : []),
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "article:published_time", content: post.date },
        ...(image ? [{ property: "og:image", content: image }] : []),
        ...(canonical ? [{ property: "og:url", content: canonical }] : []),
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        ...(image ? [{ name: "twitter:image", content: image }] : []),
      ],
      links: canonical ? [{ rel: "canonical", href: canonical }] : [],
    };
  },
  notFoundComponent: () => {
    // The article's own loader data doesn't exist when it 404s; use the root's.
    const { site } = rootApi.useLoaderData() as { site: any };
    return (
      <PageShell crumbs={["Blog"]} title="Post not found" site={site}>
        <p className="font-serif text-lg text-muted-foreground">
          This article may have moved or been taken down.
        </p>
        <Link
          to="/blog"
          className="mt-6 inline-flex min-h-[48px] items-center border border-foreground/60 px-5 font-semibold hover:bg-muted"
        >
          ← Back to the blog
        </Link>
      </PageShell>
    );
  },
  component: PostPage,
});

function PostPage() {
  const { post, site, settings } = Route.useLoaderData();
  const vars = blogThemeVars(settings) as CSSProperties;
  const sectionId = sectionOf(post);
  const section = (settings as BlogSettings).sections[sectionId];
  const sectionName = plainText(section.name);

  // Back link goes to the section the article belongs to; if the visitor came
  // from a page of that listing, the browser's own back keeps their place.
  return (
    <div style={vars} className="blog-theme">
      <PageShell crumbs={[sectionName, plainText(post.title)]} title={post.title} site={site}>
        <Link to={sectionPath(sectionId)} className={`mb-6 ${sectionButtonClassName}`}>
          ← Back to {sectionName}
        </Link>
        <BlogRenderer post={post} themeVars={vars} sectionName={sectionName} />
        <Link to={sectionPath(sectionId)} className={`mt-12 ${sectionButtonClassName}`}>
          ← More from {sectionName}
        </Link>
      </PageShell>
    </div>
  );
}
