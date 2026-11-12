// Public education section — rendered on the Overview page.
// All fields optional; empty subsections render nothing.
import type { EducationEntry, EducationPageContent } from "@/content/site";
import { Badge } from "@/components/ui/badge";

export function EducationView({ content }: { content?: EducationPageContent }) {
  const entries: EducationEntry[] = (content?.entries ?? []).filter(
    (e: EducationEntry) => e.visible !== false,
  );
  if (!entries.length) return null;

  return (
    <section className="space-y-6">
      <h2 className="text-heading-2 sm:text-3xl text-foreground">Education</h2>
      {entries.map((e) => (
        <article
          key={e.id}
          className="border border-border rounded-lg p-5 sm:p-6"
          data-testid="education-entry"
        >
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-serif text-lg text-foreground">{e.degree}</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter">
              {e.institution}
            </span>
            {e.current && (
              <Badge variant="secondary" className="text-[0.65rem]">
                Current
              </Badge>
            )}
            {e.status && (
              <Badge variant="outline" className="text-[0.65rem]">
                {e.status}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-baseline gap-3 mb-2 text-sm text-muted-foreground">
            {e.location && <span>{e.location}</span>}
            {e.startDate && <span>{new Date(e.startDate).getFullYear()}</span>}
            {e.endDate && !e.current && (
              <span>
                {"—"}
                {new Date(e.endDate).getFullYear()}
              </span>
            )}
            {e.cgpa && <span>· {e.cgpa}</span>}
          </div>
          {e.field && <p className="font-serif text-foreground">{e.field}</p>}
          {e.coursework?.length && (
            <div className="mt-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter mb-1">
                Coursework
              </h4>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {e.coursework.map((c: { category: string; courses: string[] }) => (
                  <div key={c.category} className="p-2 bg-muted/40 rounded">
                    <span className="text-[0.68rem] font-semibold text-muted-foreground block mb-1 uppercase">
                      {c.category}
                    </span>
                    <p className="text-sm text-foreground leading-relaxed">
                      {(c.courses ?? []).join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {e.distinctions?.length && (
            <div className="mt-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter mb-1">
                Distinctions
              </h4>
              <p className="text-sm text-foreground leading-relaxed">{e.distinctions.join(", ")}</p>
            </div>
          )}
          {e.scholarships?.length && (
            <div className="mt-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter mb-1">
                Scholarships
              </h4>
              <p className="text-sm text-foreground leading-relaxed">{e.scholarships.join(", ")}</p>
            </div>
          )}
          {e.research?.length && (
            <div className="mt-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter mb-1">
                Research
              </h4>
              {e.research.map(
                (r: {
                  title: string;
                  supervisor?: string;
                  area?: string;
                  description?: string;
                  technologies?: string[];
                }) => (
                  <div key={r.title} className="mb-2">
                    <h5 className="font-serif text-sm text-foreground">{r.title}</h5>
                    {r.supervisor && (
                      <p className="text-xs text-muted-foreground">
                        {r.supervisor}
                        {r.area ? ` · ${r.area}` : ""}
                      </p>
                    )}
                    {r.description && <p className="text-sm text-foreground">{r.description}</p>}
                    {r.technologies?.length && (
                      <p className="text-[0.8rem] text-muted-foreground">
                        {r.technologies.join(", ")}
                      </p>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
