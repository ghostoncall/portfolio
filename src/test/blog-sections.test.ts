/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_BLOG_SECTIONS,
  RESERVED_POST_SLUGS,
  sectionOf,
  sectionPath,
  sectionUnassigned,
  switcherSections,
} from "@/lib/blog-sections";
import { DEFAULT_BLOG_SETTINGS, mergeBlogSettings } from "@/lib/blog-settings";
import { orderPosts } from "@/components/public/BlogListing";

const post = (slug: string, date: string, section?: string) =>
  ({ slug, date, section, title: slug, dek: "", tags: [], blocks: [] }) as any;

describe("blog sections", () => {
  it("assigns posts to sections; old posts default to Tech Blogs and are flagged", () => {
    expect(sectionOf(post("a", "2026-01-01", "journal"))).toBe("journal");
    expect(sectionOf(post("b", "2026-01-01", "tech"))).toBe("tech");
    expect(sectionOf(post("c", "2026-01-01"))).toBe("tech");
    expect(sectionOf(post("d", "2026-01-01", "bogus"))).toBe("tech");
    expect(sectionUnassigned(post("c", "2026-01-01"))).toBe(true);
    expect(sectionUnassigned(post("b", "2026-01-01", "tech"))).toBe(false);
  });

  it("keeps article URLs unchanged and reserves listing paths", () => {
    expect(sectionPath("tech")).toBe("/blog");
    expect(sectionPath("journal")).toBe("/blog/journal");
    expect(RESERVED_POST_SLUGS.has("journal")).toBe(true);
    expect(RESERVED_POST_SLUGS.has("search")).toBe(true);
  });

  it("carries the old blog heading/description over to Tech Blogs", () => {
    const s = mergeBlogSettings({ heading: "Writing & Notes", description: "Old intro" });
    expect(s.sections.tech.title).toBe("Writing & Notes");
    expect(s.sections.tech.intro).toBe("Old intro");
    expect(s.sections.journal.name).toBe("My Journal");
    // The shared defaults are never modified by a merge.
    expect(DEFAULT_BLOG_SETTINGS.sections.tech.title).toBe(DEFAULT_BLOG_SECTIONS.tech.title);
  });

  it("never lets the landing section be hidden; journal can be", () => {
    const s = mergeBlogSettings({
      sections: { tech: { visible: false }, journal: { visible: false, name: "Diary" } },
    });
    expect(s.sections.tech.visible).toBe(true);
    expect(s.sections.journal.visible).toBe(false);
    expect(s.sections.journal.name).toBe("Diary");
    expect(switcherSections(s.sections).map((x) => x.id)).toEqual(["tech"]);
  });

  it("orders the switcher and the listing as configured", () => {
    const s = mergeBlogSettings({ sections: { journal: { order: -1 } } });
    expect(switcherSections(s.sections).map((x) => x.id)).toEqual(["journal", "tech"]);
    const posts = [post("old", "2025-01-01"), post("new", "2026-05-01"), post("mid", "2025-09-01")];
    expect(orderPosts(posts, mergeBlogSettings({})).map((p) => p.slug)).toEqual(["new", "mid", "old"]);
    expect(orderPosts(posts, mergeBlogSettings({ listingOrder: "oldest" })).map((p) => p.slug)).toEqual([
      "old",
      "mid",
      "new",
    ]);
    expect(orderPosts(posts, mergeBlogSettings({ listingOrder: "manual" })).map((p) => p.slug)).toEqual([
      "old",
      "new",
      "mid",
    ]);
  });
});
