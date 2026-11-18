import { useContext } from "react";
import { ProjectSummary } from "@/components/public/ProjectSummary";
import { FeaturedProjectsContext } from "@/components/public/featured-projects-context";
import { SectionVisibilityContext } from "@/components/nav-projects";
import { Rich } from "@/lib/rich-inline";
import { sectionVisible } from "@/lib/section-visibility";
import {
  featuredHeading,
  featuredVisible,
  selectedFeaturedProjects,
  type FeaturedProjectsBlock,
} from "@/lib/featured-projects";

export function FeaturedProjects({ block }: { block: FeaturedProjectsBlock }) {
  const context = useContext(FeaturedProjectsContext);
  const visibility = useContext(SectionVisibilityContext);
  if (!context || !featuredVisible(block, context.site) || !sectionVisible(visibility, "projects"))
    return null;
  const projects = selectedFeaturedProjects(block, context.projects, context.site);
  if (!projects.length) return null;
  const heading = featuredHeading(block, context.site);
  return (
    <>
      {heading && (
        <h2 className="mt-12 mb-2 text-3xl text-foreground">
          <Rich text={heading} />
        </h2>
      )}
      <ul
        data-testid="featured-projects"
        className={`border-t border-border${heading ? "" : " mt-12"}`}
      >
        {projects.map((project) => (
          <li
            key={project.slug}
            data-featured-project={project.slug}
            className="border-b border-border py-5"
          >
            <ProjectSummary project={project} />
          </li>
        ))}
      </ul>
    </>
  );
}
