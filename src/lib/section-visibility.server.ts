import { inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { settings, type SiteIdentity } from "@/db/schema";
import { PUBLIC_PAGE_SLUGS, type PublicPageSlug } from "@/lib/site-copy";
import { sectionSettingsId, visibilityFromRows } from "@/lib/section-visibility";

export async function readSectionVisibility() {
  const rows = await getDb()
    .select({ id: settings.id, published: settings.published })
    .from(settings)
    .where(inArray(settings.id, PUBLIC_PAGE_SLUGS.map(sectionSettingsId)));
  return visibilityFromRows(rows);
}

/** Atomic flag-only upsert: no content, labels, PDF metadata or other flags are replaced. */
export async function writeSectionVisibility(section: PublicPageSlug, visible: boolean) {
  const initial = {
    ...(section === "resume" ? { current: null } : {}),
    visible,
  } as unknown as SiteIdentity;
  const now = new Date();
  await getDb()
    .insert(settings)
    .values({ id: sectionSettingsId(section), staged: initial, published: initial, updatedAt: now })
    .onConflictDoUpdate({
      target: settings.id,
      set: {
        staged: sql`jsonb_set(coalesce(${settings.staged}, '{}'::jsonb), '{visible}', ${JSON.stringify(visible)}::jsonb)`,
        published: sql`jsonb_set(coalesce(${settings.published}, '{}'::jsonb), '{visible}', ${JSON.stringify(visible)}::jsonb)`,
        updatedAt: now,
      },
    });
}
