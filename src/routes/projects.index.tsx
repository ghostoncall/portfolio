import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { projects, site } from "@/content/site";

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [
      { title: `Projects — ${site.name}` },
      {
        name: "description",
        content: "AI projects: LLM apps, agents, retrieval systems and computer vision.",
      },
      { property: "og:title", content: `AI Projects — ${site.name}` },
      { property: "og:description", content: "A catalog of applied AI work." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Projects,
});

function Projects() {
  return (
    <PageShell crumbs={["Projects"]} title="Selected Projects">
      <ul className="border-t border-border">
        {projects.map((p) => (
          <li key={p.slug} className="border-b border-border py-6">
            <Link
              to="/projects/$slug"
              params={{ slug: p.slug }}
              className="group grid gap-2 md:grid-cols-[6rem_1fr]"
            >
              <span className="label-caps pt-1 text-muted-foreground">{p.year}</span>
              <span>
                <span className="label-caps text-muted-foreground">{p.category}</span>
                <span className="block font-display text-3xl text-foreground group-hover:underline">
                  {p.title}
                </span>
                <span className="mt-1 block font-serif text-muted-foreground">{p.dek}</span>
                <span className="mt-3 block text-sm text-link">{p.stack.join(" · ")}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
