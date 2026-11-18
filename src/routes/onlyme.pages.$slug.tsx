/* eslint-disable @typescript-eslint/no-explicit-any */
// Staged-blocks page editor. Only pages whose kind is "blocks" are editable
// here: skills / certificates / experience pages are managed by their
// dedicated admin routes, so they show a pointer instead of a legacy editor.

import React from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { BlockEditor } from "@/components/admin/BlockEditor";
import { Blocks } from "@/components/blocks";
import { normalizePageContent } from "@/lib/cms-normalize";
import type { PageContent } from "@/db/schema";
import { useCmsDraft } from "@/components/admin/cms/useCmsDraft";
import { useUnsavedChanges } from "@/components/admin/cms/useUnsavedChanges";
import { SaveBar } from "@/components/admin/cms/SaveBar";
import { PreviewPane } from "@/components/admin/cms/PreviewPane";
import { EmptyState } from "@/components/admin/cms/EmptyState";
import { ensureContentPage, getSiteIdentity, getPublishedProjects } from "@/lib/server-fns";
import { missingOverviewAdditions } from "@/lib/merge-additions";
import type { Block } from "@/content/site";
import { OverviewView } from "@/components/public/OverviewView";
import { editableOverview, overviewProjects, withOverviewAdditions } from "@/lib/featured-projects";
import { FeaturedProjectsEditor } from "@/components/admin/FeaturedProjectsEditor";

export const Route = createFileRoute("/onlyme/pages/$slug")({
  component: PageEditor,
});

type BlocksPage = Extract<PageContent, { kind: "blocks" }>;

function PageEditor() {
  const slug = Route.useParams().slug;
  const router = useRouter();
  const draft = useCmsDraft<PageContent>({
    table: "pages",
    slug,
    normalize: (raw) => {
      const normalized = normalizePageContent((raw as any)?.kind, raw) as PageContent;
      return slug === "overview" && normalized.kind === "blocks"
        ? editableOverview(normalized)
        : normalized;
    },
    allowMissing: true,
  });
  useUnsavedChanges(draft.dirty);
  const overviewContext = useOverviewContext(slug === "overview");

  if (draft.loading) return <div className="text-sm text-muted-foreground">Loading draft…</div>;
  // No database row yet (e.g. the Overview, which used to render only from
  // built-in content): create it from what's live, then edit as normal.
  // A failed load is not a missing page — don't offer to create it.
  if (!draft.data && draft.error) {
    return (
      <div
        role="alert"
        className="space-y-3 border border-destructive/40 bg-destructive/10 p-5 text-sm"
      >
        <p className="font-semibold text-destructive">This page couldn't be loaded.</p>
        <p className="text-foreground">Nothing was changed. Check the connection and try again.</p>
        <button
          type="button"
          onClick={() => void draft.reload()}
          className="min-h-[44px] border border-foreground/40 bg-background px-4 font-semibold hover:bg-muted"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!draft.data) return <CreateMissingPage slug={slug} onCreated={() => draft.reload()} />;

  // Kind routing: these kinds live under their own admin sections now.
  const managedElsewhere: Record<string, { label: string; to: string }> = {
    skills: { label: "Skills admin", to: "/onlyme/skills" },
    certificates: { label: "Certificates admin", to: "/onlyme/certificates" },
    experience: { label: "Experience admin", to: "/onlyme/experience" },
  };
  const elsewhere = managedElsewhere[draft.doc.kind ?? ""];
  if (elsewhere) {
    return (
      <div className="space-y-6">
        <Link to="/onlyme/pages" className="text-sm text-muted-foreground hover:underline">
          ← Pages
        </Link>
        <EmptyState
          title={`"${slug}" is managed in the ${elsewhere.label}`}
          description="This page kind has its own dedicated editor with richer controls."
          action={
            <Link
              to={elsewhere.to}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm rounded-md hover:opacity-90"
            >
              Open {elsewhere.label} →
            </Link>
          }
        />
      </div>
    );
  }

  if (draft.doc.kind !== "blocks") {
    return (
      <div className="space-y-6">
        <Link to="/onlyme/pages" className="text-sm text-muted-foreground hover:underline">
          ← Pages
        </Link>
        <EmptyState
          title="Unsupported page kind"
          description={`This page has kind "${draft.doc.kind ?? "unknown"}", which has no editor.`}
        />
      </div>
    );
  }

  const blocksPage = draft.doc as BlocksPage;
  const updateBlocks = (blocks: Block[]) =>
    draft.patch(
      (doc) =>
        ({
          ...doc,
          kind: "blocks",
          blocks,
          ...(slug === "overview" ? { featuredWorkManaged: true } : {}),
        }) as BlocksPage,
    );

  const editor = (
    <BlockEditor
      blocks={blocksPage.blocks}
      onChange={updateBlocks}
      reorderable={slug === "overview"}
      {...(slug === "overview"
        ? {
            renderFeaturedProjects: (
              block: Extract<Block, { type: "featured-projects" }>,
              index: number,
            ) => (
              <FeaturedProjectsEditor
                block={block}
                context={overviewContext.context}
                error={overviewContext.error}
                onRetry={overviewContext.reload}
                onChange={(next) =>
                  updateBlocks(blocksPage.blocks.map((entry, i) => (i === index ? next : entry)))
                }
                onRemove={() => updateBlocks(blocksPage.blocks.filter((_, i) => i !== index))}
              />
            ),
          }
        : {})}
    />
  );

  const preview = (
    <div className="max-w-3xl mx-auto py-6">
      {slug === "overview" ? (
        <OverviewPreview
          page={blocksPage}
          context={overviewContext.context}
          error={overviewContext.error}
        />
      ) : (
        <Blocks blocks={blocksPage.blocks} />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link to="/onlyme/pages" className="text-sm text-muted-foreground hover:underline">
            ← Pages
          </Link>
          <h2 className="text-lg font-medium text-foreground">{slug}</h2>
        </div>
        <span className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground">
          Kind: {draft.doc.kind}
        </span>
      </div>

      <SaveBar
        dirty={draft.dirty}
        loading={draft.loading}
        saving={draft.saving}
        hasPublished={draft.data.isPublic}
        lastSaved={draft.lastSaved}
        error={draft.error}
        onSave={() => draft.save()}
        onPublish={async () => {
          if (await draft.publish())
            await router.invalidate({ filter: (match) => match.routeId === "/" });
        }}
        onRevert={() =>
          window.confirm("Discard staged changes and restore the published version?") &&
          draft.revert()
        }
      />

      {draft.notice && (
        <p role="status" aria-label="Page save status" className="text-sm text-muted-foreground">
          {draft.notice.text}
        </p>
      )}

      {slug === "overview" && (
        <section className="space-y-2 border border-border p-4 text-sm">
          <p>
            Edit and reorder the introduction, focus areas, media and Featured Work below. Preview
            uses the same content renderer as the homepage. Publish updates makes this draft live.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <a href="/" target="_blank" rel="noreferrer" className="text-link underline">
              View live Overview
            </a>
            <Link to="/onlyme/settings" className="text-link underline">
              Edit page heading and photo
            </Link>
            <Link to="/onlyme/projects" className="text-link underline">
              Edit project content
            </Link>
          </div>
        </section>
      )}

      {slug === "overview" && !(blocksPage as { additionsApplied?: boolean }).additionsApplied && (
        <OverviewAdditionsSync
          blocks={blocksPage.blocks}
          onApply={(blocks) =>
            draft.patch(
              (doc) => ({ ...doc, kind: "blocks", blocks, additionsApplied: true }) as BlocksPage,
            )
          }
        />
      )}

      <PreviewPane
        mode="editor"
        onModeChange={() => {}}
        renderEditor={() => editor}
        renderPreview={() => preview}
      />
    </div>
  );
}

type OverviewContext = {
  site: Awaited<ReturnType<typeof getSiteIdentity>>;
  projects: Awaited<ReturnType<typeof getPublishedProjects>>;
};

function useOverviewContext(enabled: boolean) {
  const [context, setContext] = React.useState<OverviewContext | null>(null);
  const [error, setError] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  React.useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    setError(false);
    Promise.all([getSiteIdentity(), getPublishedProjects()])
      .then(([site, projects]) => {
        if (!disposed) setContext({ site, projects });
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
    };
  }, [enabled, revision]);
  return { context, error, reload: () => setRevision((value) => value + 1) };
}

function OverviewPreview({
  page,
  context,
  error,
}: {
  page: BlocksPage;
  context: OverviewContext | null;
  error: boolean;
}) {
  const blocks = page.blocks;
  if (!context)
    return (
      <>
        <Blocks blocks={blocks} />
        <p role="status" className="mt-6 text-xs text-muted-foreground">
          {error
            ? "Featured projects could not be loaded. Your edited page content is shown above."
            : "Loading the homepage's featured projects…"}
        </p>
      </>
    );
  return (
    <OverviewView
      blocks={blocks}
      featured={overviewProjects(context.projects, context.site)}
      projects={context.projects}
      site={context.site}
      featuredWorkManaged={page.featuredWorkManaged === true}
    />
  );
}

/**
 * The live Overview also shows a paragraph from src/content/additions.ts that
 * was appended on every page load — invisible here, so impossible to edit.
 * Fold it into this draft once (marked unsaved), after which the page is
 * exactly what you save and publish.
 */
function OverviewAdditionsSync({
  blocks,
  onApply,
}: {
  blocks: Block[];
  onApply: (blocks: Block[]) => void;
}) {
  const applied = React.useRef(false);
  React.useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    onApply(withOverviewAdditions(blocks, missingOverviewAdditions(blocks)));
  }, [blocks, onApply]);
  return (
    <p className="border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      Everything the live Overview shows is now in this editor, including text that used to be added
      automatically. Save and publish to make this version the one you control.
    </p>
  );
}

function CreateMissingPage({ slug, onCreated }: { slug: string; onCreated: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const title = slug === "overview" ? "Overview" : slug;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await (ensureContentPage as any)({ data: { slug, title, kind: "blocks" } });
      onCreated();
    } catch (err: any) {
      setError(err?.message ?? "Could not create the page.");
    } finally {
      setBusy(false);
    }
  }

  // The Overview should simply open; other missing pages ask first.
  const auto = slug === "overview";
  React.useEffect(() => {
    if (auto) void create();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <div className="space-y-4">
      <Link to="/onlyme/pages" className="text-sm text-muted-foreground hover:underline">
        ← Pages
      </Link>
      <EmptyState
        title={auto ? "Setting up the Overview editor…" : `"${slug}" doesn't exist yet`}
        description={
          auto
            ? "Copying what the live Overview shows into an editable page."
            : "Create it to start editing. It stays hidden until you publish."
        }
        action={
          auto ? undefined : (
            <button
              type="button"
              onClick={() => void create()}
              disabled={busy}
              className="bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create page"}
            </button>
          )
        }
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
