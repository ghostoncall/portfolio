// Polished award tile for the public /awards grid.
// Editorial academic-catalog: serif display type, hairline borders, square
// corners, subtle hover, clamped typography. Distinct from Skills/Certificates:
// serif title, visually separated reason box, reference link. All fields
// optional; empty fields render nothing.
import { useState } from "react";
import type { Award, ImageAsset } from "@/content/site";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const isImageUrl = (src?: string) => !!src && /\.(avif|webp|png|jpe?g|gif)(\?|#|$)/i.test(src);

/** The award's image, if any: the optimized thumbnail, or a legacy image field. */
function awardImage(award: Award): ImageAsset | null {
  if (award.thumbnail?.src) return award.thumbnail;
  const legacy = award.image?.src ? award.image : award.document;
  if (legacy?.src && isImageUrl(legacy.src)) {
    return { src: legacy.src, ...(legacy.alt ? { alt: legacy.alt } : {}) };
  }
  return null;
}

/** Small thumbnail that opens the full-size image in an accessible dialog. */
function AwardImage({ image, title }: { image: ImageAsset; title: string }) {
  const [open, setOpen] = useState(false);
  const alt = image.alt || `${title} — image`;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View image: ${title}`}
        className="group/thumb block w-20 shrink-0 overflow-hidden border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-24"
      >
        <img
          src={image.thumb || image.src}
          alt=""
          width={image.thumbWidth ?? 240}
          height={image.thumbHeight ?? 180}
          loading="lazy"
          decoding="async"
          className="aspect-[4/3] h-auto w-full object-cover transition-transform duration-300 group-hover/thumb:scale-[1.04] motion-reduce:transition-none"
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(92vw,64rem)] border-border p-3 sm:p-4">
          <DialogTitle className="pr-8 font-serif text-base font-normal">{title}</DialogTitle>
          <DialogDescription className="sr-only">Full-size image</DialogDescription>
          {open && (
            <img
              src={image.src}
              alt={alt}
              width={image.width}
              height={image.height}
              decoding="async"
              className="mx-auto h-auto max-h-[78vh] w-auto max-w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AwardTile({ award }: { award: Award }) {
  const image = awardImage(award);
  return (
    <article
      data-testid="award-tile"
      className={cn(
        "border border-border bg-background text-foreground rounded-none p-5 group",
        "hover:border-foreground/20 hover:bg-muted/30 transition-colors",
        "min-h-[44px]",
      )}
    >
      <header className="flex items-start gap-4 mb-3">
        {image && <AwardImage image={image} title={award.title} />}
        <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2">
          <h3 className="font-serif text-[clamp(1rem,1.5vw,1.125rem)] text-foreground leading-snug">
            {award.title}
          </h3>
          {award.date && (
            <time className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter leading-none">
              {award.date}
            </time>
          )}
        </div>
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
