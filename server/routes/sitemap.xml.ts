// Sitemap for the public website.
// Public: no auth required. Includes all publicly accessible pages.
import { defineEventHandler } from "h3";
import { getDb } from "../../src/db/client";
import { getEnv } from "../../src/lib/runtime-config";
import { pages, posts, projects, settings } from "../../src/db/schema";
import { and, eq, isNull, lte, ne, or } from "drizzle-orm";

const SITE_NAME = "Aryan Mehndiratta";

export default defineEventHandler(async () => {
  const db = getDb();
  const now = new Date();

  // Get site URL from env
  const siteUrl = getEnv("VITE_SITE_URL") || "https://example.com";

  // Independent queries — run them concurrently rather than back-to-back.
  const [siteRow, postRows, projectRows, pageRows] = await Promise.all([
    // Site identity for lastmod reference
    db
      .select({ updatedAt: settings.updatedAt })
      .from(settings)
      .where(eq(settings.id, "site"))
      .limit(1),
    // Published blog posts
    db
      .select({ slug: posts.slug, updatedAt: posts.updatedAt })
      .from(posts)
      .where(
        and(eq(posts.isPublic, true), or(isNull(posts.publishedAt), lte(posts.publishedAt, now))),
      )
      .orderBy(posts.updatedAt),
    // Published projects
    db
      .select({ slug: projects.slug, updatedAt: projects.updatedAt })
      .from(projects)
      .where(eq(projects.isPublic, true))
      .orderBy(projects.updatedAt),
    // Published pages (skills, experience, certificates, volunteering, …).
    // "overview" is served at "/", which corePages already lists.
    db
      .select({ slug: pages.slug, updatedAt: pages.updatedAt })
      .from(pages)
      .where(and(eq(pages.isPublic, true), ne(pages.slug, "overview")))
      .orderBy(pages.updatedAt),
  ]);
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

  const blogItems = postRows.map((r) => ({
    url: `${siteUrl}/blog/${r.slug}`,
    updated: new Date(r.updatedAt ?? Date.now()).toISOString(),
  }));

  const projectItems = projectRows.map((r) => ({
    url: `${siteUrl}/projects/${r.slug}`,
    updated: new Date(r.updatedAt ?? Date.now()).toISOString(),
  }));

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
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      // Crawlers don't need second-level freshness; serve from Netlify's CDN.
      "netlify-cdn-cache-control": "public, durable, s-maxage=3600, stale-while-revalidate=86400",
    },
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
