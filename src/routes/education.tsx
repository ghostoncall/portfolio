/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { getSiteIdentity } from "@/lib/server-fns";
import { getPublishedEducation } from "@/lib/server-fns";
import { EducationView } from "@/components/public/EducationView";

export const Route = createFileRoute("/education")({
  loader: async () => {
    const [site, education] = await Promise.all([
      (getSiteIdentity as any)(),
      (getPublishedEducation as any)(),
    ]);
    return { site, education };
  },
  head: ({ loaderData }) => {
    const site = loaderData?.site;
    return {
      meta: [
        { title: `Education — ${site?.name ?? "Portfolio"}` },
        {
          name: "description",
          content:
            "Academic qualifications, degrees, coursework, research interests, and scholarly achievements.",
        },
        { property: "og:title", content: `Education — ${site?.name ?? "Portfolio"}` },
        {
          property: "og:description",
          content:
            "Academic qualifications, degrees, coursework, research interests, and scholarly achievements.",
        },
      ],
    };
  },
  component: EducationPage,
});

function EducationPage() {
  const { site, education } = Route.useLoaderData() as { site: any; education: any };
  return (
    <PageShell crumbs={["Education"]} title="Education" site={site}>
      <EducationView content={education ?? { kind: "education", entries: [] }} />
    </PageShell>
  );
}
