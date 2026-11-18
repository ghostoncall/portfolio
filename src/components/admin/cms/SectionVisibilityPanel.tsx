import { useCallback, useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { getSectionVisibilityAdmin, setSectionVisibility } from "@/lib/server-fns";
import { PAGE_DEFAULTS, PUBLIC_PAGE_SLUGS, type PublicPageSlug } from "@/lib/site-copy";
import { sectionVisible, type SectionVisibility } from "@/lib/section-visibility";
import { VisibilityToggle } from "./VisibilityToggle";

export function SectionVisibilityPanel() {
  const router = useRouter();
  const [visibility, setVisibility] = useState<SectionVisibility | null>(null);
  const [busy, setBusy] = useState<Partial<Record<PublicPageSlug, boolean>>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      setVisibility(await getSectionVisibilityAdmin());
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load section visibility.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function change(section: PublicPageSlug, visible: boolean) {
    const previous = sectionVisible(visibility, section);
    setVisibility((before) => ({ ...before, [section]: visible }));
    setBusy((before) => ({ ...before, [section]: true }));
    setError("");
    let persisted = false;
    try {
      await setSectionVisibility({ data: { section, visible } });
      persisted = true;
      setNotice(`${PAGE_DEFAULTS[section].name} is now ${visible ? "visible" : "hidden"}.`);
      // Invalidate cached public child routes too, including prefetched content.
      await router.invalidate();
    } catch (error) {
      if (!persisted) setVisibility((before) => ({ ...before, [section]: previous }));
      setError(
        persisted
          ? "Visibility was saved. Reload the public page to refresh it."
          : error instanceof Error
            ? error.message
            : "Could not save visibility. Please try again.",
      );
    } finally {
      setBusy((before) => ({ ...before, [section]: false }));
    }
  }

  return (
    <section
      className="space-y-4 border border-border p-5 sm:p-6"
      aria-label="Section visibility management"
    >
      <div>
        <h3 className="text-base font-semibold text-foreground">Section visibility</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Saves immediately, just like Résumé / CV. Hidden sections leave the public menus and
          pages. All content, media and drafts stay saved and editable here.
        </p>
      </div>
      {!visibility && !error && (
        <p className="text-sm text-muted-foreground">Loading visibility…</p>
      )}
      {visibility && (
        <div className="divide-y divide-border">
          {PUBLIC_PAGE_SLUGS.map((section) => {
            const visible = sectionVisible(visibility, section);
            const page = PAGE_DEFAULTS[section];
            return (
              <div
                key={section}
                className="flex flex-wrap items-center justify-between gap-x-4 py-2"
              >
                <VisibilityToggle
                  label={`Show ${page.name} on the site`}
                  visible={visible}
                  disabled={busy[section] === true}
                  onChange={(next) => void change(section, next)}
                />
                <span className="text-xs text-muted-foreground">
                  {busy[section] ? "Saving…" : visible ? "Visible" : "Hidden"} · {page.path}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Skills, Certificates and Awards can be shown independently. When Overview is hidden, the
        home address opens the first visible menu section. Résumé / CV uses the same switch here and
        in its document editor.
      </p>
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      {error && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{error}</p>
          {!visibility && (
            <button
              type="button"
              className="border border-border px-3 py-2"
              onClick={() => void load()}
            >
              Try again
            </button>
          )}
        </div>
      )}
    </section>
  );
}
