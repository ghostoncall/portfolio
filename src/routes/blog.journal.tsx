/* eslint-disable @typescript-eslint/no-explicit-any */
// /blog/journal — My Journal. Same listing as Tech Blogs, its own posts and
// section text (Blog settings → Sections). Hidden in the admin → 404 here.
import { createFileRoute, notFound } from "@tanstack/react-router";
import { siteFromRoot } from "@/lib/root-data";
import { getBlogSettings, getPublishedPosts } from "@/lib/server-fns";
import type { BlogSettings } from "@/lib/blog-settings";
import type { Post } from "@/content/site";
import { BlogSectionPage, sectionMeta } from "@/components/public/BlogListing";

export const Route = createFileRoute("/blog/journal")({
  loader: async ({ parentMatchPromise }) => {
    const [posts, site, settings] = await Promise.all([
      (getPublishedPosts as any)({ data: { section: "journal" } }),
      siteFromRoot(parentMatchPromise, "blog"),
      (getBlogSettings as any)(),
    ]);
    if (!(settings as BlogSettings).sections.journal.visible) throw notFound();
    return { posts: posts as Post[], site, settings: settings as BlogSettings };
  },
  head: ({ loaderData }) => ({
    meta: sectionMeta(loaderData?.site, loaderData?.settings, "journal"),
  }),
  component: Journal,
});

function Journal() {
  const { posts, settings, site } = Route.useLoaderData();
  const page = Math.max(1, Number((Route.useSearch() as any).page ?? 1));
  return (
    <BlogSectionPage section="journal" posts={posts} settings={settings} site={site} page={page} />
  );
}
