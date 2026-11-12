// Compact certificate tile for the public /skills grid.
import type { Certificate } from "@/content/site";
import { Badge } from "@/components/ui/badge";

export function CertificateTile({ cert }: { cert: Certificate }) {
  return (
    <article className="border border-border rounded-lg p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <h3 className="font-serif text-lg text-foreground">{cert.title}</h3>
        {cert.featured && (
          <Badge variant="outline" className="text-[0.65rem]">
            Featured
          </Badge>
        )}
      </div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter mb-1">
        {cert.issuer}
      </p>
      {cert.category && <p className="text-sm text-muted-foreground mb-1">{cert.category}</p>}
      {cert.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">{cert.description}</p>
      )}
      {cert.credentialUrl && (
        <a
          href={cert.credentialUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-link underline hover:underline"
        >
          Verify credential ↗
        </a>
      )}
    </article>
  );
}
