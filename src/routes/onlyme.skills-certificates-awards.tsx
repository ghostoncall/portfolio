/* eslint-disable @typescript-eslint/no-explicit-any */
// Unified admin: Skills, Certificates and Awards in one expandable interface.
// Follows the Projects / Experience interaction pattern: each section has a
// heading, a "+" button to add/manage entries, a list of rows with edit /
// show-hide / duplicate / delete actions, and a Sheet drawer editor. Changes
// are draft-only until published via the SaveBar.

import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { getStaged, listStaged } from "@/lib/server-fns";
import {
  normalizeSkillsPage,
  normalizeCertificatesPage,
  normalizeAwardPage,
  nextSort,
} from "@/lib/cms-normalize";
import type {
  SkillsPageContent,
  CertificatesPageContent,
  AwardPageContent,
  Skill,
  Certificate,
  Award,
} from "@/content/site";
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
import { Plus, Search, Trash2, GripVertical } from "lucide-react";

function withKey<T extends object>(obj: T, key: string, value: unknown): T {
  const next: any = { ...obj };
  if (value === undefined || value === null || value === "") delete next[key];
  else next[key] = value;
  return next;
}

/* ------------------------------------------------------------------ */
/* Shared section: a reusable mini-admin for one content kind         */
/* ------------------------------------------------------------------ */

type EntryWithSort = { id: string; visible?: boolean; sort?: number };

function sectionHeader(count: number, singular: string, plural: string) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-medium text-foreground">{singular}</h3>
        <span className="text-xs text-muted-foreground">
          {count} {count === 1 ? singular : plural}
        </span>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/onlyme/skills-certificates-awards")({
  component: SkillsCertificatesAwardsAdmin,
});

function SkillsCertificatesAwardsAdmin() {
  /* ---------------- drafts ---------------- */
  const skillsDraft = useCmsDraft<SkillsPageContent>({
    table: "pages",
    slug: "skills",
    normalize: (raw) => normalizeSkillsPage(raw),
  });
  const certsDraft = useCmsDraft<CertificatesPageContent>({
    table: "pages",
    slug: "certificates",
    normalize: (raw) => normalizeCertificatesPage(raw),
  });
  const awardsDraft = useCmsDraft<AwardPageContent>({
    table: "pages",
    slug: "awards",
    normalize: (raw) => normalizeAwardPage(raw),
  });
  const { confirmLeave } = useUnsavedChanges(
    skillsDraft.dirty || certsDraft.dirty || awardsDraft.dirty,
  );

  const [query, setQuery] = React.useState("");
  const [editingKind, setEditingKind] = React.useState<"skills" | "certificates" | "awards">(
    "skills",
  );
  const [editingDraft, setEditingDraft] = React.useState<any>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<any>(null);

  if (skillsDraft.loading || certsDraft.loading || awardsDraft.loading) {
    return <div className="text-sm text-muted-foreground">Loading draft…</div>;
  }
  if (!skillsDraft.data || !certsDraft.data || !awardsDraft.data) return null;

  const skills = skillsDraft.doc.skills ?? [];
  const certificates = certsDraft.doc.certificates ?? [];
  const awards = awardsDraft.doc.entries ?? [];

  const setSkills = (next: Skill[]) =>
    skillsDraft.patch((d) => ({ ...d, skills: next }) as SkillsPageContent);
  const setCerts = (next: Certificate[]) =>
    certsDraft.patch((d) => ({ ...d, certificates: next }) as CertificatesPageContent);
  const setAwards = (next: Award[]) =>
    awardsDraft.patch((d) => ({ ...d, entries: next }) as AwardPageContent);

  /* ---------------- skills CRUD ---------------- */
  const openNewSkill = () => {
    setEditingKind("skills");
    setEditingId(null);
    setEditingDraft({
      id: `skill-new-${Date.now().toString(36)}`,
      name: "",
      categoryId: "",
      visible: true,
      sort: nextSort(skills),
    });
  };
  const saveSkill = () => {
    if (!editingDraft || editingKind !== "skills") return;
    if (!editingDraft.name.trim()) {
      toast.error("Skill name is required");
      return;
    }
    if (!editingDraft.categoryId.trim()) {
      toast.error("Category is required");
      return;
    }
    const exists = editingId !== null;
    const next = exists
      ? skills.map((s: any) => (s.id === editingId ? editingDraft : s))
      : [...skills, editingDraft];
    setSkills(next);
    setEditingDraft(null);
    setEditingId(null);
    toast.success(exists ? "Skill updated" : "Skill added — autosaved to draft");
  };
  const removeSkill = (s: Skill) => {
    setSkills(skills.filter((x: any) => x.id !== s.id));
    toast.success(`Deleted "${s.name}" from the draft`);
  };

  /* ---------------- certificates CRUD ---------------- */
  const openNewCert = () => {
    setEditingKind("certificates");
    setEditingId(null);
    setEditingDraft({
      id: `cert-new-${Date.now().toString(36)}`,
      title: "",
      visible: true,
      sort: nextSort(certificates),
    });
  };
  const saveCert = () => {
    if (!editingDraft || editingKind !== "certificates") return;
    if (!editingDraft.title.trim()) {
      toast.error("Certificate title is required");
      return;
    }
    const exists = editingId !== null;
    const next = exists
      ? certificates.map((c: any) => (c.id === editingId ? editingDraft : c))
      : [...certificates, editingDraft];
    setCerts(next);
    setEditingDraft(null);
    setEditingId(null);
    toast.success(exists ? "Certificate updated" : "Certificate added — autosaved to draft");
  };
  const removeCert = (c: Certificate) => {
    setCerts(certificates.filter((x: any) => x.id !== c.id));
    toast.success(`Deleted "${c.title}" from the draft`);
  };

  /* ---------------- awards CRUD ---------------- */
  const openNewAward = () => {
    setEditingKind("awards");
    setEditingId(null);
    setEditingDraft({
      id: `award-new-${Date.now().toString(36)}`,
      title: "",
      visible: true,
      sort: nextSort(awards),
    });
  };
  const saveAward = () => {
    if (!editingDraft || editingKind !== "awards") return;
    if (!editingDraft.title.trim()) {
      toast.error("Award title is required");
      return;
    }
    const exists = editingId !== null;
    const next = exists
      ? awards.map((a: any) => (a.id === editingId ? editingDraft : a))
      : [...awards, editingDraft];
    setAwards(next);
    setEditingDraft(null);
    setEditingId(null);
    toast.success(exists ? "Award updated" : "Award added — autosaved to draft");
  };
  const removeAward = (a: Award) => {
    setAwards(awards.filter((x: any) => x.id !== a.id));
    toast.success(`Deleted "${a.title}" from the draft`);
  };

  const toggleVisible = (kind: "skills" | "certificates" | "awards", id: string) => {
    if (kind === "skills") {
      setSkills(skills.map((s: any) => (s.id === id ? { ...s, visible: s.visible === false } : s)));
    } else if (kind === "certificates") {
      setCerts(
        certificates.map((c: any) => (c.id === id ? { ...c, visible: c.visible === false } : c)),
      );
    } else {
      setAwards(awards.map((a: any) => (a.id === id ? { ...a, visible: a.visible === false } : a)));
    }
  };

  const duplicate = (kind: "skills" | "certificates" | "awards", entry: any) => {
    const copy: any = {
      ...entry,
      id: `${kind}-copy-${Date.now().toString(36)}`,
      title: `${entry.title || entry.name} (copy)`,
      sort: nextSort(kind === "skills" ? skills : kind === "certificates" ? certificates : awards),
    };
    if (kind === "skills") setSkills([...skills, copy]);
    else if (kind === "certificates") setCerts([...certificates, copy]);
    else setAwards([...awards, copy]);
    toast.success("Duplicated into the draft");
  };

  /* ---------------- sheet editor ---------------- */
  const editor = (
    <FormSection
      title={
        editingKind === "skills"
          ? editingId
            ? "Edit skill"
            : "New skill"
          : editingKind === "certificates"
            ? editingId
              ? "Edit certificate"
              : "New certificate"
            : editingId
              ? "Edit award"
              : "New award"
      }
      className="border-0 p-0"
    >
      {editingKind === "skills" && (
        <>
          <Field label="Name">
            <InputField
              value={editingDraft?.name ?? ""}
              onChange={(e) =>
                setEditingDraft((d: any) => (d ? { ...d, name: e.target.value } : d))
              }
              data-testid="skill-name"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Category">
              <InputField
                value={editingDraft?.categoryId ?? ""}
                placeholder="Programming Languages…"
                onChange={(e) =>
                  setEditingDraft((d: any) => (d ? { ...d, categoryId: e.target.value } : d))
                }
              />
            </Field>
            <Field label="Level">
              <select
                className="w-full border border-input bg-background px-3 py-2 text-sm"
                value={editingDraft?.level ?? ""}
                onChange={(e) =>
                  setEditingDraft((d: any) =>
                    d ? { ...d, level: e.target.value || undefined } : d,
                  )
                }
              >
                <option value="">—</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </Field>
          </div>
          <div className="flex items-end gap-6 pb-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 cursor-pointer"
                checked={Boolean(editingDraft?.visible)}
                onChange={(e) =>
                  setEditingDraft((d: any) => (d ? { ...d, visible: e.target.checked } : d))
                }
              />
              Visible on site
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 cursor-pointer"
                checked={Boolean(editingDraft?.featured)}
                onChange={(e) =>
                  setEditingDraft((d: any) => (d ? { ...d, featured: e.target.checked } : d))
                }
              />
              Featured
            </label>
          </div>
          <Field label="Short detail" hint="Shown on /skills.">
            <InputField
              value={editingDraft?.detail ?? ""}
              onChange={(e) =>
                setEditingDraft((d: any) => (d ? { ...d, detail: e.target.value } : d))
              }
              data-testid="skill-detail"
            />
          </Field>
          <Field label="Years of experience" hint="Optional.">
            <InputField
              type="number"
              min={0}
              value={editingDraft?.years != null ? String(editingDraft.years) : ""}
              onChange={(e) => {
                const v = e.target.value;
                setEditingDraft((d: any) => {
                  if (!d) return d;
                  if (v === "") {
                    const next: any = { ...d };
                    delete next.years;
                    return next;
                  }
                  return { ...d, years: Number(v) };
                });
              }}
            />
          </Field>
        </>
      )}
      {editingKind === "certificates" && (
        <>
          <Field label="Title">
            <InputField
              value={editingDraft?.title ?? ""}
              onChange={(e) =>
                setEditingDraft((d: any) => (d ? { ...d, title: e.target.value } : d))
              }
              data-testid="certificate-title"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Issuing organization">
              <InputField
                value={editingDraft?.issuer ?? ""}
                onChange={(e) =>
                  setEditingDraft((d: any) => (d ? { ...d, issuer: e.target.value } : d))
                }
              />
            </Field>
            <Field label="Category">
              <InputField
                value={editingDraft?.category ?? ""}
                placeholder="Cloud…"
                onChange={(e) =>
                  setEditingDraft((d: any) => (d ? { ...d, category: e.target.value } : d))
                }
              />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <DateField
              label="Issue date"
              value={editingDraft?.issueDate}
              onChange={(d) => setEditingDraft((d: any) => (d ? { ...d, issueDate: d } : d))}
            />
            {editingDraft?.expiryDate ? null : (
              <DateField
                label="Expiry date"
                value={editingDraft?.expiryDate}
                onChange={(d) => setEditingDraft((d: any) => (d ? { ...d, expiryDate: d } : d))}
              />
            )}
          </div>
          <Field label="Credential ID" hint="Optional.">
            <InputField
              value={editingDraft?.credentialId ?? ""}
              onChange={(e) =>
                setEditingDraft((d: any) => (d ? { ...d, credentialId: e.target.value } : d))
              }
            />
          </Field>
          <Field label="Credential URL" hint="Optional verification link.">
            <InputField
              value={editingDraft?.credentialUrl ?? ""}
              placeholder="https://…"
              onChange={(e) =>
                setEditingDraft((d: any) => (d ? { ...d, credentialUrl: e.target.value } : d))
              }
            />
          </Field>
          <Field label="Description" hint="Optional.">
            <textarea
              rows={3}
              className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm"
              value={editingDraft?.description ?? ""}
              onChange={(e) =>
                setEditingDraft((d: any) => (d ? { ...d, description: e.target.value } : d))
              }
            />
          </Field>
          <MediaField
            label="Certificate image / thumbnail"
            value={editingDraft?.image}
            onChange={(img) =>
              setEditingDraft((d: any) => (d ? { ...d, image: img.src ? img : undefined } : d))
            }
            accept="image"
          />
          <MediaField
            label="Certificate document"
            value={editingDraft?.document}
            onChange={(doc) =>
              setEditingDraft((d: any) => (d ? { ...d, document: doc.src ? doc : undefined } : d))
            }
          />
          <div className="flex items-end gap-6 pb-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 cursor-pointer"
                checked={Boolean(editingDraft?.visible)}
                onChange={(e) =>
                  setEditingDraft((d: any) => (d ? { ...d, visible: e.target.checked } : d))
                }
              />
              Visible on site
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 cursor-pointer"
                checked={Boolean(editingDraft?.featured)}
                onChange={(e) =>
                  setEditingDraft((d: any) => (d ? { ...d, featured: e.target.checked } : d))
                }
              />
              Featured
            </label>
          </div>
        </>
      )}
      {editingKind === "awards" && (
        <>
          <Field label="Award title">
            <InputField
              value={editingDraft?.title ?? ""}
              onChange={(e) =>
                setEditingDraft((d: any) => (d ? { ...d, title: e.target.value } : d))
              }
              data-testid="award-title"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Issuing organization">
              <InputField
                value={editingDraft?.issuer ?? ""}
                onChange={(e) =>
                  setEditingDraft((d: any) => (d ? { ...d, issuer: e.target.value } : d))
                }
              />
            </Field>
            <Field label="Category">
              <InputField
                value={editingDraft?.category ?? ""}
                placeholder="Academic…"
                onChange={(e) =>
                  setEditingDraft((d: any) => (d ? { ...d, category: e.target.value } : d))
                }
              />
            </Field>
          </div>
          <DateField
            label="Date received"
            value={editingDraft?.date}
            onChange={(d) => setEditingDraft((d: any) => (d ? { ...d, date: d } : d))}
          />
          <Field label="Reason for recognition" hint="Optional.">
            <InputField
              value={editingDraft?.reason ?? ""}
              placeholder="Why you received it…"
              onChange={(e) =>
                setEditingDraft((d: any) => (d ? { ...d, reason: e.target.value } : d))
              }
            />
          </Field>
          <Field label="Description" hint="Optional.">
            <textarea
              rows={3}
              className="w-full border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring text-sm"
              value={editingDraft?.description ?? ""}
              onChange={(e) =>
                setEditingDraft((d: any) => (d ? { ...d, description: e.target.value } : d))
              }
            />
          </Field>
          <Field label="Verification / reference URL" hint="Optional.">
            <InputField
              value={editingDraft?.referenceUrl ?? ""}
              placeholder="https://…"
              onChange={(e) =>
                setEditingDraft((d: any) => (d ? { ...d, referenceUrl: e.target.value } : d))
              }
            />
          </Field>
          <MediaField
            label="Supporting document or image"
            value={editingDraft?.document ?? editingDraft?.image}
            onChange={(doc) =>
              setEditingDraft((d: any) => (d ? { ...d, document: doc.src ? doc : undefined } : d))
            }
          />
          <div className="flex items-end gap-6 pb-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 cursor-pointer"
                checked={Boolean(editingDraft?.visible)}
                onChange={(e) =>
                  setEditingDraft((d: any) => (d ? { ...d, visible: e.target.checked } : d))
                }
              />
              Visible on site
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 cursor-pointer"
                checked={Boolean(editingDraft?.featured)}
                onChange={(e) =>
                  setEditingDraft((d: any) => (d ? { ...d, featured: e.target.checked } : d))
                }
              />
              Featured
            </label>
          </div>
          <Field label="Related education" hint="Optional — links this award to an education entry.">
            <InputField
              value={editingDraft?.relatedEducation ?? ""}
              placeholder="e.g. Bachelor of Science"
              onChange={(e) =>
                setEditingDraft((d: any) => (d ? { ...d, relatedEducation: e.target.value } : d))
              }
            />
          </Field>
          <Field label="Related project" hint="Optional — links this award to a project page.">
            <InputField
              value={editingDraft?.relatedProject ?? ""}
              placeholder="e.g. slug-of-project"
              onChange={(e) =>
                setEditingDraft((d: any) => (d ? { ...d, relatedProject: e.target.value } : d))
              }
            />
          </Field>
        </>
      )}
      <div className="flex gap-2">
        <Button
          data-testid={`${editingKind}-save`}
          onClick={
            editingKind === "skills"
              ? saveSkill
              : editingKind === "certificates"
                ? saveCert
                : saveAward
          }
          disabled={
            editingKind === "skills"
              ? !editingDraft?.name.trim()
              : editingKind === "certificates"
                ? !editingDraft?.title.trim()
                : !editingDraft?.title.trim()
          }
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
    <div className="max-w-3xl mx-auto py-6 space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-tighter">
        Preview
      </h3>
      <div className="border border-border rounded-lg p-4 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Published skills, certificates and awards render on /skills using the same tile grid.
          Draft changes appear here once you save + publish.
        </p>
      </div>
    </div>
  );

  const renderList = (
    kind: "skills" | "certificates" | "awards",
    entries: EntryWithSort[],
    labelField: (e: any) => string,
    subtitleField: (e: any) => string,
    badges: (e: any) => React.ReactNode,
  ) => {
    const f = entries.filter((e) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return labelField(e).toLowerCase().includes(q) || subtitleField(e).toLowerCase().includes(q);
    });
    return (
      <div className="border border-border" data-testid={`${kind}-list`}>
        {entries.length === 0 && (
          <EmptyState
            title={`No ${kind === "skills" ? "skills" : kind === "certificates" ? "certificates" : "awards"} yet`}
            description="Add your first entry."
            action={
              <Button
                onClick={
                  kind === "skills"
                    ? openNewSkill
                    : kind === "certificates"
                      ? openNewCert
                      : openNewAward
                }
              >
                <Plus className="size-4" /> Add entry
              </Button>
            }
          />
        )}
        {f.map((e) => (
          <div
            key={e.id}
            className="flex items-center gap-3 border-b border-border last:border-0 px-4 py-3 hover:bg-muted/30"
            data-testid={`${kind}-row`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-serif text-foreground">{labelField(e) || "(untitled)"}</span>
                <span className="text-xs text-muted-foreground">{subtitleField(e)}</span>
                {badges(e)}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setEditingKind(kind);
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
                onClick={() => toggleVisible(kind, e.id)}
              >
                {e.visible === false ? "Show" : "Hide"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => duplicate(kind, e)}
              >
                Duplicate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive"
                data-testid={`${kind}-delete`}
                onClick={() => {
                  if (kind === "skills") removeSkill(e as Skill);
                  else if (kind === "certificates") removeCert(e as Certificate);
                  else removeAward(e as Award);
                }}
              >
                Del.
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/onlyme" className="text-sm text-muted-foreground hover:underline">
            ← Back
          </Link>
          <h2 className="text-lg font-medium text-foreground">Skills · Certificates · Awards</h2>
        </div>
      </div>

      <SaveBar
        dirty={skillsDraft.dirty || certsDraft.dirty || awardsDraft.dirty}
        loading={skillsDraft.loading || certsDraft.loading || awardsDraft.loading}
        saving={skillsDraft.saving || certsDraft.saving || awardsDraft.saving}
        hasPublished={
          skillsDraft.data.isPublic || certsDraft.data.isPublic || awardsDraft.data.isPublic
        }
        lastSaved={(() => {
          const ms = Math.max(
            skillsDraft.lastSaved?.getTime() ?? 0,
            certsDraft.lastSaved?.getTime() ?? 0,
            awardsDraft.lastSaved?.getTime() ?? 0,
          );
          return ms > 0 ? new Date(ms) : null;
        })()}
        error={skillsDraft.error || certsDraft.error || awardsDraft.error}
        onSave={() => {
          skillsDraft.save();
          certsDraft.save();
          awardsDraft.save();
        }}
        onPublish={() => {
          skillsDraft.publish();
          certsDraft.publish();
          awardsDraft.publish();
        }}
        onUnpublish={() => {
          skillsDraft.unpublish();
          certsDraft.unpublish();
          awardsDraft.unpublish();
        }}
        onRevert={() =>
          window.confirm("Discard all staged changes and restore published versions?") &&
          (skillsDraft.revert(), certsDraft.revert(), awardsDraft.revert())
        }
      />

      {/* Skills */}
      <div className="border border-border rounded-lg">
        <div className="border-b border-border px-4 py-3 flex items-center justify-between bg-background/50">
          {sectionHeader(skills.length, "Skill", "Skills")}
          <Button data-testid="add-skill" onClick={openNewSkill} size="sm">
            <Plus className="size-4" /> Add skill
          </Button>
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skill name, category…"
            className="pl-8"
            data-testid="skill-search"
          />
        </div>
        {renderList(
          "skills",
          skills,
          (s) => s.name,
          (s) => s.categoryId,
          (s) => (
            <>
              {s.level && (
                <Badge variant="outline" className="text-[0.65rem]">
                  {s.level}
                </Badge>
              )}
              {s.featured && (
                <Badge variant="outline" className="text-[0.65rem]">
                  Featured
                </Badge>
              )}
              {s.visible === false && (
                <Badge variant="outline" className="text-[0.65rem] text-muted-foreground">
                  hidden
                </Badge>
              )}
            </>
          ),
        )}
      </div>

      {/* Certificates */}
      <div className="border border-border rounded-lg mt-6">
        <div className="border-b border-border px-4 py-3 flex items-center justify-between bg-background/50">
          {sectionHeader(certificates.length, "Certificate", "Certificates")}
          <Button data-testid="add-certificate" onClick={openNewCert} size="sm">
            <Plus className="size-4" /> Add certificate
          </Button>
        </div>
        {renderList(
          "certificates",
          certificates,
          (c) => c.title,
          (c) => c.issuer,
          (c) => (
            <>
              {c.featured && (
                <Badge variant="outline" className="text-[0.65rem]">
                  Featured
                </Badge>
              )}
              {c.visible === false && (
                <Badge variant="outline" className="text-[0.65rem] text-muted-foreground">
                  hidden
                </Badge>
              )}
            </>
          ),
        )}
      </div>

      {/* Awards */}
      <div className="border border-border rounded-lg mt-6">
        <div className="border-b border-border px-4 py-3 flex items-center justify-between bg-background/50">
          {sectionHeader(awards.length, "Award", "Awards")}
          <Button data-testid="add-award" onClick={openNewAward} size="sm">
            <Plus className="size-4" /> Add award
          </Button>
        </div>
        {renderList(
          "awards",
          awards,
          (a) => a.title,
          (a) => a.issuer,
          (a) => (
            <>
              {a.visible === false && (
                <Badge variant="outline" className="text-[0.65rem] text-muted-foreground">
                  hidden
                </Badge>
              )}
            </>
          ),
        )}
      </div>

      {/* Drawer editor */}
      <Sheet open={!!editingDraft} onOpenChange={(o) => !o && setEditingDraft(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingKind === "skills"
                ? "Skill"
                : editingKind === "certificates"
                  ? "Certificate"
                  : "Award"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">{editor}</div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${(deleteTarget as any).title ?? (deleteTarget as any).name ?? ""}"?`}
        description="Removes the entry from the draft (and from the site once you publish)."
        onConfirm={() => {
          if (deleteTarget) {
            if (editingKind === "skills") removeSkill(deleteTarget as Skill);
            else if (editingKind === "certificates") removeCert(deleteTarget as Certificate);
            else removeAward(deleteTarget as Award);
          }
          setDeleteTarget(null);
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
