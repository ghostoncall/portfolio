/* eslint-disable @typescript-eslint/no-explicit-any */
// Volunteering admin: draggable entries + drawer editor per entry.
//
// Volunteering lives as a single `pages` document (slug "volunteering",
// kind "volunteering"). Publish/Revert operate on the whole document;
// each entry carries a `visible` flag so individual entries can be
// hidden from the public site without unpublishing everything.

import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { getStaged, listStaged } from "@/lib/server-fns";
import { normalizeVolunteeringPage, nextSort } from "@/lib/cms-normalize";
import type { VolunteeringEntry, VolunteeringPageContent, ProjectLink } from "@/content/site";
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
import { MediaField } from "@/components/admin/cms/MediaField";
import { MediaGallery } from "@/components/admin/cms/MediaGallery";
import { TagInput } from "@/components/admin/cms/TagInput";
import { SortableList } from "@/components/admin/cms/SortableList";
import { GripVertical, Plus, Trash2, Users } from "lucide-react";

export const Route = createFileRoute("/onlyme/volunteering")({
  component: VolunteeringAdmin,
});

/** exactOptionalPropertyTypes-safe key set/delete helper. */
function withKey<T extends object>(obj: T, key: string, value: unknown): T {
  const next: any = { ...obj };
  if (value === undefined || value === null || value === "") delete next[key];
  else next[key] = value;
  return next;
}

function VolunteeringAdmin() {
  const draft = useCmsDraft<VolunteeringPageContent>({
    table: "pages",
    slug: "volunteering",
    normalize: (raw) => normalizeVolunteeringPage(raw),
  });
  const { confirmLeave } = useUnsavedChanges(draft.dirty);

  const [query, setQuery] = React.useState("");
  const [editingDraft, setEditingDraft] = React.useState<VolunteeringEntry | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null); // null = new
  const [deleteTarget, setDeleteTarget] = React.useState<VolunteeringEntry | null>(null);

  if (draft.loading) return <div className="text-sm text-muted-foreground">Loading draft…</div>;
  if (!draft.data) return null;

  const doc = draft.doc;
  const entries = doc.entries ?? [];

  const patchDoc = (partial: Record<string, unknown>) =>
    draft.patch((d) => ({ ...d, ...partial }) as VolunteeringPageContent);

  const setEntries = (next: VolunteeringEntry[]) => patchDoc({ entries: next });

  const setIntroduction = (partial: Record<string, unknown>) =>
    patchDoc({
      introduction: { ...(doc.introduction ?? {}), ...partial },
    });

  const setWhyVolunteering = (partial: Record<string, unknown>) =>
    patchDoc({
      whyVolunteering: { ...(doc.whyVolunteering ?? {}), ...partial },
    });

  const setLookingAhead = (partial: Record<string, unknown>) =>
    patchDoc({
      lookingAhead: { ...(doc.lookingAhead ?? {}), ...partial },
    });

  const setInterests = (next: string[]) => patchDoc({ interests: next });

  const setCta = (partial: Record<string, unknown>) =>
    patchDoc({ cta: { ...(doc.cta ?? {}), ...partial } });

  // ---- filtering ----
  const filtered = entries.filter((e) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      e.organisation.toLowerCase().includes(q) ||
      (e.shortDescription ?? "").toLowerCase().includes(q) ||
      (e.category ?? "").toLowerCase().includes(q) ||
      (e.reflections ?? "").toLowerCase().includes(q)
    );
  });
  const searching = query !== "";
  const sorted = [...entries].sort((a, b) => Number(b.sort ?? 0) - Number(a.sort ?? 0));

  // ---- CRUD ----
  const openNew = () => {
    setEditingId(null);
    setEditingDraft({
      id: `vol-new-${Date.now().toString(36)}`,
      title: "",
      organisation: "",
      visible: true,
      sort: nextSort(entries),
      media: [],
    });
  };

  const saveEntry = () => {
    if (!editingDraft) return;
    if (!editingDraft.title.trim() && !editingDraft.organisation.trim()) {
      toast.error("Title or organisation is required");
      return;
    }
    setEntries(
      editingId
        ? entries.map((e) => (e.id === editingId ? { ...editingDraft } : e))
        : [...entries, { ...editingDraft }],
    );
    setEditingDraft(null);
    setEditingId(null);
  };

  const duplicate = (e: VolunteeringEntry) => {
    setEntries([
      ...entries,
      { ...e, id: `vol-copy-${Date.now().toString(36)}`, title: `${e.title} (copy)` },
    ]);
  };

  const delEntry = (e: VolunteeringEntry) => {
    setEntries(entries.filter((x) => x.id !== e.id));
    setDeleteTarget(null);
    toast.success(`Removed "${e.title || e.organisation}"`);
  };

  // ---- entry badges ----
  const entryBadges = (e: VolunteeringEntry) => (
    <>
      {e.category && (
        <Badge variant="outline" className="text-[0.65rem] px-2 py-0.5">
          {e.category}
        </Badge>
      )}
      {e.featured && (
        <Badge variant="secondary" className="text-[0.65rem] px-2 py-0.5">
          Featured
        </Badge>
      )}
      {e.visible === false && (
        <Badge variant="outline" className="text-[0.65rem] text-muted-foreground">
          hidden
        </Badge>
      )}
    </>
  );

  const actionButtons = (e: VolunteeringEntry) => (
    <div className="flex flex-wrap gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        data-testid="volunteering-edit"
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
        Dup.
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-destructive"
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
        <Field label="Title">
          <InputField
            value={editingDraft?.title ?? ""}
            onChange={(e) => setEditingDraft((d) => (d ? { ...d, title: e.target.value } : d))}
            data-testid="volunteering-title"
          />
        </Field>
        <Field label="Organisation">
          <InputField
            value={editingDraft?.organisation ?? ""}
            onChange={(e) =>
              setEditingDraft((d) => (d ? { ...d, organisation: e.target.value } : d))
            }
            data-testid="volunteering-organisation"
          />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Date or period">
          <InputField
            value={editingDraft?.date ?? ""}
            placeholder="e.g. 2023 · Mar 2024 – present"
            onChange={(e) => setEditingDraft((d) => (d ? withKey(d, "date", e.target.value) : d))}
          />
        </Field>
        <Field label="Location">
          <InputField
            value={editingDraft?.location ?? ""}
            placeholder="Berlin, DE"
            onChange={(e) =>
              setEditingDraft((d) => (d ? withKey(d, "location", e.target.value) : d))
            }
          />
        </Field>
      </div>
      <Field label="Category">
        <InputField
          value={editingDraft?.category ?? ""}
          placeholder="e.g. Education, Environment, Mentoring"
          onChange={(e) => setEditingDraft((d) => (d ? withKey(d, "category", e.target.value) : d))}
        />
      </Field>
      <Field label="Short description" hint="One or two sentences shown on the card.">
        <textarea
          rows={3}
          className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm"
          value={editingDraft?.shortDescription ?? ""}
          onChange={(e) =>
            setEditingDraft((d) => (d ? withKey(d, "shortDescription", e.target.value) : d))
          }
        />
      </Field>
      <Field label="Personal narrative" hint="Detailed story — shown on expand.">
        <textarea
          rows={6}
          className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm font-serif"
          value={editingDraft?.narrative ?? ""}
          onChange={(e) =>
            setEditingDraft((d) => (d ? withKey(d, "narrative", e.target.value) : d))
          }
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="My contribution">
          <textarea
            rows={4}
            className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm font-serif"
            value={editingDraft?.contribution ?? ""}
            onChange={(e) =>
              setEditingDraft((d) => (d ? withKey(d, "contribution", e.target.value) : d))
            }
          />
        </Field>
        <Field label="My reflections">
          <textarea
            rows={4}
            className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm font-serif"
            value={editingDraft?.reflections ?? ""}
            onChange={(e) =>
              setEditingDraft((d) => (d ? withKey(d, "reflections", e.target.value) : d))
            }
          />
        </Field>
      </div>
      <Field label="Key takeaways" hint="One per line.">
        <textarea
          rows={4}
          className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm"
          value={(editingDraft?.takeaways ?? []).join("\n")}
          onChange={(e) =>
            setEditingDraft((d) =>
              d
                ? withKey(
                    d,
                    "takeaways",
                    e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean).length
                      ? e.target.value
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean)
                      : undefined,
                  )
                : d,
            )
          }
        />
      </Field>
      <Field label="Media" hint="Photographs and videos. Drag to reorder.">
        <MediaGallery
          items={editingDraft?.media ?? []}
          onChange={(media) =>
            setEditingDraft((d) => (d ? withKey(d, "media", media.length ? media : undefined) : d))
          }
          accept="any"
        />
      </Field>
      <Field label="Featured image">
        <MediaField
          label="Featured image"
          value={editingDraft?.featuredImage}
          onChange={(image) =>
            setEditingDraft((d) =>
              d ? withKey(d, "featuredImage", image?.src ? image : undefined) : d,
            )
          }
          accept="image"
        />
      </Field>
      <Field label="External links" hint="Related articles, organisation site — optional.">
        {(editingDraft?.links ?? []).map((link: ProjectLink, i: number) => (
          <div
            key={link.id ?? i}
            className="grid gap-2 border border-border p-2 md:grid-cols-[8rem_1fr_auto]"
          >
            <InputField
              value={link.label ?? ""}
              placeholder="Label"
              onChange={(e) => {
                const links = [...(editingDraft?.links ?? [])];
                links[i] = { ...links[i]!, label: e.target.value };
                setEditingDraft((d) => (d ? withKey(d, "links", links) : d));
              }}
            />
            <InputField
              value={link.href ?? ""}
              placeholder="https://…"
              onChange={(e) => {
                const links = [...(editingDraft?.links ?? [])];
                links[i] = { ...links[i]!, href: e.target.value };
                setEditingDraft((d) => (d ? withKey(d, "links", links) : d));
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label="Remove link"
              onClick={() => {
                const links = (editingDraft?.links ?? []).filter((_, ix) => ix !== i);
                setEditingDraft((d) =>
                  d ? withKey(d, "links", links.length ? links : undefined) : d,
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
          onClick={() =>
            setEditingDraft((d) => {
              if (!d) return d;
              const links: ProjectLink[] = [
                ...(d.links ?? []),
                { id: `vlink-${Date.now().toString(36)}`, label: "", href: "", kind: "other" },
              ];
              return withKey(d, "links", links);
            })
          }
        >
          <Plus className="size-4" /> Add link
        </Button>
      </Field>
      <div className="flex items-center gap-6 pb-1 md:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 cursor-pointer"
            data-testid="volunteering-featured"
            checked={Boolean(editingDraft?.featured)}
            onChange={(e) =>
              setEditingDraft((d) => (d ? withKey(d, "featured", e.target.checked) : d))
            }
          />
          Featured (shown first)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 cursor-pointer"
            data-testid="volunteering-visible"
            checked={Boolean(editingDraft?.visible !== false)}
            onChange={(e) =>
              setEditingDraft((d) => (d ? withKey(d, "visible", e.target.checked) : d))
            }
          />
          Visible on public site
        </label>
      </div>
      <div className="flex gap-2">
        <Button data-testid="volunteering-save" onClick={saveEntry}>
          {editingId ? "Apply changes" : "Add entry"}
        </Button>
        <Button variant="outline" onClick={() => setEditingDraft(null)}>
          Cancel
        </Button>
      </div>
    </FormSection>
  );

  // ---- static content panels ----
  const staticContent = (
    <div className="space-y-6">
      <FormSection
        title="Introduction"
        description="Shown at the top of the public Volunteering page."
      >
        <Field label="Heading">
          <InputField
            value={doc.introduction?.heading ?? ""}
            onChange={(e) => setIntroduction({ heading: e.target.value })}
          />
        </Field>
        <Field label="Body">
          <textarea
            rows={4}
            className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm font-serif"
            value={doc.introduction?.body ?? ""}
            onChange={(e) => setIntroduction({ body: e.target.value })}
          />
        </Field>
        <Field label="Image">
          <MediaField
            label="Image"
            value={doc.introduction?.image}
            onChange={(image) => setIntroduction({ image: image?.src ? image : undefined })}
            accept="image"
          />
        </Field>
      </FormSection>

      <FormSection title="Why I volunteer" description="Your motivations and values.">
        <Field label="Heading">
          <InputField
            value={doc.whyVolunteering?.heading ?? ""}
            onChange={(e) => setWhyVolunteering({ heading: e.target.value })}
          />
        </Field>
        <Field label="Body">
          <textarea
            rows={4}
            className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm font-serif"
            value={doc.whyVolunteering?.body ?? ""}
            onChange={(e) => setWhyVolunteering({ body: e.target.value })}
          />
        </Field>
      </FormSection>

      <FormSection title="Looking ahead" description="Future causes and initiatives.">
        <Field label="Heading">
          <InputField
            value={doc.lookingAhead?.heading ?? ""}
            onChange={(e) => setLookingAhead({ heading: e.target.value })}
          />
        </Field>
        <Field label="Body">
          <textarea
            rows={4}
            className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm font-serif"
            value={doc.lookingAhead?.body ?? ""}
            onChange={(e) => setLookingAhead({ body: e.target.value })}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Future interests"
        description="Causes and communities you'd like to work with."
      >
        <textarea
          rows={4}
          className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm"
          value={(doc.interests ?? []).join("\n")}
          onChange={(e) =>
            setInterests(
              e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean).length
                ? e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : [],
            )
          }
          placeholder="e.g. Climate action, youth mentoring, open-source education…"
        />
      </FormSection>

      <FormSection title="Open to opportunities" description="Call-to-action linking to Contact.">
        <Field label="Heading">
          <InputField
            value={doc.cta?.heading ?? ""}
            onChange={(e) => setCta({ heading: e.target.value })}
          />
        </Field>
        <Field label="Body">
          <InputField
            value={doc.cta?.body ?? ""}
            onChange={(e) => setCta({ body: e.target.value })}
          />
        </Field>
        <Field label="Button text">
          <InputField
            value={doc.cta?.buttonText ?? ""}
            onChange={(e) => setCta({ buttonText: e.target.value })}
          />
        </Field>
      </FormSection>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/onlyme" className="text-sm text-muted-foreground hover:underline">
            ← Back
          </Link>
          <h2 className="text-lg font-medium text-foreground">Volunteering</h2>
          <span className="text-xs text-muted-foreground">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        <Button data-testid="add-volunteering" onClick={openNew}>
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
        onRevert={() =>
          window.confirm("Discard staged changes and restore the published version?") &&
          draft.revert()
        }
      />

      <div className="relative max-w-sm">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, organisation, category…"
          className="pl-8 w-full border border-input bg-background px-3 py-2 text-sm focus:border-ring outline-none"
          data-testid="volunteering-search"
        />
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="No volunteering entries yet"
          description="Add your first experience — the public journal follows this order."
          action={
            <Button onClick={openNew}>
              <Plus className="size-4" /> New entry
            </Button>
          }
        />
      ) : searching ? (
        <div className="border border-border" data-testid="volunteering-list">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No entries match this search.
            </div>
          )}
          {filtered.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 border-b border-border last:border-0 px-4 py-3 hover:bg-muted/30"
              data-testid="volunteering-row"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-serif text-foreground">{e.title || "(untitled)"}</span>
                  <span className="text-xs text-muted-foreground">{e.organisation}</span>
                  {entryBadges(e)}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {[e.date, e.location].filter(Boolean).join(" · ")} || {e.category}
                </div>
              </div>
              {actionButtons(e)}
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-border">
          <div className="border-b border-border bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">
            Drag to reorder — the top row shows first on the public journal
          </div>
          <SortableList
            items={sorted}
            getId={(e) => e.id}
            onReorder={(next) =>
              setEntries(next.map((e, i) => ({ ...e, sort: next.length - 1 - i })))
            }
            renderItem={(e, { index, moveUp, moveDown }: any) => (
              <div
                className="flex items-center gap-3 border-b border-border last:border-0 px-4 py-3 hover:bg-muted/30"
                data-testid="volunteering-row"
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
                      disabled={index === sorted.length - 1}
                      className="px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-serif text-foreground">{e.title || "(untitled)"}</span>
                    <span className="text-xs text-muted-foreground">{e.organisation}</span>
                    {entryBadges(e)}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {[e.date, e.location].filter(Boolean).join(" · ")} || {e.category}
                  </div>
                </div>
                {actionButtons(e)}
              </div>
            )}
          />
        </div>
      )}
      <Sheet
        open={!!editingDraft || editingId !== null}
        onOpenChange={(o) => !o && setEditingDraft(null)}
      >
        <SheetContent className="w-full max-w-2xl md:max-w-3xl p-0">
          <SheetHeader className="p-6 border-b">
            <SheetTitle>{editingId ? "Edit entry" : "New entry"}</SheetTitle>
          </SheetHeader>
          {editor}
        </SheetContent>
      </Sheet>

      {staticContent}

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.title || deleteTarget?.organisation}"?`}
        description="This removes the volunteering entry. It can be re-added, but any media and
        narrative will be lost unless you have a backup."
        onConfirm={() => deleteTarget && delEntry(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
