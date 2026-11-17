/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { siteFromRoot } from "@/lib/root-data";
import { getPublishedPage } from "@/lib/server-fns";
import { ExperienceView } from "@/components/public/ExperienceView";
import { normalizePageContent } from "@/lib/cms-normalize";

export const Route = createFileRoute("/experience")({
  loader: async ({ parentMatchPromise }) => {
    const [raw, site] = await Promise.all([
      (getPublishedPage as any)({ data: { slug: "experience" } }),
      siteFromRoot(parentMatchPromise),
    ]);
    if (!raw) throw notFound();
    const content = normalizePageContent("experience", raw);
    return { content, site };
  },
  head: ({ loaderData }) => {
    const site = loaderData?.site;
    return {
      meta: [
        { title: `Experience — ${site?.name ?? "Portfolio"}` },
        {
          name: "description",
          content: "Professional experience building AI and software products.",
        },
        { property: "og:title", content: `Experience — ${site?.name ?? "Portfolio"}` },
        {
          property: "og:description",
          content: "Roles, teams and impact.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ExperiencePage,
});

function ExperiencePage() {
  const { content, site } = Route.useLoaderData() as {
    content: any;
    site: any;
  };
  return (
    <PageShell crumbs={["Experience"]} title="Experience" site={site}>
      <ExperienceView content={content} />
    </PageShell>
  );
}
