/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  createItem,
  deleteItem,
  getBlogSettings,
  listStaged,
  publishItem,
  reorderPosts,
  revertItem,
  unpublishItem,
} from "@/lib/server-fns";
import { DEFAULT_BLOG_SECTIONS, sectionOf, sectionUnassigned, type BlogSectionId } from "@/lib/blog-sections";
import { plainText } from "@/lib/rich-inline";

export const Route = createFileRoute("/onlyme/blogs")({
  component: Blogs,
});

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function Blogs() {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isListPage = pathname === "/onlyme/blogs";
  const [items, setItems] = React.useState<any[]>([]);
  const [status, setStatus] = React.useState<{
    slug: string;
    kind: "idle" | "ok" | "error";
  } | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [tab, setTab] = React.useState<"all" | BlogSectionId>("all");
  const [newSection, setNewSection] = React.useState<BlogSectionId>("tech");
  const [names, setNames] = React.useState<Record<BlogSectionId, string>>({
    tech: DEFAULT_BLOG_SECTIONS.tech.name,
    journal: DEFAULT_BLOG_SECTIONS.journal.name,
  });
  const [orderNote, setOrderNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isListPage) return;
    (listStaged as any)({ data: { table: "posts" } })
      .then((rows: any) => setItems(Array.isArray(rows) ? rows : []))
      .catch(() => setItems([]));
    (getBlogSettings as any)()
      .then((s: any) =>
        setNames({
          tech: plainText(s.sections.tech.name),
          journal: plainText(s.sections.journal.name),
        }),
      )
      .catch(() => {});
  }, [isListPage]);

  const sectionOfItem = (item: any) => sectionOf(item.staged ?? item.published);
  const visibleItems = tab === "all" ? items : items.filter((i) => sectionOfItem(i) === tab);
  const unassigned = items.filter((i) => sectionUnassigned(i.staged ?? i.published)).length;

  /** Move a post up/down in the manual order (whole list, so tabs stay consistent). */
  async function move(slug: string, dir: -1 | 1) {
    const list = visibleItems.map((i) => i.slug);
    const at = list.indexOf(slug);
    const swapWith = list[at + dir];
    if (at < 0 || !swapWith) return;
    const all = items.map((i) => i.slug);
    const a = all.indexOf(slug);
    const b = all.indexOf(swapWith);
    [all[a], all[b]] = [all[b]!, all[a]!];
    setItems(all.map((s) => items.find((i) => i.slug === s)));
    try {
      await (reorderPosts as any)({ data: { slugs: all } });
      setOrderNote("Order saved. It's used when Blog settings → Post order is “My own order”.");
    } catch (err: any) {
      setOrderNote(err?.message ?? "Couldn't save the order — try again.");
      await refresh();
    }
  }

  async function refresh() {
    const rows = await (listStaged as any)({ data: { table: "posts" } });
    setItems(rows as any);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    setBusy(true);
    try {
      await (createItem as any)({ data: { table: "posts", slug, title, section: newSection } });
      setBusy(false);
      setCreating(false);
      navigate({ to: "/onlyme/blogs/$slug", params: { slug } });
    } catch (err: any) {
      setBusy(false);
      setCreateError(err.message ?? "Could not create post");
    }
  }

  async function handleDelete(slug: string) {
    if (!window.confirm(`Delete "${slug}" permanently? This cannot be undone.`)) return;
    setStatus({ slug, kind: "idle" });
    try {
      await (deleteItem as any)({ data: { table: "posts", slug } });
      await refresh();
      setStatus({ slug, kind: "ok" });
    } catch {
      setStatus({ slug, kind: "error" });
    }
    setTimeout(() => setStatus(null), 2000);
  }

  async function handlePublish(slug: string) {
    setStatus({ slug, kind: "ok" });
    try {
      await (publishItem as any)({ data: { table: "posts", slug } });
      setStatus({ slug, kind: "ok" });
      await refresh();
    } catch {
      setStatus({ slug, kind: "error" });
    }
    setTimeout(() => setStatus(null), 2000);
  }

  async function handleRevert(slug: string) {
    setStatus({ slug, kind: "ok" });
    try {
      await (revertItem as any)({ data: { table: "posts", slug } });
      await refresh();
    } catch {
      setStatus({ slug, kind: "error" });
    }
    setTimeout(() => setStatus(null), 2000);
  }

  async function handleUnpublish(slug: string) {
    if (!window.confirm(`Take this post off the public site? The published copy is kept.`)) return;
    setStatus({ slug, kind: "ok" });
    try {
      await (unpublishItem as any)({ data: { table: "posts", slug } });
      await refresh();
    } catch {
      setStatus({ slug, kind: "error" });
    }
    setTimeout(() => setStatus(null), 2000);
  }

  return (
    <div className="space-y-6">
      {isListPage && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link to="/onlyme" className="text-sm text-muted-foreground hover:underline">
                ← Back
              </Link>
              <h2 className="text-lg font-medium text-foreground">Blogs</h2>
              <Link to="/onlyme/blog-settings" className="ml-2 text-sm text-link underline">
                Section & blog settings
              </Link>
            </div>
            <button
              onClick={() => {
                setNewSection(tab === "journal" ? "journal" : "tech");
                setCreating((c) => !c);
              }}
              className="bg-primary px-4 py-2 text-sm text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-colors"
            >
              {creating ? "Cancel" : "+ New post"}
            </button>
          </div>

          {creating && (
            <form
              onSubmit={handleCreate}
              className="border border-border rounded-lg p-5 space-y-4 bg-muted/30"
            >
              <div>
                <span className="block text-xs font-medium text-muted-foreground mb-1">Title</span>
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!slugTouched) setSlug(slugify(e.target.value));
                  }}
                  placeholder="My first post"
                  required
                  className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm"
                />
              </div>
              <div>
                <span className="block text-xs font-medium text-muted-foreground mb-1">
                  Slug (the URL — /blog/your-slug)
                </span>
                <input
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugTouched(true);
                  }}
                  placeholder="my-first-post"
                  required
                  className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm font-mono"
                />
              </div>
              <fieldset>
                <legend className="mb-1 block text-xs font-medium text-muted-foreground">
                  Section
                </legend>
                <div className="flex flex-wrap gap-4">
                  {(["tech", "journal"] as const).map((id) => (
                    <label key={id} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="new-post-section"
                        checked={newSection === id}
                        onChange={() => setNewSection(id)}
                      />
                      {names[id]}
                    </label>
                  ))}
                </div>
              </fieldset>
              {createError && <p className="text-sm text-destructive">{createError}</p>}
              <button
                type="submit"
                disabled={busy || !title.trim() || !slug.trim()}
                className="bg-primary px-5 py-2 text-sm text-primary-foreground rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-colors"
              >
                {busy ? "Creating…" : "Create & start writing"}
              </button>
            </form>
          )}

          <div role="tablist" aria-label="Filter posts by section" className="flex flex-wrap gap-0 border-b border-border">
            {(
              [
                ["all", "All posts", items.length],
                ["tech", names.tech, items.filter((i) => sectionOfItem(i) === "tech").length],
                ["journal", names.journal, items.filter((i) => sectionOfItem(i) === "journal").length],
              ] as const
            ).map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`-mb-px min-h-[44px] border-b-2 px-4 text-sm transition-colors ${
                  tab === id
                    ? "border-foreground font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label} <span className="text-xs text-muted-foreground">({count})</span>
              </button>
            ))}
          </div>
          {unassigned > 0 && (
            <p className="border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
              {unassigned} {unassigned === 1 ? "post was" : "posts were"} written before sections
              existed and {unassigned === 1 ? "is" : "are"} shown in {names.tech} for now. Open{" "}
              {unassigned === 1 ? "it" : "each"} and pick a section to confirm.
            </p>
          )}
          {orderNote && <p className="text-xs text-muted-foreground">{orderNote}</p>}

          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-2 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    <span className="sr-only">Order</span>
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    Slug
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    Section
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    Title
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item, index) => {
                  const p = item.published as any;
                  const s = item.staged as any;
                  const isPublic = Boolean(item.isPublic);
                  const publishedAt = item.publishedAt ? new Date(item.publishedAt) : null;
                  const isScheduled = isPublic && publishedAt && publishedAt.getTime() > Date.now();
                  const stagedChanged = JSON.stringify(s) !== JSON.stringify(p);
                  const statusLabel = isScheduled
                    ? { text: "Scheduled", kind: "amber" as const }
                    : isPublic
                      ? stagedChanged
                        ? { text: "Changes Pending", kind: "amber" as const }
                        : { text: "Published", kind: "green" as const }
                      : { text: "Draft", kind: "muted" as const };

                  return (
                    <tr key={item.slug} className="border-b border-border hover:bg-muted/30">
                      <td className="px-2 py-2">
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => void move(item.slug, -1)}
                            disabled={index === 0}
                            aria-label={`Move ${plainText(p?.title ?? item.slug)} up`}
                            className="h-6 w-8 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => void move(item.slug, 1)}
                            disabled={index === visibleItems.length - 1}
                            aria-label={`Move ${plainText(p?.title ?? item.slug)} down`}
                            className="h-6 w-8 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                          >
                            ↓
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                        {item.slug}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {names[sectionOfItem(item)]}
                        {sectionUnassigned(s ?? p) && (
                          <span className="ml-1 block text-xs text-amber-700">not assigned yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{plainText(s?.title ?? p?.title)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{p?.date}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`text-xs inline-flex items-center gap-1.5 px-2 py-0.5 rounded ${
                            statusLabel.kind === "green"
                              ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-700"
                              : statusLabel.kind === "amber"
                                ? "border-amber-500/20 bg-amber-500/10 text-amber-700"
                                : "border-border bg-muted text-muted-foreground"
                          }`}
                        >
                          {statusLabel.text}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to="/onlyme/blogs/$slug"
                          params={{ slug: item.slug }}
                          className="text-sm text-primary underline"
                        >
                          Edit
                        </Link>{" "}
                        {isPublic && !isScheduled ? (
                          <>
                            <button
                              onClick={() => handlePublish(item.slug)}
                              disabled={status?.slug === item.slug}
                              className="ml-2 text-xs text-amber-700 hover:underline"
                            >
                              Publish Updates
                            </button>{" "}
                            <button
                              onClick={() => handleUnpublish(item.slug)}
                              disabled={status?.slug === item.slug}
                              className="ml-2 text-xs text-destructive hover:underline"
                            >
                              Unpublish
                            </button>{" "}
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handlePublish(item.slug)}
                              disabled={status?.slug === item.slug}
                              className="ml-2 text-xs text-success hover:underline"
                            >
                              Publish
                            </button>{" "}
                          </>
                        )}
                        <button
                          onClick={() => handleRevert(item.slug)}
                          disabled={status?.slug === item.slug}
                          className="ml-2 text-xs text-muted-foreground hover:underline"
                        >
                          Revert
                        </button>{" "}
                        <button
                          onClick={() => handleDelete(item.slug)}
                          disabled={status?.slug === item.slug}
                          className="ml-2 text-xs text-destructive hover:underline"
                        >
                          Delete
                        </button>
                        {status && status.slug === item.slug && status.kind === "ok" && (
                          <span className="ml-2 text-xs text-success">✓</span>
                        )}
                        {status && status.slug === item.slug && status.kind === "error" && (
                          <span className="ml-2 text-xs text-destructive">✗</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {visibleItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-4 text-center text-muted-foreground">
                      No posts yet — click "+ New post" to write your first one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Outlet />
    </div>
  );
}

import React from "react";
