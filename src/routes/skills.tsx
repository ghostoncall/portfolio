import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Blocks } from "@/components/blocks";
import { certificates, skills } from "@/content/site";
import { getSiteIdentity } from "@/lib/server-fns";

export const Route = createFileRoute("/skills")({
  loader: async () => {
    const site = await (getSiteIdentity as any)();
    return { site };
  },
  head: ({ loaderData }) => {
    const site = loaderData?.site;
    return {
      meta: [
        { title: `Skills & Certificates — ${site?.name ?? "Portfolio"}` },
        {
          name: "description",
          content:
            "AI and engineering skills: LLMs, agents, RAG, deep learning, MLOps, plus certificates.",
        },
        { property: "og:title", content: `Skills — ${site?.name ?? "Portfolio"}` },
        {
          property: "og:description",
          content: "Technical skills and certifications in AI engineering.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Skills,
});

function Skills() {
  const { site } = Route.useLoaderData() as { site: any };
  return (
    <PageShell crumbs={["Skills & Certificates"]} title="Skills & Requirements" site={site}>
      {skills.map((g) => (
        <section key={g.group} className="mb-10">
          <h2 className="mb-3 text-3xl text-foreground">{g.group}</h2>
          <table className="w-full border-t border-border text-left">
            <tbody>
              {g.items.map((i) => (
                <tr key={i.name} className="border-b border-border">
                  <td className="w-1/3 py-3 pr-4 font-serif text-foreground">{i.name}</td>
                  <td className="py-3 text-muted-foreground">{i.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <h2 className="mt-12 mb-3 text-3xl text-foreground">Certificates</h2>
      <Blocks blocks={certificates} />
    </PageShell>
  );
}
