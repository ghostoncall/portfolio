// Public education section — rendered on the Overview page.
// All fields optional; empty subsections render nothing.
import type { EducationEntry, EducationPageContent } from "@/content/site";
import { Badge } from "@/components/ui/badge";
import { CourseworkDisclosure } from "@/components/public/CourseworkDisclosure";
import { plainText, Rich } from "@/lib/rich-inline";

const yearOf = (iso?: string) => {
  const y = iso ? new Date(iso).getFullYear() : NaN;
  return Number.isFinite(y) ? String(y) : "";
};

/** "2021 — 2025", "2023 — Present", or just one end when that's all there is. */
function period(e: EducationEntry): string {
  const from = yearOf(e.startDate);
  const to = e.current ? "Present" : yearOf(e.endDate);
  if (from && to) return `${from} — ${to}`;
  return from || to;
}

/** "CGPA 7.95 / 10" — the scale is only appended when the value doesn't already include one. */
function grade(e: EducationEntry): string {
  const value = e.cgpa?.trim();
  if (!value) return "";
  const scale = e.gradingScale?.trim();
  return scale && !value.includes("/") ? `CGPA ${value} / ${scale}` : `CGPA ${value}`;
}

export function EducationView({ content }: { content?: EducationPageContent }) {
  const entries: EducationEntry[] = (content?.entries ?? []).filter(
    (e: EducationEntry) => e.visible !== false,
  );
  if (!entries.length) return null;

  return (
    <section className="space-y-6">
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
                  alt={e.logo.alt ?? plainText(e.institution)}
                  data-testid="education-logo"
                  className="block h-auto w-auto max-h-14 max-w-20 object-contain sm:max-h-20 sm:max-w-32"
                />
              </div>
            )}
            <div className={e.logo?.src ? "min-w-0 flex-1" : "min-w-0"}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {/* The page title is the h1, so each qualification is an h2. */}
                <h2 className="font-serif text-lg tracking-normal text-foreground"><Rich text={e.degree} /></h2>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter">
                  <Rich text={e.institution} />
                </span>
                {e.current && (
                  <Badge variant="secondary" className="text-[0.65rem]">
                    Current
                  </Badge>
                )}
                {e.status && (
                  <Badge variant="outline" className="text-[0.65rem]">
                    <Rich text={e.status} />
                  </Badge>
                )}
              </div>
              {[e.location, period(e), grade(e)].some(Boolean) && (
                <p className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  {[e.location, period(e), grade(e)]
                    .filter(Boolean)
                    .map((part, i) => (
                      <span key={i}>
                        {i > 0 && (
                          <span aria-hidden="true" className="mr-2">
                            ·
                          </span>
                        )}
                        <Rich text={part} />
                      </span>
                    ))}
                </p>
              )}
              {e.field && <p className="font-serif text-foreground"><Rich text={e.field} /></p>}
              {e.specialization && (
                <p className="mt-0.5 font-serif text-[0.95rem] italic text-muted-foreground">
                  <Rich text={e.specialization} />
                </p>
              )}
              {!!e.coursework?.length && <CourseworkDisclosure groups={e.coursework} />}
              {!!e.distinctions?.length && (
                <div className="mt-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter mb-1">
                    Distinctions
                  </h3>
                  <p className="text-sm text-foreground leading-relaxed">
                    <Rich text={e.distinctions.join(", ")} />
                  </p>
                </div>
              )}
              {!!e.scholarships?.length && (
                <div className="mt-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter mb-1">
                    Scholarships
                  </h3>
                  <p className="text-sm text-foreground leading-relaxed">
                    <Rich text={e.scholarships.join(", ")} />
                  </p>
                </div>
              )}
              {!!e.research?.length && (
                <div className="mt-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter mb-1">
                    Research
                  </h3>
                  {e.research.map(
                    (r: {
                      title: string;
                      supervisor?: string;
                      area?: string;
                      description?: string;
                      technologies?: string[];
                    }) => (
                      <div key={r.title} className="mb-2">
                        <h4 className="font-serif text-sm text-foreground"><Rich text={r.title} /></h4>
                        {r.supervisor && (
                          <p className="text-xs text-muted-foreground">
                            <Rich text={r.supervisor} />
                            {r.area ? ` · ${r.area}` : ""}
                          </p>
                        )}
                        {r.area && !r.supervisor && (
                          <p className="text-xs text-muted-foreground"><Rich text={r.area} /></p>
                        )}
                        {r.description && (
                          <p className="text-sm text-foreground"><Rich text={r.description} /></p>
                        )}
                        {!!r.technologies?.length && (
                          <p className="text-[0.8rem] text-muted-foreground">
                            <Rich text={r.technologies.join(", ")} />
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
