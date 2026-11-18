/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures */
import { describe, expect, it } from "vitest";
import { searchInPosts, suggestInPosts, tagsInPosts } from "@/lib/post-search";

const posts = [
  {
    slug: "rag",
    title: "How I Evaluate **Retrieval**-Augmented Systems",
    dek: "Golden sets and failure taxonomies.",
    date: "2026-10-12",
    tags: ["RAG", "Evaluation"],
    blocks: [],
    body: { html: "<p>Start with a <b>golden set</b> of questions.</p>" },
  },
  {
    slug: "team",
    title: "What my first team taught me",
    dek: "A journal entry.",
    date: "2026-11-01",
    tags: ["Teamwork"],
    blocks: [],
    section: "journal",
    body: { html: "<p>Retrieval of memories from the hackathon.</p>" },
  },
] as any[];

describe("fallback blog search", () => {
  it("finds posts by word prefix, ranking title matches first", () => {
    const r = searchInPosts(posts, { query: "retriev" });
    expect(r.posts.map((p) => p.slug)).toEqual(["rag", "team"]);
    expect(r.total).toBe(2);
  });

  it("requires every word and searches the body", () => {
    expect(searchInPosts(posts, { query: "golden questions" }).posts.map((p) => p.slug)).toEqual(["rag"]);
    expect(searchInPosts(posts, { query: "golden hackathon" }).total).toBe(0);
  });

  it("filters by section and tag, and lists by date without a query", () => {
    expect(searchInPosts(posts, { query: "retrieval", section: "journal" }).posts.map((p) => p.slug)).toEqual(["team"]);
    expect(searchInPosts(posts, { tag: "rag" }).posts.map((p) => p.slug)).toEqual(["rag"]);
    expect(searchInPosts(posts, { section: "tech" }).posts.map((p) => p.slug)).toEqual(["rag"]);
    expect(searchInPosts(posts, {}).posts.map((p) => p.slug)).toEqual(["team", "rag"]);
  });

  it("returns a body snippet and section for each result", () => {
    const r = searchInPosts(posts, { query: "golden" });
    expect(r.headline[0]).toContain("golden set");
    expect(r.posts[0]!.section).toBe("tech");
  });

  it("suggests titles and tags, and counts tags", () => {
    expect(suggestInPosts(posts, "team").map((s) => s.label)).toEqual([
      "What my first team taught me",
      "Teamwork",
    ]);
    expect(tagsInPosts(posts)).toContainEqual({ tag: "RAG", count: 1 });
  });
});
