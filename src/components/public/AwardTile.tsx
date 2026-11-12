// Polished award tile for the public /awards grid.
// Editorial academic-catalog: serif display type, hairline borders, square
// corners, subtle hover, clamped typography. Distinct from Skills/Certificates:
// serif title, visually separated reason box, reference link. All fields
// optional; empty fields render nothing.
import type { Award } from "@/content/site";
import { cn } from "@/lib/utils";

export function AwardTile({ award }: { award: Award }) {
  return (
    <article
      className={cn(
        "border border-border bg-background text-foreground rounded-none p-5 group",
        "hover:border-foreground/20 hover:bg-muted/30 transition-colors",
        "min-h-[44px]",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <h3 className="font-serif text-[clamp(1rem,1.5vw,1.125rem)] text-foreground leading-snug">
          {award.title}
        </h3>
        {award.date && (
          <time className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter leading-none">
            {award.date}
          </time>
        )}
      </header>
      {award.issuer && (
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter mb-1">
          {award.issuer}
        </p>
      )}
      {award.category && <p className="text-sm text-muted-foreground mb-1">{award.category}</p>}
      {award.description && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{award.description}</p>
      )}
      {award.reason && (
        <section className="mt-auto border-t border-border pt-3 text-sm text-foreground leading-relaxed">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter block mb-1">
            Why recognized
          </p>
          <p className="font-serif text-foreground">{award.reason}</p>
        </section>
      )}
      {award.referenceUrl && (
        <a
          href={award.referenceUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "inline-flex items-center gap-1 min-h-[44px] min-w-[44px] px-3 py-1.5 mt-3",
            "text-sm text-link underline underline-offset-4 hover:underline",
          )}
        >
          View credential ↗
        </a>
      )}
    </article>
  );
}
