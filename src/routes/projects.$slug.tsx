/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { siteFromRoot } from "@/lib/root-data";
import { getPublishedProject, getPublishedSkillsBundle } from "@/lib/server-fns";
import { ProjectView } from "@/components/public/ProjectView";
import { plainText } from "@/lib/rich-inline";

export const Route = createFileRoute("/projects/$slug")({
  loader: async ({ params, parentMatchPromise }) => {
    const [project, skillsBundle, site] = await Promise.all([
      (getPublishedProject as any)({ data: { slug: params.slug } }),
      (getPublishedSkillsBundle as any)(),
      siteFromRoot(parentMatchPromise, "projects"),
    ]);
    if (!project) throw notFound();
    return { project, skills: skillsBundle.skills.skills, site };
  },
  head: ({ loaderData }) => {
    const { project, site } = loaderData || {};
    return {
      meta: project
        ? [
            { title: `${plainText(project.title)} — ${plainText(site?.name ?? "Portfolio")}` },
            { name: "description", content: plainText(project.dek) },
            { property: "og:title", content: plainText(project.title) },
            { property: "og:description", content: plainText(project.dek) },
            { property: "og:type", content: "article" },
            { name: "twitter:card", content: "summary_large_image" },
          ]
        : [{ title: "Project not found" }, { name: "robots", content: "noindex" }],
    };
  },
  notFoundComponent: ProjectNotFound,
  component: ProjectPage,
});

function ProjectNotFound() {
  const { site } = (Route.useLoaderData() as { site: any } | null) || {};
  return (
    <PageShell crumbs={["Projects"]} title="Project not found" site={site}>
      <Link to="/projects" className="text-link hover:underline">
        Back to projects
      </Link>
    </PageShell>
  );
}

function ProjectPage() {
  const { project, skills, site } = Route.useLoaderData() as {
    project: any;
    skills: any[];
    site: any;
  };
  return (
    <PageShell crumbs={["Projects", plainText(project.title)]} title={project.title} site={site}>
      <ProjectView project={project} skills={skills} />
    </PageShell>
  );
}
