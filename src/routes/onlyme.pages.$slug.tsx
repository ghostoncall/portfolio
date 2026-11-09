/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getStaged, updateStaged, publishItem, revertItem } from "@/lib/server-fns";
import { BlockEditor } from "@/components/admin/BlockEditor";
import { toast } from "sonner";
import type { PageContent, SkillGroup, ExperienceEntry } from "@/db/schema";

export const Route = createFileRoute("/onlyme/pages/$slug")({
  component: PageEditor,
});

const field =
  "w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm";
const label = (t: string) => (
  <span className="block text-xs font-medium text-muted-foreground mb-1">{t}</span>
);

// --- Specialized Editors ---

function SkillsEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const { skills, certificates } = content;

  const updateSkill = (groupIndex: number, itemIndex: number, field: string, value: string) => {
    const next = [...skills];
    next[groupIndex].items[itemIndex] = { ...next[groupIndex].items[itemIndex], [field]: value };
    onChange({ ...content, skills: next });
  };

  const addSkillItem = (groupIndex: number) => {
    const next = [...skills];
    next[groupIndex].items.push({ name: "", detail: "" });
    onChange({ ...content, skills: next });
  };

  const removeSkillItem = (groupIndex: number, itemIndex: number) => {
    const next = [...skills];
    next[groupIndex].items.splice(itemIndex, 1);
    onChange({ ...content, skills: next });
  };

  const updateGroup = (index: number, name: string) => {
    const next = [...skills];
    next[index].group = name;
    onChange({ ...content, skills: next });
  };

  const addGroup = () => {
    onChange({
      ...content,
      skills: [...skills, { group: "New Group", items: [] }],
    });
  };

  const removeGroup = (index: number) => {
    const next = [...skills];
    next.splice(index, 1);
    onChange({ ...content, skills: next });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Skill Groups</h3>
          <button
            onClick={addGroup}
            className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:opacity-90"
          >
            + Add Group
          </button>
        </div>
        {skills.map((group: any, gIdx: number) => (
          <div key={gIdx} className="border border-border rounded-lg p-4 space-y-4 bg-muted/20">
            <div className="flex items-center gap-2">
              <input
                value={group.group}
                onChange={(e) => updateGroup(gIdx, e.target.value)}
                className={`${field} font-medium`}
              />
              <button
                onClick={() => removeGroup(gIdx)}
                className="text-xs text-destructive hover:underline"
              >
                Remove Group
              </button>
            </div>
            <div className="space-y-3">
              {group.items.map((item: any, iIdx: number) => (
                <div key={iIdx} className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    placeholder="Skill name (e.g. React)"
                    value={item.name}
                    onChange={(e) => updateSkill(gIdx, iIdx, "name", e.target.value)}
                    className={field}
                  />
                  <div className="flex gap-2">
                    <input
                      placeholder="Detail (e.g. Proficient in Hooks)"
                      value={item.detail}
                      onChange={(e) => updateSkill(gIdx, iIdx, "detail", e.target.value)}
                      className={field}
                    />
                    <button
                      onClick={() => removeSkillItem(gIdx, iIdx)}
                      className="px-2 text-destructive hover:bg-destructive/10 rounded"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => addSkillItem(gIdx)}
                className="text-xs text-primary hover:underline"
              >
                + Add skill to group
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">Certificates / Additional</h3>
        <BlockEditor
          blocks={certificates}
          onChange={(b) => onChange({ ...content, certificates: b })}
        />
      </div>
    </div>
  );
}

function ExperienceEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const { entries } = content;

  const updateEntry = (index: number, field: string, value: string) => {
    const next = [...entries];
    next[index] = { ...next[index], [field]: value };
    onChange({ ...content, entries: next });
  };

  const addEntry = () => {
    onChange({
      ...content,
      entries: [
        ...entries,
        { role: "", org: "", period: "", blocks: [] },
      ],
    });
  };

  const removeEntry = (index: number) => {
    const next = [...entries];
    next.splice(index, 1);
    onChange({ ...content, entries: next });
  };

  const updateBlocks = (index: number, blocks: any[]) => {
    const next = [...entries];
    next[index].blocks = blocks;
    onChange({ ...content, entries: next });
  };

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Experience Entries</h3>
        <button
          onClick={addEntry}
          className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:opacity-90"
        >
          + Add Entry
        </button>
      </div>
      {entries.map((entry: any, idx: number) => (
        <div key={idx} className="border border-border rounded-lg p-6 space-y-6 bg-muted/20 relative">
          <button
            onClick={() => removeEntry(idx)}
            className="absolute top-4 right-4 text-xs text-destructive hover:underline"
          >
            Remove Entry
          </button>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              {label("Role")}
              <input
                value={entry.role}
                onChange={(e) => updateEntry(idx, "role", e.target.value)}
                className={field}
              />
            </div>
            <div className="space-y-1">
              {label("Organization")}
              <input
                value={entry.org}
                onChange={(e) => updateEntry(idx, "org", e.target.value)}
                className={field}
              />
            </div>
            <div className="space-y-1">
              {label("Period (e.g. 2020 - Present)")}
              <input
                value={entry.period}
                onChange={(e) => updateEntry(idx, "period", e.target.value)}
                className={field}
              />
            </div>
          </div>
          <div className="space-y-3">
            {label("Content Blocks")}
            <BlockEditor
              blocks={entry.blocks}
              onChange={(b) => updateBlocks(idx, b)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Main Editor Component ---

function PageEditor() {
  const slug = Route.useParams().slug;
  const [data, setData] = useState<{ published: any; staged: any } | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  React.useEffect(() => {
    (getStaged as any)({ data: { table: "pages", slug } }).then((d: any) => {
      setData(d);
    });
  }, [slug]);

  if (!data) return <div className="text-muted-foreground">Loading…</div>;

  const staged = data.staged as PageContent;

  async function handleSave() {
    setSaving(true);
    try {
      await (updateStaged as any)({
        data: { table: "pages", slug, content: staged, kind: staged.kind },
      });
      setStatus("ok");
      toast.success("Page saved as draft");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      toast.error("Failed to save page");
      setTimeout(() => setStatus("idle"), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setSaving(true);
    try {
      await (publishItem as any)({ data: { table: "pages", slug } });
      setStatus("ok");
      toast.success("Page published successfully");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      toast.error("Publishing failed");
      setTimeout(() => setStatus("idle"), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleRevert() {
    setSaving(true);
    try {
      await (revertItem as any)({ data: { table: "pages", slug } });
      const d = await (getStaged as any)({ data: { table: "pages", slug } });
      setData(d as any);
      setStatus("ok");
      toast.success("Reverted to published version");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      toast.error("Revert failed");
      setTimeout(() => setStatus("idle"), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Link to="/onlyme/pages" className="text-sm text-muted-foreground hover:underline">
          ← Pages
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground">
            Kind: {staged.kind}
          </span>
          <h2 className="text-lg font-medium text-foreground">{slug}</h2>
        </div>
      </div>

      <div className="border border-border rounded-lg p-6 bg-card">
        {staged.kind === "blocks" && (
          <BlockEditor
            blocks={staged.blocks}
            onChange={(b) => setData({ ...data!, published: data!.published, staged: { ...staged, blocks: b } })}
          />
        )}
        {staged.kind === "skills" && (
          <SkillsEditor
            content={staged}
            onChange={(next) => setData({ ...data!, published: data!.published, staged: next })}
          />
        )}
        {staged.kind === "experience" && (
          <ExperienceEditor
            content={staged}
            onChange={(next) => setData({ ...data!, published: data!.published, staged: next })}
          />
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary px-6 py-3 text-primary-foreground rounded-lg font-medium disabled:opacity-50 hover:opacity-90"
        >
          {saving && status === "idle" ? "Saving…" : "Save staged"}
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
    </div>
  );
}
