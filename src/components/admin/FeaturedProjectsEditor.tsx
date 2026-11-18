import { useContext } from "react";
import { GripVertical } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SortableList } from "@/components/admin/cms/SortableList";
import { VisibilityToggle } from "@/components/admin/cms/VisibilityToggle";
import { SectionVisibilityContext } from "@/components/nav-projects";
import {
  featuredHeading,
  featuredSlugs,
  featuredVisible,
  type FeaturedProjectsBlock,
  type OverviewProject,
} from "@/lib/featured-projects";
import { sectionVisible } from "@/lib/section-visibility";
import { plainText } from "@/lib/rich-inline";
import type { SiteIdentity } from "@/db/schema";

type Context = { site: SiteIdentity; projects: OverviewProject[] };
const button = "min-h-[40px] border border-border px-3 text-sm hover:bg-muted disabled:opacity-40";

export function FeaturedProjectsEditor({
  block,
  context,
  error,
  onChange,
  onRemove,
  onRetry,
}: {
  block: FeaturedProjectsBlock;
  context: Context | null;
  error: boolean;
  onChange: (block: FeaturedProjectsBlock) => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const visibility = useContext(SectionVisibilityContext);
  const site = context?.site;
  const slugs = context
    ? featuredSlugs(block, context.projects, context.site)
    : (block.projectSlugs ?? []);
  const bySlug = new Map(context?.projects.map((project) => [project.slug, project]));
  const available = (context?.projects ?? []).filter(
    (project) => project.status !== "archived" && !slugs.includes(project.slug),
  );
  return (
    <section className="space-y-4 border border-border p-4" aria-label="Featured Work settings">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Featured Work</h3>
        <button type="button" className={`${button} text-destructive`} onClick={onRemove}>
          Remove Featured Work section
        </button>
      </div>
      <VisibilityToggle
        label="Show Featured Work on Overview"
        visible={site ? featuredVisible(block, site) : block.visible !== false}
        disabled={!context}
        description="Hiding keeps your selected projects and order. Save staged keeps a draft; Publish updates changes the homepage."
        onChange={(visible) => onChange({ ...block, visible })}
      />
      <div className="space-y-1">
        <label className="block space-y-1 text-sm">
          <span>Featured Work heading</span>
          <input
            className="w-full border border-input bg-background px-3 py-2 text-sm"
            value={site ? featuredHeading(block, site) : (block.heading ?? "")}
            disabled={!context}
            onChange={(event) => onChange({ ...block, heading: event.target.value })}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          An empty heading shows the project list without a heading.
        </p>
      </div>
      {!context ? (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            {error
              ? "The project list could not be loaded. Your selection is still saved."
              : "Loading published projects…"}
          </p>
          {error && (
            <button type="button" className={button} onClick={onRetry}>
              Reload projects
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {block.projectSlugs === undefined
              ? "Using the automatic selection. Editing the list saves your chosen projects and order."
              : "Your chosen projects appear in this order."}{" "}
            Drag a handle or use the arrow buttons.
          </p>
          <div aria-label="Featured project order" className="space-y-2">
            <SortableList
              items={slugs}
              getId={(slug) => slug}
              handleOnly
              onReorder={(projectSlugs) => onChange({ ...block, projectSlugs })}
              renderItem={(slug, { index, moveUp, moveDown, dragHandleProps }) => {
                const project = bySlug.get(slug);
                const title = plainText(project?.title ?? slug);
                return (
                  <div
                    data-featured-row={slug}
                    className="flex flex-wrap items-center gap-2 border border-border bg-background p-2"
                  >
                    <button
                      type="button"
                      {...dragHandleProps}
                      aria-label={`Drag featured project ${title}`}
                      style={{ touchAction: "none" }}
                      className="inline-flex min-h-[44px] min-w-[44px] cursor-grab items-center justify-center border border-border active:cursor-grabbing"
                    >
                      <GripVertical className="size-4" />
                    </button>
                    <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      <p className="text-sm font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground">
                        {!project || project.status === "archived"
                          ? "Unavailable publicly; kept in your selection"
                          : `/projects/${slug}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={button}
                      aria-label={`Move featured project ${title} up`}
                      disabled={index === 0}
                      onClick={moveUp}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={button}
                      aria-label={`Move featured project ${title} down`}
                      disabled={index === slugs.length - 1}
                      onClick={moveDown}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={`${button} text-destructive`}
                      aria-label={`Remove ${title} from Featured Work`}
                      onClick={() =>
                        onChange({
                          ...block,
                          projectSlugs: slugs.filter((selected) => selected !== slug),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                );
              }}
            />
          </div>
          {!slugs.length && (
            <p className="text-sm text-muted-foreground">
              No featured projects selected. Add a project below.
            </p>
          )}
          <label className="block space-y-1 text-sm">
            <span>Add a featured project</span>
            <select
              aria-label="Add a featured project"
              className="w-full border border-input bg-background px-3 py-2"
              value=""
              disabled={!available.length}
              onChange={(event) => {
                if (event.target.value)
                  onChange({ ...block, projectSlugs: [...slugs, event.target.value] });
              }}
            >
              <option value="">
                {available.length
                  ? "Choose a published project…"
                  : "No other published projects available"}
              </option>
              {available.map((project) => (
                <option key={project.slug} value={project.slug}>
                  {plainText(project.title)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={button}
              disabled={!slugs.length}
              onClick={() => onChange({ ...block, projectSlugs: [] })}
            >
              Clear featured projects
            </button>
            <button
              type="button"
              className={button}
              disabled={block.projectSlugs === undefined}
              onClick={() => {
                const { projectSlugs: _slugs, ...automatic } = block;
                onChange(automatic);
              }}
            >
              Use automatic selection
            </button>
          </div>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Removing a project here keeps its project page and content.{" "}
        <Link to="/onlyme/projects" className="text-link underline">
          Edit project content
        </Link>
      </p>
      {!sectionVisible(visibility, "projects") && (
        <p className="text-sm text-muted-foreground">
          Projects is hidden in{" "}
          <Link to="/onlyme/settings" className="text-link underline">
            Settings
          </Link>
          . Your selection stays saved; Featured Work will appear when Projects is shown again.
        </p>
      )}
    </section>
  );
}
