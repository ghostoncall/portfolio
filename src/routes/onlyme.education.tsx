/* eslint-disable @typescript-eslint/no-explicit-any */
// Education admin: institutional entries + drawer editor.
// Public / sorts by kind "education" descending sort, so the admin list is
// displayed and revalidated in the same order (highest sort first).

import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { getStaged, listStaged } from "@/lib/server-fns";
import { normalizeEducationPage, nextSort } from "@/lib/cms-normalize";
import type { EducationEntry, EducationPageContent } from "@/content/site";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCmsDraft } from "@/components/admin/cms/useCmsDraft";
import { useUnsavedChanges } from "@/components/admin/cms/useUnsavedChanges";
import { SaveBar } from "@/components/admin/cms/SaveBar";
import { ConfirmDialog } from "@/components/admin/cms/ConfirmDialog";
import { EmptyState } from "@/components/admin/cms/EmptyState";
import { Field, FormSection, InputField } from "@/components/admin/cms/FormSection";
import { DateField } from "@/components/admin/cms/DateField";
import { MediaField } from "@/components/admin/cms/MediaField";
import { TagInput } from "@/components/admin/cms/TagInput";
import { SortableList } from "@/components/admin/cms/SortableList";
import { EducationView } from "@/components/public/EducationView";
import { Plus, Search, Trash2, GripVertical } from "lucide-react";

export const Route = createFileRoute("/onlyme/education")({
  component: EducationAdmin,
});

function withKey<T extends object>(obj: T, key: string, value: unknown): T {
  const next: any = { ...obj };
  if (value === undefined || value === null || value === "") delete next[key];
  else next[key] = value;
  return next;
}

function EducationAdmin() {
  const draft = useCmsDraft<EducationPageContent>({
    table: "pages",
    slug: "education",
    normalize: (raw) => normalizeEducationPage(raw),
  });
  const { confirmLeave } = useUnsavedChanges(draft.dirty);

  const [query, setQuery] = React.useState("");
  const [editingDraft, setEditingDraft] = React.useState<EducationEntry | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null); // null = new
  const [deleteTarget, setDeleteTarget] = React.useState<EducationEntry | null>(null);

  if (draft.loading) return <div className="text-sm text-muted-foreground">Loading draft…</div>;
  if (!draft.data) return null;

  const entries = draft.doc.entries ?? [];

  const patchDoc = (partial: Record<string, unknown>) =>
    draft.patch((d) => ({ ...d, ...partial }) as EducationPageContent);

  const setEntries = (next: EducationEntry[]) => patchDoc({ entries: next });

  // ---- filtering ----
  const filtered = entries.filter((e) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      e.institution.toLowerCase().includes(q) ||
      e.degree.toLowerCase().includes(q) ||
      (e.field ?? "").toLowerCase().includes(q) ||
      (e.location ?? "").toLowerCase().includes(q)
    );
  });
  const searching = query !== "";
  const sortedDesc = [...entries].sort((a, b) => Number(b.sort ?? 0) - Number(a.sort ?? 0));

  // ---- CRUD ----
  const openNew = () => {
    setEditingId(null);
    setEditingDraft({
      id: `edu-new-${Date.now().toString(36)}`,
      institution: "",
      degree: "",
      coursework: [],
      research: [],
      visible: true,
      sort: nextSort(entries),
      current: false,
    });
  };

  const saveEntry = () => {
    if (!editingDraft) return;
    if (!editingDraft.institution.trim()) {
      toast.error("Institution is required");
      return;
    }
    if (!editingDraft.degree.trim()) {
      toast.error("Degree is required");
      return;
    }
    const exists = editingId !== null;
    const next = exists
      ? entries.map((e) => (e.id === editingId ? editingDraft : e))
      : [...entries, editingDraft];
    setEntries(next);
    setEditingDraft(null);
    setEditingId(null);
    toast.success(exists ? "Entry updated" : "Entry added — autosaved to draft");
  };

  const removeEntry = (entry: EducationEntry) => {
    setEntries(entries.filter((e) => e.id !== entry.id));
    toast.success(`Deleted "${entry.degree} at ${entry.institution}" from the draft`);
  };

  const duplicate = (entry: EducationEntry) => {
    const copy: EducationEntry = {
      ...entry,
      id: `edu-copy-${Date.now().toString(36)}`,
      institution: `${entry.institution} (copy)`,
      sort: nextSort(entries),
    };
    setEntries([...entries, copy]);
    toast.success("Duplicated into the draft");
  };

  const whenLabel = (e: EducationEntry) => {
    const from = e.startDate ? e.startDate.slice(0, 4) : "";
    const to = e.current ? "Present" : e.endDate ? e.endDate.slice(0, 4) : "";
    if (!from && !to) return "—";
    return `${from || "?"} — ${to}`;
  };

  const entryBadges = (e: EducationEntry) => (
    <>
      {e.current && (
        <Badge variant="secondary" className="text-[0.65rem]">
          Current
        </Badge>
      )}
      {e.status && (
        <Badge variant="outline" className="text-[0.65rem]">
          {e.status}
        </Badge>
      )}
      {e.visible === false && (
        <Badge variant="outline" className="text-[0.65rem] text-muted-foreground">
          hidden
        </Badge>
      )}
    </>
  );

  const actionButtons = (e: EducationEntry) => (
    <div className="flex flex-wrap gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        data-testid="education-edit"
        onClick={() => {
          setEditingId(e.id);
          setEditingDraft({ ...e });
        }}
      >
        Edit
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() =>
          setEntries(
            entries.map((x) => (x.id === e.id ? { ...x, visible: x.visible === false } : x)),
          )
        }
      >
        {e.visible === false ? "Show" : "Hide"}
      </Button>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => duplicate(e)}>
        Duplicate
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-destructive"
        data-testid="education-delete"
        onClick={() => setDeleteTarget(e)}
      >
        Del.
      </Button>
    </div>
  );

  // ---- drawer editor ----
  const editor = (
    <FormSection title={editingId ? "Edit entry" : "New entry"} className="border-0 p-0">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Institution">
          <InputField
            value={editingDraft?.institution ?? ""}
            onChange={(e) =>
              setEditingDraft((d) => (d ? withKey(d, "institution", e.target.value) : d))
            }
            data-testid="education-institution"
          />
        </Field>
        <Field label="Degree">
          <InputField
            value={editingDraft?.degree ?? ""}
            onChange={(e) => setEditingDraft((d) => (d ? withKey(d, "degree", e.target.value) : d))}
            data-testid="education-degree"
          />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Field of study">
          <InputField
            value={editingDraft?.field ?? ""}
            placeholder="Computer Science…"
            onChange={(e) => setEditingDraft((d) => (d ? withKey(d, "field", e.target.value) : d))}
          />
        </Field>
        <Field label="Specialization">
          <InputField
            value={editingDraft?.specialization ?? ""}
            placeholder="AI & Machine Learning…"
            onChange={(e) =>
              setEditingDraft((d) => (d ? withKey(d, "specialization", e.target.value) : d))
            }
          />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Location">
          <InputField
            value={editingDraft?.location ?? ""}
            placeholder="City, Country…"
            onChange={(e) =>
              setEditingDraft((d) => (d ? withKey(d, "location", e.target.value) : d))
            }
          />
        </Field>
        <Field label="Status">
          <InputField
            value={editingDraft?.status ?? ""}
            placeholder="Graduated…"
            onChange={(e) => setEditingDraft((d) => (d ? withKey(d, "status", e.target.value) : d))}
          />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <DateField
          label="Start date"
          value={editingDraft?.startDate}
          onChange={(startDate) =>
            setEditingDraft((d) => (d ? withKey(d, "startDate", startDate) : d))
          }
        />
        {editingDraft?.current ? null : (
          <DateField
            label="End date"
            value={editingDraft?.endDate}
            onChange={(endDate) => setEditingDraft((d) => (d ? withKey(d, "endDate", endDate) : d))}
          />
        )}
        <div className="flex items-center gap-6 pb-1 md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 cursor-pointer"
              data-testid="education-current"
              checked={Boolean(editingDraft?.current)}
              onChange={(e) =>
                setEditingDraft((d) => {
                  if (!d) return d;
                  if (e.target.checked) {
                    const next: any = { ...d, current: true };
                    delete next.endDate;
                    return next;
                  }
                  return { ...d, current: false };
                })
              }
            />
            Current study (shows “Present” instead of an end date)
          </label>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="CGPA / GPA">
          <InputField
            value={editingDraft?.cgpa ?? ""}
            placeholder="3.8 / 4.0…"
            data-testid="education-cgpa"
            onChange={(e) => setEditingDraft((d) => (d ? withKey(d, "cgpa", e.target.value) : d))}
          />
        </Field>
        <Field label="Grading scale">
          <InputField
            value={editingDraft?.gradingScale ?? ""}
            placeholder="4.0…"
            onChange={(e) =>
              setEditingDraft((d) => (d ? withKey(d, "gradingScale", e.target.value) : d))
            }
          />
        </Field>
      </div>
      <MediaField
        label="Institution logo"
        value={editingDraft?.logo}
        onChange={(logo) =>
          setEditingDraft((d) => (d ? withKey(d, "logo", logo.src ? logo : undefined) : d))
        }
        accept="image"
      />
      <Field label="Distinctions" hint="Dean’s List, honours, etc. One per line.">
        <TagInput
          value={editingDraft?.distinctions ?? []}
          onChange={(v) =>
            setEditingDraft((d) => (d ? withKey(d, "distinctions", v.length ? v : undefined) : d))
          }
          placeholder="Summa cum laude…"
        />
      </Field>
      <Field label="Scholarships" hint="One per line.">
        <TagInput
          value={editingDraft?.scholarships ?? []}
          onChange={(v) =>
            setEditingDraft((d) => (d ? withKey(d, "scholarships", v.length ? v : undefined) : d))
          }
          placeholder="Merit scholarship…"
        />
      </Field>
      <Field label="Coursework (category + courses)" hint="e.g. AI: Machine Learning, NLP">
        <div className="space-y-2">
          {(editingDraft?.coursework ?? []).map((c, i) => (
            <div key={i} className="grid gap-2 border border-border p-2 md:grid-cols-[12rem_1fr]">
              <InputField
                value={c.category}
                placeholder="Category"
                onChange={(e) => {
                  const cw = [...(editingDraft?.coursework ?? [])];
                  cw[i] = { ...cw[i]!, category: e.target.value };
                  setEditingDraft((d) => (d ? withKey(d, "coursework", cw) : d));
                }}
              />
              <InputField
                value={c.courses.join(", ")}
                placeholder="Course 1, Course 2…"
                onChange={(e) => {
                  const cw = [...(editingDraft?.coursework ?? [])];
                  cw[i] = {
                    ...cw[i]!,
                    courses: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  };
                  setEditingDraft((d) => (d ? withKey(d, "coursework", cw) : d));
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                aria-label="Remove coursework category"
                onClick={() => {
                  const cw = (editingDraft?.coursework ?? []).filter((_, ix) => ix !== i);
                  setEditingDraft((d) =>
                    d ? withKey(d, "coursework", cw.length ? cw : undefined) : d,
                  );
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              const cw = [...(editingDraft?.coursework ?? [])];
              cw.push({ category: "", courses: [] });
              setEditingDraft((d) => (d ? withKey(d, "coursework", cw) : d));
            }}
          >
            <Plus className="size-4" /> Add category
          </Button>
        </div>
      </Field>
      <Field label="Research & projects" hint="Optional academic research.">
        <div className="space-y-2">
          {(editingDraft?.research ?? []).map((r, i) => (
            <div key={i} className="grid gap-2 border border-border p-2">
              <InputField
                value={r.title}
                placeholder="Research title"
                onChange={(e) => {
                  const rw = [...(editingDraft?.research ?? [])];
                  rw[i] = { ...rw[i]!, title: e.target.value };
                  setEditingDraft((d) => (d ? withKey(d, "research", rw) : d));
                }}
              />
              <InputField
                value={r.area ?? ""}
                placeholder="Research area"
                onChange={(e) => {
                  const rw = [...(editingDraft?.research ?? [])];
                  rw[i] = { ...rw[i]!, area: e.target.value };
                  setEditingDraft((d) => (d ? withKey(d, "research", rw) : d));
                }}
              />
              <InputField
                value={r.supervisor ?? ""}
                placeholder="Supervisor"
                onChange={(e) => {
                  const rw = [...(editingDraft?.research ?? [])];
                  rw[i] = { ...rw[i]!, supervisor: e.target.value };
                  setEditingDraft((d) => (d ? withKey(d, "research", rw) : d));
                }}
              />
              <TagInput
                value={r.technologies ?? []}
                onChange={(v) => {
                  const rw = [...(editingDraft?.research ?? [])];
                  rw[i] = { ...rw[i]!, technologies: v.length ? v : [] };
                  setEditingDraft((d) => (d ? withKey(d, "research", rw) : d));
                }}
                placeholder="Technologies…"
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                aria-label="Remove research item"
                onClick={() => {
                  const rw = (editingDraft?.research ?? []).filter((_, ix) => ix !== i);
                  setEditingDraft((d) =>
                    d ? withKey(d, "research", rw.length ? rw : undefined) : d,
                  );
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              const rw = [...(editingDraft?.research ?? [])];
              rw.push({ title: "" });
              setEditingDraft((d) => (d ? withKey(d, "research", rw) : d));
            }}
          >
            <Plus className="size-4" /> Add research item
          </Button>
        </div>
      </Field>
      <div className="flex gap-2">
        <Button
          data-testid="education-save"
          onClick={saveEntry}
          disabled={!editingDraft?.institution.trim() || !editingDraft?.degree.trim()}
        >
          {editingId ? "Apply changes" : "Add entry"}
        </Button>
        <Button variant="outline" onClick={() => setEditingDraft(null)}>
          Cancel
        </Button>
      </div>
    </FormSection>
  );

  const preview = (
    <div className="max-w-3xl mx-auto py-6">
      <EducationView content={draft.doc} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/onlyme" className="text-sm text-muted-foreground hover:underline">
            ← Back
          </Link>
          <h2 className="text-lg font-medium text-foreground">Education</h2>
          <span className="text-xs text-muted-foreground">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        <Button data-testid="add-education" onClick={openNew}>
          <Plus className="size-4" /> New entry
        </Button>
      </div>

      <SaveBar
        dirty={draft.dirty}
        loading={draft.loading}
        saving={draft.saving}
        hasPublished={draft.data.isPublic}
        lastSaved={draft.lastSaved}
        error={draft.error}
        onSave={() => draft.save()}
        onPublish={() => draft.publish()}
        onUnpublish={() => draft.unpublish()}
        onRevert={() =>
          window.confirm("Discard staged changes and restore the published version?") &&
          draft.revert()
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search institution, degree, field…"
          className="pl-8"
          data-testid="education-search"
        />
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="No education entries yet"
          description="Add your first qualification — the public timeline follows this order, newest first."
          action={
            <Button onClick={openNew}>
              <Plus className="size-4" /> New entry
            </Button>
          }
        />
      ) : searching ? (
        <div className="border border-border" data-testid="education-list">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No entries match this search.
            </div>
          )}
          {filtered.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 border-b border-border last:border-0 px-4 py-3 hover:bg-muted/30"
              data-testid="education-row"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-serif text-foreground">{e.degree || "(untitled)"}</span>
                  <span className="text-xs text-muted-foreground">{e.institution}</span>
                  {entryBadges(e)}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{whenLabel(e)}</div>
              </div>
              {actionButtons(e)}
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-border" data-testid="education-list">
          <div className="border-b border-border bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">
            Drag to reorder — the top row shows first on / (Overview)
          </div>
          <SortableList
            items={sortedDesc}
            getId={(e) => e.id}
            onReorder={(next) =>
              setEntries(next.map((e, i) => ({ ...e, sort: next.length - 1 - i })))
            }
            renderItem={(e, { index, moveUp, moveDown }: any) => (
              <div
                className="flex items-center gap-3 border-b border-border last:border-0 px-4 py-3 hover:bg-muted/30"
                data-testid="education-row"
              >
                <div className="flex flex-col items-center">
                  <span className="cursor-grab text-muted-foreground" aria-label="Drag to reorder">
                    <GripVertical className="size-4" />
                  </span>
                  <div className="mt-1 flex">
                    <button
                      onClick={moveUp}
                      disabled={index === 0}
                      className="px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={moveDown}
                      disabled={index === sortedDesc.length - 1}
                      className="px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-serif text-foreground">{e.degree || "(untitled)"}</span>
                    <span className="text-xs text-muted-foreground">{e.institution}</span>
                    {entryBadges(e)}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{whenLabel(e)}</div>
                </div>
                {actionButtons(e)}
              </div>
            )}
          />
        </div>
      )}

      {/* Drawer editor */}
      <Sheet open={!!editingDraft} onOpenChange={(o) => !o && setEditingDraft(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? "Edit entry" : "New entry"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{editor}</div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.degree ?? ""} at ${deleteTarget?.institution ?? ""}"?`}
        description="Removes the entry from the draft (and from the site once you publish)."
        onConfirm={() => {
          if (deleteTarget) removeEntry(deleteTarget);
          setDeleteTarget(null);
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
