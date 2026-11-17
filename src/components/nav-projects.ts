// Published project list for the side menu, supplied by the root loader in
// `projects.sort` order (the order written by the admin drag-to-reorder list).

import { createContext } from "react";

export type NavProject = { slug: string; title: string };

export const NavProjectsContext = createContext<NavProject[] | null>(null);

// Top-level nav order persisted by the admin drag-and-drop list. Supplied by
// the root loader so the menu renders in the saved order on the very first
// paint — no client refetch, so it can never reorder under the cursor.
export const NavOrderContext = createContext<string[] | null>(null);

/**
 * Apply an admin-saved order to the default nav list. Sections missing from
 * the saved order (e.g. one added after the order was saved, like "resume")
 * are placed directly after their default predecessor instead of at the end,
 * so a new section shows up where it belongs without re-saving the order.
 */
export function applyNavOrder<T extends { slug: string }>(
  defaults: readonly T[],
  order: readonly string[] | null | undefined,
): T[] {
  if (!order || order.length === 0) return [...defaults];
  const bySlug = new Map(defaults.map((d) => [d.slug, d]));
  const result: T[] = [];
  for (const slug of order) {
    const item = bySlug.get(slug);
    if (item && !result.includes(item)) result.push(item);
  }
  defaults.forEach((item, i) => {
    if (result.includes(item)) return;
    const prev = i > 0 ? defaults[i - 1] : undefined;
    const at = prev ? result.indexOf(prev) + 1 : 0;
    result.splice(at, 0, item);
  });
  return result;
}
