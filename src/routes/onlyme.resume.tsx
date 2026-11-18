/* eslint-disable @typescript-eslint/no-explicit-any */
// Admin: manage the Résumé / CV document shown at /resume.
//
// Flow (same staged → published model as the rest of the CMS):
//   1. Choose a PDF → validated in the browser (type, size), then
//      createResumeUpload validates again and returns a signed Storage URL.
//   2. The browser uploads straight to Storage, with progress.
//   3. stageResume checks the stored bytes server-side (PDF signature, size)
//      and makes it the draft. If anything fails, the new file is discarded
//      and the current résumé is untouched.
//   4. "Publish" makes the draft the public résumé; the public page and the
//      Download button switch to it immediately (CDN copies within a minute).
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createResumeUpload,
  discardResumeDraft,
  getResumeAdmin,
  publishResume,
  removeResume,
  stageResume,
  setResumeVisibility,
} from "@/lib/server-fns";
import { putWithProgress } from "@/lib/media-upload";
import { RESUME_MAX_BYTES, RESUME_MIME, type ResumeDoc } from "@/lib/resume";
import { formatBytes } from "@/lib/media-config";
import { ConfirmDialog } from "@/components/admin/cms/ConfirmDialog";
import { VisibilityToggle } from "@/components/admin/cms/VisibilityToggle";

const PdfViewer = lazy(() =>
  import("@/components/public/PdfViewer").then((m) => ({ default: m.PdfViewer })),
);

export const Route = createFileRoute("/onlyme/resume")({
  component: ResumeAdmin,
});

type AdminState = {
  visible: boolean;
  staged: ResumeDoc | null;
  published: ResumeDoc | null;
  stagedUrl: string | null;
  publishedUrl: string | null;
};

function errorMessage(err: any, fallback: string): string {
  return typeof err?.message === "string" && err.message ? err.message : fallback;
}

function ResumeAdmin() {
  const router = useRouter();
  const [state, setState] = useState<AdminState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setState((await (getResumeAdmin as any)()) as AdminState);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, "Could not load the résumé settings."));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    // Fast client-side checks; the server repeats them and inspects the bytes.
    if (file.type !== RESUME_MIME || !/\.pdf$/i.test(file.name)) {
      setUploadError("Please choose a PDF file (.pdf).");
      return;
    }
    if (file.size > RESUME_MAX_BYTES) {
      setUploadError(
        `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(RESUME_MAX_BYTES)}.`,
      );
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const { storagePath, signedUrl } = await (createResumeUpload as any)({
        data: { name: file.name, type: file.type, size: file.size },
      });
      await putWithProgress(signedUrl, file, setProgress);
      await (stageResume as any)({ data: { storagePath, fileName: file.name } });
      toast.success("Uploaded. Review the preview, then publish.");
      await refresh();
    } catch (err) {
      // The current résumé is untouched: stageResume only replaces the draft
      // after the new file has been verified.
      setUploadError(errorMessage(err, "Upload failed. The current résumé was not changed."));
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function run(action: () => Promise<unknown>, success: string, failure: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await refresh();
      await router.invalidate();
    } catch (err) {
      toast.error(errorMessage(err, failure));
    } finally {
      setBusy(false);
    }
  }

  const staged = state?.staged ?? null;
  const published = state?.published ?? null;
  const hasDraft = !!staged && staged.storagePath !== published?.storagePath;
  const previewUrl = state?.stagedUrl ?? state?.publishedUrl ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/onlyme" className="text-sm text-muted-foreground hover:underline">
          ← Back
        </Link>
        <h2 className="text-lg font-medium text-foreground">Résumé / CV</h2>
      </div>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      <section className="space-y-4 border border-border p-6">
        <div className="space-y-1 border-b border-border pb-4">
          <VisibilityToggle
            label="Show Résumé / CV on the site"
            visible={state?.visible ?? true}
            disabled={!state || busy || !!loadError}
            description="Saves immediately. Uncheck to hide the section and downloads while keeping your PDF."
            onChange={(visible) => {
              const previous = state?.visible ?? true;
              setState((before) => (before ? { ...before, visible } : before));
              void run(
                async () => {
                  try {
                    await (setResumeVisibility as any)({ data: { visible } });
                  } catch (error) {
                    setState((before) => (before ? { ...before, visible: previous } : before));
                    throw error;
                  }
                },
                visible
                  ? "Résumé / CV is visible on the site."
                  : "Résumé / CV is hidden from the site.",
                "Could not save visibility. Please try again.",
              );
            }}
          />
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">Published PDF</dt>
          <dd className="text-foreground">
            {published ? (
              <>
                {published.fileName} · {formatBytes(published.size)} · uploaded{" "}
                {new Date(published.uploadedAt).toLocaleString()}{" "}
                {state?.visible && (
                  <a
                    href="/resume"
                    target="_blank"
                    rel="noreferrer"
                    className="text-link hover:underline"
                  >
                    View page ↗
                  </a>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">Nothing published yet</span>
            )}
          </dd>
          <dt className="text-muted-foreground">Draft</dt>
          <dd className="text-foreground">
            {hasDraft ? (
              <>
                {staged!.fileName} · {formatBytes(staged!.size)} ·{" "}
                <span className="font-semibold">not published</span>
              </>
            ) : (
              <span className="text-muted-foreground">No unpublished changes</span>
            )}
          </dd>
        </dl>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            id="resume-file"
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={busy}
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <label
            htmlFor="resume-file"
            className={`inline-flex min-h-[44px] cursor-pointer items-center border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent ${
              busy ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {published || staged ? "Upload replacement PDF" : "Upload PDF"}
          </label>
          {hasDraft && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => (publishResume as any)({ data: {} }),
                    "Published — the site now shows this résumé.",
                    "Publishing failed.",
                  )
                }
                className="min-h-[44px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Publish
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => (discardResumeDraft as any)({ data: {} }),
                    "Draft discarded.",
                    "Could not discard the draft.",
                  )
                }
                className="min-h-[44px] px-3 py-2 text-sm text-muted-foreground underline hover:text-foreground disabled:opacity-50"
              >
                Discard draft
              </button>
            </>
          )}
          {(published || staged) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmRemove(true)}
              className="min-h-[44px] px-3 py-2 text-sm text-destructive underline hover:bg-destructive/10 disabled:opacity-50"
            >
              Remove résumé
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          PDF only, up to {formatBytes(RESUME_MAX_BYTES)}. Visitors download it under its original
          file name.
        </p>

        {progress !== null && (
          <div className="space-y-1" aria-live="polite">
            <div
              className="h-1 w-full bg-muted"
              role="progressbar"
              aria-label="Upload progress"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-1 bg-foreground transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {progress < 100 ? `Uploading… ${progress}%` : "Verifying the file…"}
            </p>
          </div>
        )}
        {uploadError && (
          <p role="alert" className="text-sm text-destructive">
            {uploadError}
          </p>
        )}
      </section>

      {previewUrl && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">
            Preview {hasDraft ? "(draft)" : "(live)"}
          </h3>
          <div className="mx-auto max-w-[52rem]">
            <Suspense fallback={<div className="aspect-[1/1.414] border border-border" />}>
              <PdfViewer key={previewUrl} src={previewUrl} title="Résumé preview" />
            </Suspense>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirmRemove}
        title="Remove the résumé?"
        description="The Résumé / CV page will show no document, and the stored file(s) are deleted. You can upload a new one at any time."
        confirmLabel="Remove"
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false);
          void run(
            () => (removeResume as any)({ data: {} }),
            "Résumé removed.",
            "Could not remove the résumé.",
          );
        }}
      />
    </div>
  );
}
