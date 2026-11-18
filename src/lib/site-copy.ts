// Site wording that used to be hard-coded in route files. Everything here is
// editable in /onlyme/settings (navigation, page titles and wording) and stored on the
// `site` settings row (SiteIdentity.copy), which the root loader already
// fetches — so reading it costs no extra request.
//
// Rules:
//  - undefined → the built-in default below.
//  - "" on a line that can be hidden (profile photo, "Featured Work", contact
//    lines, footer CTA) → that line is not rendered at all.
//  - Page titles and nav labels can't be hidden; empty → default.
import type { PageCopy, SiteCopy, SiteIdentity } from "@/db/schema";
import { plainText } from "@/lib/rich-inline";

export type PublicPageSlug =
  | "overview"
  | "education"
  | "projects"
  | "blog"
  | "skills"
  | "certificates"
  | "awards"
  | "experience"
  | "volunteering"
  | "resume"
  | "contact";

type PageDefault = {
  /** Admin label for the page. */
  name: string;
  path: string;
  /** Large heading at the top of the page ("" = the site name, Overview only). */
  title: string;
  /** Label in the site menu. */
  navLabel: string;
  /** Search-engine / link-preview description. */
  description: string;
};

export const PAGE_DEFAULTS: Record<PublicPageSlug, PageDefault> = {
  overview: {
    name: "Overview",
    path: "/",
    title: "",
    navLabel: "Overview",
    description:
      "Portfolio of an AI engineer: LLM applications, retrieval, computer vision and MLOps.",
  },
  education: {
    name: "Education",
    path: "/education",
    title: "Education",
    navLabel: "Education",
    description:
      "Academic qualifications, degrees, coursework, research interests, and scholarly achievements.",
  },
  projects: {
    name: "Projects",
    path: "/projects",
    title: "Selected Projects",
    navLabel: "Projects",
    description: "AI projects: LLM apps, agents, retrieval systems and computer vision.",
  },
  blog: {
    name: "Blog",
    path: "/blog",
    // The blog's page heading lives in Blog settings.
    title: "Blog",
    navLabel: "Blog",
    description: "Writing on AI engineering.",
  },
  skills: {
    name: "Skills",
    path: "/skills",
    title: "Skills",
    navLabel: "Skills, Certificates & Awards",
    description:
      "Technical skills in AI engineering: LLMs, agents, RAG, deep learning, MLOps, and more.",
  },
  certificates: {
    name: "Certificates",
    path: "/certificates",
    title: "Certificates",
    navLabel: "Certificates",
    description: "Certifications and credentials in AI engineering and related fields.",
  },
  awards: {
    name: "Awards",
    path: "/awards",
    title: "Awards & Recognitions",
    navLabel: "Awards & Recognitions",
    description: "Academic awards, scholarships, honours, and competition recognitions.",
  },
  experience: {
    name: "Experience",
    path: "/experience",
    title: "Experience",
    navLabel: "Experience",
    description: "Professional experience building AI and software products.",
  },
  volunteering: {
    name: "Volunteering",
    path: "/volunteering",
    title: "Volunteering",
    navLabel: "Volunteering",
    description:
      "Volunteering beyond engineering — causes, communities, reflections and what I want to contribute next.",
  },
  resume: {
    name: "Résumé / CV",
    path: "/resume",
    title: "Résumé / CV",
    navLabel: "Résumé / CV",
    description: "The current résumé / CV.",
  },
  contact: {
    name: "Contact",
    path: "/contact",
    title: "Correspondence",
    navLabel: "Contact",
    description: "Get in touch about AI projects and roles.",
  },
};

export const PUBLIC_PAGE_SLUGS = Object.keys(PAGE_DEFAULTS) as PublicPageSlug[];

export const COPY_DEFAULTS = {
  homeBrand: "engineerthisaryan",
  profileImage: "/images/profile.webp",
  profileAlt: "",
  featuredHeading: "Featured Work",
  featuredCount: 3,
  contactHeading: "Have a project or role in mind?",
  contactLead: "Write to",
  contactFormNote: "Or use the form below.",
  contactThanks: "Thank you — your message has been noted.",
  footerCtaHeading: "Have a project or role in mind?",
  footerCtaLink: "Get in touch",
} as const;

type HideableKey =
  | "profileImage"
  | "profileAlt"
  | "featuredHeading"
  | "contactHeading"
  | "contactLead"
  | "contactFormNote"
  | "contactThanks"
  | "footerCtaHeading"
  | "footerCtaLink";

const trimmed = (v: unknown): string | undefined => (typeof v === "string" ? v.trim() : undefined);

/** A copy line: the saved value ("" hides it), else the default. */
export function copyText(site: SiteIdentity | undefined, key: HideableKey | "homeBrand"): string {
  const saved = trimmed(site?.copy?.[key]);
  if (saved !== undefined && (saved !== "" || key !== "homeBrand")) return saved;
  return COPY_DEFAULTS[key];
}

export function featuredCount(site: SiteIdentity | undefined): number {
  const n = Number(site?.copy?.featuredCount);
  return Number.isFinite(n) && n >= 0 ? Math.min(12, Math.round(n)) : COPY_DEFAULTS.featuredCount;
}

/** Resolved wording for one public page. */
export function pageCopy(
  site: SiteIdentity | undefined,
  slug: PublicPageSlug,
): { title: string; navLabel: string; childNavLabel: string; description: string } {
  const d = PAGE_DEFAULTS[slug];
  const saved: PageCopy = site?.copy?.pages?.[slug] ?? {};
  return {
    title: trimmed(saved.title) || d.title || site?.name || "",
    navLabel: trimmed(saved.navLabel) || d.navLabel,
    childNavLabel:
      trimmed(saved.childNavLabel) || trimmed(saved.title) || d.title || site?.name || "",
    description: trimmed(saved.description) || d.description,
  };
}

/** Standard <head> meta for a public page, from its (editable) copy. */
export function pageMeta(site: SiteIdentity | undefined, slug: PublicPageSlug) {
  const name = plainText(site?.name ?? "Portfolio");
  const copy = pageCopy(site, slug);
  const title = plainText(copy.title);
  const description = plainText(copy.description);
  const full =
    slug === "overview"
      ? `${name} — ${plainText(site?.title ?? "AI Engineer")}`
      : `${title} — ${name}`;
  return [
    { title: full },
    { name: "description", content: description },
    { property: "og:title", content: full },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}

/** Only same-site paths and http(s) URLs are allowed as image sources. */
export function safeImageSrc(src: string): string {
  if (!src) return "";
  return /^(\/(?!\/)|https?:\/\/)/i.test(src) ? src : "";
}

/** Strip unknown keys and coerce types before saving (admin side). */
export function cleanCopy(copy: SiteCopy | undefined): SiteCopy {
  const out: SiteCopy = {};
  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 600) : undefined);
  for (const key of Object.keys(COPY_DEFAULTS) as (keyof typeof COPY_DEFAULTS)[]) {
    if (key === "featuredCount") continue;
    const v = str(copy?.[key]);
    if (v !== undefined) (out as Record<string, unknown>)[key] = v;
  }
  if (copy?.featuredCount !== undefined && Number.isFinite(Number(copy.featuredCount))) {
    out.featuredCount = Math.max(0, Math.min(12, Math.round(Number(copy.featuredCount))));
  }
  const pages: Record<string, PageCopy> = {};
  for (const slug of PUBLIC_PAGE_SLUGS) {
    const p = copy?.pages?.[slug];
    if (!p) continue;
    const entry: PageCopy = {};
    if (str(p.title)?.trim()) entry.title = str(p.title)!.trim();
    if (str(p.navLabel)?.trim()) entry.navLabel = str(p.navLabel)!.trim();
    if (slug === "skills" && str(p.childNavLabel)?.trim())
      entry.childNavLabel = str(p.childNavLabel)!.trim();
    if (str(p.description)?.trim()) entry.description = str(p.description)!.trim();
    if (Object.keys(entry).length) pages[slug] = entry;
  }
  if (Object.keys(pages).length) out.pages = pages;
  return out;
}
