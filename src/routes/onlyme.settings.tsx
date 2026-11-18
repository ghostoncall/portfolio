/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { getStaged, updateStaged, publishItem, revertItem } from "@/lib/server-fns";
import { NavReorder } from "@/components/admin/cms/NavReorder";
import type { SiteCopy, SiteIdentity } from "@/db/schema";
import { HeadingStyleControls } from "@/components/admin/cms/HeadingStyleControls";
import { MediaField } from "@/components/admin/cms/MediaField";
import { useUnsavedChanges } from "@/components/admin/cms/useUnsavedChanges";
import { cleanHeadingStyle, type SiteTypography } from "@/lib/typography";
import {
  cleanCopy,
  COPY_DEFAULTS,
  PAGE_DEFAULTS,
  PUBLIC_PAGE_SLUGS,
  pageCopy,
} from "@/lib/site-copy";
import { SectionVisibilityPanel } from "@/components/admin/cms/SectionVisibilityPanel";

export const Route = createFileRoute("/onlyme/settings")({
  component: Settings,
});

const input =
  "w-full border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring";

/** Labelled text input (label is a real <label>, so it's announced and clickable). */
function TextRow({
  label,
  value,
  onChange,
  hint,
  placeholder,
  required,
  type = "text",
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  multiline?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-foreground">
        {label}
        {required ? (
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
        )}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={2}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={input}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          required={required}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={input}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 border border-border p-5 sm:p-6">
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

type Form = {
  name: string;
  title: string;
  edition: string;
  email: string;
  showHomeBrand: boolean;
  socials: { label: string; href: string }[];
  typography: SiteTypography;
  copy: SiteCopy;
};

function toForm(staged: SiteIdentity): Form {
  return {
    name: staged.name ?? "",
    title: staged.title ?? "",
    edition: staged.edition ?? "",
    email: staged.email ?? "",
    showHomeBrand: staged.showHomeBrand ?? true,
    socials: (staged.socials ?? []).map((s) => ({ label: s.label ?? "", href: s.href ?? "" })),
    typography: staged.typography ?? {},
    copy: staged.copy ?? {},
  };
}

/** A copy line as shown in its input: saved value, else the live default. */
function lineValue(copy: SiteCopy, key: keyof typeof COPY_DEFAULTS): string {
  const v = copy[key];
  return v === undefined ? String(COPY_DEFAULTS[key]) : String(v);
}

function Settings() {
  const router = useRouter();
  const [form, setForm] = React.useState<Form | null>(null);
  const [published, setPublished] = React.useState<SiteIdentity | undefined>();
  const [saved, setSaved] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const dirty = form ? JSON.stringify(form) !== saved : false;
  useUnsavedChanges(dirty);

  const load = React.useCallback(async () => {
    const d: any = await (getStaged as any)({ data: { table: "settings", slug: "site" } });
    const next = toForm(d.staged as SiteIdentity);
    setPublished(d.published as SiteIdentity);
    setForm(next);
    setSaved(JSON.stringify(next));
  }, []);

  React.useEffect(() => {
    load().catch((e) => setError(e?.message ?? "Couldn't load settings."));
  }, [load]);

  if (!form) {
    return <div className="text-muted-foreground">{error ?? "Loading…"}</div>;
  }

  const set = (partial: Partial<Form>) => setForm((f) => (f ? { ...f, ...partial } : f));
  const setCopy = (partial: Partial<SiteCopy>) =>
    setForm((f) => (f ? { ...f, copy: { ...f.copy, ...partial } } : f));
  const setPageCopy = (
    slug: string,
    key: "title" | "navLabel" | "childNavLabel" | "description",
    value: string,
  ) =>
    setForm((f) => {
      if (!f) return f;
      const pages = { ...(f.copy.pages ?? {}) };
      pages[slug] = { ...(pages[slug] ?? {}), [key]: value };
      return { ...f, copy: { ...f.copy, pages } };
    });

  function content(): SiteIdentity & { kind: string } {
    const f = form!;
    return {
      name: f.name.trim(),
      title: f.title.trim(),
      edition: f.edition.trim(),
      email: f.email.trim(),
      // Rows with no label or no link are dropped instead of rendering empty.
      socials: f.socials
        .map((s) => ({ label: s.label.trim(), href: s.href.trim() }))
        .filter((s) => s.label && s.href),
      showHomeBrand: f.showHomeBrand,
      typography: {
        titles: cleanHeadingStyle(f.typography.titles),
        headings: cleanHeadingStyle(f.typography.headings),
      },
      copy: cleanCopy(f.copy),
      kind: "site",
    };
  }

  function validate(): string | null {
    if (!form!.name.trim()) return "Site name is required.";
    if (form!.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form!.email.trim()))
      return "That email address doesn't look right.";
    const bad = form!.socials.find((s) => s.href.trim() && !/^https?:\/\//i.test(s.href.trim()));
    if (bad) return `Social link "${bad.label || bad.href}" must start with https://`;
    return null;
  }

  async function run(kind: "save" | "publish" | "revert") {
    const problem = kind === "revert" ? null : validate();
    if (problem) {
      setError(problem);
      toast.error(problem);
      return;
    }
    if (
      kind === "revert" &&
      !window.confirm("Discard staged changes and restore the live settings?")
    )
      return;
    setSaving(true);
    setError(null);
    try {
      if (kind === "save") {
        await (updateStaged as any)({
          data: { table: "settings", slug: "site", content: content(), kind: "site" },
        });
        setSaved(JSON.stringify(form));
        toast.success("Saved as draft — publish to make it live");
      } else if (kind === "publish") {
        await (publishItem as any)({
          data: { table: "settings", slug: "site", content: content() },
        });
        await load();
        await router.invalidate();
        toast.success("Published — the live site now uses these settings");
      } else {
        await (revertItem as any)({ data: { table: "settings", slug: "site" } });
        await load();
        toast.success("Restored the live settings");
      }
    } catch (e: any) {
      const msg = e?.message ?? "Something went wrong. Your changes are still here — try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const copy = form.copy;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/onlyme" className="text-sm text-muted-foreground hover:underline">
          ← Back
        </Link>
        <h2 className="text-lg font-medium text-foreground">Settings</h2>
        {dirty && <span className="text-xs text-muted-foreground">· unsaved changes</span>}
      </div>

      <Card
        title="Navigation management"
        description="Customize menu titles without changing page headings, links or content. Save draft to keep changes here; Publish makes them live in both desktop and mobile menus. Empty uses the default."
      >
        <div className="grid gap-4 [overflow-wrap:anywhere] md:grid-cols-2">
          {PUBLIC_PAGE_SLUGS.map((slug) => (
            <div key={slug} className="space-y-1 border-t border-border pt-3">
              <TextRow
                label={`${PAGE_DEFAULTS[slug].name} menu title`}
                value={form.copy.pages?.[slug]?.navLabel ?? ""}
                placeholder={PAGE_DEFAULTS[slug].navLabel}
                onChange={(value) => setPageCopy(slug, "navLabel", value)}
                hint={`Target: ${PAGE_DEFAULTS[slug].path} · Live title: ${pageCopy(published, slug).navLabel}`}
              />
            </div>
          ))}
          <TextRow
            label="Skills subpage menu title"
            value={form.copy.pages?.["skills"]?.childNavLabel ?? ""}
            placeholder={pageCopy(content(), "skills").title}
            onChange={(value) => setPageCopy("skills", "childNavLabel", value)}
            hint="Only the Skills link inside the grouped menu. Its page heading stays unchanged."
          />
        </div>
      </Card>

      <SectionVisibilityPanel />

      <Card
        title="Identity"
        description="Your name, headline and contact email, used across the site."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <TextRow
            label="Site name"
            required
            value={form.name}
            onChange={(name) => set({ name })}
          />
          <TextRow
            label="Professional headline"
            value={form.title}
            onChange={(title) => set({ title })}
            hint="Used in search results and link previews, e.g. “AI Engineer”."
          />
          <TextRow
            label="Edition label"
            value={form.edition}
            onChange={(edition) => set({ edition })}
            hint="The black label in the header on wide screens. Empty hides it."
          />
          <TextRow
            label="Email"
            type="email"
            value={form.email}
            onChange={(email) => set({ email })}
            hint="Shown on Contact and in the footer call to action. Empty hides it."
          />
        </div>
      </Card>

      <Card title="Overview page" description="The home page header, photo and featured projects.">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.showHomeBrand}
            onChange={(e) => set({ showHomeBrand: e.target.checked })}
            className="size-4"
          />
          Show the header text on the home page
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <TextRow
            label="Home page header text"
            value={copy.homeBrand ?? COPY_DEFAULTS.homeBrand}
            onChange={(homeBrand) => setCopy({ homeBrand })}
            hint="Other pages show your site name instead."
          />
          <TextRow
            label="“Featured Work” heading"
            value={lineValue(copy, "featuredHeading")}
            onChange={(featuredHeading) => setCopy({ featuredHeading })}
            hint="Empty hides the featured projects section."
          />
          <div className="space-y-1">
            <label htmlFor="featured-count" className="block text-xs font-medium text-foreground">
              Number of featured projects
            </label>
            <input
              id="featured-count"
              type="number"
              min={0}
              max={12}
              value={copy.featuredCount ?? COPY_DEFAULTS.featuredCount}
              onChange={(e) => setCopy({ featuredCount: Number(e.target.value) })}
              className={`${input} max-w-32`}
            />
          </div>
        </div>
        <MediaField
          label="Profile photo"
          accept="image"
          value={{ src: lineValue(copy, "profileImage"), alt: copy.profileAlt ?? "" } as any}
          onChange={(item: any) =>
            setCopy({ profileImage: item?.src ?? "", profileAlt: item?.alt ?? "" })
          }
        />
        <p className="text-xs text-muted-foreground">
          Remove the photo to show none. Square images look best (shown at 200×200).
        </p>
      </Card>

      <Card
        title="Page titles & search descriptions"
        description="The big heading on each page and the description search engines show. Menu titles are managed above. Leave a box empty to use the default shown in grey."
      >
        <div className="space-y-5">
          {PUBLIC_PAGE_SLUGS.map((slug) => {
            const d = PAGE_DEFAULTS[slug];
            const p = copy.pages?.[slug] ?? {};
            return (
              <fieldset
                key={slug}
                className="space-y-3 border-t border-border pt-4 first:border-0 first:pt-0"
              >
                <legend className="text-sm font-semibold text-foreground">
                  {d.name}{" "}
                  <span className="font-mono text-xs font-normal text-muted-foreground">
                    {d.path}
                  </span>
                </legend>
                <div className="grid gap-3 md:grid-cols-2">
                  {slug === "blog" ? (
                    <p className="text-xs text-muted-foreground md:pt-6">
                      The blog's page heading is set in{" "}
                      <Link to="/onlyme/blog-settings" className="text-link underline">
                        Blog settings
                      </Link>
                      .
                    </p>
                  ) : (
                    <TextRow
                      label="Page title"
                      value={p.title ?? ""}
                      placeholder={d.title || form.name || "Site name"}
                      onChange={(v) => setPageCopy(slug, "title", v)}
                    />
                  )}
                </div>
                <TextRow
                  label="Search description"
                  multiline
                  value={p.description ?? ""}
                  placeholder={d.description}
                  onChange={(v) => setPageCopy(slug, "description", v)}
                />
              </fieldset>
            );
          })}
        </div>
      </Card>

      <Card title="Contact page wording" description="Empty a line to hide it.">
        <div className="grid gap-4 md:grid-cols-2">
          <TextRow
            label="Heading"
            value={lineValue(copy, "contactHeading")}
            onChange={(contactHeading) => setCopy({ contactHeading })}
          />
          <TextRow
            label="Words before your email"
            value={lineValue(copy, "contactLead")}
            onChange={(contactLead) => setCopy({ contactLead })}
          />
          <TextRow
            label="Note above the form"
            value={lineValue(copy, "contactFormNote")}
            onChange={(contactFormNote) => setCopy({ contactFormNote })}
          />
          <TextRow
            label="Message after sending"
            value={lineValue(copy, "contactThanks")}
            onChange={(contactThanks) => setCopy({ contactThanks })}
          />
        </div>
      </Card>

      <Card
        title="Footer call to action"
        description="Shown at the bottom of Skills, Certificates and Awards. Empty the heading to hide it."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <TextRow
            label="Heading"
            value={lineValue(copy, "footerCtaHeading")}
            onChange={(footerCtaHeading) => setCopy({ footerCtaHeading })}
          />
          <TextRow
            label="Link text (goes to Contact)"
            value={lineValue(copy, "footerCtaLink")}
            onChange={(footerCtaLink) => setCopy({ footerCtaLink })}
          />
        </div>
      </Card>

      <Card
        title="Headings"
        description="Applies across the whole site. Individual headings in the page editor can override this."
      >
        <HeadingStyleControls
          label="Page titles"
          sample={form.name || "Page title"}
          level="h1"
          value={form.typography.titles}
          onChange={(titles) => set({ typography: { ...form.typography, titles } })}
        />
        <HeadingStyleControls
          label="Section headings"
          sample={lineValue(copy, "featuredHeading") || "Section heading"}
          level="h2"
          value={form.typography.headings}
          onChange={(headings) => set({ typography: { ...form.typography, headings } })}
        />
      </Card>

      <Card
        title="Social links"
        description="Shown in the header and the mobile menu. GitHub and LinkedIn links get their icon automatically."
      >
        <div className="space-y-3">
          {form.socials.map((s, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
              <TextRow
                label="Label"
                value={s.label}
                placeholder="GitHub"
                onChange={(label) => {
                  const n = [...form.socials];
                  n[i] = { ...n[i]!, label };
                  set({ socials: n });
                }}
              />
              <TextRow
                label="Link"
                type="url"
                value={s.href}
                placeholder="https://github.com/…"
                onChange={(href) => {
                  const n = [...form.socials];
                  n[i] = { ...n[i]!, href };
                  set({ socials: n });
                }}
              />
              <button
                type="button"
                onClick={() => set({ socials: form.socials.filter((_, j) => j !== i) })}
                className="min-h-[38px] border border-border px-3 text-sm text-destructive hover:bg-destructive/10"
                aria-label={`Remove ${s.label || "this link"}`}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set({ socials: [...form.socials, { label: "", href: "" }] })}
            className="border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            + Add a link
          </button>
        </div>
      </Card>

      <div className="border border-border p-5 sm:p-6">
        <NavReorder site={content()} />
      </div>

      <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-2 py-3">
        <button
          onClick={() => void run("publish")}
          disabled={saving}
          className="min-h-[44px] bg-primary px-6 py-2 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Working…" : "Publish"}
        </button>
        <button
          onClick={() => void run("save")}
          disabled={saving || !dirty}
          className="min-h-[44px] border border-input bg-background px-6 py-2 font-medium text-foreground hover:bg-accent disabled:opacity-50"
        >
          Save draft
        </button>
        <button
          onClick={() => void run("revert")}
          disabled={saving}
          className="min-h-[44px] border border-input bg-background px-6 py-2 font-medium text-foreground hover:bg-accent disabled:opacity-50"
        >
          Revert to live
        </button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
