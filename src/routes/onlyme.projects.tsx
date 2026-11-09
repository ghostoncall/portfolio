/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createItem, deleteItem, listStaged, publishItem, revertItem } from "@/lib/server-fns";

export const Route = createFileRoute("/onlyme/projects")({
  component: Projects,
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

function Projects() {
  const navigate = useNavigate();
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

  React.useEffect(() => {
    (listStaged as any)({ data: { table: "projects" } }).then((rows: any) => setItems(rows));
  }, []);

  async function refresh() {
    const rows = await (listStaged as any)({ data: { table: "projects" } });
    setItems(rows as any);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    setBusy(true);
    try {
      await (createItem as any)({ data: { table: "projects", slug, title } });
      navigate({ to: "/onlyme/projects/$slug", params: { slug } });
    } catch (err: any) {
      setCreateError(err.message ?? "Could not create project");
      setBusy(false);
    }
  }

  async function handleDelete(slug: string) {
    if (!window.confirm(`Delete "${slug}" permanently? This cannot be undone.`)) return;
    setStatus({ slug, kind: "idle" });
    try {
      await (deleteItem as any)({ data: { table: "projects", slug } });
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
      await (publishItem as any)({ data: { table: "projects", slug } });
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
      await (revertItem as any)({ data: { table: "projects", slug } });
      await refresh();
    } catch {
      setStatus({ slug, kind: "error" });
    }
    setTimeout(() => setStatus(null), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/onlyme" className="text-sm text-muted-foreground hover:underline">
            ← Back
          </Link>
          <h2 className="text-lg font-medium text-foreground">Projects</h2>
        </div>
        <button
          onClick={() => setCreating((c) => !c)}
          className="bg-primary px-4 py-2 text-sm text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-colors"
        >
          {creating ? "Cancel" : "+ New project"}
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
              placeholder="My project"
              required
              className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm"
            />
          </div>
          <div>
            <span className="block text-xs font-medium text-muted-foreground mb-1">
              Slug (the URL — /projects/your-slug)
            </span>
            <input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              placeholder="my-project"
              required
              className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm font-mono"
            />
          </div>
          {createError && <p className="text-sm text-destructive">{createError}</p>}
          <button
            type="submit"
            disabled={busy || !title.trim() || !slug.trim()}
            className="bg-primary px-5 py-2 text-sm text-primary-foreground rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-colors"
          >
            {busy ? "Creating…" : "Create & start building"}
          </button>
        </form>
      )}

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                Slug
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                Title
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                Year
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                Live
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                Updated
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const p = item.published as any;
              return (
                <tr key={item.slug} className="border-b border-border hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{item.slug}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{p?.title}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{p?.year}</td>
                  <td className="px-4 py-3 text-sm">
                    {item.isPublic ? (
                      <span className="text-xs text-success">Yes</span>
                    ) : (
                      <span className="text-xs text-destructive">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to="/onlyme/projects/$slug"
                      params={{ slug: item.slug }}
                      className="text-sm text-primary underline"
                    >
                      Edit
                    </Link>{" "}
                    <button
                      onClick={() => handlePublish(item.slug)}
                      disabled={status?.slug === item.slug}
                      className="ml-2 text-xs text-success hover:underline"
                    >
                      Publish
                    </button>{" "}
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
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-muted-foreground">
                  No projects yet — click "+ New project" to add your first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React from "react";
