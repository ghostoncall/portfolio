// Compact award tile for the public /skills grid.
import type { Award } from "@/content/site";

export function AwardTile({ award }: { award: Award }) {
  return (
    <article className="border border-border rounded-lg p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <h3 className="font-serif text-lg text-foreground">{award.title}</h3>
      </div>
      {award.issuer && (
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter mb-1">
          {award.issuer}
        </p>
      )}
      {award.category && <p className="text-sm text-muted-foreground mb-1">{award.category}</p>}
      {award.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">{award.description}</p>
      )}
      {award.reason && (
        <p className="mt-2 text-sm text-foreground">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter block mb-1">
            Why recognized
          </span>
          {award.reason}
        </p>
      )}
      {award.referenceUrl && (
        <a
          href={award.referenceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-link underline hover:underline"
        >
          View credential ↗
        </a>
      )}
    </article>
  );
}

import { Badge } from "@/components/ui/badge";
