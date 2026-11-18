/* eslint-disable @typescript-eslint/no-explicit-any */
// Site identity is loaded once by the root route (__root.tsx). Public route
// loaders used to request it again on every navigation; they now read it from
// the root match instead. Call this inside the loader's Promise.all so the
// page's own data fetch still starts immediately, in parallel with the root.
import type { SiteIdentity } from "@/db/schema";
import { getSiteIdentity } from "@/lib/server-fns";
import { notFound, redirect } from "@tanstack/react-router";
import type { PublicPageSlug } from "@/lib/site-copy";
import { sectionVisible, type SectionVisibility } from "@/lib/section-visibility";
import { buildNav } from "@/components/site-nav";

export async function siteFromRoot(
  parentMatchPromise: Promise<{ loaderData?: unknown }> | undefined,
  section?: PublicPageSlug,
): Promise<SiteIdentity> {
  const parent = await parentMatchPromise?.catch(() => undefined);
  const data = parent?.loaderData as
    | {
        site?: SiteIdentity;
        sectionVisibility?: SectionVisibility;
        navOrder?: string[];
      }
    | undefined;
  const site = data?.site;
  if (section && !sectionVisible(data?.sectionVisibility, section)) {
    if (section === "overview") {
      const landing = buildNav(site, data?.navOrder, [], true, data?.sectionVisibility)[0];
      if (landing) throw redirect({ to: landing.to });
    }
    throw notFound({ routeId: "__root__" });
  }
  // Fallback keeps the old behaviour if the root data is ever unavailable.
  return site ?? ((await (getSiteIdentity as any)()) as SiteIdentity);
}
