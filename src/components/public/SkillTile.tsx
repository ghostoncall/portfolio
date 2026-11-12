// Compact skill tile for the public /skills grid.
import type { Skill } from "@/content/site";
import { Badge } from "@/components/ui/badge";

export function SkillTile({ skill }: { skill: Skill }) {
  return (
    <article className="border border-border rounded-lg p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <h3 className="font-serif text-lg text-foreground">{skill.name}</h3>
        {skill.level && (
          <Badge variant="outline" className="text-[0.65rem]">
            {skill.level}
          </Badge>
        )}
      </div>
      {skill.categoryId && (
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter mb-1">
          {skill.categoryId}
        </p>
      )}
      {skill.detail && (
        <p className="text-sm text-muted-foreground leading-relaxed">{skill.detail}</p>
      )}
      {skill.years != null && (
        <p className="mt-2 text-sm text-foreground">
          {skill.years} year{skill.years !== 1 ? "s" : ""} experience
        </p>
      )}
    </article>
  );
}
