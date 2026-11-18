/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { siteFromRoot } from "@/lib/root-data";
import { pageCopy, pageMeta } from "@/lib/site-copy";
import { getPublishedSkills } from "@/lib/server-fns";
import { SkillsView } from "@/components/public/SkillsView";

export const Route = createFileRoute("/skills")({
  loader: async ({ parentMatchPromise }) => {
    const [site, skills] = await Promise.all([
      siteFromRoot(parentMatchPromise, "skills"),
      (getPublishedSkills as any)(),
    ]);
    return { site, skills };
  },
  head: ({ loaderData }) => ({ meta: pageMeta(loaderData?.site as any, "skills") }),
  component: SkillsPage,
});

function SkillsPage() {
  const { site, skills } = Route.useLoaderData() as {
    site: any;
    skills: any;
  };
  return (
    <PageShell crumbs={[pageCopy(site, "skills").navLabel]} title={pageCopy(site, "skills").title} site={site}>
      <SkillsView skills={skills?.skills ?? []} categories={skills?.categories ?? []} />
    </PageShell>
  );
}
