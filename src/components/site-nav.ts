// One navigation model for both menus (desktop side index + mobile drawer).
// Labels come from Settings → "Page titles & wording", the order from the
// admin's saved nav order, and the project list from the database — so the
// two menus can never drift apart or show stale, hard-coded entries.
import type { SiteIdentity } from "@/db/schema";
import { applyNavOrder, type NavProject } from "@/components/nav-projects";
import { pageCopy, type PublicPageSlug } from "@/lib/site-copy";
import { sectionVisible, type SectionVisibility } from "@/lib/section-visibility";

export type NavChild = { key: string; label: string; to: string; params?: { slug: string } };
export type NavEntry = {
  slug: string;
  label: string;
  to: string;
  /** Sub-pages; undefined when the item has none. */
  children?: NavChild[];
  /** Is this section (or one of its sub-pages) the current page? */
  isActive: (pathname: string) => boolean;
};

const TOP: { slug: PublicPageSlug; to: string }[] = [
  { slug: "overview", to: "/" },
  { slug: "education", to: "/education" },
  { slug: "projects", to: "/projects" },
  { slug: "blog", to: "/blog" },
  { slug: "skills", to: "/skills" },
  { slug: "experience", to: "/experience" },
  { slug: "volunteering", to: "/volunteering" },
  { slug: "resume", to: "/resume" },
  { slug: "contact", to: "/contact" },
];

const SKILL_PATHS = ["/skills", "/certificates", "/awards"];

const clean = (p: string) => (p.length > 1 ? p.replace(/\/$/, "") : p);

export function buildNav(
  site: SiteIdentity | undefined,
  order: string[] | null | undefined,
  projects: NavProject[] | null | undefined,
  resumeVisible = true,
  visibility: SectionVisibility = {},
): NavEntry[] {
  const visible = (slug: PublicPageSlug) =>
    sectionVisible(visibility, slug) && (slug !== "resume" || resumeVisible);
  const entries: NavEntry[] = TOP.flatMap(({ slug, to }): NavEntry[] => {
    const label = pageCopy(site, slug).navLabel;
    if (slug !== "skills" && !visible(slug)) return [];
    if (slug === "projects") {
      return [
        {
          slug,
          label,
          to,
          children: (projects ?? []).map((p) => ({
            key: p.slug,
            label: p.title,
            to: "/projects/$slug",
            params: { slug: p.slug },
          })),
          isActive: (path) => clean(path).startsWith("/projects"),
        },
      ];
    }
    if (slug === "skills") {
      const children = [
        { key: "skills", label: pageCopy(site, "skills").childNavLabel, to: "/skills" },
        {
          key: "certificates",
          label: pageCopy(site, "certificates").navLabel,
          to: "/certificates",
        },
        { key: "awards", label: pageCopy(site, "awards").navLabel, to: "/awards" },
      ].filter((child) => visible(child.key as PublicPageSlug));
      if (!children.length) return [];
      return [
        {
          slug,
          label,
          // Keep the group usable when Skills is hidden but a sibling stays visible.
          to: visible("skills") ? to : children[0]!.to,
          children,
          isActive: (path) => SKILL_PATHS.includes(clean(path)),
        },
      ];
    }
    return [
      {
        slug,
        label,
        to,
        isActive: (path) =>
          to === "/" ? clean(path) === "/" : clean(path) === to || clean(path).startsWith(`${to}/`),
      },
    ];
  });
  return applyNavOrder(entries, order);
}

/** Is this sub-page the current page? */
export function childActive(child: NavChild, pathname: string): boolean {
  const target = child.params ? `/projects/${child.params.slug}` : child.to;
  return clean(pathname) === target;
}
