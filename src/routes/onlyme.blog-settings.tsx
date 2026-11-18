/* eslint-disable @typescript-eslint/no-explicit-any */
// Blog appearance + typography. Stored as one JSONB row and applied to the
// public blog routes immediately (no staging). Defaults reproduce the
// existing editorial design, so a fresh install looks unchanged.
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ImageIcon, Loader2, RotateCcw } from "lucide-react";
import { getBlogSettings, saveBlogSettings } from "@/lib/server-fns";
import { MediaPicker } from "@/components/admin/MediaPicker";
import {
  DEFAULT_BLOG_SETTINGS,
  FONT_OPTIONS,
  IMAGE_RATIOS,
  blogThemeVars,
  type BlogSettings,
} from "@/lib/blog-settings";
import { BLOG_SECTION_IDS, sectionPath, type BlogSectionId } from "@/lib/blog-sections";
import { Rich } from "@/lib/rich-inline";

export const Route = createFileRoute("/onlyme/blog-settings")({
  component: BlogSettingsPage,
});

const field =
  "w-full border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring";
const caption = "mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground";

// Not exported, so the route component can be code-split out of the entry.
function BlogSettingsPage() {
  const [settings, setSettings] = useState<BlogSettings>(DEFAULT_BLOG_SETTINGS);
  const [saved, setSaved] = useState<string>(JSON.stringify(DEFAULT_BLOG_SETTINGS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    (getBlogSettings as any)()
      .then((value: BlogSettings) => {
        setSettings(value);
        setSaved(JSON.stringify(value));
      })
      .catch(() => setNotice({ kind: "error", text: "Could not load blog settings." }))
      .finally(() => setLoading(false));
  }, []);

  const dirty = useMemo(() => JSON.stringify(settings) !== saved, [settings, saved]);

  function setPath(path: string, value: unknown) {
    setSettings((prev) => {
      const next: any = structuredClone(prev);
      const parts = path.split(".");
      let cursor = next;
      for (let index = 0; index < parts.length - 1; index += 1) {
        cursor = cursor[parts[index]!];
      }
      cursor[parts[parts.length - 1]!] = value;
      return next as BlogSettings;
    });
  }

  async function handleSave() {
    setSaving(true);
    setNotice(null);
    try {
      const result: any = await (saveBlogSettings as any)({ data: { settings } });
      setSettings(result.settings);
      setSaved(JSON.stringify(result.settings));
      setNotice({ kind: "ok", text: "Blog settings saved — the public blog is updated." });
    } catch (error: any) {
      setNotice({ kind: "error", text: error?.message ?? "Could not save blog settings." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading blog settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/onlyme/blogs" className="text-sm text-muted-foreground hover:underline">
              ← Blogs
            </Link>
          </div>
          <h2 className="mt-1 text-2xl font-medium text-foreground">Blog settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The two sections (Tech Blogs at /blog, My Journal at /blog/journal), the post list,
            and typography. Saving updates the public blog straight away.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSettings(structuredClone(DEFAULT_BLOG_SETTINGS));
              setNotice({ kind: "ok", text: "Defaults loaded. Save to apply them." });
            }}
            className="inline-flex items-center gap-1.5 border border-input px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset defaults
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`border px-4 py-3 text-sm ${
            notice.kind === "ok"
              ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-800"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="space-y-5">
          {BLOG_SECTION_IDS.map((id) => (
            <SectionEditor
              key={id}
              id={id}
              settings={settings}
              onChange={(key, value) => setPath(`sections.${id}.${key}`, value)}
            />
          ))}

          <Section title="Layout">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Post list">
                <select
                  value={settings.layout}
                  onChange={(e) => setPath("layout", e.target.value)}
                  className={field}
                >
                  <option value="list">List — one post per row</option>
                  <option value="grid">Grid — two columns</option>
                </select>
              </Field>
              <Field label="Posts per page">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.postsPerPage}
                  onChange={(e) => setPath("postsPerPage", clampInt(e.target.value, 1, 50, 10))}
                  className={field}
                />
              </Field>
            </div>
            <Field label="Post order">
              <select
                value={settings.listingOrder}
                onChange={(e) => setPath("listingOrder", e.target.value)}
                className={field}
              >
                <option value="newest">Newest first (by publication date)</option>
                <option value="oldest">Oldest first</option>
                <option value="manual">My own order (arrange it in Blogs → move up/down)</option>
              </select>
            </Field>
            <Toggle
              label="Pagination"
              hint="Split posts across pages using “Newer / Older” links."
              checked={settings.pagination.enabled}
              onChange={(value) => setPath("pagination.enabled", value)}
            />
            <Toggle
              label="Featured post"
              hint="Pin one post above the list. Mark a post as featured in the editor."
              checked={settings.featured.enabled}
              onChange={(value) => setPath("featured.enabled", value)}
            />
            {settings.featured.enabled && (
              <Field label="Featured placement">
                <select
                  value={settings.featured.position}
                  onChange={(e) => setPath("featured.position", e.target.value)}
                  className={field}
                >
                  <option value="top">Top — full-width feature above the list</option>
                  <option value="hero">Hero — large title + image</option>
                </select>
              </Field>
            )}
          </Section>

          <Section title="Post cards">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Card style">
                <select
                  value={settings.card.style}
                  onChange={(e) => setPath("card.style", e.target.value)}
                  className={field}
                >
                  <option value="divided">Divided — hairline rules</option>
                  <option value="bordered">Bordered — boxed cards</option>
                  <option value="plain">Plain — no rules</option>
                </select>
              </Field>
              <Field label="Excerpt length (characters)">
                <input
                  type="number"
                  min={0}
                  max={600}
                  value={settings.card.excerptLength}
                  onChange={(e) =>
                    setPath("card.excerptLength", clampInt(e.target.value, 0, 600, 180))
                  }
                  className={field}
                />
              </Field>
            </div>
            <Toggle
              label="Show featured image"
              checked={settings.card.showImage}
              onChange={(value) => setPath("card.showImage", value)}
            />
            {settings.card.showImage && (
              <Field label="Image aspect ratio">
                <select
                  value={settings.card.imageRatio}
                  onChange={(e) => setPath("card.imageRatio", e.target.value)}
                  className={field}
                >
                  {IMAGE_RATIOS.map((ratio) => (
                    <option key={ratio} value={ratio}>
                      {ratio}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Toggle
              label="Show excerpt"
              checked={settings.card.showExcerpt}
              onChange={(value) => setPath("card.showExcerpt", value)}
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <Toggle
                label="Show author"
                checked={settings.card.showAuthor}
                onChange={(value) => setPath("card.showAuthor", value)}
              />
              <Toggle
                label="Show date"
                checked={settings.card.showDate}
                onChange={(value) => setPath("card.showDate", value)}
              />
              <Toggle
                label="Show tags"
                checked={settings.card.showTags}
                onChange={(value) => setPath("card.showTags", value)}
              />
              <Toggle
                label="Show reading time"
                checked={settings.card.showReadTime}
                onChange={(value) => setPath("card.showReadTime", value)}
              />
            </div>
          </Section>

          <Section title="Empty sections">
            <p className="text-xs text-muted-foreground">
              Each section's “nothing published yet” heading and message are set in its own card
              above. This picture (optional) is shown with both.
            </p>
            <EmptyImageField
              value={settings.empty.image}
              onChange={(value) => setPath("empty.image", value)}
            />
          </Section>

          <Section title="Typography">
            <div className="grid gap-4 sm:grid-cols-2">
              <FontPicker
                label="Heading font"
                value={settings.typography.headingFont}
                onChange={(value) => setPath("typography.headingFont", value)}
              />
              <FontPicker
                label="Body font"
                value={settings.typography.bodyFont}
                onChange={(value) => setPath("typography.bodyFont", value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                label="Body size"
                value={settings.typography.baseSize}
                min={12}
                max={26}
                step={1}
                suffix="px"
                onChange={(value) => setPath("typography.baseSize", value)}
              />
              <NumberField
                label="Heading scale"
                value={settings.typography.headingScale}
                min={0.6}
                max={2}
                step={0.05}
                suffix="×"
                onChange={(value) => setPath("typography.headingScale", value)}
              />
              <NumberField
                label="Line height"
                value={settings.typography.lineHeight}
                min={1}
                max={2.4}
                step={0.05}
                onChange={(value) => setPath("typography.lineHeight", value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                label="Content width"
                value={settings.typography.contentWidth}
                min={28}
                max={80}
                step={1}
                suffix="rem"
                onChange={(value) => setPath("typography.contentWidth", value)}
              />
              <NumberField
                label="Image spacing"
                value={settings.typography.imageSpacing}
                min={0}
                max={6}
                step={0.25}
                suffix="rem"
                onChange={(value) => setPath("typography.imageSpacing", value)}
              />
              <NumberField
                label="Paragraph spacing"
                value={settings.typography.paragraphSpacing}
                min={0}
                max={3}
                step={0.25}
                suffix="rem"
                onChange={(value) => setPath("typography.paragraphSpacing", value)}
              />
            </div>
          </Section>

          <Section title="Colors">
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField
                label="Background"
                value={settings.typography.background}
                onChange={(value) => setPath("typography.background", value)}
              />
              <ColorField
                label="Body text"
                value={settings.typography.text}
                onChange={(value) => setPath("typography.text", value)}
              />
              <ColorField
                label="Links"
                value={settings.typography.link}
                onChange={(value) => setPath("typography.link", value)}
              />
              <ColorField
                label="Accent / rules"
                value={settings.typography.accent}
                onChange={(value) => setPath("typography.accent", value)}
              />
            </div>
          </Section>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="border border-border p-4">
            <h3 className="text-sm font-medium text-foreground">Live preview</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Sample content, using the current settings.
            </p>
          </div>
          <Preview settings={settings} />
        </aside>
      </div>
    </div>
  );
}

function clampInt(raw: string, min: number, max: number, fallback: number) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampFloat(raw: string, min: number, max: number, fallback: number) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border border-border p-5">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={caption}>{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <span>
        {label}
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={suffix ? `${label} (${suffix})` : label}>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clampFloat(e.target.value, min, max, value))}
        className={field}
      />
    </Field>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <span className={caption}>{label}</span>
      <div className="flex gap-2">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 border border-input bg-background p-0.5"
        />
        <input value={value} onChange={(e) => onChange(e.target.value)} className={field} />
      </div>
    </div>
  );
}

function FontPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const known = FONT_OPTIONS.some((option) => option.value === value);
  const [forceCustom, setForceCustom] = useState(false);
  const custom = forceCustom || !known;

  return (
    <div className="space-y-2">
      <Field label={label}>
        <select
          value={custom ? "__custom" : value}
          onChange={(e) => {
            if (e.target.value === "__custom") {
              setForceCustom(true);
            } else {
              setForceCustom(false);
              onChange(e.target.value);
            }
          }}
          className={field}
        >
          {FONT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          <option value="__custom">Custom family…</option>
        </select>
      </Field>
      {custom && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder='"My Font", Georgia, serif'
          className={`${field} font-mono text-xs`}
        />
      )}
      <p className="text-sm text-muted-foreground" style={{ fontFamily: value }}>
        The quick brown fox jumps over the lazy dog.
      </p>
    </div>
  );
}

/** One section's editable text, images, SEO and visibility. */
function SectionEditor({
  id,
  settings,
  onChange,
}: {
  id: BlogSectionId;
  settings: BlogSettings;
  onChange: (key: string, value: unknown) => void;
}) {
  const sec = settings.sections[id];
  const isLanding = id === "tech";
  const text = (key: keyof typeof sec, label: string, opts: { rows?: number; hint?: string } = {}) => (
    <label className="block">
      <span className={caption}>{label}</span>
      {opts.rows ? (
        <textarea
          value={String(sec[key] ?? "")}
          onChange={(e) => onChange(key, e.target.value)}
          rows={opts.rows}
          className={`${field} resize-y`}
        />
      ) : (
        <input value={String(sec[key] ?? "")} onChange={(e) => onChange(key, e.target.value)} className={field} />
      )}
      {opts.hint && <span className="mt-1 block text-xs text-muted-foreground">{opts.hint}</span>}
    </label>
  );
  return (
    <section className="space-y-4 border border-border p-5" aria-labelledby={`section-${id}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`section-${id}`} className="text-base font-semibold text-foreground">
          <Rich text={sec.name || (isLanding ? "Tech Blogs" : "My Journal")} />{" "}
          <span className="font-mono text-xs font-normal text-muted-foreground">{sectionPath(id)}</span>
        </h3>
        <a
          href={sectionPath(id)}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-link underline"
        >
          View on site ↗
        </a>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {text("name", "Name (switcher label & article tag)")}
        {text("title", "Page heading")}
      </div>
      {text("subtitle", "Subtitle (optional)")}
      {text("intro", "Introduction", { rows: 3, hint: "Shown under the heading. Empty → no introduction." })}
      <EmptyImageField
        label="Introduction image (optional)"
        value={sec.image}
        onChange={(value) => onChange("image", value)}
      />
      {sec.image && text("imageAlt", "Image description (alt text)", { hint: "What the picture shows, for screen readers." })}
      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle
          label="Show the introduction"
          checked={sec.showIntro}
          onChange={(value) => onChange("showIntro", value)}
        />
        <Toggle
          label="Show in the section switcher"
          checked={sec.showInSwitcher}
          onChange={(value) => onChange("showInSwitcher", value)}
        />
        {isLanding ? (
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Tech Blogs is the /blog landing page, so it is always published.
          </p>
        ) : (
          <Toggle
            label="Published (visible on the site)"
            hint="Off: /blog/journal and its articles return “not found” and leave the sitemap. Posts are kept."
            checked={sec.visible}
            onChange={(value) => onChange("visible", value)}
          />
        )}
      </div>
      <label className="block max-w-40">
        <span className={caption}>Order in switcher</span>
        <input
          type="number"
          min={0}
          max={9}
          value={sec.order}
          onChange={(e) => onChange("order", clampInt(e.target.value, 0, 9, isLanding ? 0 : 1))}
          className={field}
        />
      </label>
      <details className="border-t border-border pt-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Search & sharing (optional)
        </summary>
        <div className="mt-3 space-y-4">
          {text("seoTitle", "Search title", { hint: "Empty → “Page heading — your name”." })}
          {text("seoDescription", "Search description", { rows: 2, hint: "Empty → the introduction." })}
          <EmptyImageField
            label="Link preview image"
            value={sec.ogImage}
            onChange={(value) => onChange("ogImage", value)}
          />
        </div>
      </details>
      <details className="border-t border-border pt-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          When there are no posts
        </summary>
        <div className="mt-3 space-y-4">
          {text("emptyHeading", "Heading")}
          {text("emptyBody", "Message", { rows: 2 })}
        </div>
      </details>
    </section>
  );
}

function EmptyImageField({
  value,
  onChange,
  label = "Empty-state image (optional)",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <span className={caption}>{label}</span>
      {value && (
        <img src={value} alt="" className="h-20 w-auto border border-border object-cover" />
      )}
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Image URL"
          className={field}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 border border-input px-2 text-muted-foreground hover:bg-accent"
          title="Choose from the media library"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
      </div>
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-xs text-destructive hover:underline"
        >
          Remove image
        </button>
      )}
      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        accept="image"
        title={label}
        onSelect={(asset) => onChange(asset.url)}
      />
    </div>
  );
}

const SAMPLE_BODY = {
  title: "Measuring retrieval quality",
  dek: "A single accuracy number is never enough. Build the golden set first, then the failure taxonomy.",
  date: "2026-10-12",
  author: "Ada Lovelace",
  tags: ["RAG", "Evaluation"],
  readTime: "6 min read",
};

function Preview({ settings }: { settings: BlogSettings }) {
  const vars = blogThemeVars(settings) as CSSProperties;
  const cards = settings.layout === "grid" ? 2 : 1;

  return (
    <div style={vars} className="blog-theme mt-3 border border-border">
      <div className="p-4">
        <p className="font-display text-2xl leading-tight text-foreground">
          <Rich text={settings.sections.tech.title} />
        </p>
        {settings.sections.tech.showIntro && settings.sections.tech.intro && (
          <p className="mt-1 text-xs text-muted-foreground">
            <Rich text={settings.sections.tech.intro} />
          </p>
        )}

        {settings.featured.enabled && settings.featured.position === "hero" && (
          <div className="mt-4 border-y border-border py-3">
            <p className="label-caps text-muted-foreground">Featured</p>
            {settings.card.showImage && (
              <div
                className="mt-2 flex items-center justify-center border border-border bg-muted"
                style={{ aspectRatio: settings.card.imageRatio }}
              >
                <span className="label-caps text-muted-foreground">Cover</span>
              </div>
            )}
            <p className="mt-2 font-display text-xl leading-tight text-foreground">
              {SAMPLE_BODY.title}
            </p>
            {settings.card.showExcerpt && (
              <p className="mt-1 font-serif text-xs text-muted-foreground">
                {SAMPLE_BODY.dek.slice(0, settings.card.excerptLength)}
              </p>
            )}
          </div>
        )}

        <div
          className={
            settings.layout === "grid"
              ? "mt-4 grid grid-cols-2 gap-3"
              : "mt-4 border-t border-border"
          }
        >
          {Array.from({ length: cards }, (_, index) => (
            <div
              key={index}
              className={`${
                settings.layout === "grid"
                  ? settings.card.style === "bordered"
                    ? "border border-border p-2"
                    : ""
                  : `border-b border-border py-3 ${
                      settings.card.style === "bordered" ? "border border-border px-2" : ""
                    }`
              }`}
            >
              {settings.card.showImage && (
                <div
                  className="flex items-center justify-center border border-border bg-muted"
                  style={{ aspectRatio: settings.card.imageRatio }}
                >
                  <span className="label-caps text-[9px] text-muted-foreground">Cover</span>
                </div>
              )}
              <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                {[
                  settings.card.showDate && "12 Oct 2026",
                  settings.card.showAuthor && SAMPLE_BODY.author,
                  settings.card.showTags && SAMPLE_BODY.tags.join(" · "),
                ]
                  .filter(Boolean)
                  .join(" · ") || "\u00a0"}
              </p>
              <p className="mt-0.5 font-display text-sm leading-tight text-foreground">
                {index === 0 ? SAMPLE_BODY.title : "Notes on agent design"}
              </p>
              {settings.card.showExcerpt && (
                <p className="mt-1 font-serif text-[10px] leading-relaxed text-muted-foreground">
                  {SAMPLE_BODY.dek.slice(0, settings.card.excerptLength)}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <p className="label-caps mb-2 text-muted-foreground">Article</p>
          <div className="kg-content" style={{ maxWidth: "100%" }}>
            <h2>Start with failures</h2>
            <p>
              A single accuracy number is never enough. Build the golden set first, then the failure
              taxonomy.
            </p>
            <blockquote>
              <p>Measure the failures you can name.</p>
            </blockquote>
            <p>
              <a href="#preview">An inline link</a> shows the link colour and paragraph rhythm.
            </p>
          </div>
        </div>

        {settings.pagination.enabled && (
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[10px] text-muted-foreground">
            <span>← Newer</span>
            <span>Page 1 of 2</span>
            <span>Older →</span>
          </div>
        )}
      </div>
    </div>
  );
}
