/* eslint-disable @typescript-eslint/no-explicit-any */
// Staged-blocks page editor. Only pages whose kind is "blocks" are editable
// here: skills / certificates / experience pages are managed by their
// dedicated admin routes, so they show a pointer instead of a legacy editor.

import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BlockEditor } from "@/components/admin/BlockEditor";
import { Blocks } from "@/components/blocks";
import { normalizePageContent } from "@/lib/cms-normalize";
import type { PageContent } from "@/db/schema";
import { useCmsDraft } from "@/components/admin/cms/useCmsDraft";
import { useUnsavedChanges } from "@/components/admin/cms/useUnsavedChanges";
import { SaveBar } from "@/components/admin/cms/SaveBar";
import { PreviewPane } from "@/components/admin/cms/PreviewPane";
import { EmptyState } from "@/components/admin/cms/EmptyState";
import { ensureContentPage } from "@/lib/server-fns";
import { missingOverviewAdditions } from "@/lib/merge-additions";
import type { Block } from "@/content/site";

export const Route = createFileRoute("/onlyme/pages/$slug")({
  component: PageEditor,
});

type BlocksPage = Extract<PageContent, { kind: "blocks" }>;

function PageEditor() {
  const slug = Route.useParams().slug;
  const draft = useCmsDraft<PageContent>({
    table: "pages",
    slug,
    normalize: (raw) => normalizePageContent((raw as any)?.kind, raw),
    allowMissing: true,
  });
  const { confirmLeave } = useUnsavedChanges(draft.dirty);

  if (draft.loading) return <div className="text-sm text-muted-foreground">Loading draft…</div>;
  // No database row yet (e.g. the Overview, which used to render only from
  // built-in content): create it from what's live, then edit as normal.
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

  const editor = (
    <BlockEditor
      blocks={blocksPage.blocks}
      onChange={(blocks) =>
        draft.patch((doc) => ({ ...doc, kind: "blocks", blocks }) as BlocksPage)
      }
    />
  );

  const preview = (
    <div className="max-w-3xl mx-auto py-6">
      <Blocks blocks={blocksPage.blocks} />
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
        onPublish={() => draft.publish()}
        onRevert={() =>
          window.confirm("Discard staged changes and restore the published version?") &&
          draft.revert()
        }
      />

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
    onApply([...blocks, ...missingOverviewAdditions(blocks)]);
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
