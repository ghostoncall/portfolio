/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { getSiteIdentity } from "@/lib/server-fns";
import { getPublishedSkillsBundle } from "@/lib/server-fns";
import { SkillsCertificatesAwardsView } from "@/components/public/SkillsCertificatesAwardsView";

export const Route = createFileRoute("/skills")({
  loader: async () => {
    const [site, bundle] = await Promise.all([
      (getSiteIdentity as any)(),
      (getPublishedSkillsBundle as any)(),
    ]);
    return { site, bundle };
  },
  head: ({ loaderData }) => {
    const site = loaderData?.site;
    return {
      meta: [
        { title: `Skills & Certificates — ${site?.name ?? "Portfolio"}` },
        {
          name: "description",
          content:
            "AI and engineering skills: LLMs, agents, RAG, deep learning, MLOps, plus certificates and awards.",
        },
        { property: "og:title", content: `Skills — ${site?.name ?? "Portfolio"}` },
        {
          property: "og:description",
          content: "Technical skills, certifications and awards in AI engineering.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: SkillsPage,
});

function SkillsPage() {
  const { site, bundle } = Route.useLoaderData() as {
    site: any;
    bundle: { skills: any; certificates: any; awards: any };
  };
  return (
    <PageShell crumbs={["Skills & Certificates"]} title="Skills & Certificates" site={site}>
      <SkillsCertificatesAwardsView
        skills={bundle.skills?.skills ?? []}
        certificates={bundle.certificates?.certificates ?? []}
        awards={bundle.awards?.entries ?? []}
      />
    </PageShell>
  );
}
