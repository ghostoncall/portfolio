/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { siteFromRoot } from "@/lib/root-data";
import { pageCopy, pageMeta } from "@/lib/site-copy";
import { getPublishedProjects } from "@/lib/server-fns";
import { ProjectSummary } from "@/components/public/ProjectSummary";

export const Route = createFileRoute("/projects/")({
  loader: async ({ parentMatchPromise }) => {
    const [projects, site] = await Promise.all([
      (getPublishedProjects as any)(),
      siteFromRoot(parentMatchPromise, "projects"),
    ]);
    return { projects, site };
  },
  head: ({ loaderData }) => ({ meta: pageMeta(loaderData?.site as any, "projects") }),
  component: Projects,
});

function Projects() {
  const { projects, site } = Route.useLoaderData();
  const visible = (projects as any[]).filter((p) => p.status !== "archived");
  return (
    <PageShell crumbs={[pageCopy(site, "projects").navLabel]} title={pageCopy(site, "projects").title} site={site}>
      <ul className="border-t border-border">
        {visible.map((p) => (
          <li key={p.slug} className="border-b border-border py-6">
            <ProjectSummary project={p} />
          </li>
        ))}
        {visible.length === 0 && (
          <li className="border-b border-border py-6 text-center text-muted-foreground">
            No projects to display.
          </li>
        )}
      </ul>
    </PageShell>
  );
}
