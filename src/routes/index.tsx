/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { siteFromRoot } from "@/lib/root-data";
import { OverviewView } from "@/components/public/OverviewView";
import { getPublishedPage, getPublishedProjects } from "@/lib/server-fns";
import { copyText, pageCopy, pageMeta, safeImageSrc } from "@/lib/site-copy";
import { overviewProjectCatalog, type BlocksPage } from "@/lib/featured-projects";

export const Route = createFileRoute("/")({
  loader: async ({ parentMatchPromise }) => {
    const [overviewPage, projects, site] = await Promise.all([
      (getPublishedPage as any)({ data: { slug: "overview" } }),
      (getPublishedProjects as any)(),
      siteFromRoot(parentMatchPromise, "overview"),
    ]);
    const overview = (overviewPage ?? { kind: "blocks", blocks: [] }) as BlocksPage;
    const overviewProjects = overviewProjectCatalog(overview, projects, site);
    return {
      overview,
      featured: overviewProjects,
      projects: overviewProjects,
      site,
    };
  },
  head: ({ loaderData }) => ({ meta: pageMeta(loaderData?.site, "overview") }),
  component: Index,
});

function Index() {
  const { overview, featured, projects, site } = Route.useLoaderData();
  const { title } = pageCopy(site, "overview");
  // Default is a 400×400 WebP (2× the 200px display size); Settings can
  // replace it or clear it to show no photo.
  const photo = safeImageSrc(copyText(site, "profileImage"));
  return (
    <PageShell
      crumbs={[pageCopy(site, "overview").navLabel]}
      title={title}
      site={site}
      profileImage={photo || undefined}
      profileAlt={copyText(site, "profileAlt") || undefined}
    >
      <OverviewView
        blocks={(overview as any).blocks}
        featured={featured}
        projects={projects}
        site={site}
        featuredWorkManaged={(overview as any).featuredWorkManaged === true}
      />
    </PageShell>
  );
}
