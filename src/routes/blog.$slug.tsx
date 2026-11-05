import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Blocks } from "@/components/blocks";
import { Media } from "@/components/media";
import { posts, site } from "@/content/site";
import { formatDate } from "@/lib/format-date";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = posts.find((p) => p.slug === params.slug);
    if (!post) throw notFound();
    return post;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} — ${site.name}` },
          { name: "description", content: loaderData.dek },
          { property: "og:title", content: loaderData.title },
          { property: "og:description", content: loaderData.dek },
          { property: "og:type", content: "article" },
          { name: "twitter:card", content: "summary_large_image" },
        ]
      : [{ title: "Post not found" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: () => (
    <PageShell crumbs={["Blog"]} title="Post not found">
      <Link to="/blog" className="text-link hover:underline">
        Back to the blog
      </Link>
    </PageShell>
  ),
  component: PostPage,
});

function PostPage() {
  const p = Route.useLoaderData();
  return (
    <PageShell crumbs={["Blog", p.title]} title={p.title}>
      <p className="font-serif text-xl italic text-muted-foreground">{p.dek}</p>
      <p className="label-caps mt-6 border-y border-border py-3 text-muted-foreground">
        By {site.name} · {formatDate(p.date)}
        {p.readTime ? ` · ${p.readTime}` : ""}
        {p.tags.length ? ` · ${p.tags.join(", ")}` : ""}
      </p>
      {p.cover && <Media items={[p.cover]} />}
      <Blocks blocks={p.blocks} />
      <Link to="/blog" className="label-caps mt-12 inline-block text-link hover:underline">
        ← All posts
      </Link>
    </PageShell>
  );
}
