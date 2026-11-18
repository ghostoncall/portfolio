import { Blocks } from "@/components/blocks";
import { FeaturedProjects } from "@/components/public/FeaturedProjects";
import { FeaturedProjectsContext } from "@/components/public/featured-projects-context";
import type { Block, Project } from "@/content/site";
import type { SiteIdentity } from "@/db/schema";

/** Published and staged Overview bodies share the renderer and public styles. */
export function OverviewView({
  blocks,
  featured,
  site,
  projects = featured,
  featuredWorkManaged = false,
}: {
  blocks: Block[];
  featured: Project[];
  site: SiteIdentity;
  projects?: Project[] | undefined;
  featuredWorkManaged?: boolean;
}) {
  const managed = featuredWorkManaged || blocks.some((block) => block.type === "featured-projects");
  return (
    <FeaturedProjectsContext.Provider value={{ site, projects }}>
      <Blocks blocks={blocks} />
      {!managed && <FeaturedProjects block={{ type: "featured-projects" }} />}
    </FeaturedProjectsContext.Provider>
  );
}
