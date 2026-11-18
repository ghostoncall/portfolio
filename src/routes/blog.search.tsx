/* eslint-disable @typescript-eslint/no-explicit-any */
// Blog search across Tech Blogs and My Journal.
//
// Results come from the Postgres search (full text + typo-tolerant fuzzy
// match; drafts, scheduled and private posts are excluded inside the
// database), with a plain fallback search on the server if that isn't
// available. Results update as you type; the query and filters live in the
// URL so refresh, Back and shared links all keep them.
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Search, X } from "lucide-react";
import { getBlogSettings, getBlogTags, searchPosts } from "@/lib/server-fns";
import type { BlogSettings } from "@/lib/blog-settings";
import { BLOG_SECTION_IDS, sectionPath, type BlogSectionId } from "@/lib/blog-sections";
import { plainText, Rich } from "@/lib/rich-inline";
import { PageShell } from "@/components/PageShell";
import { siteFromRoot } from "@/lib/root-data";
import { pageCopy } from "@/lib/site-copy";
import { formatDate } from "@/lib/format-date";

type SearchQuery = {
  q?: string;
  section?: BlogSectionId;
  tag?: string;
  sort?: "relevance" | "newest" | "oldest";
  page?: number;
};

export const Route = createFileRoute("/blog/search")({
  validateSearch: (s: Record<string, unknown>): SearchQuery => ({
    ...(typeof s["q"] === "string" && s["q"] ? { q: s["q"] } : {}),
    ...(s["section"] === "tech" || s["section"] === "journal" ? { section: s["section"] } : {}),
    ...(typeof s["tag"] === "string" && s["tag"] ? { tag: s["tag"] } : {}),
    ...(s["sort"] === "newest" || s["sort"] === "oldest" ? { sort: s["sort"] } : {}),
    ...(Number(s["page"]) > 1 ? { page: Math.floor(Number(s["page"])) } : {}),
  }),
  loader: async ({ parentMatchPromise }) => {
    const [settings, site] = await Promise.all([
      (getBlogSettings as any)() as Promise<BlogSettings>,
      siteFromRoot(parentMatchPromise, "blog"),
    ]);
    return { settings, site };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `Search articles — ${plainText(loaderData?.site?.name ?? "Portfolio")}` },
      // Result pages are endless permutations; keep them out of search engines.
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: SearchPage,
});

const PER_PAGE = 10;
const field =
  "min-h-[44px] border border-input bg-background px-3 text-base text-foreground outline-none focus:border-ring";

type Result = {
  slug: string;
  title: string;
  dek: string;
  date: string;
  tags: string[];
  readTime?: string;
  section?: BlogSectionId;
};

function SearchPage() {
  const { settings, site } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/blog/search" });

  const [input, setInput] = useState(search.q ?? "");
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [headlines, setHeadlines] = useState<(string | null)[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const requestId = useRef(0);

  const sections = BLOG_SECTION_IDS.filter((id) => settings.sections[id].visible);
  const q = search.q ?? "";
  const page = search.page ?? 1;
  // A section on its own (arriving from Tech Blogs / My Journal) isn't a
  // search yet — show the prompt rather than "no articles match".
  const active = Boolean(q.trim() || search.tag);

  // Typing updates the URL (and so the results) after a short pause.
  useEffect(() => {
    if (input === q) return;
    const t = window.setTimeout(() => {
      void navigate({
        search: (prev: SearchQuery) => {
          const next: SearchQuery = { ...prev };
          if (input.trim()) next.q = input;
          else delete next.q;
          delete next.page;
          return next;
        },
        replace: true,
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [input, q, navigate]);

  // Keep the box in sync when the URL changes (Back/Forward).
  useEffect(() => setInput(q), [q]);

  useEffect(() => {
    (getBlogTags as any)()
      .then((rows: any) => setTags(Array.isArray(rows) ? rows : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!active) {
      setResults([]);
      setTotal(0);
      setSearched(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    (searchPosts as any)({
      data: {
        query: q.trim() || null,
        tag: search.tag ?? null,
        section: search.section ?? null,
        sort: search.sort ?? (q.trim() ? "relevance" : "newest"),
        page,
        perPage: PER_PAGE,
      },
    })
      .then((data: any) => {
        if (id !== requestId.current) return; // a newer search is on its way
        setResults(data.posts ?? []);
        setHeadlines(data.headline ?? []);
        setTotal(Number(data.total ?? 0));
        setSearched(true);
      })
      .catch(() => {
        if (id !== requestId.current) return;
        setError("Search isn't available right now. Please try again in a moment.");
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [active, q, search.tag, search.section, search.sort, page]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const setFilter = (patch: { [K in keyof SearchQuery]?: SearchQuery[K] | undefined }) =>
    navigate({
      search: (prev: SearchQuery) => {
        const next: any = { ...prev, ...patch };
        delete next.page;
        for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === "") delete next[k];
        return next;
      },
      replace: true,
    });

  const status = useMemo(() => {
    if (!active) return "";
    if (loading && !searched) return "Searching…";
    const what = q.trim() ? `for “${q.trim()}”` : "";
    return `${total} ${total === 1 ? "article" : "articles"} ${what}`.trim();
  }, [active, loading, searched, total, q]);

  const blogLabel = pageCopy(site, "blog").navLabel;
  // "Back" returns to the section the visitor came from (or Tech Blogs).
  const backTo: BlogSectionId =
    search.section && settings.sections[search.section].visible ? search.section : "tech";
  const backName = plainText(settings.sections[backTo].name);

  return (
    <PageShell crumbs={[blogLabel, "Search"]} title="Search articles" site={site}>
      <Link
        to={sectionPath(backTo)}
        className="mb-6 inline-flex min-h-[48px] items-center gap-2 border border-foreground/60 bg-background px-5 text-base font-semibold text-foreground transition-colors hover:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span aria-hidden="true">←</span> Back to {backName}
      </Link>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="space-y-4">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search by title, topic or word…"
            aria-label="Search articles"
            className={`${field} w-full pl-10 pr-12`}
          />
          {input && (
            <button
              type="button"
              onClick={() => setInput("")}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {sections.length > 1 && (
            <select
              aria-label="Filter by section"
              value={search.section ?? ""}
              onChange={(e) => setFilter({ section: (e.target.value || undefined) as any })}
              className={field}
            >
              <option value="">All sections</option>
              {sections.map((id) => (
                <option key={id} value={id}>
                  {plainText(settings.sections[id].name)}
                </option>
              ))}
            </select>
          )}
          {tags.length > 0 && (
            <select
              aria-label="Filter by tag"
              value={search.tag ?? ""}
              onChange={(e) => setFilter({ tag: e.target.value || undefined })}
              className={field}
            >
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t.tag} value={t.tag}>
                  {t.tag} ({t.count})
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Sort results"
            value={search.sort ?? "relevance"}
            onChange={(e) =>
              setFilter({ sort: e.target.value === "relevance" ? undefined : (e.target.value as any) })
            }
            className={field}
          >
            <option value="relevance">Best match</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          {active && (
            <button
              type="button"
              onClick={() => {
                setInput("");
                void navigate({ search: {}, replace: true });
              }}
              className="min-h-[44px] px-2 text-sm font-semibold text-link hover:underline"
            >
              Reset
            </button>
          )}
        </div>
      </form>

      <p role="status" aria-live="polite" className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        {loading && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
        {status}
      </p>

      {error && (
        <p role="alert" className="mt-4 border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!active ? (
        <div className="mt-6 border border-dashed border-border px-6 py-12 text-center">
          <p className="font-serif text-lg text-foreground">Type a word or topic to find articles.</p>
          {tags.length > 0 && (
            <div className="mt-5">
              <p className="text-sm text-muted-foreground">Or browse a topic:</p>
              <ul className="mt-3 flex flex-wrap justify-center gap-2">
                {tags.slice(0, 12).map((t) => (
                  <li key={t.tag}>
                    <button
                      type="button"
                      onClick={() => setFilter({ tag: t.tag })}
                      className="min-h-[44px] border border-border px-3 text-sm hover:bg-muted"
                    >
                      {t.tag}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : searched && results.length === 0 && !loading ? (
        <div className="mt-6 border border-dashed border-border px-6 py-12 text-center">
          <p className="font-serif text-lg text-foreground">No articles match that search.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try fewer or shorter words
            {search.tag || search.section ? ", or remove a filter" : ""}.
          </p>
        </div>
      ) : (
        <ul className={`mt-4 border-t border-border transition-opacity ${loading ? "opacity-60" : ""}`}>
          {results.map((post, i) => {
            const sec = post.section ?? "tech";
            const headline = headlines[i] ? plainText(String(headlines[i]).replace(/<[^>]+>/g, "")) : "";
            return (
              <li key={post.slug} className="border-b border-border">
                <Link to="/blog/$slug" params={{ slug: post.slug }} className="group block py-5">
                  <span className="label-caps flex flex-wrap gap-x-1.5 text-muted-foreground">
                    <span className="text-foreground">{plainText(settings.sections[sec].name)}</span>
                    {post.date && (
                      <>
                        <span aria-hidden="true">·</span>
                        <time dateTime={post.date}>{formatDate(post.date)}</time>
                      </>
                    )}
                    {post.readTime && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{post.readTime}</span>
                      </>
                    )}
                  </span>
                  <span className="mt-1 block font-display text-2xl leading-tight text-foreground group-hover:underline">
                    <Rich text={post.title} />
                  </span>
                  {post.dek && (
                    <span className="mt-1 block font-serif text-muted-foreground">
                      <Rich text={post.dek} />
                    </span>
                  )}
                  {headline && headline !== plainText(post.dek) && (
                    <span className="mt-2 block text-sm text-muted-foreground">{headline}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {active && totalPages > 1 && (
        <nav aria-label="Search result pages" className="mt-8 flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => navigate({ search: (p: SearchQuery) => ({ ...p, page: page - 1 }) })}
            className="min-h-[44px] font-semibold text-link hover:underline disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => navigate({ search: (p: SearchQuery) => ({ ...p, page: page + 1 }) })}
            className="min-h-[44px] font-semibold text-link hover:underline disabled:opacity-40"
          >
            Next →
          </button>
        </nav>
      )}

      <p className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {sections.map((id) => (
          <Link key={id} to={sectionPath(id)} className="inline-flex min-h-[44px] items-center font-semibold text-link hover:underline">
            ← <span className="ml-1">{plainText(settings.sections[id].name)}</span>
          </Link>
        ))}
      </p>
    </PageShell>
  );
}
