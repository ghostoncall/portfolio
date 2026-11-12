// Test-only helpers for the CMS-backed E2E suites.
//
// These talk to the same Supabase project the dev server uses:
//  - snapshot/restore the `experience` page document so a run never leaves
//    test entries published;
//  - remove the media rows + storage objects created by the run so no
//    orphaned files accumulate in the library.
//
// The admin JWT comes from the normal password grant (the same credentials
// the browser test types) — storage delete is allowed for the authenticated
// role, the anon key alone is not.

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

export const ROOT = process.cwd();

export const ADMIN_EMAIL = "abc@gmail.com";
export const ADMIN_PASSWORD = "hello@123abc";

/** Every fixture uploaded by the experience logo suite starts with this. */
export const TEST_MEDIA_PREFIX = "e2e-logo-";
export const TEST_MEDIA_PREFIX_2 = "e2e-not-";

export type PageSnapshot = {
  /** Raw jsonb text, exactly as stored (rendered server-side for the restore). */
  published: string;
  staged: string;
  publishedAt: string | null;
  updatedAt: string | null;
};

function readEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  const file = path.join(ROOT, ".env");
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = readEnv();

function required(name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is missing from .env`);
  return value;
}

function connect() {
  return postgres(required("DATABASE_URL"), {
    prepare: false, // Supabase transaction pooler
    ssl: "require",
    max: 1,
  });
}

export async function snapshotExperiencePage(): Promise<PageSnapshot> {
  const sql = connect();
  try {
    const rows = await sql<
      {
        published: string;
        staged: string;
        published_at: Date | null;
        updated_at: Date | null;
      }[]
    >`
      select published::text as published, staged::text as staged,
             published_at, updated_at
      from pages
      where slug = 'experience'
    `;
    if (!rows[0]) throw new Error("The experience page row does not exist.");
    return {
      published: rows[0].published,
      staged: rows[0].staged,
      publishedAt: rows[0].published_at?.toISOString() ?? null,
      updatedAt: rows[0].updated_at?.toISOString() ?? null,
    };
  } finally {
    await sql.end();
  }
}

export async function restoreExperiencePage(snapshot: PageSnapshot): Promise<void> {
  const sql = connect();
  try {
    // `::text::jsonb` parses the text into a jsonb value. A bare `${str}::jsonb`
    // binds a jsonb *string scalar*, which adds an encoding level per restore.
    await sql`
      update pages
      set published = ${snapshot.published}::text::jsonb,
          staged = ${snapshot.staged}::text::jsonb,
          published_at = ${snapshot.publishedAt},
          updated_at = ${snapshot.updatedAt}
      where slug = 'experience'
    `;
  } finally {
    await sql.end();
  }
}

export type LogoRef = { src?: string; alt?: string };

export type ExperienceEntryRef = {
  role: string;
  org: string;
  logo?: LogoRef;
};

function parseDoc(value: unknown): unknown {
  // The page document is a jsonb string scalar; postgres.js hands back the
  // string contents, so decode until we reach an object.
  let current = value;
  for (let i = 0; i < 3 && typeof current === "string"; i += 1) {
    try {
      current = JSON.parse(current);
    } catch {
      break;
    }
  }
  return current;
}

function entriesOf(doc: unknown): ExperienceEntryRef[] {
  const entries = (parseDoc(doc) as { entries?: unknown })?.entries;
  return Array.isArray(entries) ? (entries as ExperienceEntryRef[]) : [];
}

/**
 * Reads the suite's entry from the staged draft and the published document.
 * Polling this gives a reliable "save/publish finished" signal — no sleeps.
 */
export async function getExperienceEntry(org: string): Promise<{
  staged: ExperienceEntryRef | null;
  published: ExperienceEntryRef | null;
}> {
  const sql = connect();
  try {
    const rows = await sql<{ published: unknown; staged: unknown }[]>`
      select published, staged from pages where slug = 'experience'
    `;
    const staged = entriesOf(rows[0]?.staged).find((e) => e.org === org) ?? null;
    const published = entriesOf(rows[0]?.published).find((e) => e.org === org) ?? null;
    return { staged, published };
  } finally {
    await sql.end();
  }
}

async function adminAccessToken(): Promise<string> {
  const res = await fetch(`${required("VITE_SUPABASE_URL")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: required("VITE_SUPABASE_ANON_KEY"),
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Admin login for cleanup failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Admin login for cleanup returned no access token.");
  return json.access_token;
}

/**
 * Deletes every media row + storage object created by the suite. Returns the
 * filenames that were removed so the test output can prove cleanup happened.
 */
export async function cleanupTestMedia(): Promise<string[]> {
  const sql = connect();
  let rows: { id: string; name: string; storage_path: string | null }[];
  try {
    rows = await sql<{ id: string; name: string; storage_path: string | null }[]>`
      select id, name, storage_path
      from media_assets
      where name like ${TEST_MEDIA_PREFIX + "%"}
         or name like ${TEST_MEDIA_PREFIX_2 + "%"}
    `;
  } finally {
    await sql.end();
  }
  if (rows.length === 0) return [];

  const token = await adminAccessToken();
  const removed: string[] = [];

  for (const row of rows) {
    if (row.storage_path) {
      const res = await fetch(
        `${required("VITE_SUPABASE_URL")}/storage/v1/object/media/${row.storage_path}`,
        {
          method: "DELETE",
          headers: {
            apikey: required("VITE_SUPABASE_ANON_KEY"),
            Authorization: `Bearer ${token}`,
          },
        },
      );
      // 400/404 both mean the object is already gone — that's fine.
      if (!res.ok && res.status !== 400 && res.status !== 404) {
        throw new Error(
          `Could not delete ${row.storage_path} from storage (${res.status}): ${await res.text()}`,
        );
      }
    }
    removed.push(row.name);
  }

  const cleanup = connect();
  try {
    await cleanup`
      delete from media_assets
      where name like ${TEST_MEDIA_PREFIX + "%"}
         or name like ${TEST_MEDIA_PREFIX_2 + "%"}
    `;
  } finally {
    await cleanup.end();
  }

  return removed;
}
