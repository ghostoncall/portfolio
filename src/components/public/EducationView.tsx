// Public education section — rendered on the Overview page.
// All fields optional; empty subsections render nothing.
import type { EducationEntry, EducationPageContent } from "@/content/site";
import { Badge } from "@/components/ui/badge";
import { CourseworkDisclosure } from "@/components/public/CourseworkDisclosure";

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
          className="reveal border border-border rounded-lg p-5 sm:p-6"
          data-testid="education-entry"
        >
          <div className={e.logo?.src ? "flex items-start gap-3 sm:gap-5" : undefined}>
            {e.logo?.src && (
              <div className="shrink-0" data-testid="education-logo-column">
                <img
                  src={e.logo.src}
                  alt={e.logo.alt ?? e.institution}
                  data-testid="education-logo"
                  className="block h-auto w-auto max-h-14 max-w-20 object-contain sm:max-h-20 sm:max-w-32"
                />
              </div>
            )}
            <div className={e.logo?.src ? "min-w-0 flex-1" : "min-w-0"}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {/* h3 so the entry's h4 subsections follow the page's h2. */}
                <h3 className="font-serif text-lg tracking-normal text-foreground">{e.degree}</h3>
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
              {!!e.coursework?.length && <CourseworkDisclosure groups={e.coursework} />}
              {!!e.distinctions?.length && (
                <div className="mt-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter mb-1">
                    Distinctions
                  </h4>
                  <p className="text-sm text-foreground leading-relaxed">
                    {e.distinctions.join(", ")}
                  </p>
                </div>
              )}
              {!!e.scholarships?.length && (
                <div className="mt-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter mb-1">
                    Scholarships
                  </h4>
                  <p className="text-sm text-foreground leading-relaxed">
                    {e.scholarships.join(", ")}
                  </p>
                </div>
              )}
              {!!e.research?.length && (
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
                        {r.description && (
                          <p className="text-sm text-foreground">{r.description}</p>
                        )}
                        {!!r.technologies?.length && (
                          <p className="text-[0.8rem] text-muted-foreground">
                            {r.technologies.join(", ")}
                          </p>
                        )}
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
