// Sitemap for the public website.
// Public: no auth required. Includes all publicly accessible pages.
import { defineEventHandler } from "h3";
import { getDb } from "../../src/db/client";
import { getEnv } from "../../src/lib/runtime-config";
import { pages, posts, projects, settings } from "../../src/db/schema";
import { and, eq, isNull, lte, or } from "drizzle-orm";

const SITE_NAME = "Aryan Mehndiratta";

export default defineEventHandler(async () => {
  const db = getDb();
  const now = new Date();

  // Get site URL from env
  const siteUrl = getEnv("VITE_SITE_URL") || "https://example.com";

  // Get site identity for lastmod reference
  const siteRow = await db
    .select({ published: settings.published, updatedAt: settings.updatedAt })
    .from(settings)
    .where(eq(settings.id, "site"))
    .limit(1);
  const siteUpdatedAt = siteRow[0]?.updatedAt ?? now;

  const siteLastMod = new Date(siteUpdatedAt ?? Date.now()).toISOString();

  // Core public pages
  const corePages = [
    { url: `${siteUrl}/`, updated: siteLastMod },
    { url: `${siteUrl}/skills`, updated: siteLastMod },
    { url: `${siteUrl}/experience`, updated: siteLastMod },
    { url: `${siteUrl}/projects/`, updated: siteLastMod },
    { url: `${siteUrl}/certificates`, updated: siteLastMod },
    { url: `${siteUrl}/contact`, updated: siteLastMod },
    { url: `${siteUrl}/volunteering`, updated: siteLastMod },
    { url: `${siteUrl}/blog`, updated: siteLastMod },
  ];

  // Published blog posts
  const postRows = await db
    .select({ slug: posts.slug, updatedAt: posts.updatedAt })
    .from(posts)
    .where(
      and(eq(posts.isPublic, true), or(isNull(posts.publishedAt), lte(posts.publishedAt, now))),
    )
    .orderBy(posts.updatedAt);

  const blogItems = postRows.map((r) => ({
    url: `${siteUrl}/blog/${r.slug}`,
    updated: new Date(r.updatedAt ?? Date.now()).toISOString(),
  }));

  // Published projects
  const projectRows = await db
    .select({ slug: projects.slug, updatedAt: projects.updatedAt })
    .from(projects)
    .where(eq(projects.isPublic, true))
    .orderBy(projects.updatedAt);

  const projectItems = projectRows.map((r) => ({
    url: `${siteUrl}/projects/${r.slug}`,
    updated: new Date(r.updatedAt ?? Date.now()).toISOString(),
  }));

  // Published pages (skills, experience, certificates, volunteering)
  const pageRows = await db
    .select({ slug: pages.slug, updatedAt: pages.updatedAt })
    .from(pages)
    .orderBy(pages.updatedAt);

  const pageItems = pageRows.map((r) => ({
    url: `${siteUrl}/${r.slug}`,
    updated: new Date(r.updatedAt ?? Date.now()).toISOString(),
  }));

  const allPages = [...corePages, ...blogItems, ...projectItems, ...pageItems];

  // Deduplicate by URL
  const seen = new Set<string>();
  const uniquePages = allPages.filter((p) => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });

  const urls = uniquePages
    .map(
      (p) => `<url>
  <loc>${escapeXml(p.url)}</loc>
  <lastmod>${p.updated}</lastmod>
</url>`,
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
});

function escapeXml(value: string | undefined | null): string {
  if (!value) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
