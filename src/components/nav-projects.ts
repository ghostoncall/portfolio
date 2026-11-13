// Published project list for the side menu, supplied by the root loader in
// `projects.sort` order (the order written by the admin drag-to-reorder list).

import { createContext } from "react";

export type NavProject = { slug: string; title: string };

export const NavProjectsContext = createContext<NavProject[] | null>(null);

// Top-level nav order persisted by the admin drag-and-drop list. Supplied by
// the root loader so the menu renders in the saved order on the very first
// paint — no client refetch, so it can never reorder under the cursor.
export const NavOrderContext = createContext<string[] | null>(null);
