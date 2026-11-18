import { createContext } from "react";
import type { SiteIdentity } from "@/db/schema";
import type { OverviewProject } from "@/lib/featured-projects";

export const FeaturedProjectsContext = createContext<{
  site: SiteIdentity;
  projects: OverviewProject[];
} | null>(null);
