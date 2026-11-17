/* eslint-disable @typescript-eslint/no-explicit-any */
// Site identity is loaded once by the root route (__root.tsx). Public route
// loaders used to request it again on every navigation; they now read it from
// the root match instead. Call this inside the loader's Promise.all so the
// page's own data fetch still starts immediately, in parallel with the root.
import type { SiteIdentity } from "@/db/schema";
import { getSiteIdentity } from "@/lib/server-fns";

export async function siteFromRoot(
  parentMatchPromise: Promise<{ loaderData?: unknown }> | undefined,
): Promise<SiteIdentity> {
  const parent = await parentMatchPromise?.catch(() => undefined);
  const site = (parent?.loaderData as { site?: SiteIdentity } | undefined)?.site;
  // Fallback keeps the old behaviour if the root data is ever unavailable.
  return site ?? ((await (getSiteIdentity as any)()) as SiteIdentity);
}
