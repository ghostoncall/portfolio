import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Blocks } from "@/components/blocks";
import { experience } from "@/content/site";
import { getSiteIdentity } from "@/lib/server-fns";

export const Route = createFileRoute("/experience")({
  loader: async () => {
    const site = await (getSiteIdentity as any)();
    return { site };
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
        { property: "og:description", content: "Roles, teams and impact." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Experience,
});

function Experience() {
  const { site } = Route.useLoaderData() as { site: any };
  return (
    <PageShell crumbs={["Experience"]} title="Experience" site={site}>
      {experience.map((e) => (
        <section key={e.role + e.org} className="border-b border-border py-6 first:pt-0">
          <span className="label-caps text-muted-foreground">{e.period}</span>
          <h2 className="text-3xl text-foreground">{e.role}</h2>
          <p className="font-serif italic text-muted-foreground">{e.org}</p>
          <Blocks blocks={e.blocks} />
        </section>
      ))}
    </PageShell>
  );
}
