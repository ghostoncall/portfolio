/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { getSiteIdentity } from "@/lib/server-fns";
import { getPublishedAwards } from "@/lib/server-fns";
import { AwardsView } from "@/components/public/AwardsView";

export const Route = createFileRoute("/awards")({
  loader: async () => {
    const [site, awards] = await Promise.all([
      (getSiteIdentity as any)(),
      (getPublishedAwards as any)(),
    ]);
    return { site, awards };
  },
  head: ({ loaderData }) => {
    const site = loaderData?.site;
    return {
      meta: [
        { title: `Awards & Recognitions — ${site?.name ?? "Portfolio"}` },
        {
          name: "description",
          content: "Academic awards, scholarships, honours, and competition recognitions.",
        },
        {
          property: "og:title",
          content: `Awards & Recognitions — ${site?.name ?? "Portfolio"}`,
        },
        {
          property: "og:description",
          content: "Academic awards and recognitions.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: AwardsPage,
});

function AwardsPage() {
  const { site, awards } = Route.useLoaderData() as {
    site: any;
    awards: any;
  };
  return (
    <PageShell crumbs={["Awards & Recognitions"]} title="Awards & Recognitions" site={site}>
      <AwardsView awards={awards?.entries ?? []} />
    </PageShell>
  );
}
