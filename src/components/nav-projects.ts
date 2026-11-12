// Published project list for the side menu, supplied by the root loader in
// `projects.sort` order (the order written by the admin drag-to-reorder list).

import { createContext } from "react";

export type NavProject = { slug: string; title: string };

export const NavProjectsContext = createContext<NavProject[] | null>(null);
