import { describe, expect, it } from "vitest";
import {
  editableOverview,
  featuredHeading,
  featuredSlugs,
  featuredVisible,
  overviewProjectCatalog,
  overviewProjects,
  selectedFeaturedProjects,
  withOverviewAdditions,
  type BlocksPage,
  type OverviewProject,
} from "@/lib/featured-projects";
import {
  normalizePageContent,
  replaceProjectSlug,
  removeProjectReferences,
} from "@/lib/cms-normalize";
import { mergePage } from "@/lib/merge-additions";
import type { SiteIdentity } from "@/db/schema";
const site: SiteIdentity = { name: "Ada", title: "Engineer", edition: "", email: "", socials: [] };
const project = (slug: string, extra: Partial<OverviewProject> = {}): OverviewProject => ({
  slug,
  title: slug,
  dek: "Unchanged description",
  year: "2026",
  category: "Engineering",
  stack: [],
  blocks: [],
  ...extra,
});
const projects = [
  project("first", { featured: true }),
  project("second", { featured: true, priority: 2 }),
  project("third"),
  project("archived", { status: "archived", priority: 99 }),
];

describe("editable Featured Work", () => {
  it("retains the old automatic selection, heading, count and visibility until edited", () => {
    const block = { type: "featured-projects" } as const;
    expect(featuredSlugs(block, projects, site)).toEqual(
      overviewProjects(projects, site).map((project) => project.slug),
    );
    expect(featuredHeading(block, site)).toBe("Featured Work");
    const legacyHidden = { ...site, copy: { featuredHeading: "", featuredCount: 1 } };
    expect(featuredVisible(block, legacyHidden)).toBe(false);
    expect(selectedFeaturedProjects(block, projects, legacyHidden).map((p) => p.slug)).toEqual([
      "second",
    ]);
    expect(featuredVisible({ ...block, visible: true }, legacyHidden)).toBe(true);
    expect(featuredHeading({ ...block, visible: true }, legacyHidden)).toBe("Featured Work");
  });
  it("adopts one typed block and permanently respects an intentionally removed section", () => {
    const old: BlocksPage = {
      kind: "blocks",
      blocks: [{ type: "text", body: "Original" }],
      additionsApplied: true,
    };
    const adopted = editableOverview(old);
    expect(adopted.blocks.map((b) => b.type)).toEqual(["text", "featured-projects"]);
    expect(editableOverview(adopted)).toEqual(adopted);
    expect(old.blocks).toHaveLength(1);
    const removed = { ...adopted, blocks: old.blocks };
    const reopened = normalizePageContent("blocks", JSON.parse(JSON.stringify(removed)));
    expect(editableOverview(reopened).blocks).toEqual(old.blocks);
    expect(mergePage("overview", reopened).blocks).toEqual(old.blocks);
  });
  it("uses the exact manual order without the automatic count cap, refill or duplicates", () => {
    const before = structuredClone(projects);
    const block = {
      type: "featured-projects",
      projectSlugs: ["third", "first", "third", "missing", "archived", "second"],
    } as const;
    const selected = selectedFeaturedProjects(
      { ...block, projectSlugs: [...block.projectSlugs] },
      projects,
      { ...site, copy: { featuredCount: 1 } },
    );
    expect(selected.map((p) => p.slug)).toEqual(["third", "first", "second"]);
    expect(
      selectedFeaturedProjects({ type: "featured-projects", projectSlugs: [] }, projects, site),
    ).toEqual([]);
    expect(projects).toEqual(before);
  });
  it("sends only renderable Featured Work projects to the public Overview", () => {
    const legacy: BlocksPage = { kind: "blocks", blocks: [{ type: "text", body: "Original" }] };
    expect(overviewProjectCatalog(legacy, projects, site).map((p) => p.slug)).toEqual(
      overviewProjects(projects, site).map((p) => p.slug),
    );
    const managed: BlocksPage = {
      kind: "blocks",
      featuredWorkManaged: true,
      blocks: [
        { type: "featured-projects", projectSlugs: ["third", "first", "missing"] },
        { type: "featured-projects", projectSlugs: ["first", "second"] },
      ],
    };
    expect(overviewProjectCatalog(managed, projects, site).map((p) => p.slug)).toEqual([
      "third",
      "first",
      "second",
    ]);
    expect(overviewProjectCatalog({ ...managed, blocks: [] }, projects, site)).toEqual([]);
  });
  it("preserves selection and order while hidden and follows published project content", () => {
    const block = {
      type: "featured-projects",
      projectSlugs: ["third", "second"],
      heading: "Selected work",
      visible: false,
    } as const;
    const reopened = JSON.parse(JSON.stringify(block));
    expect(featuredVisible(reopened, site)).toBe(false);
    const shown = { ...reopened, visible: true };
    expect(featuredSlugs(shown, projects, site)).toEqual(block.projectSlugs);
    expect(featuredHeading(shown, site)).toBe("Selected work");
    const updated = projects.map((p) =>
      p.slug === "third" ? { ...p, title: "Updated published title" } : p,
    );
    expect(selectedFeaturedProjects(shown, updated, site)[0]!.title).toBe(
      "Updated published title",
    );
  });
  it("keeps existing code additions before the feature during first-time adoption", () => {
    const page = editableOverview({ kind: "blocks", blocks: [{ type: "text", body: "Original" }] });
    const blocks = withOverviewAdditions(page.blocks, [
      { type: "text", body: "Existing addition" },
    ]);
    expect(blocks).toEqual([
      { type: "text", body: "Original" },
      { type: "text", body: "Existing addition" },
      { type: "featured-projects" },
    ]);
  });
  it("participates in the existing project rename/deletion reference cleanup", () => {
    const doc = editableOverview({
      kind: "blocks",
      blocks: [{ type: "featured-projects", projectSlugs: ["first", "second"] }],
      additionsApplied: true,
    });
    const renamed = replaceProjectSlug(doc, "first", "renamed");
    const deleted = removeProjectReferences(renamed.doc, ["second"]);
    const normalized = normalizePageContent("blocks", deleted.doc);
    expect(normalized.blocks[0].projectSlugs).toEqual(["renamed"]);
    expect(normalized.featuredWorkManaged).toBe(true);
    expect(normalized.additionsApplied).toBe(true);
    expect(doc.blocks[0]).toMatchObject({ projectSlugs: ["first", "second"] });
  });
});
