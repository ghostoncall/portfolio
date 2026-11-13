"use client";

// Polished certificate tile for the public certificates grid.
// Editorial academic-catalog: ink on white, serif display, hairline rules,
// square corners, no gradients or flashy effects. All fields optional; empty
// fields render nothing. The whole card is a ≥44px touch target that opens
// the certificate preview dialog.
import * as React from "react";
import type { Certificate } from "@/content/site";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type CertificateTileProps = {
  cert: Certificate;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">;

const CertificateTile = React.forwardRef<HTMLButtonElement, CertificateTileProps>(
  ({ cert, className, ...props }, ref) => {
    const hasImage = Boolean(cert.image?.src);

    return (
      <button
        ref={ref}
        type="button"
        data-testid="certificate-tile"
        className={cn(
          "border border-border bg-background text-foreground rounded-none p-4 text-left align-start",
          "hover:border-foreground/20 hover:bg-muted/30",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground",
          "transition-colors duration-200 min-h-[44px]",
          className,
        )}
        {...props}
      >
        {hasImage && (
          <div className="relative mb-3 overflow-hidden" style={{ aspectRatio: "4/3" }}>
            <img
              src={cert.image.src}
              alt={cert.image.alt ?? cert.title ?? "Certificate"}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover bg-muted"
            />
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
          <h3 className="font-display text-[clamp(1rem,1.5vw,1.125rem)] text-foreground leading-snug">
            {cert.title}
          </h3>
          {cert.featured && (
            <Badge variant="outline" className="text-[0.65rem] px-2 py-0.5">
              Featured
            </Badge>
          )}
        </div>
        {cert.issuer && (
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter mb-1">
            {cert.issuer}
          </p>
        )}
        {cert.category && <p className="text-sm text-muted-foreground mb-1">{cert.category}</p>}
        {cert.description && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">{cert.description}</p>
        )}
        {(cert.issueDate || cert.expiryDate || cert.credentialId) && (
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1 mb-3 text-[clamp(0.75rem,2vw,0.8125rem)] sm:text-sm text-muted-foreground">
            {cert.issueDate && (
              <>
                <dt className="text-muted-foreground/60">Issued</dt>
                <dd className="text-foreground">{cert.issueDate}</dd>
              </>
            )}
            {cert.expiryDate && (
              <>
                <dt className="text-muted-foreground/60">Expires</dt>
                <dd className="text-foreground">{cert.expiryDate}</dd>
              </>
            )}
            {cert.credentialId && (
              <>
                <dt className="text-muted-foreground/60">Credential ID</dt>
                <dd className="text-foreground truncate">{cert.credentialId}</dd>
              </>
            )}
          </dl>
        )}
        {cert.credentialUrl && (
          <a
            href={cert.credentialUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "inline-flex items-center gap-1 min-h-[44px] min-w-[44px] px-3 py-1.5",
              "text-sm text-link underline underline-offset-4 hover:underline",
            )}
          >
            Verify credential ↗
          </a>
        )}
      </button>
    );
  },
);
CertificateTile.displayName = "CertificateTile";

export { CertificateTile };
