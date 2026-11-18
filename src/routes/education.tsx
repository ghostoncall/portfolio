/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { siteFromRoot } from "@/lib/root-data";
import { pageCopy, pageMeta } from "@/lib/site-copy";
import { getPublishedEducation } from "@/lib/server-fns";
import { EducationView } from "@/components/public/EducationView";

export const Route = createFileRoute("/education")({
  loader: async ({ parentMatchPromise }) => {
    const [site, education] = await Promise.all([
      siteFromRoot(parentMatchPromise, "education"),
      (getPublishedEducation as any)(),
    ]);
    return { site, education };
  },
  head: ({ loaderData }) => ({ meta: pageMeta(loaderData?.site as any, "education") }),
  component: EducationPage,
});

function EducationPage() {
  const { site, education } = Route.useLoaderData() as { site: any; education: any };
  return (
    <PageShell crumbs={[pageCopy(site, "education").navLabel]} title={pageCopy(site, "education").title} site={site}>
      <EducationView content={education ?? { kind: "education", entries: [] }} />
    </PageShell>
  );
}
