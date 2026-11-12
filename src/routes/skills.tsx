/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { getSiteIdentity } from "@/lib/server-fns";
import { getPublishedSkills } from "@/lib/server-fns";
import { SkillsView } from "@/components/public/SkillsView";

export const Route = createFileRoute("/skills")({
  loader: async () => {
    const [site, skills] = await Promise.all([
      (getSiteIdentity as any)(),
      (getPublishedSkills as any)(),
    ]);
    return { site, skills };
  },
  head: ({ loaderData }) => {
    const site = loaderData?.site;
    return {
      meta: [
        { title: `Skills — ${site?.name ?? "Portfolio"}` },
        {
          name: "description",
          content:
            "Technical skills in AI engineering: LLMs, agents, RAG, deep learning, MLOps, and more.",
        },
        { property: "og:title", content: `Skills — ${site?.name ?? "Portfolio"}` },
        {
          property: "og:description",
          content: "Technical skills in AI engineering.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: SkillsPage,
});

function SkillsPage() {
  const { site, skills } = Route.useLoaderData() as {
    site: any;
    skills: any;
  };
  return (
    <PageShell crumbs={["Skills"]} title="Skills" site={site}>
      <SkillsView skills={skills?.skills ?? []} />
    </PageShell>
  );
}
