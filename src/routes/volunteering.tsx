/* eslint-disable @typescript-eslint/no-explicit-any */
// Public Volunteering page — editorial journal, placed before Contact.
//
// Reads the published `pages` document (slug "volunteering", kind "volunteering")
// so drafts never leak to the public site. Every section is optional: an
// empty section renders nothing (no default headings over empty content).

import React from "react";
import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { siteFromRoot } from "@/lib/root-data";
import { getPublishedPage } from "@/lib/server-fns";
import { normalizeVolunteeringPage } from "@/lib/cms-normalize";
import { pageCopy, pageMeta } from "@/lib/site-copy";
import { Media } from "@/components/media";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Rich } from "@/lib/rich-inline";

export const Route = createFileRoute("/volunteering")({
  loader: async ({ parentMatchPromise }) => {
    const [raw, site] = await Promise.all([
      (getPublishedPage as any)({ data: { slug: "volunteering" } }),
      siteFromRoot(parentMatchPromise, "volunteering"),
    ]);
    if (!raw) throw notFound();
    const content = normalizeVolunteeringPage(raw);
    return { content, site };
  },
  head: ({ loaderData }) => ({ meta: pageMeta(loaderData?.site, "volunteering") }),
  component: VolunteeringPage,
});

const sectionHeading = "text-3xl leading-tight text-foreground sm:text-4xl";
const meta = "text-xs uppercase tracking-wider text-muted-foreground";

function images(entry: any): any[] {
  return [...(entry.media ?? [])].filter((m: any) => m?.src);
}

function EntryCard({
  entry,
  index,
  onOpen,
}: {
  entry: any;
  index: number;
  onOpen: () => void;
}) {
  const media = images(entry);
  const captions = media
    .map((m: any) => m.caption)
    .filter(Boolean)
    .join(" · ");
  const details = [entry.date, entry.location, entry.category].filter(Boolean);
  const hasMore = Boolean(
    entry.narrative ||
      entry.contribution ||
      entry.reflections ||
      entry.takeaways?.length ||
      entry.links?.length ||
      media.length > 1,
  );
  // Alternate image side on wide screens; entries without images span the row.
  const flip = index % 2 === 1;
  return (
    <li
      className={`grid items-start gap-6 border-t border-border pt-8 ${
        media.length ? "md:grid-cols-2 md:gap-10" : ""
      }`}
      data-testid="volunteering-card"
    >
      {media.length > 0 && (
        <div className={`space-y-2 ${flip ? "md:order-2" : ""}`}>
          <Media items={media} ratio="16/9" />
          {captions && <p className="font-serif text-sm text-muted-foreground">{captions}</p>}
        </div>
      )}
      <div className="space-y-3">
        {(details.length > 0 || entry.featured) && (
          <p className={`${meta} flex flex-wrap gap-x-2`}>
            {details.map((d: string, i: number) => (
              <span key={i}>
                {i > 0 && (
                  <span aria-hidden="true" className="mr-2">
                    ·
                  </span>
                )}
                <Rich text={d} />
              </span>
            ))}
            {entry.featured && (
              <span className="text-foreground">
                {details.length > 0 && (
                  <span aria-hidden="true" className="mr-2 text-muted-foreground">
                    ·
                  </span>
                )}
                Featured
              </span>
            )}
          </p>
        )}
        <h3 className="text-2xl leading-snug text-foreground sm:text-3xl"><Rich text={entry.title} /></h3>
        {entry.organisation && (
          <p className="font-serif text-lg text-muted-foreground"><Rich text={entry.organisation} /></p>
        )}
        {entry.shortDescription && (
          <p className="font-serif text-foreground"><Rich text={entry.shortDescription} /></p>
        )}
        {hasMore && (
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] px-4"
            onClick={onOpen}
            data-testid={`volunteering-readmore-${index}`}
          >
            Read the full story
          </Button>
        )}
      </div>
    </li>
  );
}

function VolunteeringPage() {
  const { content, site } = Route.useLoaderData() as {
    content: any;
    site: any;
  };

  const [modalEntry, setModalEntry] = React.useState<any | null>(null);

  // Featured first, then the admin's order.
  const entries = (content.entries ?? [])
    .filter((e: any) => e.visible !== false)
    .sort(
      (a: any, b: any) =>
        Number(!!b.featured) - Number(!!a.featured) || Number(b.sort ?? 0) - Number(a.sort ?? 0),
    );

  const intro = content.introduction ?? {};
  const why = content.whyVolunteering ?? {};
  const ahead = content.lookingAhead ?? {};
  const interests: string[] = content.interests ?? [];
  const cta = content.cta ?? {};
  const entriesHeading =
    typeof content.entriesHeading === "string"
      ? content.entriesHeading
      : "Volunteering experiences";
  const ctaLink = `/contact?subject=${encodeURIComponent("Volunteering Opportunity")}`;

  return (
    <PageShell
      crumbs={[pageCopy(site, "volunteering").navLabel]}
      title={pageCopy(site, "volunteering").title}
      site={site}
    >
      {/* A. Introduction */}
      {(intro.heading || intro.body || intro.image?.src) && (
        <section className="space-y-5">
          {intro.heading && <h2 className={sectionHeading}><Rich text={intro.heading} /></h2>}
          {intro.body && (
            <p className="font-serif text-lg text-foreground whitespace-pre-line"><Rich text={intro.body} /></p>
          )}
          {intro.image?.src && (
            <figure>
              <Media items={[intro.image]} ratio="16/9" />
            </figure>
          )}
        </section>
      )}

      {/* B. Volunteering experiences */}
      {entries.length > 0 && (
        <section className={intro.heading || intro.body || intro.image?.src ? "mt-14" : ""}>
          {entriesHeading && <h2 className={`${sectionHeading} mb-6`}>{entriesHeading}</h2>}
          <ul className="space-y-10" data-testid="volunteering-journal">
            {entries.map((entry: any, i: number) => (
              <EntryCard key={entry.id} entry={entry} index={i} onOpen={() => setModalEntry(entry)} />
            ))}
          </ul>
        </section>
      )}

      {/* Read more dialog */}
      <Dialog open={modalEntry !== null} onOpenChange={(o) => !o && setModalEntry(null)}>
        <DialogContent
          data-testid="volunteering-dialog"
          className="w-[calc(100%-2rem)] max-w-3xl p-0"
        >
          {modalEntry && (
            <div className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden">
              <DialogHeader className="shrink-0 border-b border-border px-6 pb-4 pr-14 pt-6">
                <DialogTitle><Rich text={modalEntry.title} /></DialogTitle>
                <DialogDescription>
                  {[modalEntry.organisation, modalEntry.date, modalEntry.location]
                    .filter(Boolean)
                    .join(" · ")}
                </DialogDescription>
              </DialogHeader>
              <div
                data-testid="volunteering-dialog-body"
                data-lenis-prevent
                tabIndex={0}
                aria-label="Volunteering entry details"
                className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-6 font-serif text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {images(modalEntry).length > 0 && (
                  <figure className="mb-6">
                    <Media items={images(modalEntry)} ratio="16/9" />
                  </figure>
                )}
                {modalEntry.shortDescription && (
                  <p className="text-lg italic"><Rich text={modalEntry.shortDescription} /></p>
                )}
                {(
                  [
                    ["The story", modalEntry.narrative],
                    ["My contribution", modalEntry.contribution],
                    ["Reflections", modalEntry.reflections],
                  ] as const
                )
                  .filter(([, text]) => Boolean(text))
                  .map(([label, text]) => (
                    <div key={label}>
                      <h3 className="label-caps mb-2 text-muted-foreground">{label}</h3>
                      <p className="whitespace-pre-line">{text}</p>
                    </div>
                  ))}
                {!!modalEntry.takeaways?.length && (
                  <div>
                    <h3 className="label-caps mb-2 text-muted-foreground">What I learned</h3>
                    <ul className="list-disc space-y-2 pl-6">
                      {modalEntry.takeaways.map((t: string, i: number) => (
                        <li key={i}><Rich text={t} /></li>
                      ))}
                    </ul>
                  </div>
                )}
                {modalEntry.links?.some((l: any) => l?.href) && (
                  <div>
                    <h3 className="label-caps mb-2 text-muted-foreground">Links</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                      {modalEntry.links
                        .filter((l: any) => l?.href)
                        .map((l: any, i: number) => (
                          <a
                            key={l.id ?? i}
                            href={l.href}
                            target="_blank"
                            rel="noreferrer"
                            className="text-link underline"
                          >
                            <Rich text={l.label || l.href} /> ↗
                          </a>
                        ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
                <Button data-testid="volunteering-dialog-close" onClick={() => setModalEntry(null)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* D. Why I volunteer */}
      {(why.heading || why.body) && (
        <section className="mt-14 space-y-4">
          {why.heading && <h2 className={sectionHeading}><Rich text={why.heading} /></h2>}
          {why.body && (
            <p className="font-serif text-lg text-foreground whitespace-pre-line"><Rich text={why.body} /></p>
          )}
        </section>
      )}

      {/* E. Looking ahead */}
      {(ahead.heading || ahead.body || interests.length > 0) && (
        <section className="mt-14 space-y-4">
          {ahead.heading && <h2 className={sectionHeading}><Rich text={ahead.heading} /></h2>}
          {ahead.body && (
            <p className="font-serif text-lg text-foreground whitespace-pre-line"><Rich text={ahead.body} /></p>
          )}
          {interests.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm text-foreground">
              {interests.map((interest, i) => (
                <li key={i}><Rich text={interest} /></li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* F. Call to action (hidden with the admin toggle) */}
      {!cta.hidden && (
        <section className="mt-14 space-y-4 border-t border-border pt-10">
          <h2 className={sectionHeading}>{cta.heading || "Open to volunteering opportunities"}</h2>
          {cta.body && (
            <p className="font-serif text-lg text-foreground whitespace-pre-line"><Rich text={cta.body} /></p>
          )}
          <Link
            to={ctaLink}
            className="inline-flex min-h-[44px] items-center bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Rich text={cta.buttonText || "Get in touch"} />
          </Link>
        </section>
      )}
    </PageShell>
  );
}
