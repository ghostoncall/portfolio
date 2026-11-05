import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Blocks } from "@/components/blocks";
import { projects, site } from "@/content/site";

export const Route = createFileRoute("/projects/$slug")({
  loader: ({ params }) => {
    const project = projects.find((p) => p.slug === params.slug);
    if (!project) throw notFound();
    return project;
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
      : [{ title: "Project not found" }, { name: "robots", content: "noindex" }],
  }),
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
  const p = Route.useLoaderData();
  return (
    <PageShell crumbs={["Projects", p.title]} title={p.title}>
      <p className="font-serif text-xl italic text-muted-foreground">{p.dek}</p>
      <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-border py-4 text-sm md:grid-cols-3">
        <div>
          <dt className="label-caps text-muted-foreground">Year</dt>
          <dd>{p.year}</dd>
        </div>
        <div>
          <dt className="label-caps text-muted-foreground">Category</dt>
          <dd>{p.category}</dd>
        </div>
        <div className="col-span-2 md:col-span-1">
          <dt className="label-caps text-muted-foreground">Stack</dt>
          <dd>{p.stack.join(", ")}</dd>
        </div>
      </dl>
      <Blocks blocks={p.blocks} />
    </PageShell>
  );
}
