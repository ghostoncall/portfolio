"use client";

// Click-to-preview dialog for a certificate. Shows the certificate image
// enlarged (when available) and offers buttons to open the original document
// or verify the credential in a new tab. Radix Dialog-based; styled to the
// editorial academic-catalog language (ink on white, hairline rules, square
// corners, no animation or flashy effects).
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { Certificate } from "@/content/site";
import { cn } from "@/lib/utils";

type CertificatePreviewDialogProps = {
  cert: Certificate;
  children: React.ReactNode;
};

export function CertificatePreviewDialog({ cert, children }: CertificatePreviewDialogProps) {
  const hasImage = Boolean(cert.image?.src);
  const hasDocument = Boolean(cert.file?.src || cert.credentialUrl);

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/25" />
        <Dialog.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-full max-w-lg max-h-[90dvh] overflow-y-auto",
            "translate-x-[-50%] translate-y-[-50%]",
            "border border-border bg-background text-foreground rounded-none p-6 shadow-sm outline-none",
            "focus-visible:ring-1 focus-visible:ring-foreground",
          )}
        >
          <Dialog.Close
            className={cn(
              "absolute right-3 top-3 rounded-none p-1 opacity-70 ring-offset-background",
              "transition-opacity hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-2 cursor-pointer",
            )}
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>

          {cert.title && (
            <h2 className="font-display text-[clamp(1.25rem,2vw,1.5rem)] text-foreground leading-snug mb-1">
              {cert.title}
            </h2>
          )}
          {cert.issuer && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter mb-4">
              {cert.issuer}
            </p>
          )}

          {hasImage && (
            <figure className="mb-4">
              <div
                className="w-full max-w-[720px] flex items-center justify-center border border-border bg-muted"
                style={{ aspectRatio: "4/3", maxHeight: "60vh" }}
              >
                <img
                  src={cert.image.src}
                  alt={cert.image.alt ?? cert.title ?? "Certificate"}
                  className="max-w-full max-h-full object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </figure>
          )}

          {cert.description && (
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">{cert.description}</p>
          )}

          {hasDocument && (
            <div className="flex flex-wrap gap-2">
              {cert.file?.src && (
                <a
                  href={cert.file.src}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "inline-flex items-center gap-1 min-h-[44px] min-w-[44px] px-3 py-1.5",
                    "border border-border rounded-none text-sm text-link underline underline-offset-4 hover:underline",
                  )}
                >
                  Open original document ↗
                </a>
              )}
              {cert.credentialUrl && (
                <a
                  href={cert.credentialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "inline-flex items-center gap-1 min-h-[44px] min-w-[44px] px-3 py-1.5",
                    "border border-border rounded-none text-sm text-link underline underline-offset-4 hover:underline",
                  )}
                >
                  Verify credential ↗
                </a>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
