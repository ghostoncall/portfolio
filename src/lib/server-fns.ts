/* eslint-disable @typescript-eslint/no-explicit-any */
// Server functions for the /onlyme admin panel.
//
// Every function checks the admin session before touching the database.
// The client passes input via `data`; the server receives it in the handler
// context along with the Request for session verification.

import { createServerFn } from "@tanstack/react-start";
import { OEMBED_PROVIDERS } from "@/lib/oembed-providers";
import { and, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { getAuthUser, getSupabaseServer, isAllowedAdmin } from "@/lib/supabase.server";
import { getEnv } from "@/lib/runtime-config";
import { createHash } from "node:crypto";
import nodemailer from "nodemailer";
import {
  blogSettings,
  contactMessages,
  mediaAssets,
  pages,
  postRevisions,
  posts,
  projects,
  settings,
} from "@/db/schema";
import type {
  CertificatesPageContent,
  PageContent,
  PageKind,
  PageRow,
  Project,
  SiteIdentity,
  SkillsPageContent,
  AwardPageContent,
} from "@/db/schema";
import { assertValidContent } from "@/lib/cms-validation";
import { contactNotificationEmail } from "@/lib/email-templates";
import {
  normalizeCertificatesPage,
  normalizeExperiencePage,
  normalizePageContent,
  normalizeProject,
  normalizeSkillsPage,
  nextSort,
} from "@/lib/cms-normalize";
import { planPageReferenceCleanup, planProjectDelete, planProjectRename } from "@/lib/cms-server";
import { mergeBlogSettings } from "@/lib/blog-settings";
import {
  fillProjectFromAdditions,
  liveOverviewBlocks,
  mergePage,
  mergeProjects,
  projectsMissingFromDb,
  SITE_FALLBACK,
  SEED_POSTS,
} from "@/lib/merge-additions";
import { withReadTime } from "@/lib/reading-time";
import { RESERVED_POST_SLUGS, sectionOf, type BlogSectionId } from "@/lib/blog-sections";
import { searchInPosts, suggestInPosts, tagsInPosts } from "@/lib/post-search";
import { isPublicSection, type SectionVisibility } from "@/lib/section-visibility";
import { readSectionVisibility, writeSectionVisibility } from "@/lib/section-visibility.server";

/**
 * Published, publicly listed posts (full documents) for the fallback search,
 * minus posts in a hidden blog section. Uses the seed posts when the
 * database can't be reached (local development).
 */
async function searchablePosts(): Promise<Post[]> {
  try {
    const db = getDb();
    const now = new Date();
    const [rows, settingsRow] = await Promise.all([
      db
        .select({ published: posts.published })
        .from(posts)
        .where(
          and(eq(posts.isPublic, true), or(isNull(posts.publishedAt), lte(posts.publishedAt, now))),
        ),
      db
        .select({ value: blogSettings.value })
        .from(blogSettings)
        .where(eq(blogSettings.id, "blog"))
        .limit(1),
    ]);
    const journalHidden = (settingsRow[0]?.value as any)?.sections?.journal?.visible === false;
    return rows
      .map((r) => r.published)
      .filter((p) => (p.visibility ?? "public") === "public")
      .filter((p) => !(journalHidden && sectionOf(p) === "journal"));
  } catch {
    return (SEED_POSTS as Post[]).filter((p) => (p.visibility ?? "public") === "public");
  }
}
import type { Post } from "@/content/site";
import {
  RESUME_MAX_BYTES,
  RESUME_MIME,
  isResumeVisible,
  publicResumeSettings,
  safeResumeFileName,
  type PublicResumeSettings,
  type ResumeDoc,
  type ResumeSettings,
} from "@/lib/resume";

/** Verify the Supabase session on a Request. Throws 401 if invalid. */
async function requireAdmin(request: Request): Promise<void> {
  const user = await getAuthUser();
  if (!user) {
    const err: any = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
}

/** Settings rows key on `id`; content rows key on `slug`. */
function keyColumn(table: any) {
  return table.slug ?? table.id;
}

/** Per-file upload ceiling. Supabase Storage enforces the same value. */
export function mediaMaxBytes(): number {
  const configured = Number((import.meta.env as any).VITE_MEDIA_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : 50 * 1024 * 1024;
}

type TableKey = "pages" | "projects" | "posts" | "settings";
const TABLES: Record<TableKey, any> = {
  pages,
  projects,
  posts,
  settings,
};

// ---------------------------------------------------------------------------
// List all items in a table (for admin index views)
// ---------------------------------------------------------------------------

export const listStaged = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const table = TABLES[data.table as TableKey];
    if (!table) {
      const err: any = new Error("Unknown table");
      err.statusCode = 400;
      throw err;
    }
    const rows = await db.select().from(table).orderBy(table.sort);
    // Drizzle exposes camelCase properties; settings rows have no `slug`.
    return rows.map((r: any) => ({
      slug: r.slug ?? r.id,
      published: r.published,
      staged: r.staged,
      sort: r.sort,
      navOrder: r.navOrder ?? 0,
      isPublic: r.isPublic ?? false,
      publishedAt: r.publishedAt ?? null,
      updatedAt: r.updatedAt ?? null,
    }));
  },
);

// ---------------------------------------------------------------------------
// Read staged content for a single item
// ---------------------------------------------------------------------------

export const getStaged = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const table = TABLES[data.table as TableKey];
    if (!table) {
      const err: any = new Error("Unknown table");
      err.statusCode = 400;
      throw err;
    }
    const row = await db
      .select()
      .from(table)
      .where(eq(keyColumn(table), data.slug))
      .limit(1);
    if (!row[0]) {
      const err: any = new Error("Not found");
      err.statusCode = 404;
      throw err;
    }
    return {
      published: row[0]["published"],
      staged: row[0]["staged"],
      isPublic: row[0]["isPublic"] ?? false,
      publishedAt: row[0]["publishedAt"]?.toISOString?.() ?? null,
      updatedAt: row[0]["updatedAt"]?.toISOString?.() ?? null,
    };
  },
);

// ---------------------------------------------------------------------------
// Write (edit staged copy)
// ---------------------------------------------------------------------------

export const updateStaged = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const table = TABLES[data.table as TableKey];
    if (!table) {
      const err: any = new Error("Unknown table");
      err.statusCode = 400;
      throw err;
    }
    const now = new Date();
    try {
      assertValidContent(data.table, data.content);
    } catch (err: any) {
      if (!err.statusCode) {
        const wrapped: any = new Error(err?.message ?? "Validation failed");
        wrapped.statusCode = 400;
        throw wrapped;
      }
      throw err;
    }
    if (data.table === "pages") {
      await db
        .update(pages)
        .set({ staged: data.content, updatedAt: now })
        .where(eq(pages.slug, data.slug));
      return { ok: true };
    }
    await db
      .update(table)
      .set({ staged: data.content, updatedAt: now })
      .where(eq(keyColumn(table), data.slug));
    return { ok: true };
  },
);

// ---------------------------------------------------------------------------
// Publish (copy staged → published)
// ---------------------------------------------------------------------------

export const createItem = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const table = TABLES[data.table as TableKey];
    if (!table) {
      const err: any = new Error("Unknown table");
      err.statusCode = 400;
      throw err;
    }
    const slug = String(data.slug ?? "").trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      const err: any = new Error(
        "Slug must be lowercase letters, numbers, and dashes (e.g. my-first-post)",
      );
      err.statusCode = 400;
      throw err;
    }
    if (data.table === "posts" && RESERVED_POST_SLUGS.has(slug)) {
      const err: any = new Error(
        `"${slug}" is used by a blog page (/blog/${slug}) — pick another slug`,
      );
      err.statusCode = 400;
      throw err;
    }
    const existing = await db.select().from(table).where(eq(table.slug, slug)).limit(1);
    if (existing[0]) {
      const err: any = new Error(`"${slug}" already exists — pick another slug`);
      err.statusCode = 409;
      throw err;
    }
    const now = new Date();
    let doc: any;
    if (data.table === "posts") {
      doc = {
        slug,
        title: String(data.title ?? "").trim() || "Untitled post",
        dek: "",
        date: now.toISOString().slice(0, 10),
        tags: [],
        blocks: [],
        section: data.section === "journal" ? "journal" : "tech",
      };
    } else if (data.table === "projects") {
      doc = {
        slug,
        title: String(data.title ?? "").trim() || "Untitled project",
        dek: "",
        year: String(now.getFullYear()),
        category: "",
        stack: [],
        blocks: [],
      };
    } else if (data.table === "pages") {
      const kind = String(data.kind ?? "blocks") as PageKind;
      if (
        ![
          "blocks",
          "skills",
          "experience",
          "certificates",
          "volunteering",
          "education",
          "awards",
        ].includes(kind)
      ) {
        const err: any = new Error(`Unsupported page kind "${kind}"`);
        err.statusCode = 400;
        throw err;
      }
      const empty: PageContent =
        kind === "skills"
          ? { kind: "skills", categories: [], skills: [] }
          : kind === "certificates"
            ? { kind: "certificates", certificates: [] }
            : kind === "experience"
              ? { kind: "experience", entries: [] }
              : kind === "volunteering"
                ? {
                    kind: "volunteering",
                    introduction: {},
                    entries: [],
                    whyVolunteering: {},
                    lookingAhead: {},
                    interests: [],
                    cta: {},
                  }
                : kind === "education"
                  ? { kind: "education", entries: [] }
                  : kind === "awards"
                    ? { kind: "awards", entries: [] }
                    : { kind: "blocks", blocks: [] };
      doc = empty;
    } else {
      const err: any = new Error("Unsupported table for creation");
      err.statusCode = 400;
      throw err;
    }
    const values: any = { slug, published: doc, staged: doc, sort: 0, updatedAt: now };
    if (data.table === "posts" || data.table === "projects") {
      values.isPublic = false; // hidden until published
    }
    await db.insert(table).values(values);
    return { ok: true, slug };
  },
);

export const deleteItem = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const table = TABLES[data.table as TableKey];
    if (!table) {
      const err: any = new Error("Unknown table");
      err.statusCode = 400;
      throw err;
    }
    await db.delete(table).where(eq(keyColumn(table), data.slug));
    return { ok: true };
  },
);

/** Admin: save the manual post order (used when Blog settings → order = manual). */
export const reorderPosts = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    await requireAdmin(context.request);
    const slugs: string[] = Array.isArray(data?.slugs) ? data.slugs.map(String) : [];
    if (!slugs.length) return { ok: true };
    const db = getDb();
    const now = new Date();
    await db.transaction(async (tx) => {
      for (const [i, slug] of slugs.entries()) {
        await tx.update(posts).set({ sort: i, updatedAt: now }).where(eq(posts.slug, slug));
      }
    });
    return { ok: true };
  },
);

/** Rename a post URL. The slug is the primary key, so it updates in place. */
export const updatePostSlug = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const oldSlug = String(data?.oldSlug ?? "").trim();
    const newSlug = String(data?.newSlug ?? "").trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newSlug)) {
      throw httpError("Slug must be lowercase letters, numbers, and dashes.", 400);
    }
    if (newSlug === oldSlug) return { ok: true, slug: newSlug };
    if (RESERVED_POST_SLUGS.has(newSlug)) {
      throw httpError(
        `"${newSlug}" is used by a blog page (/blog/${newSlug}) — pick another slug.`,
        400,
      );
    }
    const existing = await db.select().from(posts).where(eq(posts.slug, newSlug)).limit(1);
    if (existing[0]) throw httpError(`"${newSlug}" already exists — pick another slug.`, 409);

    const row = await db.select().from(posts).where(eq(posts.slug, oldSlug)).limit(1);
    if (!row[0]) throw httpError("Post not found", 404);
    await db
      .update(posts)
      .set({
        slug: newSlug,
        published: { ...row[0].published, slug: newSlug },
        staged: { ...row[0].staged, slug: newSlug },
        updatedAt: new Date(),
      })
      .where(eq(posts.slug, oldSlug));
    return { ok: true, slug: newSlug };
  },
);

/** Bulk publish / unpublish / delete for the blog list. */
export const bulkUpdatePosts = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const action = String(data?.action ?? "");
    const slugs: string[] = Array.isArray(data?.slugs) ? data.slugs.map(String) : [];
    if (!slugs.length) return { ok: true, count: 0 };
    const now = new Date();
    let count = 0;

    for (const slug of slugs) {
      if (action === "delete") {
        await db.delete(posts).where(eq(posts.slug, slug));
        count += 1;
        continue;
      }
      const row = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
      if (!row[0]) continue;
      if (action === "publish") {
        await db
          .update(posts)
          .set({ published: row[0].staged, publishedAt: now, isPublic: true, updatedAt: now })
          .where(eq(posts.slug, slug));
        count += 1;
      } else if (action === "unpublish") {
        await db.update(posts).set({ isPublic: false, updatedAt: now }).where(eq(posts.slug, slug));
        count += 1;
      }
    }
    return { ok: true, count };
  },
);

export const publishItem = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const table = TABLES[data.table as TableKey];
    if (!table) {
      const err: any = new Error("Unknown table");
      err.statusCode = 400;
      throw err;
    }
    const now = new Date();
    const row = await db
      .select()
      .from(table)
      .where(eq(keyColumn(table), data.slug))
      .limit(1);
    if (!row[0]) {
      const err: any = new Error("Not found");
      err.statusCode = 404;
      throw err;
    }
    let when = now;
    if (data.publishAt) {
      const parsed = new Date(data.publishAt);
      if (Number.isNaN(parsed.getTime())) {
        const err: any = new Error("Invalid publish date");
        err.statusCode = 400;
        throw err;
      }
      when = parsed;
    }
    // When the client sends its current draft, write staged + published in the
    // same UPDATE. This makes the published snapshot exactly what the editor
    // sees, and removes any window where a slow/overlapping autosave could
    // publish an older staged version.
    const content = data.content === undefined ? row[0]["staged"] : data.content;
    const setValues: any = {
      staged: content,
      published: content,
      publishedAt: when,
      updatedAt: now,
    };
    if (data.table === "posts" || data.table === "projects" || data.table === "pages") {
      setValues.isPublic = true; // publishing makes the item live
    }
    if (data.table === "posts" && data.publishAt) {
      setValues.needsPublish = true; // pg_cron publishes at the scheduled time
    }
    await db
      .update(table)
      .set(setValues)
      .where(eq(keyColumn(table), data.slug));
    return { ok: true, publishedAt: when.toISOString() };
  },
);

/** Take a post/project off the public site without discarding the published copy. */
export const unpublishItem = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const table = TABLES[data.table as TableKey];
    if (!table) {
      const err: any = new Error("Unknown table");
      err.statusCode = 400;
      throw err;
    }
    await db
      .update(table)
      .set({ isPublic: false, updatedAt: new Date() })
      .where(eq(keyColumn(table), data.slug));
    return { ok: true };
  },
);

export const revertItem = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const table = TABLES[data.table as TableKey];
    if (!table) {
      const err: any = new Error("Unknown table");
      err.statusCode = 400;
      throw err;
    }
    const row = await db
      .select()
      .from(table)
      .where(eq(keyColumn(table), data.slug))
      .limit(1);
    if (!row[0]) {
      const err: any = new Error("Not found");
      err.statusCode = 404;
      throw err;
    }
    await db
      .update(table)
      .set({ staged: row[0]["published"], updatedAt: new Date() })
      .where(eq(keyColumn(table), data.slug));
    return { ok: true };
  },
);

// ---------------------------------------------------------------------------
// Project-specific operations (slug rename, duplicate, reorder, delete)
// ---------------------------------------------------------------------------

export const updateProjectSlug = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const oldSlug = String(data?.oldSlug ?? "").trim();
    const newSlug = String(data?.newSlug ?? "").trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newSlug)) {
      throw httpError("Slug must be lowercase letters, numbers, and dashes.", 400);
    }
    if (newSlug === oldSlug) return { ok: true, slug: newSlug };
    const existing = await db.select().from(projects).where(eq(projects.slug, newSlug)).limit(1);
    if (existing[0]) throw httpError(`"${newSlug}" already exists — pick another slug.`, 409);
    const row = await db.select().from(projects).where(eq(projects.slug, oldSlug)).limit(1);
    if (!row[0]) throw httpError("Project not found", 404);
    const allPages = await db.select().from(pages);
    const plan = planProjectRename({
      project: row[0].staged as Project,
      pages: allPages as PageRow[],
      oldSlug,
      newSlug,
    });
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(projects)
        .set({
          slug: newSlug,
          published: { ...plan.project, slug: newSlug } as Project,
          staged: plan.project,
          updatedAt: now,
        })
        .where(eq(projects.slug, oldSlug));
      for (const p of plan.pages) {
        await tx
          .update(pages)
          .set({ published: p.published, staged: p.staged, updatedAt: now })
          .where(eq(pages.slug, p.slug));
      }
    });
    return { ok: true, slug: newSlug };
  },
);

export const duplicateProject = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const slug = String(data?.slug ?? "").trim();
    const newSlug = String(data?.newSlug ?? "").trim();
    const newTitle = String(data?.title ?? "").trim() || "Copy";
    if (!newSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newSlug)) {
      throw httpError("Invalid slug", 400);
    }
    const existing = await db.select().from(projects).where(eq(projects.slug, newSlug)).limit(1);
    if (existing[0]) throw httpError(`"${newSlug}" already exists — pick another slug.`, 409);
    const row = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
    if (!row[0]) throw httpError("Project not found", 404);
    const all = await db.select().from(projects);
    const maxSort = all.reduce((m, p) => Math.max(m, p.sort ?? 0), 0);
    const now = new Date();
    const staged = normalizeProject({
      ...row[0].staged,
      slug: newSlug,
      title: newTitle,
      featured: false,
      updatedAt: now.toISOString(),
    });
    await db.insert(projects).values({
      slug: newSlug,
      published: staged,
      staged,
      sort: maxSort + 1,
      isPublic: false,
      updatedAt: now,
    });
    return { ok: true, slug: newSlug };
  },
);

export const reorderProjects = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const slugs: string[] = Array.isArray(data?.slugs) ? data.slugs.map(String) : [];
    if (!slugs.length) return { ok: true, count: 0 };
    const now = new Date();
    await db.transaction(async (tx) => {
      for (let i = 0; i < slugs.length; i++) {
        await tx
          .update(projects)
          .set({ sort: i, updatedAt: now })
          .where(eq(projects.slug, slugs[i]!));
      }
    });
    return { ok: true, count: slugs.length };
  },
);

export const reorderNav = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const known = new Set<string>(NAV_SLUGS);
    const slugs: string[] = (Array.isArray(data?.slugs) ? data.slugs.map(String) : []).filter(
      (s: string) => known.has(s),
    );
    if (!slugs.length) return { ok: true, count: 0 };
    const now = new Date();
    const value = { order: slugs };
    await db.transaction(async (tx) => {
      // Single source of truth for the complete public nav order.
      await tx
        .insert(settings)
        .values({ id: "nav", published: value as any, staged: value as any, updatedAt: now })
        .onConflictDoUpdate({
          target: settings.id,
          set: { published: value as any, staged: value as any, updatedAt: now },
        });
      // Mirror onto pages.navOrder for backward compatibility.
      for (let i = 0; i < slugs.length; i++) {
        await tx
          .update(pages)
          .set({ navOrder: i, updatedAt: now })
          .where(eq(pages.slug, slugs[i]!));
      }
    });
    return { ok: true, count: slugs.length };
  },
);

export const deleteProject = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const slug = String(data?.slug ?? "").trim();
    const row = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
    if (!row[0]) throw httpError("Project not found", 404);
    const allPages = await db.select().from(pages);
    const plan = planProjectDelete({ pages: allPages as PageRow[], slug });
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.delete(projects).where(eq(projects.slug, slug));
      for (const p of plan) {
        await tx
          .update(pages)
          .set({ published: p.published, staged: p.staged, updatedAt: now })
          .where(eq(pages.slug, p.slug));
      }
    });
    return { ok: true };
  },
);

// ---------------------------------------------------------------------------
// Content-page helpers
// ---------------------------------------------------------------------------

export const ensureContentPage = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const slug = String(data?.slug ?? "").trim();
    const title = String(data?.title ?? slug).trim();
    const kind = (data?.kind ?? "blocks") as PageKind;
    if (!slug) throw httpError("slug is required", 400);
    const existing = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
    if (existing[0]) return { ok: true, created: false, slug };
    const now = new Date();
    const empty: PageContent =
      kind === "blocks"
        ? slug === "overview"
          ? // Start from exactly what the public Overview shows today.
            { kind: "blocks", blocks: liveOverviewBlocks(null), additionsApplied: true }
          : { kind: "blocks", blocks: [] }
        : kind === "skills"
          ? { kind: "skills", categories: [], skills: [] }
          : kind === "certificates"
            ? { kind: "certificates", certificates: [] }
            : kind === "education"
              ? { kind: "education", entries: [] }
              : kind === "awards"
                ? { kind: "awards", entries: [] }
                : { kind: "experience", entries: [] };
    await db.insert(pages).values({
      slug,
      title,
      kind,
      published: empty,
      staged: empty,
      sort: 99,
      updatedAt: now,
      isPublic: false,
    });
    return { ok: true, created: true, slug };
  },
);

/**
 * Public read of page rows: only the columns the public site needs. The
 * `staged` JSONB (often as large as `published`) is never sent over the wire.
 */
function selectPublicPages(slugs: string[]) {
  return getDb()
    .select({ slug: pages.slug, published: pages.published, isPublic: pages.isPublic })
    .from(pages)
    .where(slugs.length === 1 ? eq(pages.slug, slugs[0]!) : inArray(pages.slug, slugs));
}

export const getPublishedSkillsBundle = createServerFn({ method: "GET", strict: false }).handler(
  async () => {
    try {
      // One round trip instead of three sequential ones.
      const rows = await selectPublicPages(["skills", "certificates", "awards"]);
      const bySlug = new Map(rows.map((r) => [r.slug, r]));
      const resolve = (slug: string) => {
        const row = bySlug.get(slug);
        return row && row.isPublic
          ? normalizePageContent(row.published.kind, mergePage(slug, row.published))
          : mergePage(slug, null);
      };
      const skills = resolve("skills");
      const certificates = resolve("certificates");
      const awards = resolve("awards");
      return {
        skills: skills as SkillsPageContent,
        certificates: certificates as CertificatesPageContent,
        awards: awards as AwardPageContent,
      };
    } catch (err) {
      console.error("[getPublishedSkillsBundle] db unavailable, using additions only", err);
      return {
        skills: mergePage("skills", null, true),
        certificates: mergePage("certificates", null, true),
        awards: mergePage("awards", null, true),
      };
    }
  },
);

export const getPublishedEducation = createServerFn({ method: "GET", strict: false }).handler(
  async () => {
    try {
      const row = await selectPublicPages(["education"]);
      if (!row[0] || !row[0].isPublic) return mergePage("education", null);
      return normalizePageContent(row[0].published.kind, mergePage("education", row[0].published));
    } catch (err) {
      console.error("[getPublishedEducation] db unavailable, using additions only", err);
      return mergePage("education", null, true);
    }
  },
);

export const getPublishedAwards = createServerFn({ method: "GET", strict: false }).handler(
  async () => {
    try {
      const row = await selectPublicPages(["awards"]);
      if (!row[0] || !row[0].isPublic) return mergePage("awards", null);
      return normalizePageContent(row[0].published.kind, mergePage("awards", row[0].published));
    } catch (err) {
      console.error("[getPublishedAwards] db unavailable, using additions only", err);
      return mergePage("awards", null, true);
    }
  },
);

export const getPublishedSkills = createServerFn({ method: "GET", strict: false }).handler(
  async () => {
    try {
      const row = await selectPublicPages(["skills"]);
      if (!row[0] || !row[0].isPublic) return mergePage("skills", null);
      return normalizePageContent(row[0].published.kind, mergePage("skills", row[0].published));
    } catch (err) {
      console.error("[getPublishedSkills] db unavailable, using additions only", err);
      return mergePage("skills", null, true);
    }
  },
);

export const getPublishedCertificates = createServerFn({
  method: "GET",
  strict: false,
}).handler(async () => {
  try {
    const row = await selectPublicPages(["certificates"]);
    if (!row[0] || !row[0].isPublic) return mergePage("certificates", null);
    return normalizePageContent(row[0].published.kind, mergePage("certificates", row[0].published));
  } catch (err) {
    console.error("[getPublishedCertificates] db unavailable, using additions only", err);
    return mergePage("certificates", null, true);
  }
});

export const publishAll = createServerFn({ method: "POST", strict: false }).handler(
  async ({ context }) => {
    const { request } = context as any;
    await requireAdmin(request);
    const db = getDb();
    const now = new Date();
    await db
      .update(pages)
      .set({ published: pages.staged, publishedAt: now, updatedAt: now, isPublic: true });
    await db.update(projects).set({ published: projects.staged, publishedAt: now, updatedAt: now });
    await db.update(posts).set({ published: posts.staged, publishedAt: now, updatedAt: now });
    await db.update(settings).set({ published: settings.staged, updatedAt: now });
    return { ok: true };
  },
);

// ---------------------------------------------------------------------------
// Public content access (no admin required)
// ---------------------------------------------------------------------------

export const getSiteIdentity = createServerFn({ method: "GET", strict: false }).handler(
  async () => {
    try {
      const db = getDb();
      const row = await db
        .select({ published: settings.published })
        .from(settings)
        .where(eq(settings.id, "site"))
        .limit(1);
      return (
        row[0]?.published ?? {
          name: "Portfolio",
          title: "AI Engineer",
          edition: "2026",
          email: "",
          socials: [],
        }
      );
    } catch (err) {
      console.error("[getSiteIdentity] db unavailable, using additions only", err);
      return SITE_FALLBACK;
    }
  },
);

// ---------------------------------------------------------------------------
// Blog appearance settings
// ---------------------------------------------------------------------------

export const getBlogSettings = createServerFn({ method: "GET", strict: false }).handler(
  async () => {
    try {
      const db = getDb();
      const row = await db.select().from(blogSettings).where(eq(blogSettings.id, "blog")).limit(1);
      return mergeBlogSettings(row[0]?.value ?? {});
    } catch (err) {
      console.error("[getBlogSettings] db unavailable, using seed content", err);
      return mergeBlogSettings({});
    }
  },
);

export const saveBlogSettings = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const value = mergeBlogSettings(data?.settings ?? {});
    await db
      .insert(blogSettings)
      .values({ id: "blog", value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: blogSettings.id,
        set: { value, updatedAt: new Date() },
      });
    return { ok: true, settings: value };
  },
);

/**
 * Blog index entry: reading time resolved, and the article body dropped —
 * the index never renders it, and shipping every full post in the listing
 * payload was the single largest part of /blog's HTML.
 */
function toListing(post: Post): Post {
  const { body: _body, blocks: _blocks, ...rest } = withReadTime(post);
  void _body;
  void _blocks;
  return { ...rest, blocks: [] } as Post;
}

/** Only posts of one section when `section` is given ("tech" also gets unassigned posts). */
function inSection(section: unknown) {
  return (p: Post) =>
    section === "tech" || section === "journal" ? sectionOf(p) === section : true;
}

export const getPublishedPosts = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data }: any) => {
    const section = data?.section as BlogSectionId | undefined;
    try {
      const db = getDb();
      const now = new Date();
      const rows = await db
        .select({ published: posts.published })
        .from(posts)
        .where(
          and(eq(posts.isPublic, true), or(isNull(posts.publishedAt), lte(posts.publishedAt, now))),
        )
        .orderBy(posts.sort);
      return rows
        .map((r) => r.published)
        .filter((p) => (p.visibility ?? "public") === "public")
        .filter(inSection(section))
        .map(toListing);
    } catch (err) {
      console.error("[getPublishedPosts] db unavailable, using seed content", err);
      return SEED_POSTS.filter((p: any) => (p.visibility ?? "public") === "public")
        .filter(inSection(section))
        .map(toListing);
    }
  },
);

export const getPublishedPost = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data }: any) => {
    try {
      const db = getDb();
      const row = await db
        .select({
          published: posts.published,
          isPublic: posts.isPublic,
          publishedAt: posts.publishedAt,
        })
        .from(posts)
        .where(eq(posts.slug, data.slug))
        .limit(1);
      if (!row[0] || !row[0].isPublic) return null;
      // Scheduled posts stay hidden until their publish time.
      if (row[0].publishedAt && row[0].publishedAt.getTime() > Date.now()) return null;
      const post = row[0].published;
      if ((post.visibility ?? "public") === "private") return null;
      return withReadTime(post);
    } catch (err) {
      console.error("[getPublishedPost] db unavailable, using seed content", err);
      const seedPost = SEED_POSTS.find((p: any) => p.slug === data.slug);
      return seedPost ? withReadTime(seedPost) : null;
    }
  },
);

/**
 * Admin preview: the staged copy regardless of status. `published` is returned
 * so the preview can show "compared to live" state.
 */
export const getPostPreview = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const row = await db.select().from(posts).where(eq(posts.slug, data.slug)).limit(1);
    if (!row[0]) return null;
    return {
      staged: row[0].staged,
      published: row[0].published,
      isPublic: row[0].isPublic,
      publishedAt: row[0].publishedAt?.toISOString() ?? null,
    };
  },
);

// ---------------------------------------------------------------------------
// Search (PostgreSQL full text + trigram fuzzy fallback, RPC-enforced visibility)
// ---------------------------------------------------------------------------

export const searchPosts = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data }: any) => {
    try {
      const db = getDb();
      const section = data?.section === "tech" || data?.section === "journal" ? data.section : null;
      const page = Math.max(1, Number(data?.page ?? 1));
      const perPage = Math.max(1, Math.min(50, Number(data?.perPage ?? 10)));
      // The search function (search_blog_posts in Postgres) has no section
      // parameter. With a section filter, fetch every match (the blog is
      // small), filter by section here, then paginate.
      let rows: any[] = await db.execute(sql`
      select * from search_blog_posts(
        ${data?.query ?? null},
        ${data?.tag ?? null},
        ${data?.year ?? null},
        ${data?.featured ?? null},
        ${data?.sort ?? "relevance"},
        ${section ? 1 : page},
        ${section ? 500 : perPage}
      )
    `);
      // Attach each result's section (only for posts the search already returned).
      const slugs = rows.map((r) => String(r.slug));
      const sections = new Map<string, BlogSectionId>();
      if (slugs.length) {
        const meta = await db
          .select({ slug: posts.slug, published: posts.published })
          .from(posts)
          .where(and(inArray(posts.slug, slugs), eq(posts.isPublic, true)));
        for (const m of meta) sections.set(m.slug, sectionOf(m.published));
      }
      let total = rows.length ? Number(rows[0].total) : 0;
      const journalHidden = await (async () => {
        const s = await db
          .select({ value: blogSettings.value })
          .from(blogSettings)
          .where(eq(blogSettings.id, "blog"))
          .limit(1);
        return (s[0]?.value as any)?.sections?.journal?.visible === false;
      })();
      if (journalHidden) {
        const before = rows.length;
        rows = rows.filter((r) => sections.get(String(r.slug)) !== "journal");
        total -= before - rows.length;
      }
      if (section) {
        rows = rows.filter((r) => (sections.get(String(r.slug)) ?? "tech") === section);
        total = rows.length;
        rows = rows.slice((page - 1) * perPage, page * perPage);
      }
      return {
        posts: rows.map((r) => ({
          section: sections.get(String(r.slug)) ?? "tech",
          slug: r.slug,
          title: r.title,
          dek: r.dek,
          date: r.date,
          tags: r.tags,
          cover: r.cover,
          readTime: r.read_time,
          author: r.author,
          featured: r.featured,
          publishedAt: r.published_at,
        })),
        rank: rows.map((r) => r.rank),
        headline: rows.map((r) => r.headline),
        total,
      };
    } catch (err) {
      // The Postgres search isn't available (missing function, timeout, or no
      // database locally): search the published posts directly instead of
      // telling the visitor nothing matched.
      console.error("[searchPosts] database search unavailable, using fallback search", err);
      const result = searchInPosts(await searchablePosts(), {
        query: data?.query ?? null,
        tag: data?.tag ?? null,
        year: data?.year ?? null,
        featured: data?.featured ?? null,
        section: data?.section === "tech" || data?.section === "journal" ? data.section : null,
        sort: data?.sort ?? "relevance",
        page: Number(data?.page ?? 1),
        perPage: Number(data?.perPage ?? 10),
      });
      return { ...result, rank: result.posts.map(() => null) };
    }
  },
);

export const searchSuggest = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data }: any) => {
    try {
      const db = getDb();
      const rows: any[] = await db.execute(sql`
      select * from search_blog_suggest(${data?.query ?? ""}, ${data?.limit ?? 6})
    `);
      return rows;
    } catch (err) {
      console.error("[searchSuggest] database search unavailable, using fallback", err);
      return suggestInPosts(
        await searchablePosts(),
        String(data?.query ?? ""),
        Number(data?.limit ?? 6),
      );
    }
  },
);

export const getBlogTags = createServerFn({ method: "GET", strict: false }).handler(async () => {
  try {
    const db = getDb();
    return await db.execute(sql`select * from get_blog_tags()`);
  } catch (err) {
    console.error("[getBlogTags] database function unavailable, using fallback", err);
    return tagsInPosts(await searchablePosts());
  }
});

export const getRelatedPosts = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data }: any) => {
    try {
      const db = getDb();
      const rows: any[] = await db.execute(sql`
      select * from get_related_posts(${data?.slug ?? ""}, ${data?.limit ?? 3})
    `);
      return rows.map((r) => ({
        slug: r.out_slug,
        title: r.out_title,
        dek: r.out_dek,
        date: r.out_date,
        tags: r.out_tags,
        cover: r.out_cover,
        readTime: r.out_read_time,
        author: r.out_author,
        featured: r.out_featured,
        publishedAt: r.out_published_at,
      }));
    } catch (err) {
      console.error("[getRelatedPosts] db unavailable, using seed content", err);
      return [];
    }
  },
);

// ---------------------------------------------------------------------------
// Analytics: once-per-session view counting
// ---------------------------------------------------------------------------

export const recordPostView = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data }: any) => {
    try {
      const db = getDb();
      const row: any = await db.execute(sql`select record_post_view(${data?.slug ?? ""}) as views`);
      return { views: row[0]?.views ?? null };
    } catch (err) {
      console.error("[recordPostView] db unavailable, using seed content", err);
      return { views: null };
    }
  },
);

// ---------------------------------------------------------------------------
// Blog overview (dashboard)
// ---------------------------------------------------------------------------

export const getBlogOverview = createServerFn({ method: "GET", strict: false }).handler(
  async () => {
    const db = getDb();
    const row: any = await db.execute(sql`select get_blog_overview() as overview`);
    return row[0]?.overview ?? {};
  },
);

// ---------------------------------------------------------------------------
// Revision history
// ---------------------------------------------------------------------------

export const listPostRevisions = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    return await db
      .select()
      .from(postRevisions)
      .where(eq(postRevisions.postSlug, data.slug))
      .orderBy(postRevisions.revisionNumber);
  },
);

export const createPostRevision = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const row = await db.select().from(posts).where(eq(posts.slug, data.slug)).limit(1);
    if (!row[0]) {
      const err: any = new Error("Not found");
      err.statusCode = 404;
      throw err;
    }
    const last = await db
      .select()
      .from(postRevisions)
      .where(eq(postRevisions.postSlug, data.slug))
      .orderBy(postRevisions.revisionNumber)
      .limit(1);
    const nextNum = last[0] ? (last[0].revisionNumber as number) + 1 : 1;
    const id = crypto.randomUUID();
    await db.insert(postRevisions).values({
      id,
      postSlug: data.slug,
      title: data.title ?? row[0].published.title,
      content: data.content ?? row[0].staged,
      revisionNumber: nextNum,
    });
    return { ok: true, id, revisionNumber: nextNum };
  },
);

export const restorePostRevision = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const rev = await db
      .select()
      .from(postRevisions)
      .where(eq(postRevisions.id, data.revisionId))
      .limit(1);
    if (!rev[0]) {
      const err: any = new Error("Revision not found");
      err.statusCode = 404;
      throw err;
    }
    // Restore to staged only — never silently overwrites newer edits.
    await db
      .update(posts)
      .set({ staged: rev[0].content, updatedAt: new Date() })
      .where(eq(posts.slug, rev[0].postSlug));
    return { ok: true, slug: rev[0].postSlug };
  },
);

// ---------------------------------------------------------------------------
// Contact inbox
// ---------------------------------------------------------------------------

export const submitContact = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data }: any) => {
    const db = getDb();
    const name = String(data?.name ?? "")
      .trim()
      .slice(0, 200);
    const email = String(data?.email ?? "")
      .trim()
      .slice(0, 320);
    const message = String(data?.message ?? "")
      .trim()
      .slice(0, 10000);
    const honeypot = data?.website ?? "";
    if (honeypot) {
      // Bot trap filled in — silently accept but do not store.
      return { ok: true, skipped: true };
    }
    if (!name || !email || !message) {
      const err: any = new Error("Missing required fields");
      err.statusCode = 400;
      throw err;
    }
    // Suppress near-duplicate submissions within 5 minutes.
    const recent = await db
      .select()
      .from(contactMessages)
      .where(eq(contactMessages.email, email))
      .orderBy(contactMessages.createdAt)
      .limit(1);
    if (
      recent[0] &&
      recent[0].message === message &&
      Date.now() - new Date(recent[0].createdAt).getTime() < 5 * 60 * 1000
    ) {
      return { ok: true, duplicate: true };
    }
    const id = crypto.randomUUID();
    await db.insert(contactMessages).values({
      id,
      name,
      email,
      subject_category: "other",
      custom_subject: null,
      message,
    });
    return { ok: true, id };
  },
);

export const listContactMessages = createServerFn({ method: "GET", strict: false }).handler(
  async ({ context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    return await db.select().from(contactMessages).orderBy(contactMessages.createdAt);
  },
);

export const markContactRead = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    await db.update(contactMessages).set({ isRead: true }).where(eq(contactMessages.id, data.id));
    return { ok: true };
  },
);

export const getPublishedProjects = createServerFn({ method: "GET", strict: false }).handler(
  async () => {
    try {
      const db = getDb();
      const [rows, adopted] = await Promise.all([
        db
          .select({ published: projects.published })
          .from(projects)
          .where(eq(projects.isPublic, true))
          .orderBy(projects.sort),
        codeContentAdopted(),
      ]);
      return mergeProjects(
        rows.map((r) => r.published),
        false,
        adopted,
      );
    } catch (err) {
      console.error("[getPublishedProjects] db unavailable, using additions only", err);
      return mergeProjects([], true);
    }
  },
);

export const getPublishedProject = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data }: any) => {
    try {
      const db = getDb();
      const [row, adopted] = await Promise.all([
        db
          .select({ published: projects.published, isPublic: projects.isPublic })
          .from(projects)
          .where(eq(projects.slug, data.slug))
          .limit(1),
        codeContentAdopted(),
      ]);
      // Hidden in the admin → hidden on the site (it used to stay reachable by URL).
      if (row[0] && !row[0].isPublic) return null;
      if (!row[0]) {
        if (adopted) return null;
        return mergeProjects([]).find((p: any) => p.slug === data.slug) ?? null;
      }
      return row[0].published;
    } catch (err) {
      console.error("[getPublishedProject] db unavailable, using additions only", err);
      return mergeProjects([], true).find((p: any) => p.slug === data.slug) ?? null;
    }
  },
);

export const getPublishedPage = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data }: any) => {
    try {
      const row = await selectPublicPages([String(data.slug)]);
      if (!row[0] || !row[0].isPublic) return mergePage(data.slug, null);
      return mergePage(data.slug, row[0].published);
    } catch (err) {
      console.error("[getPublishedPage] db unavailable, using additions only", err);
      return mergePage(data.slug, null, true);
    }
  },
);

// ---------------------------------------------------------------------------
// Code-defined content → database (single source of truth)
// ---------------------------------------------------------------------------
//
// Some live content was added in src/content/additions.ts and merged into the
// database content on every public read. The admin only ever saw (and could
// only edit) the database copy, so those entries could not be edited or
// deleted, and cleared fields were refilled from the file. adoptCodeContent
// copies that merged view into the database once and flags it; from then on
// the database alone decides what the site shows.

const CONTENT_FLAGS_ID = "content";

/** True once adoptCodeContent has run (projects no longer merge additions). */
async function codeContentAdopted(): Promise<boolean> {
  try {
    const row = await getDb()
      .select({ published: settings.published })
      .from(settings)
      .where(eq(settings.id, CONTENT_FLAGS_ID))
      .limit(1);
    return (row[0]?.published as any)?.additionsAdopted === true;
  } catch {
    return false;
  }
}

const ADOPTABLE_PAGES: { slug: string; kind: PageKind; title: string }[] = [
  { slug: "overview", kind: "blocks", title: "Overview" },
  { slug: "education", kind: "education", title: "Education" },
  { slug: "skills", kind: "skills", title: "Skills" },
  { slug: "certificates", kind: "certificates", title: "Certificates" },
  { slug: "awards", kind: "awards", title: "Awards" },
  { slug: "experience", kind: "experience", title: "Experience" },
  { slug: "volunteering", kind: "volunteering", title: "Volunteering" },
];

const ENTRY_LISTS: Record<string, string[]> = {
  overview: ["blocks"],
  education: ["entries"],
  skills: ["skills", "categories"],
  certificates: ["certificates"],
  awards: ["entries"],
  experience: ["entries"],
  volunteering: ["entries"],
};

function countEntries(slug: string, doc: any): number {
  return (ENTRY_LISTS[slug] ?? []).reduce(
    (n, key) => n + (Array.isArray(doc?.[key]) ? doc[key].length : 0),
    0,
  );
}

/** Admin: what the live site still takes from code instead of the database. */
export const getCodeContentStatus = createServerFn({ method: "GET", strict: false }).handler(
  async ({ context }: any) => {
    await requireAdmin(context.request);
    const db = getDb();
    const [rows, projectRows, adopted] = await Promise.all([
      db
        .select({
          slug: pages.slug,
          published: pages.published,
          staged: pages.staged,
          isPublic: pages.isPublic,
        })
        .from(pages)
        .where(
          inArray(
            pages.slug,
            ADOPTABLE_PAGES.map((p) => p.slug),
          ),
        ),
      db.select({ slug: projects.slug }).from(projects),
      codeContentAdopted(),
    ]);
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    const sections: { section: string; items: number }[] = [];
    let pending = !adopted;
    for (const page of ADOPTABLE_PAGES) {
      const row = bySlug.get(page.slug);
      const raw = row?.isPublic ? row.published : null;
      if ((raw as any)?.additionsApplied && (row?.staged as any)?.additionsApplied) continue;
      pending = true;
      const extra =
        countEntries(page.slug, mergePage(page.slug, raw)) - countEntries(page.slug, raw);
      if (extra > 0) sections.push({ section: page.title, items: extra });
    }
    if (!adopted) {
      const missing = projectsMissingFromDb(new Set(projectRows.map((r) => r.slug))).length;
      if (missing > 0) sections.push({ section: "Projects", items: missing });
    }
    return {
      pending,
      totalItems: sections.reduce((n, s) => n + s.items, 0),
      sections,
    };
  },
);

/**
 * Admin: copy everything the public site currently shows into the database
 * and mark it as owned by the admin. Idempotent; the public site looks the
 * same before and after. The difference is that every entry is now editable
 * and deletable in the admin panel, and cleared fields stay cleared.
 */
export const adoptCodeContent = createServerFn({ method: "POST", strict: false }).handler(
  async ({ context }: any) => {
    await requireAdmin(context.request);
    const db = getDb();
    const now = new Date();
    const own = (doc: any) => ({ ...(doc ?? {}), additionsApplied: true });
    let changed = 0;
    await db.transaction(async (tx) => {
      for (const page of ADOPTABLE_PAGES) {
        const [row] = await tx.select().from(pages).where(eq(pages.slug, page.slug)).limit(1);
        if (!row) {
          const content = own(mergePage(page.slug, null));
          await tx.insert(pages).values({
            slug: page.slug,
            title: page.title,
            kind: page.kind,
            published: content as PageContent,
            staged: content as PageContent,
            sort: 99,
            publishedAt: now,
            updatedAt: now,
            isPublic: true,
          });
          changed++;
          continue;
        }
        const pubOwned = (row.published as any)?.additionsApplied === true;
        const stagedOwned = (row.staged as any)?.additionsApplied === true;
        if (pubOwned && stagedOwned && row.isPublic) continue;
        // What visitors see right now (a non-public row shows the code content).
        const published = pubOwned
          ? row.published
          : own(mergePage(page.slug, row.isPublic ? row.published : null));
        const staged = stagedOwned ? row.staged : own(mergePage(page.slug, row.staged));
        await tx
          .update(pages)
          .set({
            published: published as PageContent,
            staged: staged as PageContent,
            isPublic: true,
            updatedAt: now,
          })
          .where(eq(pages.slug, page.slug));
        changed++;
      }

      const projectRows = await tx
        .select({
          slug: projects.slug,
          published: projects.published,
          staged: projects.staged,
          isPublic: projects.isPublic,
          sort: projects.sort,
        })
        .from(projects);
      let sort = projectRows.reduce((m, r) => Math.max(m, r.sort ?? 0), 0) + 1;
      for (const p of projectsMissingFromDb(new Set(projectRows.map((r) => r.slug)))) {
        await tx.insert(projects).values({
          slug: p.slug,
          published: p,
          staged: p,
          isPublic: true,
          sort: sort++,
          publishedAt: now,
          updatedAt: now,
        });
        changed++;
      }
      for (const r of projectRows) {
        if (!r.isPublic) continue;
        const published = fillProjectFromAdditions(r.published);
        if (JSON.stringify(published) === JSON.stringify(r.published)) continue;
        await tx
          .update(projects)
          .set({ published, staged: fillProjectFromAdditions(r.staged), updatedAt: now })
          .where(eq(projects.slug, r.slug));
        changed++;
      }

      const flags = { additionsAdopted: true, adoptedAt: now.toISOString() } as any;
      await tx
        .insert(settings)
        .values({ id: CONTENT_FLAGS_ID, published: flags, staged: flags, updatedAt: now })
        .onConflictDoUpdate({
          target: settings.id,
          set: { published: flags, staged: flags, updatedAt: now },
        });
    });
    return { ok: true, changed };
  },
);

/** Top-level sections that participate in nav reordering. */
export const NAV_SLUGS = [
  "overview",
  "education",
  "projects",
  "blog",
  "skills",
  "experience",
  "volunteering",
  "resume",
  "contact",
] as const;

/**
 * Public read path for the DB-persisted nav order (no admin session required).
 *
 * The full order — including sections that have no `pages` row (projects/blog/
 * contact) — is stored in the dedicated `settings` row id="nav". An empty array
 * means "no saved order yet": the public menu then uses its canonical default
 * (Overview, Education, Projects, …) so it is always deterministic.
 */
export const getPublishedNavOrder = createServerFn({ method: "GET", strict: false }).handler(
  async () => {
    try {
      const db = getDb();
      const navRow = await db
        .select({ published: settings.published })
        .from(settings)
        .where(eq(settings.id, "nav"))
        .limit(1);
      const stored = (navRow[0]?.published as any)?.order;
      if (!Array.isArray(stored) || stored.length === 0) return [];
      const known = new Set<string>(NAV_SLUGS);
      return stored.map(String).filter((s) => known.has(s));
    } catch (err) {
      console.error("[getPublishedNavOrder] db unavailable, using additions only", err);
      return [];
    }
  },
);

export const exportBackup = createServerFn({ method: "GET", strict: false }).handler(
  async ({ context }) => {
    const { request } = context as any;
    await requireAdmin(request);
    const db = getDb();
    const [allPages, allProjects, allPosts, allSettings] = await Promise.all([
      db.select().from(pages),
      db.select().from(projects),
      db.select().from(posts),
      db.select().from(settings),
    ]);
    const backup = {
      exportedAt: new Date().toISOString(),
      pages: allPages.map((r: any) => ({ slug: r.slug, published: r.published, sort: r.sort })),
      projects: allProjects.map((r: any) => ({
        slug: r.slug,
        published: r.published,
        sort: r.sort,
      })),
      posts: allPosts.map((r: any) => ({ slug: r.slug, published: r.published, sort: r.sort })),
      settings: allSettings.map((r: any) => ({ id: r.id, published: r.published })),
    };
    return backup;
  },
);
// ---------------------------------------------------------------------------
// Media library
//
// Bytes live in Supabase Storage (bucket `media`), never inside a serverless
// request body: Vercel caps function request bodies at 4.5 MB, and Workers
// cap them at 100 MB. The browser uploads directly with a signed URL.
// ---------------------------------------------------------------------------

const MEDIA_BUCKET = "media";

const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
]);

function httpError(message: string, statusCode: number) {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/** Every content document that could reference an asset URL. */
async function findMediaReferences(url: string): Promise<{ kind: string; ref: string }[]> {
  const db = getDb();
  const like = `%${url}%`;
  const result: any = await db.execute(sql`
    select 'post' as kind, slug as ref from posts
      where published::text like ${like} or staged::text like ${like}
    union all
    select 'project' as kind, slug as ref from projects
      where published::text like ${like} or staged::text like ${like}
    union all
    select 'page' as kind, slug as ref from pages
      where published::text like ${like} or staged::text like ${like}
    union all
    select 'site settings' as kind, id as ref from settings
      where published::text like ${like} or staged::text like ${like}
    union all
    select 'blog settings' as kind, id as ref from blog_settings
      where value::text like ${like}
  `);
  const rows = Array.isArray(result) ? result : (result?.rows ?? []);
  return rows as { kind: string; ref: string }[];
}

export const createMediaUpload = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();

    const name = String(data?.name ?? "upload").slice(0, 200);
    const type = String(data?.type ?? "");
    const size = Number(data?.size ?? 0);
    if (!Number.isFinite(size) || size <= 0) throw httpError("File is empty", 400);
    if (size > mediaMaxBytes()) {
      throw httpError(
        `File is too large (${(size / 1024 / 1024).toFixed(1)} MB). Limit is ${(
          mediaMaxBytes() /
          1024 /
          1024
        ).toFixed(0)} MB.`,
        413,
      );
    }
    if (!ALLOWED_MEDIA_TYPES.has(type)) {
      throw httpError(`Unsupported file type: ${type || "unknown"}`, 415);
    }

    const id = crypto.randomUUID();
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-") || "file";
    const storagePath = `${id}-${safeName}`;

    const supabase = getSupabaseServer();
    const { data: signed, error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUploadUrl(storagePath);
    if (error || !signed) {
      throw httpError(
        `Storage is not configured: ${error?.message ?? "could not create upload URL"}`,
        500,
      );
    }
    const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);

    const row = await db
      .insert(mediaAssets)
      .values({
        id,
        url: pub.publicUrl,
        name,
        type,
        size,
        storagePath,
        width: data?.width ? Number(data.width) : null,
        height: data?.height ? Number(data.height) : null,
        alt: typeof data?.alt === "string" ? data.alt : null,
        caption: typeof data?.caption === "string" ? data.caption : null,
        uploadedAt: new Date(),
      })
      .returning();

    return {
      asset: row[0],
      path: signed.path,
      token: signed.token,
      signedUrl: signed.signedUrl,
      maxBytes: mediaMaxBytes(),
    };
  },
);

export const listMedia = createServerFn({ method: "GET", strict: false }).handler(
  async ({ context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    return await db.select().from(mediaAssets).orderBy(mediaAssets.uploadedAt);
  },
);

export const updateMedia = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const id = String(data?.id ?? "");
    if (!id) throw httpError("Missing media id", 400);
    const patch: any = {};
    if (typeof data.alt === "string") patch.alt = data.alt;
    if (typeof data.caption === "string") patch.caption = data.caption;
    if (typeof data.name === "string" && data.name.trim()) patch.name = data.name.trim();
    if (!Object.keys(patch).length) return { ok: true };
    const row = await db.update(mediaAssets).set(patch).where(eq(mediaAssets.id, id)).returning();
    return { ok: true, asset: row[0] ?? null };
  },
);

export const getMediaUsage = createServerFn({ method: "GET", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const id = String(data?.id ?? "");
    const db = getDb();
    const row = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
    if (!row[0]) return [];
    return findMediaReferences(row[0].url);
  },
);

export const deleteMedia = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const id = String(data?.id ?? "");
    if (!id) throw httpError("Missing media id", 400);

    const row = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
    if (!row[0]) throw httpError("Media not found", 404);
    const asset = row[0];

    const refs = await findMediaReferences(asset.url);
    if (refs.length) {
      const where = refs
        .slice(0, 4)
        .map((r) => `${r.kind} “${r.ref}”`)
        .join(", ");
      throw httpError(
        `This file is still used by ${where}${refs.length > 4 ? ` and ${refs.length - 4} more` : ""}. Remove it from those first.`,
        409,
      );
    }

    if (asset.storagePath) {
      const supabase = getSupabaseServer();
      const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([asset.storagePath]);
      if (error) throw httpError(`Could not remove file from storage: ${error.message}`, 500);
    }

    await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
    return { ok: true };
  },
);

// ---------------------------------------------------------------------------
// Editor embeds (Koenig `cardConfig.fetchEmbed`)
// ---------------------------------------------------------------------------

/** Only public http(s) hosts — never localhost, private ranges or IP literals. */
function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw httpError("That doesn't look like a valid URL.", 400);
  }
  const host = url.hostname.toLowerCase();
  if (
    !/^https?:$/.test(url.protocol) ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
    host.includes(":") ||
    !host.includes(".")
  ) {
    throw httpError("Only public web addresses can be embedded.", 400);
  }
  return url;
}

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function bookmarkMetadata(url: URL) {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
    headers: { accept: "text/html", "user-agent": "Mozilla/5.0 (compatible; PortfolioBot/1.0)" },
  });
  assertPublicUrl(res.url || url.href);
  if (!res.ok) throw httpError(`The page returned ${res.status}.`, 502);
  const html = await readCapped(res, 512 * 1024);
  const meta = (name: string) => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`,
      "i",
    );
    const m = re.exec(html);
    return m ? decodeEntities(m[1] ?? m[2] ?? "") : "";
  };
  const abs = (href: string) => {
    try {
      return href ? new URL(href, res.url || url.href).href : "";
    } catch {
      return "";
    }
  };
  const title =
    meta("og:title") || decodeEntities(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? "");
  const iconHref = /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i.exec(
    html,
  )?.[1];
  return {
    title: title || url.hostname,
    description: meta("og:description") || meta("description"),
    thumbnail: abs(meta("og:image")),
    icon: abs(iconHref ?? "/favicon.ico"),
    publisher: meta("og:site_name") || url.hostname.replace(/^www\./, ""),
    author: meta("author") || meta("article:author"),
  };
}

/**
 * Koenig contract: `{type: "bookmark"}` → `{url, metadata}`; otherwise an
 * oEmbed object (`type`, `html`, …) or `{type: "bookmark", url, metadata}`
 * when the URL has no oEmbed provider (e.g. GitHub). Admin-only.
 */
export const fetchEmbedData = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const url = assertPublicUrl(String(data?.url ?? "").trim());
    const wantsBookmark = data?.type === "bookmark";

    if (!wantsBookmark) {
      const provider = OEMBED_PROVIDERS.find((p) => p.test.test(url.href));
      if (provider) {
        const res = await fetch(provider.endpoint + encodeURIComponent(url.href), {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw httpError("That content couldn't be found or isn't embeddable.", 422);
        const oembed = (await res.json()) as Record<string, unknown>;
        return { ...oembed, type: oembed["type"] ?? "video", url: url.href };
      }
    }

    const metadata = await bookmarkMetadata(url);
    return wantsBookmark
      ? { url: url.href, metadata }
      : { type: "bookmark", url: url.href, metadata };
  },
);

// ---------------------------------------------------------------------------
// Résumé / CV (settings row id "resume"; see src/lib/resume.ts)
// ---------------------------------------------------------------------------

const RESUME_PATH_RE = /^resume\/[0-9a-f-]{36}\.pdf$/;

async function readResumeRow(): Promise<{
  staged: ResumeDoc | null;
  published: ResumeDoc | null;
  visible: boolean;
}> {
  const row = await getDb()
    .select({ staged: settings.staged, published: settings.published })
    .from(settings)
    .where(eq(settings.id, "resume"))
    .limit(1);
  const staged = (row[0]?.staged as unknown as ResumeSettings | undefined)?.current ?? null;
  const published = (row[0]?.published as unknown as ResumeSettings | undefined)?.current ?? null;
  const visible = isResumeVisible(row[0]?.published as unknown as ResumeSettings | undefined);
  return { staged, published, visible };
}

async function writeResumeRow(next: { staged: ResumeDoc | null; published: ResumeDoc | null }) {
  const staged = { current: next.staged } as any;
  const published = { current: next.published } as any;
  const now = new Date();
  await getDb()
    .insert(settings)
    .values({ id: "resume", staged, published, updatedAt: now })
    .onConflictDoUpdate({
      target: settings.id,
      set: {
        // Change only the document so uploads/publishing cannot reset visibility.
        staged: sql`jsonb_set(coalesce(${settings.staged}, '{}'::jsonb), '{current}', ${JSON.stringify(next.staged)}::jsonb)`,
        published: sql`jsonb_set(coalesce(${settings.published}, '{}'::jsonb), '{current}', ${JSON.stringify(next.published)}::jsonb)`,
        updatedAt: now,
      },
    });
}

/** Delete résumé objects no longer referenced by the staged or published copy. */
async function removeOrphanedResumeFiles(
  request: Request,
  candidates: (ResumeDoc | null)[],
  keep: (ResumeDoc | null)[],
) {
  const kept = new Set(keep.filter(Boolean).map((d) => d!.storagePath));
  const paths = [...new Set(candidates.filter(Boolean).map((d) => d!.storagePath))].filter(
    (p) => !kept.has(p) && RESUME_PATH_RE.test(p),
  );
  if (!paths.length) return;
  const { error } = await getSupabaseServer().storage.from(MEDIA_BUCKET).remove(paths);
  // The document change already succeeded; a leftover file is harmless.
  if (error) console.error("[resume] could not remove old file(s):", error.message);
}

/** Public: metadata of the published résumé (never the storage path). */
export const getPublishedResume = createServerFn({ method: "GET", strict: false }).handler(
  async (): Promise<PublicResumeSettings> => {
    try {
      const { published, visible } = await readResumeRow();
      return publicResumeSettings({ current: published, visible });
    } catch (err) {
      console.error("[getPublishedResume] db unavailable", err);
      return { current: null, visible: false };
    }
  },
);

/** Admin: both copies, with a direct URL for previewing the staged file. */
export const getResumeAdmin = createServerFn({ method: "GET", strict: false }).handler(
  async ({ context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const { staged, published, visible } = await readResumeRow();
    const supabase = getSupabaseServer();
    const urlFor = (d: ResumeDoc | null) =>
      d ? supabase.storage.from(MEDIA_BUCKET).getPublicUrl(d.storagePath).data.publicUrl : null;
    return {
      staged,
      published,
      visible,
      stagedUrl: urlFor(staged),
      publishedUrl: urlFor(published),
    };
  },
);

/** Visibility saves immediately and retains both the published PDF and draft. */
export const setResumeVisibility = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    await requireAdmin(context.request);
    if (typeof data?.visible !== "boolean")
      throw httpError("Choose whether to show the résumé.", 400);
    const visible = data.visible;
    await writeSectionVisibility("resume", visible);
    return { ok: true, visible };
  },
);

/** Public flags only; hidden content remains available to its admin editors. */
export const getPublishedSectionVisibility = createServerFn({
  method: "GET",
  strict: false,
}).handler(async (): Promise<SectionVisibility> => {
  try {
    return await readSectionVisibility();
  } catch (error) {
    console.error("[getPublishedSectionVisibility] db unavailable", error);
    // Preserve the existing résumé failure behavior and other sections' defaults.
    return { resume: false };
  }
});

export const getSectionVisibilityAdmin = createServerFn({ method: "GET", strict: false }).handler(
  async ({ context }: any) => {
    await requireAdmin(context.request);
    return readSectionVisibility();
  },
);

export const setSectionVisibility = createServerFn({ method: "POST", strict: false })
  .inputValidator((data: { section: keyof SectionVisibility; visible: boolean }) => data)
  .handler(async ({ data, context }: any) => {
    await requireAdmin(context.request);
    if (!isPublicSection(data?.section) || typeof data?.visible !== "boolean")
      throw httpError("Choose a supported section and whether to show it.", 400);
    await writeSectionVisibility(data.section, data.visible);
    return { ok: true, section: data.section, visible: data.visible };
  });

/** Admin step 1: validate the file description and hand out a signed upload URL. */
export const createResumeUpload = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const name = String(data?.name ?? "");
    const type = String(data?.type ?? "");
    const size = Number(data?.size ?? 0);
    if (!Number.isFinite(size) || size <= 0) throw httpError("The file is empty.", 400);
    if (size > RESUME_MAX_BYTES) {
      throw httpError(
        `The file is too large (${(size / 1024 / 1024).toFixed(1)} MB). The limit is ${
          RESUME_MAX_BYTES / 1024 / 1024
        } MB.`,
        413,
      );
    }
    if (type !== RESUME_MIME || !/\.pdf$/i.test(name)) {
      throw httpError("Only PDF files can be used as the résumé.", 415);
    }

    // Random object name: the original filename is kept in the DB only.
    const storagePath = `resume/${crypto.randomUUID()}.pdf`;
    const { data: signed, error } = await getSupabaseServer()
      .storage.from(MEDIA_BUCKET)
      .createSignedUploadUrl(storagePath);
    if (error || !signed) {
      throw httpError(`Storage is not configured: ${error?.message ?? "no upload URL"}`, 500);
    }
    return { storagePath, signedUrl: signed.signedUrl };
  },
);

/**
 * Admin step 2 (after the browser uploaded the bytes): verify the stored
 * object really is a PDF of the declared size, then make it the staged
 * résumé. On any failure the new object is deleted and the current résumé
 * stays exactly as it was.
 */
export const stageResume = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const storagePath = String(data?.storagePath ?? "");
    if (!RESUME_PATH_RE.test(storagePath)) throw httpError("Invalid upload reference.", 400);

    const supabase = getSupabaseServer();
    const discard = async () => {
      await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
    };
    const publicUrl = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath).data.publicUrl;

    // Server-side content check: the first bytes must be the PDF signature.
    let size = 0;
    try {
      const res = await fetch(publicUrl, {
        headers: { range: "bytes=0-1023" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`storage returned ${res.status}`);
      const total = /\/(\d+)$/.exec(res.headers.get("content-range") ?? "")?.[1];
      size = Number(total ?? res.headers.get("content-length") ?? 0);
      const head = new Uint8Array(await res.arrayBuffer()).subarray(0, 1024);
      const signature = new TextDecoder("latin1").decode(head);
      if (!signature.includes("%PDF-")) {
        await discard();
        throw httpError("That file is not a valid PDF.", 422);
      }
    } catch (err: any) {
      if (err?.statusCode) throw err;
      await discard().catch(() => {});
      throw httpError(`Could not verify the upload: ${err?.message ?? "unknown error"}`, 502);
    }
    if (!size || size > RESUME_MAX_BYTES) {
      await discard();
      throw httpError("The uploaded file is empty or exceeds the size limit.", 413);
    }

    const before = await readResumeRow();
    const staged: ResumeDoc = {
      storagePath,
      fileName: safeResumeFileName(String(data?.fileName ?? "Resume.pdf")),
      size,
      uploadedAt: new Date().toISOString(),
      version: storagePath.slice("resume/".length, "resume/".length + 8),
    };
    await writeResumeRow({ staged, published: before.published });
    await removeOrphanedResumeFiles(request, [before.staged], [staged, before.published]);
    return { ok: true, staged };
  },
);

/** Admin: publish the staged résumé (staged → published). */
export const publishResume = createServerFn({ method: "POST", strict: false }).handler(
  async ({ context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const before = await readResumeRow();
    if (!before.staged) throw httpError("Upload a résumé before publishing.", 400);
    await writeResumeRow({ staged: before.staged, published: before.staged });
    await removeOrphanedResumeFiles(request, [before.published], [before.staged]);
    return { ok: true };
  },
);

/** Admin: drop an unpublished upload and go back to the published résumé. */
export const discardResumeDraft = createServerFn({ method: "POST", strict: false }).handler(
  async ({ context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const before = await readResumeRow();
    await writeResumeRow({ staged: before.published, published: before.published });
    await removeOrphanedResumeFiles(request, [before.staged], [before.published]);
    return { ok: true };
  },
);

/** Admin: remove the résumé entirely (public section shows no document). */
export const removeResume = createServerFn({ method: "POST", strict: false }).handler(
  async ({ context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const before = await readResumeRow();
    await writeResumeRow({ staged: null, published: null });
    await removeOrphanedResumeFiles(request, [before.staged, before.published], []);
    return { ok: true };
  },
);

// ---------------------------------------------------------------------------
// Session probe (used by the /onlyme route guard)
// ---------------------------------------------------------------------------

/**
 * Why the server does or doesn't accept this browser's session. The login
 * page uses it so it only forwards to /onlyme when the server agrees —
 * otherwise the two would bounce the visitor back and forth forever.
 */
export const getAdminStatus = createServerFn({ method: "GET", strict: false }).handler(
  async ({ context }: any) => {
    const { request } = context;
    try {
      const { data, error } = await getSupabaseServer().auth.getUser();
      if (error || !data.user)
        return { ok: false as const, reason: "no-session" as const, email: null };
      const email = data.user.email ?? null;
      if (!isAllowedAdmin(email)) {
        return { ok: false as const, reason: "not-allowed" as const, email };
      }
      return { ok: true as const, reason: "ok" as const, email };
    } catch {
      return { ok: false as const, reason: "unreachable" as const, email: null };
    }
  },
);

/** Admin: can the server reach the database right now? */
export const checkDatabase = createServerFn({ method: "GET", strict: false }).handler(
  async ({ context }: any) => {
    await requireAdmin(context.request);
    const started = Date.now();
    try {
      await getDb().execute(sql`select 1`);
      return { ok: true, ms: Date.now() - started };
    } catch (error: any) {
      console.error("[checkDatabase] probe failed", {
        code: error?.cause?.code ?? error?.code ?? error?.name,
      });
      return { ok: false, ms: Date.now() - started };
    }
  },
);

export const getAdminUser = createServerFn({ method: "GET", strict: false }).handler(
  async ({ context }: any) => {
    const { request } = context;
    const user = await getAuthUser();
    if (!user) return null;
    return { id: user.id, email: user.email ?? null };
  },
);

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Contact form submission
// ---------------------------------------------------------------------------

const CONTACT_LIMITS = {
  name: 100,
  email: 254,
  subject: 120,
  message: 5000,
  honeypot: 200,
} as const;

/** Accepted submissions allowed per client IP, per rolling window. */
const RATE_WINDOWS = [
  { ms: 10 * 60 * 1000, max: 3 },
  { ms: 60 * 60 * 1000, max: 5 },
  { ms: 24 * 60 * 60 * 1000, max: 10 },
] as const;

/** Same person, same text, within this window = duplicate. */
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;

const ALLOWED_SUBJECTS = new Set([
  "general",
  "project",
  "freelance",
  "job",
  "tech",
  "business",
  "feedback",
  "issue",
  "other",
]);

/** Strip control characters, trim, and hard-cap the length. */
function cleanText(value: unknown, max: number): string {
  return (
    String(value ?? "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .replace(/\r\n/g, "\n")
      .trim()
      .slice(0, max)
  );
}

/** Escape user text before it goes into the notification email HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getClientIp(request?: Request): string {
  if (!request?.headers) return "unknown";
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for") ?? "";
  const candidate =
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    forwarded.split(",")[0] ||
    "unknown";
  return candidate.trim().slice(0, 100) || "unknown";
}

/** Server-side Cloudflare Turnstile check. Skipped when no secret is configured. */
async function verifyTurnstile(token: string, ip: string): Promise<void> {
  const secret = getEnv("TURNSTILE_SECRET_KEY");
  if (!secret) return; // not configured yet — don't block real visitors
  if (!token) throw new Error("Please complete the verification challenge.");

  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);

  let payload: any = null;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    payload = await res.json();
  } catch {
    throw new Error("Could not verify the challenge. Please try again.");
  }

  if (!payload?.success) {
    const codes: string[] = Array.isArray(payload?.["error-codes"]) ? payload["error-codes"] : [];
    console.log("[sendContactEmail] Turnstile rejected:", codes.join(",") || "invalid");
    if (codes.includes("timeout-or-duplicate")) {
      throw new Error("That verification has expired. Please refresh and try again.");
    }
    throw new Error("Verification failed. Please refresh the page and try again.");
  }
}

export const sendContactEmail = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const request: Request | undefined = context?.request;

    // 1. Honeypot — bots fill hidden fields, humans never see them.
    const honeypot = cleanText(data?.honeypot, CONTACT_LIMITS.honeypot);
    if (honeypot) {
      console.log("[sendContactEmail] Honeypot triggered, rejecting submission");
      throw new Error("Invalid submission");
    }

    // 2. Normalise + length-cap every field.
    const name = cleanText(data?.name, CONTACT_LIMITS.name);
    const email = cleanText(data?.email, CONTACT_LIMITS.email).toLowerCase();
    const message = cleanText(data?.message, CONTACT_LIMITS.message);
    const subjectCategory = cleanText(data?.subject_category, 32);
    let customSubject = cleanText(data?.custom_subject, CONTACT_LIMITS.subject);

    if (!name || !email || !message || !subjectCategory) {
      throw new Error("Please fill in your name, email, subject and message.");
    }
    if (!ALLOWED_SUBJECTS.has(subjectCategory)) {
      throw new Error("Please choose a valid subject.");
    }

    // 3. Strict format checks.
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      throw new Error("Please enter a valid email address.");
    }
    if (message.length < 10) {
      throw new Error("Please write a slightly longer message (at least 10 characters).");
    }
    if (subjectCategory === "other" && !customSubject) {
      throw new Error("Please specify your subject.");
    }

    let subjectText = subjectCategory;
    if (subjectCategory === "other") {
      subjectText = customSubject;
    } else {
      customSubject = "";
    }
    if (!subjectText) throw new Error("Please choose a subject.");

    // 4. Turnstile (no-op until keys are configured).
    await verifyTurnstile(cleanText(data?.turnstile_token, 4096), getClientIp(request));

    const db = getDb();
    const ipHash = sha256(`contact:${getClientIp(request)}`);
    const contentHash = sha256(
      `${email}|${subjectCategory}|${message.toLowerCase().replace(/\s+/g, " ")}`,
    );

    // 5. Rate limit per IP (rolling windows, survives page refresh).
    const widest = RATE_WINDOWS[RATE_WINDOWS.length - 1] ?? { ms: 86_400_000, max: 10 };
    const recent = await db
      .select({ createdAt: contactMessages.createdAt })
      .from(contactMessages)
      .where(
        and(
          eq(contactMessages.ipHash, ipHash),
          gte(contactMessages.createdAt, new Date(Date.now() - widest.ms)),
        ),
      );

    const now = Date.now();
    for (const window of RATE_WINDOWS) {
      const used = recent.filter(
        (row) => now - new Date(row.createdAt).getTime() < window.ms,
      ).length;
      if (used >= window.max) {
        console.log("[sendContactEmail] Rate limit hit:", ipHash.slice(0, 12), window.ms);
        throw new Error(
          "You've sent several messages recently. Please wait a little before sending another.",
        );
      }
    }

    // 6. Duplicate detection (same email + same content, short cooldown).
    const duplicates = await db
      .select({ id: contactMessages.id })
      .from(contactMessages)
      .where(
        and(
          eq(contactMessages.contentHash, contentHash),
          gte(contactMessages.createdAt, new Date(now - DUPLICATE_WINDOW_MS)),
        ),
      )
      .limit(1);
    if (duplicates.length > 0) {
      console.log("[sendContactEmail] Duplicate submission blocked");
      throw new Error("This message was already sent. Please wait before sending it again.");
    }

    // 7. Persist first — a failed email must never lose the submission.
    const id = crypto.randomUUID();
    await db.insert(contactMessages).values({
      id,
      name,
      email,
      subject_category: subjectCategory,
      custom_subject: customSubject || null,
      message,
      ipHash,
      contentHash,
      emailDeliveryStatus: "pending",
    });

    // 8. Notify the owner. Failures are recorded, not thrown.
    const smtpHost = getEnv("SMTP_HOST");
    const smtpPort = Number(getEnv("SMTP_PORT") || 587);
    const smtpUser = getEnv("SMTP_USER");
    const smtpPass = getEnv("SMTP_PASS");
    const smtpFrom = getEnv("SMTP_FROM");
    const smtpTo = getEnv("SMTP_TO");

    let deliveryStatus = "skipped";
    if (smtpHost && smtpUser && smtpPass && smtpFrom && smtpTo) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });

        const safeName = escapeHtml(name);
        const safeEmail = escapeHtml(email);

        // Site identity for email branding (matches the website header).
        const siteRow = await db.select().from(settings).where(eq(settings.id, "site")).limit(1);
        const site = siteRow[0]?.published ?? {};
        const siteName = (site as any)?.name ?? "Portfolio";
        const siteEdition = (site as any)?.edition ?? "2026";

        const { html, text, subject } = contactNotificationEmail({
          name: safeName,
          email: safeEmail,
          subject: subjectText,
          customSubject,
          message,
          siteName,
          siteEdition,
        });

        await transporter.sendMail({
          from: `Portfolio Contact <${smtpFrom}>`,
          to: smtpTo,
          // Replies go to the visitor, never "From" (protects the verified sender).
          replyTo: `${name.replace(/[\r\n"]/g, " ")} <${email}>`,
          subject,
          text,
          html,
        });

        deliveryStatus = "sent";
      } catch (err: any) {
        deliveryStatus = "failed";
        console.log("[sendContactEmail] Email failed:", err?.message ?? err);
      }
    } else {
      console.log("[sendContactEmail] SMTP not configured, skipping email send");
    }

    try {
      await db
        .update(contactMessages)
        .set({ emailDeliveryStatus: deliveryStatus })
        .where(eq(contactMessages.id, id));
    } catch (err: any) {
      console.log("[sendContactEmail] Could not record delivery status:", err?.message ?? err);
    }

    return { ok: true };
  },
);
