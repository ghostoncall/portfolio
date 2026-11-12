/* eslint-disable @typescript-eslint/no-explicit-any */
// Public Volunteering page — editorial journal, placed before Contact.
//
// Reads the published `pages` document (slug "volunteering", kind "volunteering")
// so drafts never leak to the public site.

import React from "react";
import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { getPublishedPage, getSiteIdentity } from "@/lib/server-fns";
import { normalizeVolunteeringPage } from "@/lib/cms-normalize";
import { Media } from "@/components/media";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/volunteering")({
  loader: async () => {
    const [raw, site] = await Promise.all([
      (getPublishedPage as any)({ data: { slug: "volunteering" } }),
      (getSiteIdentity as any)(),
    ]);
    if (!raw) throw notFound();
    const content = normalizeVolunteeringPage(raw);
    return { content, site };
  },
  head: ({ loaderData }) => {
    const site = loaderData?.site;
    return {
      meta: [
        { title: `Volunteering — ${site?.name ?? "Portfolio"}` },
        {
          name: "description",
          content:
            "Volunteering beyond engineering — causes, communities, reflections and what I want to contribute next.",
        },
        { property: "og:title", content: `Volunteering — ${site?.name ?? "Portfolio"}` },
        {
          property: "og:description",
          content: "Giving back: causes, communities and reflections.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: VolunteeringPage,
});

function VolunteeringPage() {
  const { content, site } = Route.useLoaderData() as {
    content: any;
    site: any;
  };

  const [modalEntry, setModalEntry] = React.useState<any | null>(null);

  const entries = (content.entries ?? [])
    .filter((e: any) => e.visible !== false)
    .sort((a: any, b: any) => Number(b.sort ?? 0) - Number(a.sort ?? 0));

  const featured = entries.filter((e: any) => e.featured);
  const regular = entries.filter((e: any) => !e.featured);

  const openModal = (entry: any) => {
    setModalEntry(entry);
  };

  const ctaLink = content.cta
    ? `/contact?subject=${encodeURIComponent("Volunteering Opportunity")}`
    : "/contact";

  return (
    <PageShell crumbs={["Volunteering"]} title="Volunteering" site={site}>
      {/* A. Introduction */}
      {content.introduction?.heading ||
        content.introduction?.body ||
        (content.introduction?.image && (
          <section className="mt-6 space-y-6">
            <h2 className="text-5xl leading-tight text-foreground">
              {content.introduction?.heading || "Beyond Engineering"}
            </h2>
            {content.introduction?.body && (
              <p className="mt-2 font-serif text-lg text-foreground">{content.introduction.body}</p>
            )}
            {content.introduction?.image && (
              <figure className="mt-6">
                <Media items={[content.introduction.image]} ratio="16/9" />
              </figure>
            )}
          </section>
        ))}

      {/* B. Volunteering Experiences */}
      <section className="mt-12">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-5xl leading-tight text-foreground">Volunteering experiences</h2>
          {featured.length && (
            <Badge variant="secondary" className="text-[0.65rem]">
              {featured.length} featured
            </Badge>
          )}
        </div>

        {(featured.length || regular.length) && (
          <ul className="mt-8 space-y-12" data-testid="volunteering-journal">
            {featured.map((entry: any, i: number) => (
              <li
                key={entry.id}
                className="grid gap-8 md:grid-cols-[1fr_1.2fr] items-start border border-border rounded-lg p-6 hover:bg-muted/20 transition-colors"
                data-testid="volunteering-card"
              >
                <div className="space-y-4">
                  <Media items={[...(entry.media ?? [])].filter((m: any) => m.src)} ratio="16/9" />
                  {entry.media?.some((m: any) => m.caption || m.credit) && (
                    <p className="text-sm text-muted-foreground font-serif">
                      {entry.media
                        .map((m: any) => m.caption)
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[0.68rem] uppercase tracking-wider text-muted-foreground">
                      {entry.date}
                    </span>
                    {entry.location && (
                      <span className="text-[0.68rem] text-muted-foreground">{entry.location}</span>
                    )}
                    {entry.category && (
                      <Badge variant="outline" className="text-[0.65rem] px-2 py-0.5">
                        {entry.category}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[0.65rem]">
                      Featured
                    </Badge>
                  </div>
                  <h3 className="text-3xl text-foreground">{entry.title}</h3>
                  <p className="font-serif text-lg text-muted-foreground">{entry.organisation}</p>
                  {entry.shortDescription && (
                    <p className="mt-2 font-serif text-foreground">{entry.shortDescription}</p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openModal(entry)}
                    data-testid={`volunteering-readmore-${i}`}
                  >
                    Read more
                  </Button>
                </div>
              </li>
            ))}
            {regular.map((entry: any, i: number) => (
              <li
                key={entry.id}
                className={`
                  grid gap-8 md:grid-cols-[${i % 2 === 0 ? "1fr 1.2fr" : "1.2fr 1fr"}] items-start
                  border border-border rounded-lg p-6 hover:bg-muted/20 transition-colors
                `}
                data-testid="volunteering-card"
              >
                {i % 2 === 0 ? (
                  <>
                    <div className="space-y-4">
                      <Media
                        items={[...(entry.media ?? [])].filter((m: any) => m.src)}
                        ratio="16/9"
                      />
                      {entry.media?.some((m: any) => m.caption || m.credit) && (
                        <p className="text-sm text-muted-foreground font-serif">
                          {entry.media
                            .map((m: any) => m.caption)
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-[0.68rem] uppercase tracking-wider text-muted-foreground">
                          {entry.date}
                        </span>
                        {entry.location && (
                          <span className="text-[0.68rem] text-muted-foreground">
                            {entry.location}
                          </span>
                        )}
                        {entry.category && (
                          <Badge variant="outline" className="text-[0.65rem] px-2 py-0.5">
                            {entry.category}
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-3xl text-foreground">{entry.title}</h3>
                      <p className="font-serif text-lg text-muted-foreground">
                        {entry.organisation}
                      </p>
                      {entry.shortDescription && (
                        <p className="mt-2 font-serif text-foreground">{entry.shortDescription}</p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openModal(entry)}
                        data-testid={`volunteering-readmore-${i + featured.length}`}
                      >
                        Read more
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-[0.68rem] uppercase tracking-wider text-muted-foreground">
                          {entry.date}
                        </span>
                        {entry.location && (
                          <span className="text-[0.68rem] text-muted-foreground">
                            {entry.location}
                          </span>
                        )}
                        {entry.category && (
                          <Badge variant="outline" className="text-[0.65rem] px-2 py-0.5">
                            {entry.category}
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-3xl text-foreground">{entry.title}</h3>
                      <p className="font-serif text-lg text-muted-foreground">
                        {entry.organisation}
                      </p>
                      {entry.shortDescription && (
                        <p className="mt-2 font-serif text-foreground">{entry.shortDescription}</p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openModal(entry)}
                        data-testid={`volunteering-readmore-${i + featured.length}`}
                      >
                        Read more
                      </Button>
                    </div>
                    <div className="space-y-4">
                      <Media
                        items={[...(entry.media ?? [])].filter((m: any) => m.src)}
                        ratio="16/9"
                      />
                      {entry.media?.some((m: any) => m.caption || m.credit) && (
                        <p className="text-sm text-muted-foreground font-serif">
                          {entry.media
                            .map((m: any) => m.caption)
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {entries.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground text-center">
            No volunteering experiences shared yet.
          </p>
        )}
      </section>

      {/* Read more modal */}
      <Dialog open={modalEntry !== null} onOpenChange={(o) => !o && setModalEntry(null)}>
        <DialogContent className="max-w-3xl p-0">
          {modalEntry && (
            <>
              <DialogHeader>
                <DialogTitle>{modalEntry.title}</DialogTitle>
                <DialogDescription>
                  {modalEntry.organisation} · {modalEntry.date} · {modalEntry.location}
                </DialogDescription>
              </DialogHeader>
              {modalEntry.media?.length && (
                <figure className="my-6">
                  <Media items={modalEntry.media.filter((m: any) => m.src)} ratio="16/9" />
                </figure>
              )}
              <div className="p-6 space-y-4 font-serif text-foreground">
                {modalEntry.shortDescription && (
                  <p className="text-lg italic">{modalEntry.shortDescription}</p>
                )}
                {modalEntry.narrative && (
                  <>
                    <h3 className="text-xl label-caps text-muted-foreground mb-2">The story</h3>
                    <p className="whitespace-pre-line">{modalEntry.narrative}</p>
                  </>
                )}
                {modalEntry.contribution && (
                  <>
                    <h3 className="text-xl label-caps text-muted-foreground mb-2">
                      My contribution
                    </h3>
                    <p className="whitespace-pre-line">{modalEntry.contribution}</p>
                  </>
                )}
                {modalEntry.reflections && (
                  <>
                    <h3 className="text-xl label-caps text-muted-foreground mb-2">Reflections</h3>
                    <p className="whitespace-pre-line">{modalEntry.reflections}</p>
                  </>
                )}
                {modalEntry.takeaways?.length && (
                  <>
                    <h3 className="text-xl label-caps text-muted-foreground mb-2">
                      What I learned
                    </h3>
                    <ul className="list-disc pl-6 space-y-2">
                      {modalEntry.takeaways.map((t: string, i: number) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </>
                )}
                {modalEntry.links?.length && (
                  <>
                    <h3 className="text-xl label-caps text-muted-foreground mb-2">Links</h3>
                    <div className="flex flex-wrap gap-2 text-sm">
                      {modalEntry.links
                        .filter((l: any) => l.href)
                        .map((l: any, i: number) => (
                          <a
                            key={l.id ?? i}
                            href={l.href}
                            target="_blank"
                            rel="noreferrer"
                            className="text-link underline"
                          >
                            {l.label || l.href} ↗
                          </a>
                        ))}
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => setModalEntry(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* D. Why I volunteer */}
      {(content.whyVolunteering?.heading || content.whyVolunteering?.body) && (
        <section className="mt-16 space-y-4">
          <h2 className="text-5xl leading-tight text-foreground">
            {content.whyVolunteering.heading || "Why I volunteer"}
          </h2>
          {content.whyVolunteering.body && (
            <p className="font-serif text-lg text-foreground whitespace-pre-line">
              {content.whyVolunteering.body}
            </p>
          )}
        </section>
      )}

      {/* E. Looking ahead */}
      {(content.lookingAhead?.heading ||
        content.lookingAhead?.body ||
        content.interests?.length) && (
        <section className="mt-16 space-y-6">
          <h2 className="text-5xl leading-tight text-foreground">
            {content.lookingAhead.heading || "Looking ahead"}
          </h2>
          {content.lookingAhead?.body && (
            <p className="font-serif text-lg text-foreground whitespace-pre-line">
              {content.lookingAhead.body}
            </p>
          )}
          {content.interests?.length && (
            <div className="mt-6 flex flex-wrap gap-2">
              {content.interests.map((interest: string, i: number) => (
                <Badge key={i} variant="outline" className="text-xs px-3 py-1.5">
                  {interest}
                </Badge>
              ))}
            </div>
          )}
        </section>
      )}

      {/* F. CTA */}
      <section className="mt-16 border-t border-border pt-12 space-y-4">
        <h2 className="text-5xl leading-tight text-foreground">
          {content.cta?.heading || "Open to volunteering opportunities"}
        </h2>
        {content.cta?.body && (
          <p className="font-serif text-lg text-foreground whitespace-pre-line">
            {content.cta.body}
          </p>
        )}
        <Link to={ctaLink} className="inline-flex items-center gap-2">
          <Button>{content.cta?.buttonText || "Get in touch"}</Button>
        </Link>
      </section>
    </PageShell>
  );
}
