/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { siteFromRoot } from "@/lib/root-data";
import { pageCopy, pageMeta } from "@/lib/site-copy";
import { getPublishedPage } from "@/lib/server-fns";
import { ExperienceView } from "@/components/public/ExperienceView";
import { normalizePageContent } from "@/lib/cms-normalize";

export const Route = createFileRoute("/experience")({
  loader: async ({ parentMatchPromise }) => {
    const [raw, site] = await Promise.all([
      (getPublishedPage as any)({ data: { slug: "experience" } }),
      siteFromRoot(parentMatchPromise, "experience"),
    ]);
    if (!raw) throw notFound();
    const content = normalizePageContent("experience", raw);
    return { content, site };
  },
  head: ({ loaderData }) => ({ meta: pageMeta(loaderData?.site as any, "experience") }),
  component: ExperiencePage,
});

function ExperiencePage() {
  const { content, site } = Route.useLoaderData() as {
    content: any;
    site: any;
  };
  return (
    <PageShell crumbs={[pageCopy(site, "experience").navLabel]} title={pageCopy(site, "experience").title} site={site}>
      <ExperienceView content={content} />
    </PageShell>
  );
}
