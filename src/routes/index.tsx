import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Blocks } from "@/components/blocks";
import { getPublishedPage, getPublishedProjects, getSiteIdentity } from "@/lib/server-fns";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [overviewPage, projects, site] = await Promise.all([
      (getPublishedPage as any)({ data: { slug: "overview" } }),
      (getPublishedProjects as any)(),
      (getSiteIdentity as any)(),
    ]);
    return {
      overview: overviewPage ?? { kind: "blocks", blocks: [] },
      projects,
      site,
    };
  },
  head: ({ loaderData }) => {
    const site = loaderData?.site;
    return {
      meta: [
        { title: `${site?.name ?? "Portfolio"} — ${site?.title ?? "AI Engineer"} Portfolio` },
        {
          name: "description",
          content:
            "Portfolio of an AI engineer: LLM applications, retrieval, computer vision and MLOps.",
        },
        { property: "og:title", content: `${site?.name ?? "Portfolio"} — ${site?.title ?? "AI Engineer"}` },
        { property: "og:description", content: "Selected AI projects, skills and experience." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Index,
});

function Index() {
  const { overview, projects, site } = Route.useLoaderData();
  return (
    <PageShell crumbs={["Overview"]} title={`${site?.name}, ${site?.title}`} site={site}>
      <Blocks blocks={(overview as any).blocks} />
      <h2 className="mt-12 mb-2 text-3xl text-foreground">Featured Work</h2>
      <ul className="border-t border-border">
        {projects.slice(0, 3).map((p: any) => (
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
