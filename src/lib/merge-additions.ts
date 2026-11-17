/* eslint-disable @typescript-eslint/no-explicit-any */
// Merges git-tracked additions (src/content/additions.ts) into content that
// already lives on the site. Existing entries always win on an id/slug clash;
// additions are only appended, never replacing anything.
import * as add from "@/content/additions";
import * as seed from "@/content/site";

type WithId = { id?: string; slug?: string };

/** Lower-case, drop parentheticals ("(BVCOE)"), punctuation and extra spaces. */
function norm(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Semantic identity per collection. Admin-created entries get their own ids,
 * so an addition describing the same thing (e.g. the B.Tech degree) must also
 * match on meaning — otherwise it is appended a second time.
 */
type KeyFn = (x: any) => string | null;
const byId: KeyFn = () => null;
const KEYS = {
  education: (e) =>
    e.degree ? `${norm(e.degree)}|${norm(e.institution).split(" ").slice(0, 3).join(" ")}` : null,
  experience: (e) => (e.role ? `${norm(e.role)}|${norm(e.org).split(" ")[0]}` : null),
  awards: (a) => (a.title ? norm(a.title) : null),
  certificates: (c) =>
    c.credentialId ? `id:${norm(c.credentialId)}` : c.title ? norm(c.title) : null,
  skills: (s) => (s.name ? norm(s.name) : null),
  categories: (c) => (c.name ? norm(c.name) : null),
  volunteering: (v) => (v.title ? `${norm(v.title)}|${norm(v.organisation)}` : null),
} satisfies Record<string, KeyFn>;

const isEmpty = (v: unknown) => v == null || v === "" || (Array.isArray(v) && v.length === 0);

/**
 * Append additions that don't already exist. When an addition matches an
 * existing entry (by id/slug or by meaning), the existing entry wins and only
 * its *empty* fields are filled from the addition — nothing is overwritten
 * and nothing is duplicated.
 */
function appendNew<T extends WithId>(
  existing: T[] | undefined,
  extra: T[],
  key: KeyFn = byId,
): T[] {
  const base = (Array.isArray(existing) ? existing : []).map((x) => ({ ...x }));
  const index = new Map<string, number>();
  base.forEach((x, i) => {
    const id = x.id ?? x.slug;
    if (id) index.set(`#${id}`, i);
    const k = key(x);
    if (k && !index.has(k)) index.set(k, i);
  });
  const added: T[] = [];
  for (const x of extra) {
    const id = x.id ?? x.slug;
    const k = key(x);
    let hit = id ? index.get(`#${id}`) : undefined;
    if (hit === undefined && k) hit = index.get(k);
    if (hit === undefined) {
      added.push(x);
      if (k) index.set(k, base.length + added.length - 1);
      continue;
    }
    const target = base[hit] as Record<string, unknown> | undefined;
    if (!target) continue;
    for (const [field, value] of Object.entries(x)) {
      if (field === "id" || field === "slug" || field === "sort") continue;
      if (isEmpty(target[field]) && !isEmpty(value)) target[field] = value;
    }
  }
  return [...base, ...added];
}

export function mergeProjects<T extends WithId>(rows: T[], useSeed = false): T[] {
  if (useSeed) rows = seed.projects as unknown as T[];
  return appendNew(rows, add.projects as unknown as T[]);
}

/** `raw` is the published page content from the DB (or null when absent). */
export function mergePage(slug: string, raw: any, useSeed = false): any {
  if (raw == null && useSeed) {
    // Database unreachable (e.g. local dev without .env): show the original
    // seed content, with the additions merged in.
    raw = seedPage(slug);
  }
  switch (slug) {
    case "overview": {
      // Once the admin has taken ownership (flag set by the Overview editor),
      // the page is exactly what they saved. Before that, append only the
      // additions that aren't already on the page.
      if (raw?.additionsApplied) return raw;
      return {
        ...(raw ?? { kind: "blocks" }),
        blocks: [...(raw?.blocks ?? []), ...missingOverviewAdditions(raw?.blocks)],
      };
    }
    case "skills":
      return {
        ...(raw ?? { kind: "skills" }),
        categories: appendNew(raw?.categories, add.skills.categories, KEYS.categories),
        skills: appendNew(raw?.skills, add.skills.skills, KEYS.skills),
      };
    case "certificates":
      return {
        ...(raw ?? { kind: "certificates" }),
        certificates: appendNew(
          raw?.certificates,
          add.certificates.certificates,
          KEYS.certificates,
        ),
      };
    case "education":
      return {
        ...(raw ?? { kind: "education" }),
        entries: appendNew(raw?.entries, add.education.entries, KEYS.education),
      };
    case "awards":
      return {
        ...(raw ?? { kind: "awards" }),
        entries: appendNew(raw?.entries, add.awards.entries, KEYS.awards),
      };
    case "experience":
      return {
        ...(raw ?? { kind: "experience" }),
        entries: appendNew(raw?.entries, add.experience.entries, KEYS.experience),
      };
    case "volunteering":
      return raw
        ? {
            ...raw,
            entries: appendNew(raw.entries, add.volunteering.entries, KEYS.volunteering),
          }
        : add.volunteering;
    default:
      return raw;
  }
}

/** Overview additions not already present on the page (compared by text). */
export function missingOverviewAdditions(blocks: any[] | undefined): any[] {
  const text = (b: any) => norm(b?.body ?? b?.text ?? "");
  const present = new Set((blocks ?? []).map(text));
  return add.overviewAdditions.filter((b) => !present.has(text(b)));
}

/** What the public Overview shows right now (used to seed a missing row). */
export function liveOverviewBlocks(rawPublished: any | null): any[] {
  return mergePage("overview", rawPublished)?.blocks ?? [];
}

function seedPage(slug: string): any {
  switch (slug) {
    case "overview":
      return { kind: "blocks", blocks: seed.overview };
    case "skills":
      return seed.skills;
    case "certificates":
      return seed.certificates;
    case "education":
      return seed.education;
    case "awards":
      return seed.awards;
    case "experience":
      return seed.experience;
    case "volunteering":
      return seed.volunteering;
    default:
      return null;
  }
}

/** Site identity as currently live on engineerthisaryan.com. */
export const SITE_FALLBACK = {
  name: "Aryan Mehndiratta",
  title: "AI Engineer",
  edition: "Portfolio 2026 Edition",
  email: "engineerthisaryan@gmail.com",
  socials: [
    { label: "GitHub", href: "https://github.com/amehnd" },
    { label: "LinkedIn", href: "https://linkedin.com/in/aryann-m" },
  ],
};

export const SEED_POSTS = seed.posts as any[];
