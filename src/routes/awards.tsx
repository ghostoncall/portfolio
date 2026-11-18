/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { siteFromRoot } from "@/lib/root-data";
import { pageCopy, pageMeta } from "@/lib/site-copy";
import { getPublishedAwards } from "@/lib/server-fns";
import { AwardsView } from "@/components/public/AwardsView";

export const Route = createFileRoute("/awards")({
  loader: async ({ parentMatchPromise }) => {
    const [site, awards] = await Promise.all([
      siteFromRoot(parentMatchPromise, "awards"),
      (getPublishedAwards as any)(),
    ]);
    return { site, awards };
  },
  head: ({ loaderData }) => ({ meta: pageMeta(loaderData?.site as any, "awards") }),
  component: AwardsPage,
});

function AwardsPage() {
  const { site, awards } = Route.useLoaderData() as {
    site: any;
    awards: any;
  };
  return (
    <PageShell crumbs={[pageCopy(site, "awards").navLabel]} title={pageCopy(site, "awards").title} site={site}>
      <AwardsView awards={awards?.entries ?? []} />
    </PageShell>
  );
}
