import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { posts, site } from "@/content/site";
import { formatDate } from "@/lib/format-date";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: `Blog — ${site.name}` },
      {
        name: "description",
        content: `Essays and notes on applied AI, LLMs, retrieval and engineering by ${site.name}.`,
      },
      { property: "og:title", content: `Writing — ${site.name}` },
      { property: "og:description", content: "Essays and notes on applied AI and engineering." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <PageShell crumbs={["Blog"]} title="Writing & Notes">
      <ul className="border-t border-border">
        {sorted.map((p) => (
          <li key={p.slug} className="border-b border-border py-6">
            <Link
              to="/blog/$slug"
              params={{ slug: p.slug }}
              className="group grid gap-2 md:grid-cols-[9rem_1fr]"
            >
              <span className="label-caps pt-1 text-muted-foreground">{formatDate(p.date)}</span>
              <span>
                <span className="label-caps text-muted-foreground">{p.tags.join(" · ")}</span>
                <span className="block font-display text-3xl text-foreground group-hover:underline">
                  {p.title}
                </span>
                <span className="mt-1 block font-serif text-muted-foreground">{p.dek}</span>
                {p.readTime && <span className="mt-3 block text-sm text-link">{p.readTime}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
