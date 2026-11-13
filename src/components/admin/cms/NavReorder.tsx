/* eslint-disable @typescript-eslint/no-explicit-any */
// Admin component: drag-and-drop reordering of the top-level nav sections.
//
// Order is persisted to the `pages.navOrder` column via `reorderNav` (Task 2).
// The current order is read from `pages` via `listStaged`, filtered to the
// nav-relevant slugs and sorted by `navOrder`. Move up/down buttons are the
// keyboard alternative to dragging; "Restore default order" resets the canonical
// sequence (Overview, Education, Projects, Blog, Skills/Certs/Awards,
// Experience, Volunteering, Contact).

import * as React from "react";
import { toast } from "sonner";
import { getPublishedNavOrder, reorderNav } from "@/lib/server-fns";
import { Button } from "@/components/ui/button";
import { GripVertical } from "lucide-react";
import { SortableList } from "@/components/admin/cms/SortableList";

const DEFAULT_NAV = [
  { slug: "overview", label: "Overview" },
  { slug: "education", label: "Education" },
  { slug: "projects", label: "Projects" },
  { slug: "blog", label: "Blog" },
  { slug: "skills", label: "Skills/Certs/Awards" },
  { slug: "experience", label: "Experience" },
  { slug: "volunteering", label: "Volunteering" },
  { slug: "contact", label: "Contact" },
] as const;

type NavItem = {
  slug: string;
  label: string;
  navOrder: number;
};

export function NavReorder() {
  const [items, setItems] = React.useState<NavItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const defaultIndexBySlug = React.useMemo(
    () => new Map(DEFAULT_NAV.map((s, i) => [s.slug, i])),
    [],
  );

  const refresh = React.useCallback(async () => {
    const saved = ((await (getPublishedNavOrder as any)()) as string[]) ?? [];
    const rank = new Map(saved.map((slug, i) => [slug, i]));
    const next = DEFAULT_NAV.map((s) => ({
      slug: s.slug,
      label: s.label,
      navOrder:
        rank.get(s.slug) ?? Number.MAX_SAFE_INTEGER - 100 + (defaultIndexBySlug.get(s.slug) ?? 0),
    }));
    next.sort(
      (a, b) =>
        a.navOrder - b.navOrder ||
        (defaultIndexBySlug.get(a.slug) ?? 0) - (defaultIndexBySlug.get(b.slug) ?? 0),
    );
    setItems(next);
    setLoading(false);
  }, [defaultIndexBySlug]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleReorder(next: NavItem[]) {
    setItems(next);
    try {
      await (reorderNav as any)({ data: { slugs: next.map((i) => i.slug) } });
      toast.success("Nav order saved");
    } catch (err: any) {
      toast.error(err?.message ?? "Reorder failed");
      await refresh();
    }
  }

  async function handleRestore() {
    const next = DEFAULT_NAV.map((s, i) => ({
      slug: s.slug,
      label: s.label,
      navOrder: i,
    }));
    setItems(next);
    try {
      await (reorderNav as any)({ data: { slugs: next.map((i) => i.slug) } });
      toast.success("Default nav order restored");
    } catch (err: any) {
      toast.error(err?.message ?? "Restore failed");
      await refresh();
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[44px] items-center justify-center text-muted-foreground">
        Loading nav order…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-lg text-foreground">Nav order</h2>
        <p className="text-xs text-muted-foreground">
          Drag to reorder — the public top-level nav follows this order
        </p>
        <Button onClick={handleRestore} variant="outline" size="sm" className="rounded-none">
          Restore default order
        </Button>
      </div>

      <div className="border border-border">
        <div className="border-b border-border bg-muted/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">
          Section
        </div>
        <SortableList
          items={items}
          getId={(item) => item.slug}
          onReorder={handleReorder}
          renderItem={(item, { index, moveUp, moveDown }) => (
            <div
              className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30"
              data-testid="nav-row"
            >
              {/* Drag handle — visual; ≥44px touch target */}
              <div
                className="min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                aria-label={`Drag ${item.label}`}
              >
                <GripVertical className="size-5 text-muted-foreground" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="font-serif text-lg text-foreground">{item.label}</div>
                <div className="text-xs font-mono text-muted-foreground">{item.slug}</div>
              </div>

              {/* Keyboard alternative: move up / down */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={moveUp}
                  disabled={index === 0}
                  aria-label={`Move ${item.label} up`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 border border-border bg-background rounded-none"
                >
                  ↑
                </button>
                <button
                  onClick={moveDown}
                  disabled={index === items.length - 1}
                  aria-label={`Move ${item.label} down`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 border border-border bg-background rounded-none"
                >
                  ↓
                </button>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
