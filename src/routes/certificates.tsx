/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { siteFromRoot } from "@/lib/root-data";
import { getPublishedCertificates } from "@/lib/server-fns";
import { CertificatesView } from "@/components/public/CertificatesView";

export const Route = createFileRoute("/certificates")({
  loader: async ({ parentMatchPromise }) => {
    const [site, certificates] = await Promise.all([
      siteFromRoot(parentMatchPromise),
      (getPublishedCertificates as any)(),
    ]);
    return { site, certificates };
  },
  head: ({ loaderData }) => {
    const site = loaderData?.site;
    return {
      meta: [
        { title: `Certificates — ${site?.name ?? "Portfolio"}` },
        {
          name: "description",
          content: "Certifications and credentials in AI engineering and related fields.",
        },
        { property: "og:title", content: `Certificates — ${site?.name ?? "Portfolio"}` },
        {
          property: "og:description",
          content: "Certifications and credentials in AI engineering.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: CertificatesPage,
});

function CertificatesPage() {
  const { site, certificates } = Route.useLoaderData() as {
    site: any;
    certificates: any;
  };
  return (
    <PageShell crumbs={["Certificates"]} title="Certificates" site={site}>
      <CertificatesView certificates={certificates?.certificates ?? []} />
    </PageShell>
  );
}
