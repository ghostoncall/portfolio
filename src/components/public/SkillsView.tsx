// Public Skills section — rendered on the /skills page.
//
// Calm, list-based layout: each category is a quiet section (small heading on
// the left, a two-column list on the right), each skill is just its name with
// its detail in secondary type. No cards, badges, icons, levels or bars —
// only the data that exists. A light index row lets visitors jump straight to
// a category. Pure markup + CSS; no client JS.
import type { Skill, SkillCategory } from "@/content/site";

type Group = { id: string; name: string; skills: Skill[] };

function bySort<T extends { sort?: number }>(a: T, b: T) {
  return (a.sort ?? 0) - (b.sort ?? 0);
}

/** Group visible skills by category, in admin order; unknown categories → "Other". */
function groupSkills(skills: Skill[], categories: SkillCategory[]): Group[] {
  const visible = skills.filter((s) => s.visible !== false);
  const cats = [...categories].filter((c) => c.visible !== false).sort(bySort);
  const known = new Set(cats.map((c) => c.id));
  const groups: Group[] = cats.map((c) => ({
    id: c.id,
    name: c.name,
    skills: visible
      .filter((s) => s.categoryId === c.id)
      .sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || bySort(a, b)),
  }));
  const other = visible.filter((s) => !known.has(s.categoryId)).sort(bySort);
  if (other.length) groups.push({ id: "other", name: "Other", skills: other });
  return groups.filter((g) => g.skills.length > 0);
}

const anchor = (id: string) => `skills-${id.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;

export function SkillsView({
  skills,
  categories = [],
}: {
  skills: Skill[];
  categories?: SkillCategory[];
}) {
  const groups = groupSkills(skills, categories);
  if (!groups.length) return null;

  return (
    <div className="space-y-2">
      {groups.length > 1 && (
        <nav aria-label="Skill categories" className="pb-6">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {groups.map((g) => (
              <li key={g.id}>
                <a
                  href={`#${anchor(g.id)}`}
                  className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {g.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {groups.map((g) => (
        <section
          key={g.id}
          id={anchor(g.id)}
          aria-labelledby={`${anchor(g.id)}-h`}
          className="grid scroll-mt-28 gap-4 border-t border-border py-8 md:grid-cols-[12rem_1fr] md:gap-10"
        >
          <h2
            id={`${anchor(g.id)}-h`}
            className="font-sans text-sm font-bold tracking-wide text-foreground"
          >
            {g.name}
            <span className="ml-2 font-normal text-muted-foreground">{g.skills.length}</span>
          </h2>
          <ul className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
            {g.skills.map((s) => (
              <li key={s.id} data-testid="skill-item" className="min-w-0">
                <p className="font-sans text-[1.0625rem] leading-snug text-foreground">{s.name}</p>
                {(s.detail || s.description) && (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {s.detail || s.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
