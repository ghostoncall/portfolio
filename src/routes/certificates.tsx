/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { siteFromRoot } from "@/lib/root-data";
import { pageCopy, pageMeta } from "@/lib/site-copy";
import { getPublishedCertificates } from "@/lib/server-fns";
import { CertificatesView } from "@/components/public/CertificatesView";

export const Route = createFileRoute("/certificates")({
  loader: async ({ parentMatchPromise }) => {
    const [site, certificates] = await Promise.all([
      siteFromRoot(parentMatchPromise, "certificates"),
      (getPublishedCertificates as any)(),
    ]);
    return { site, certificates };
  },
  head: ({ loaderData }) => ({ meta: pageMeta(loaderData?.site as any, "certificates") }),
  component: CertificatesPage,
});

function CertificatesPage() {
  const { site, certificates } = Route.useLoaderData() as {
    site: any;
    certificates: any;
  };
  return (
    <PageShell crumbs={[pageCopy(site, "certificates").navLabel]} title={pageCopy(site, "certificates").title} site={site}>
      <CertificatesView certificates={certificates?.certificates ?? []} />
    </PageShell>
  );
}
