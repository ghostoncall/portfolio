/* eslint-disable @typescript-eslint/no-explicit-any */
// Public Résumé / CV section — placed after Volunteering in the nav.
//
// Renders the *published* résumé managed in /onlyme/resume. The preview and the
// download button both point at the same-origin /cv/* routes, which always
// serve the current published file (see server/routes/cv/[action].ts).
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Download } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { siteFromRoot } from "@/lib/root-data";
import { pageCopy, pageMeta } from "@/lib/site-copy";
import { getPublishedResume } from "@/lib/server-fns";
import { resumeFileUrl, type PublicResume } from "@/lib/resume";
import { formatBytes } from "@/lib/media-config";

// The viewer (and PDF.js behind it) is split out of the route chunk.
const PdfViewer = lazy(() =>
  import("@/components/public/PdfViewer").then((m) => ({ default: m.PdfViewer })),
);

export const Route = createFileRoute("/resume")({
  loader: async ({ parentMatchPromise }) => {
    const [site, resumeSettings] = await Promise.all([
      siteFromRoot(parentMatchPromise, "resume"),
      getPublishedResume(),
    ]);
    if (!resumeSettings.visible) throw notFound();
    return { site, resume: resumeSettings.current };
  },
  head: ({ loaderData }) => ({ meta: pageMeta(loaderData?.site as any, "resume") }),
  component: ResumePage,
});

function ResumePage() {
  const { site, resume } = Route.useLoaderData() as { site: any; resume: PublicResume | null };
  const title = `Résumé of ${site?.name ?? "the site owner"}`;

  return (
    <PageShell
      crumbs={[pageCopy(site, "resume").navLabel]}
      title={pageCopy(site, "resume").title}
      site={site}
    >
      {!resume ? (
        <p className="prose-editorial text-muted-foreground">
          The résumé hasn’t been published yet. In the meantime, you can{" "}
          <Link to="/contact" className="text-link underline underline-offset-4">
            get in touch
          </Link>
          .
        </p>
      ) : (
        <section aria-labelledby="resume-heading" className="space-y-5">
          <h2 id="resume-heading" className="sr-only">
            Résumé document
          </h2>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Updated{" "}
              {new Date(resume.uploadedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              · PDF, {formatBytes(resume.size)}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={resumeFileUrl(resume, "view")}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-link underline-offset-4 hover:underline"
              >
                Open in new tab ↗
              </a>
              <a
                href={resumeFileUrl(resume, "download")}
                download={resume.fileName}
                className="group inline-flex min-h-[44px] items-center gap-2 bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Download
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-y-0.5 motion-reduce:transition-none"
                />
                Download Résumé
              </a>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[52rem]">
            <Suspense
              fallback={
                <div className="aspect-[1/1.414] w-full border border-border bg-muted/40" />
              }
            >
              <PdfViewer src={resumeFileUrl(resume, "view")} title={title} />
            </Suspense>
          </div>
        </section>
      )}
    </PageShell>
  );
}
