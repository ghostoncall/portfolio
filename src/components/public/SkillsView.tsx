// Public Skills section — rendered on the /skills page.
//
// Calm, list-based layout: each category heading sits directly above its own
// list (nothing to "connect" across the page), and every skill is one hairline
// row — name, with its detail in secondary type underneath. No cards, badges,
// icons, levels or bars — only the data that exists. A row of jump links lets
// visitors go straight to a category. Pure markup + CSS; no client JS.
import type { Skill, SkillCategory } from "@/content/site";
import { Rich } from "@/lib/rich-inline";

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
    <div>
      {groups.length > 1 && (
        <nav aria-label="Jump to a skill category" className="mb-10">
          <ul className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <li key={g.id}>
                <a
                  href={`#${anchor(g.id)}`}
                  className="inline-flex min-h-[44px] items-center border border-border px-3 text-sm text-foreground transition-colors hover:border-foreground/60 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Rich text={g.name} />
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="space-y-12">
        {groups.map((g) => (
          <section
            key={g.id}
            id={anchor(g.id)}
            aria-labelledby={`${anchor(g.id)}-h`}
            className="scroll-mt-28"
          >
            <div className="flex items-baseline justify-between gap-4 border-b border-foreground/70 pb-2">
              <h2 id={`${anchor(g.id)}-h`} className="text-2xl leading-tight text-foreground">
                <Rich text={g.name} />
              </h2>
              <span className="shrink-0 text-sm text-muted-foreground">
                {g.skills.length} {g.skills.length === 1 ? "skill" : "skills"}
              </span>
            </div>
            <ul className="grid sm:grid-cols-2 sm:gap-x-10">
              {g.skills.map((s) => (
                <li
                  key={s.id}
                  data-testid="skill-item"
                  className="min-w-0 border-b border-border py-3"
                >
                  <p className="font-sans text-base font-medium leading-snug text-foreground">
                    <Rich text={s.name} />
                  </p>
                  {(s.detail || s.description) && (
                    <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                      <Rich text={s.detail || s.description} />
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
