// Polished skill tile for the public /skills grid.
// Editorial academic-catalog: serif display type, hairline borders, square
// corners, subtle hover, clamped typography, consistent dimensions.
import type { Skill } from "@/content/site";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function SkillTile({ skill }: { skill: Skill }) {
  return (
    <article
      className={cn(
        "border border-border group flex flex-col min-h-[260px] p-5",
        "hover:bg-muted/50 transition-colors",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <h3 className="font-display text-foreground text-heading-3 leading-none">{skill.name}</h3>
        {skill.level && (
          <Badge variant="outline" className="text-[0.65rem]">
            {skill.level}
          </Badge>
        )}
      </header>
      {skill.categoryId && (
        <p className="label-caps text-muted-foreground mb-3">{skill.categoryId}</p>
      )}
      {skill.detail && (
        <p className="text-secondary-mobile text-muted-foreground leading-relaxed mb-4">
          {skill.detail}
        </p>
      )}
      {skill.years != null && (
        <p className="mt-auto text-sm text-foreground">
          {skill.years} year{skill.years !== 1 ? "s" : ""} experience
        </p>
      )}
    </article>
  );
}
