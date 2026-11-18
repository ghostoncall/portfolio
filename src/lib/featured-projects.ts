import type { Block, PageContent, Project } from "@/content/site";
import type { SiteIdentity } from "@/db/schema";
import { COPY_DEFAULTS, copyText, featuredCount } from "@/lib/site-copy";

export type FeaturedProjectsBlock = Extract<Block, { type: "featured-projects" }>;
export type OverviewProject = Project & { sort?: number };
export type BlocksPage = Extract<PageContent, { kind: "blocks" }>;

/** Preserve the current published selection until the owner edits its list. */
export function overviewProjects(
  projects: OverviewProject[],
  site: SiteIdentity,
): OverviewProject[] {
  return projects
    .filter((project) => project.status !== "archived")
    .sort(
      (a, b) =>
        Number(b.featured ?? 0) - Number(a.featured ?? 0) ||
        Number(b.priority ?? 0) - Number(a.priority ?? 0) ||
        Number(a.sort ?? 0) - Number(b.sort ?? 0),
    )
    .slice(0, featuredCount(site));
}

export function featuredSlugs(
  block: FeaturedProjectsBlock,
  projects: OverviewProject[],
  site: SiteIdentity,
): string[] {
  return Array.isArray(block.projectSlugs)
    ? [...new Set(block.projectSlugs.filter((slug) => typeof slug === "string" && slug.length > 0))]
    : overviewProjects(projects, site).map((project) => project.slug);
}

export function selectedFeaturedProjects(
  block: FeaturedProjectsBlock,
  projects: OverviewProject[],
  site: SiteIdentity,
): OverviewProject[] {
  const available = new Map(
    projects
      .filter((project) => project.status !== "archived")
      .map((project) => [project.slug, project]),
  );
  return featuredSlugs(block, projects, site).flatMap((slug) => {
    const project = available.get(slug);
    return project ? [project] : [];
  });
}

/**
 * Keep the public Overview payload limited to projects its blocks can render.
 * Legacy pages still receive their original automatic selection; an adopted
 * page with no Featured Work block intentionally receives none.
 */
export function overviewProjectCatalog(
  page: BlocksPage,
  projects: OverviewProject[],
  site: SiteIdentity,
): OverviewProject[] {
  const blocks = page.blocks.filter(
    (block): block is FeaturedProjectsBlock => block.type === "featured-projects",
  );
  if (!page.featuredWorkManaged && !blocks.length) return overviewProjects(projects, site);
  const selected = blocks.flatMap((block) => selectedFeaturedProjects(block, projects, site));
  return [...new Map(selected.map((project) => [project.slug, project])).values()];
}

export function featuredHeading(block: FeaturedProjectsBlock, site: SiteIdentity): string {
  if (block.heading !== undefined) return block.heading;
  return (
    copyText(site, "featuredHeading") ||
    (block.visible === true ? COPY_DEFAULTS.featuredHeading : "")
  );
}

export function featuredVisible(block: FeaturedProjectsBlock, site: SiteIdentity): boolean {
  return block.visible ?? Boolean(copyText(site, "featuredHeading"));
}

/** In-memory adoption only. Save/publish persists through the existing Overview draft. */
export function editableOverview(page: BlocksPage): BlocksPage {
  const hasFeature = page.blocks.some((block) => block.type === "featured-projects");
  return {
    ...page,
    featuredWorkManaged: true,
    blocks:
      page.featuredWorkManaged || hasFeature
        ? page.blocks
        : [...page.blocks, { type: "featured-projects" }],
  };
}

/** Code additions historically appeared immediately before the automatic feature. */
export function withOverviewAdditions(blocks: Block[], additions: Block[]): Block[] {
  const index = blocks.findIndex((block) => block.type === "featured-projects");
  if (index < 0) return [...blocks, ...additions];
  return [...blocks.slice(0, index), ...additions, ...blocks.slice(index)];
}
