// The two editorial sections of the blog: Tech Blogs (the /blog landing) and
// My Journal (/blog/journal). Posts live in one table; a post's `section`
// field decides where it is listed. Everything a visitor reads about a
// section — its name, heading, introduction, image, SEO text, visibility and
// order — is stored in the blog settings row and edited in
// /onlyme/blog-settings → Sections. Nothing here is shown unless the admin
// leaves the defaults in place.

export type BlogSectionId = "tech" | "journal";
export const BLOG_SECTION_IDS: readonly BlogSectionId[] = ["tech", "journal"];

export type BlogSection = {
  /** Short label in the section switcher and article metadata. */
  name: string;
  /** Large heading on the section page. */
  title: string;
  subtitle: string;
  /** Introduction paragraph(s) under the heading. */
  intro: string;
  image: string;
  imageAlt: string;
  /** Hidden sections 404 publicly and drop out of the switcher. Tech Blogs can't be hidden. */
  visible: boolean;
  showInSwitcher: boolean;
  showIntro: boolean;
  /** Position in the switcher (lower first). */
  order: number;
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
  /** Heading/body when the section has no posts yet. */
  emptyHeading: string;
  emptyBody: string;
};

export const DEFAULT_BLOG_SECTIONS: Record<BlogSectionId, BlogSection> = {
  tech: {
    name: "Tech Blogs",
    title: "Tech Blogs",
    subtitle: "",
    intro: "Notes, guides and deep dives on applied AI, LLMs, retrieval and engineering.",
    image: "",
    imageAlt: "",
    visible: true,
    showInSwitcher: true,
    showIntro: true,
    order: 0,
    seoTitle: "",
    seoDescription: "",
    ogImage: "",
    emptyHeading: "Nothing published yet",
    emptyBody: "New technical writing will appear here as soon as it is published.",
  },
  journal: {
    name: "My Journal",
    title: "My Journal",
    subtitle: "",
    intro:
      "Stories from teams, projects and the people I've worked with — what happened, and what I learned.",
    image: "",
    imageAlt: "",
    visible: true,
    showInSwitcher: true,
    showIntro: true,
    order: 1,
    seoTitle: "",
    seoDescription: "",
    ogImage: "",
    emptyHeading: "No journal entries yet",
    emptyBody: "Personal stories and reflections will appear here soon.",
  },
};

/** Public URL of a section's listing. Article URLs stay /blog/<slug> for both. */
export function sectionPath(id: BlogSectionId): "/blog" | "/blog/journal" {
  return id === "journal" ? "/blog/journal" : "/blog";
}

/** Where a post is listed. Posts written before sections existed count as Tech Blogs. */
export function sectionOf(post: { section?: unknown } | null | undefined): BlogSectionId {
  return post?.section === "journal" ? "journal" : "tech";
}

/** True when a post has never been assigned (shown in admin for review). */
export function sectionUnassigned(post: { section?: unknown } | null | undefined): boolean {
  return post?.section !== "tech" && post?.section !== "journal";
}

/**
 * Post slugs that would collide with blog pages (/blog/journal, /blog/search…).
 * Checked when a post is created or renamed.
 */
export const RESERVED_POST_SLUGS = new Set(["journal", "search", "tech", "page", "feed", "rss", "tag", "tags"]);

/** Sections that appear in the switcher, in display order. */
export function switcherSections(
  sections: Record<BlogSectionId, BlogSection>,
): { id: BlogSectionId; section: BlogSection }[] {
  return BLOG_SECTION_IDS.map((id) => ({ id, section: sections[id] }))
    .filter(({ section }) => section.visible && section.showInSwitcher)
    .sort((a, b) => a.section.order - b.section.order);
}
