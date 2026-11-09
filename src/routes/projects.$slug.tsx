import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Blocks } from "@/components/blocks";
import { getPublishedProject, getSiteIdentity } from "@/lib/server-fns";

export const Route = createFileRoute("/projects/$slug")({
  loader: async ({ params }) => {
    const [project, site] = await Promise.all([
      (getPublishedProject as any)({ data: { slug: params.slug } }),
      (getSiteIdentity as any)(),
    ]);
    if (!project) throw notFound();
    return { project, site };
  },
  head: ({ loaderData }) => {
    const { project, site } = loaderData || {};
    return {
      meta: project
        ? [
            { title: `${project.title} — ${site?.name ?? "Portfolio"}` },
            { name: "description", content: project.dek },
            { property: "og:title", content: project.title },
            { property: "og:description", content: project.dek },
            { property: "og:type", content: "article" },
            { name: "twitter:card", content: "summary_large_image" },
          ]
        : [{ title: "Project not found" }, { name: "robots", content: "noindex" }],
    };
  },
  notFoundComponent: () => (
    <PageShell crumbs={["Projects"]} title="Project not found">
      <Link to="/projects" className="text-link hover:underline">
        Back to projects
      </Link>
    </PageShell>
  ),
  component: ProjectPage,
});

function ProjectPage() {
  const { project, site } = Route.useLoaderData();
  return (
    <PageShell crumbs={["Projects", project.title]} title={project.title}>
      <p className="font-serif text-xl italic text-muted-foreground">{project.dek}</p>
      <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-border py-4 text-sm md:grid-cols-3">
        <div>
          <dt className="label-caps text-muted-foreground">Year</dt>
          <dd>{project.year}</dd>
        </div>
        <div>
          <dt className="label-caps text-muted-foreground">Category</dt>
          <dd>{project.category}</dd>
        </div>
        <div className="col-span-2 md:col-span-1">
          <dt className="label-caps text-muted-foreground">Stack</dt>
          <dd>{project.stack.join(", ")}</dd>
        </div>
      </dl>
      <Blocks blocks={project.blocks} />
    </PageShell>
  );
}
