import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Blocks } from "@/components/blocks";
import { overview, projects, site } from "@/content/site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${site.name} — ${site.title} Portfolio` },
      {
        name: "description",
        content:
          "Portfolio of an AI engineer: LLM applications, retrieval, computer vision and MLOps.",
      },
      { property: "og:title", content: `${site.name} — ${site.title}` },
      { property: "og:description", content: "Selected AI projects, skills and experience." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <PageShell crumbs={["Overview"]} title={`${site.name}, ${site.title}`}>
      <Blocks blocks={overview} />
      <h2 className="mt-12 mb-2 text-3xl text-foreground">Featured Work</h2>
      <ul>
        {projects.slice(0, 3).map((p) => (
          <li key={p.slug} className="border-b border-border py-5">
            <Link to="/projects/$slug" params={{ slug: p.slug }} className="group block">
              <span className="label-caps text-muted-foreground">
                {p.category} · {p.year}
              </span>
              <span className="block font-serif text-xl text-foreground group-hover:underline">
                {p.title}
              </span>
              <span className="text-muted-foreground">{p.dek}</span>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
