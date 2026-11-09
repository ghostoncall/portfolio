/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { getStaged, updateStaged, publishItem, revertItem } from "@/lib/server-fns";
import { BlockEditor } from "@/components/admin/BlockEditor";
import type { Project } from "@/content/site";

export const Route = createFileRoute("/onlyme/projects/$slug")({
  component: ProjectEditor,
});

function ProjectEditor() {
  const slug = Route.useParams().slug;
  const [data, setData] = React.useState<{ published: Project; staged: Project } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "ok" | "error">("idle");
  const [title, setTitle] = React.useState("");
  const [dek, setDek] = React.useState("");
  const [year, setYear] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [stackStr, setStackStr] = React.useState("");

  React.useEffect(() => {
    (getStaged as any)({ data: { table: "projects", slug } }).then((d: any) => {
      setData(d);
      const staged = d.staged as Project;
      setTitle(staged.title);
      setDek(staged.dek);
      setYear(staged.year);
      setCategory(staged.category);
      setStackStr(staged.stack.join(", "));
    });
  }, [slug]);

  if (!data) return <div className="text-muted-foreground">Loading…</div>;

  const staged = data.staged as Project;

  const field =
    "w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm";

  async function handleSave() {
    setSaving(true);
    try {
      const next: Project = {
        ...staged,
        title,
        dek,
        year,
        category,
        stack: stackStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        blocks: staged.blocks,
      };
      await (updateStaged as any)({
        data: { table: "projects", slug, content: next, kind: "project" },
      });
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setSaving(true);
    try {
      await (publishItem as any)({ data: { table: "projects", slug } });
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleRevert() {
    setSaving(true);
    try {
      await (revertItem as any)({ data: { table: "projects", slug } });
      const d = await (getStaged as any)({ data: { table: "projects", slug } });
      setData(d as any);
      const s = d.staged as Project;
      setTitle(s.title);
      setDek(s.dek);
      setYear(s.year);
      setCategory(s.category);
      setStackStr(s.stack.join(", "));
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Link to="/onlyme/projects" className="text-sm text-muted-foreground hover:underline">
          ← Projects
        </Link>
        <h2 className="text-lg font-medium text-foreground">{slug}</h2>
      </div>

      <div className="border border-border rounded-lg p-6 space-y-4">
        <label className="block">
          <span className="block text-xs font-medium text-muted-foreground mb-1">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-muted-foreground mb-1">
            Dek (subtitle)
          </span>
          <input value={dek} onChange={(e) => setDek(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-muted-foreground mb-1">Year</span>
          <input value={year} onChange={(e) => setYear(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-muted-foreground mb-1">Category</span>
          <input value={category} onChange={(e) => setCategory(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-muted-foreground mb-1">
            Stack (comma-separated)
          </span>
          <input value={stackStr} onChange={(e) => setStackStr(e.target.value)} className={field} />
        </label>
      </div>

      <div className="border border-border rounded-lg p-6">
        <h3 className="text-sm font-medium text-foreground mb-3">Blocks</h3>
        <BlockEditor
          blocks={staged.blocks}
          onChange={(b) => {
            setData({
              ...data!,
              published: { ...data!.published, blocks: b } as any,
              staged: { ...data!.staged, blocks: b } as any,
            });
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary px-6 py-3 text-primary-foreground rounded-lg font-medium disabled:opacity-50 hover:opacity-90"
        >
          Save staged
        </button>
        <button
          onClick={handlePublish}
          disabled={saving}
          className="border border-input bg-background px-6 py-3 text-foreground rounded-lg font-medium disabled:opacity-50 hover:bg-accent"
        >
          Publish
        </button>
        <button
          onClick={handleRevert}
          disabled={saving}
          className="border border-input bg-background px-6 py-3 text-foreground rounded-lg font-medium disabled:opacity-50 hover:bg-accent"
        >
          Revert
        </button>
      </div>

      {status === "ok" && <p className="text-sm text-success">Saved.</p>}
      {status === "error" && <p className="text-sm text-destructive">Error. Try again.</p>}
    </div>
  );
}

import React from "react";
