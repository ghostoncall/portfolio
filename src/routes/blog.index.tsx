/* eslint-disable @typescript-eslint/no-explicit-any */
// /blog — Tech Blogs, the default blog section. Layout and section text come
// from Blog settings; see src/components/public/BlogListing.tsx.
import { createFileRoute } from "@tanstack/react-router";
import { siteFromRoot } from "@/lib/root-data";
import { getBlogSettings, getPublishedPosts } from "@/lib/server-fns";
import type { BlogSettings } from "@/lib/blog-settings";
import type { Post } from "@/content/site";
import { BlogSectionPage, sectionMeta } from "@/components/public/BlogListing";

export const Route = createFileRoute("/blog/")({
  loader: async ({ parentMatchPromise }) => {
    const [posts, site, settings] = await Promise.all([
      (getPublishedPosts as any)({ data: { section: "tech" } }),
      siteFromRoot(parentMatchPromise, "blog"),
      (getBlogSettings as any)(),
    ]);
    return { posts: posts as Post[], site, settings: settings as BlogSettings };
  },
  head: ({ loaderData }) => ({
    meta: sectionMeta(loaderData?.site, loaderData?.settings, "tech"),
  }),
  component: TechBlogs,
});

function TechBlogs() {
  const { posts, settings, site } = Route.useLoaderData();
  const page = Math.max(1, Number((Route.useSearch() as any).page ?? 1));
  return <BlogSectionPage section="tech" posts={posts} settings={settings} site={site} page={page} />;
}
