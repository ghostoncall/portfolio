// Search over published posts in plain TypeScript.
//
// The main search runs in Postgres (search_blog_posts: full text + trigram).
// When that isn't available — database function missing, a timeout, or local
// development without the database — the server falls back to this, so
// visitors always get results instead of a silent "nothing found".
//
// Matching: every word of the query must appear somewhere in the post (title,
// excerpt, tags or body), as a whole word or the start of one ("retriev"
// matches "Retrieval"). Score: title ×4, tags ×3, excerpt ×2, body ×1.
import type { Post } from "@/content/site";
import { plainText } from "@/lib/rich-inline";
import { sectionOf, type BlogSectionId } from "@/lib/blog-sections";

export type SearchParams = {
  query?: string | null;
  tag?: string | null;
  year?: number | string | null;
  featured?: boolean | null;
  section?: BlogSectionId | null;
  sort?: "relevance" | "newest" | "oldest";
  page?: number;
  perPage?: number;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

function bodyText(post: Post): string {
  const html = post.body?.html ?? "";
  const fromHtml = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ");
  const fromBlocks = (post.blocks ?? [])
    .map((b: any) => [b.text, b.body, b.title, b.caption, ...(b.items ?? [])].filter(Boolean).join(" "))
    .join(" ");
  return `${fromHtml} ${fromBlocks}`;
}

function hits(haystack: string, word: string): number {
  const re = new RegExp(`(^| )${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g");
  return (haystack.match(re) ?? []).length;
}

/** A short excerpt around the first match in the body (plain text). */
function snippet(text: string, words: string[]): string | null {
  const plain = text.replace(/\s+/g, " ").trim();
  const lower = plain.toLowerCase();
  const at = Math.min(...words.map((w) => lower.indexOf(w)).filter((i) => i >= 0));
  if (!Number.isFinite(at)) return null;
  const start = Math.max(0, at - 60);
  return `${start > 0 ? "…" : ""}${plain.slice(start, at + 140).trim()}…`;
}

export function searchInPosts(posts: Post[], params: SearchParams) {
  const words = norm(params.query ?? "")
    .split(" ")
    .filter((w) => w.length > 0);
  const year = params.year ? String(params.year) : "";
  const results: { post: Post; score: number; headline: string | null }[] = [];

  for (const post of posts) {
    if (params.section && sectionOf(post) !== params.section) continue;
    if (params.tag && !(post.tags ?? []).some((t) => t.toLowerCase() === params.tag!.toLowerCase()))
      continue;
    if (year && !String(post.date ?? "").startsWith(year)) continue;
    if (params.featured === true && !post.featured) continue;

    const title = norm(plainText(post.title));
    const tags = norm((post.tags ?? []).join(" "));
    const dek = norm(plainText(post.dek));
    const rawBody = bodyText(post);
    const body = norm(rawBody);
    let score = 0;
    let all = true;
    for (const w of words) {
      const s = hits(title, w) * 4 + hits(tags, w) * 3 + hits(dek, w) * 2 + hits(body, w);
      if (!s) {
        all = false;
        break;
      }
      score += s;
    }
    if (words.length && !all) continue;
    results.push({ post, score, headline: words.length ? snippet(rawBody, words) : null });
  }

  const byDate = (a: Post, b: Post) => String(b.date).localeCompare(String(a.date));
  if (params.sort === "oldest") results.sort((a, b) => byDate(b.post, a.post));
  else if (params.sort === "newest" || !words.length) results.sort((a, b) => byDate(a.post, b.post));
  else results.sort((a, b) => b.score - a.score || byDate(a.post, b.post));

  const perPage = Math.max(1, Math.min(50, params.perPage ?? 10));
  const page = Math.max(1, params.page ?? 1);
  const slice = results.slice((page - 1) * perPage, page * perPage);
  return {
    posts: slice.map(({ post }) => ({
      slug: post.slug,
      title: post.title,
      dek: post.dek,
      date: post.date,
      tags: post.tags ?? [],
      readTime: post.readTime,
      author: post.author,
      featured: post.featured,
      section: sectionOf(post),
    })),
    headline: slice.map((r) => r.headline),
    total: results.length,
  };
}

/** Tag list with counts (fallback for get_blog_tags). */
export function tagsInPosts(posts: Post[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of posts) for (const t of p.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
}

/** Title + tag suggestions while typing (fallback for search_blog_suggest). */
export function suggestInPosts(posts: Post[], query: string, limit = 6) {
  const q = norm(query);
  if (q.length < 2) return [];
  const out: { kind: "post" | "tag"; label: string; slug: string }[] = [];
  for (const p of posts) {
    if (norm(plainText(p.title)).includes(q)) out.push({ kind: "post", label: plainText(p.title), slug: p.slug });
  }
  for (const { tag } of tagsInPosts(posts)) {
    if (norm(tag).includes(q)) out.push({ kind: "tag", label: tag, slug: "" });
  }
  return out.slice(0, limit);
}
