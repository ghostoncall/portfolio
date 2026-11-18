/* eslint-disable @typescript-eslint/no-explicit-any */
// Admin banner: some live content still comes from a code file
// (src/content/additions.ts) instead of the database, so it can't be edited
// or deleted here. One click copies it into the database; the public site
// looks the same afterwards, but the admin panel then controls all of it.
import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { adoptCodeContent, getCodeContentStatus } from "@/lib/server-fns";

type Status = {
  pending: boolean;
  totalItems: number;
  sections: { section: string; items: number }[];
};

export function CodeContentBanner() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (getCodeContentStatus as any)()
      .then((s: Status) => setStatus(s))
      .catch(() => setStatus(null));
  }, []);

  if (done) {
    return (
      <div role="status" className="mb-6 border border-border bg-muted/40 px-4 py-3 text-sm">
        Done — every entry on the site is now editable here. Reopen an editor to see them.
      </div>
    );
  }
  if (!status?.pending) return null;

  const summary = status.sections.length
    ? status.sections.map((s) => `${s.section} (${s.items})`).join(", ")
    : "a few fields";

  async function adopt() {
    setBusy(true);
    setError(null);
    try {
      await (adoptCodeContent as any)({ data: {} });
      setDone(true);
      await router.invalidate();
    } catch (err: any) {
      setError(err?.message ?? "That didn't work. Nothing was changed — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="code-content-title"
      className="mb-6 border border-foreground/30 bg-background px-4 py-4 sm:px-5"
    >
      <h2 id="code-content-title" className="text-base font-semibold text-foreground">
        Some live content isn't editable here yet
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        {status.totalItems > 0 ? `${status.totalItems} entries` : "Some entries"} shown on the
        site come from a code file, not the admin panel: {summary}. That's why they can't be
        edited or deleted, and why cleared fields come back. Import them once and everything on
        the site is managed here. The live site looks the same afterwards.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void adopt()}
          disabled={busy}
          className="min-h-[44px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Importing…" : "Import into admin"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
