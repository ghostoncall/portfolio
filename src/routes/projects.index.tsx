import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { getPublishedProjects, getSiteIdentity } from "@/lib/server-fns";

export const Route = createFileRoute("/projects/")({
  loader: async () => {
    const [projects, site] = await Promise.all([
      (getPublishedProjects as any)(),
      (getSiteIdentity as any)(),
    ]);
    return { projects, site };
  },
  head: ({ loaderData }) => {
    const site = loaderData?.site;
    return {
      meta: [
        { title: `Projects — ${site?.name ?? "Portfolio"}` },
        {
          name: "description",
          content: "AI projects: LLM apps, agents, retrieval systems and computer vision.",
        },
        { property: "og:title", content: `AI Projects — ${site?.name ?? "Portfolio"}` },
        { property: "og:description", content: "A catalog of applied AI work." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Projects,
});

function Projects() {
  const { projects, site } = Route.useLoaderData();
  return (
    <PageShell crumbs={["Projects"]} title="Selected Projects" site={site}>
      <ul className="border-t border-border">
        {projects.map((p: any) => (
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
