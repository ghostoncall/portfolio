// "View Coursework" disclosure for an education entry.
//
// Collapsed by default. The panel animates its height with a CSS grid
// (0fr → 1fr) transition — no JS measuring, no scroll container of its own, so
// the page keeps scrolling natively with wheel, trackpad and touch. While
// collapsed the panel is `inert`: not focusable and hidden from assistive tech.
// Each entry owns its state, so several can be open at once.
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

export type CourseworkGroup = { category: string; courses: string[] };

export function CourseworkDisclosure({ groups }: { groups: CourseworkGroup[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex min-h-[44px] items-center gap-2 border border-border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {open ? "Hide Coursework" : "View Coursework"}
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        id={panelId}
        role="region"
        aria-label="Coursework"
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid gap-1 pt-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((c) => (
              <div key={c.category} className="rounded bg-muted/40 p-2">
                <span className="mb-1 block text-[0.68rem] font-semibold uppercase text-muted-foreground">
                  {c.category}
                </span>
                <p className="text-sm leading-relaxed text-foreground">
                  {(c.courses ?? []).join(", ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
