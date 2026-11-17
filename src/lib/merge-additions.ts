// Merges git-tracked additions (src/content/additions.ts) into content that
// already lives on the site. Existing entries always win on an id/slug clash;
// additions are only appended, never replacing anything.
import * as add from "@/content/additions";
import * as seed from "@/content/site";

type WithId = { id?: string; slug?: string };

function appendNew<T extends WithId>(existing: T[] | undefined, extra: T[]): T[] {
  const base = Array.isArray(existing) ? existing : [];
  const keys = new Set(base.map((x) => x.id ?? x.slug));
  return [...base, ...extra.filter((x) => !keys.has(x.id ?? x.slug))];
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
    case "overview":
      return {
        ...(raw ?? { kind: "blocks" }),
        blocks: [...(raw?.blocks ?? []), ...add.overviewAdditions],
      };
    case "skills":
      return {
        ...(raw ?? { kind: "skills" }),
        categories: appendNew(raw?.categories, add.skills.categories),
        skills: appendNew(raw?.skills, add.skills.skills),
      };
    case "certificates":
      return {
        ...(raw ?? { kind: "certificates" }),
        certificates: appendNew(raw?.certificates, add.certificates.certificates),
      };
    case "education":
      return {
        ...(raw ?? { kind: "education" }),
        entries: appendNew(raw?.entries, add.education.entries),
      };
    case "awards":
      return {
        ...(raw ?? { kind: "awards" }),
        entries: appendNew(raw?.entries, add.awards.entries),
      };
    case "experience":
      return {
        ...(raw ?? { kind: "experience" }),
        entries: appendNew(raw?.entries, add.experience.entries),
      };
    case "volunteering":
      return raw
        ? { ...raw, entries: appendNew(raw.entries, add.volunteering.entries) }
        : add.volunteering;
    default:
      return raw;
  }
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
