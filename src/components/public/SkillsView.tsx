// Public Skills section — rendered on the /skills page.
// All fields optional; empty entries render nothing.
import type { Skill } from "@/content/site";
import { SkillTile } from "@/components/public/SkillTile";

export function SkillsView({ skills }: { skills: Skill[] }) {
  const visibleSkills = skills.filter((s) => s.visible !== false);
  if (!visibleSkills.length) return null;

  return (
    <section id="skills" className="space-y-6">
      <h2 className="text-heading-2 sm:text-3xl text-foreground">Skills</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleSkills.map((s) => (
          <SkillTile key={s.id} skill={s} />
        ))}
      </div>
    </section>
  );
}
