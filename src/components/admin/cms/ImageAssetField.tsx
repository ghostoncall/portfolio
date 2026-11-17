// Optional image control for the admin: upload (optimized to WebP thumb +
// full variants), preview, replace, remove, alt text — and, with
// `cropAspect`, a crop step so the thumbnail fits that frame exactly. Only
// the thumbnail is cropped; the full image stays whole, so the crop can be
// re-adjusted any time. Never required — an empty value is always valid.
import { useEffect, useId, useRef, useState } from "react";
import {
  uploadImageVariants,
  uploadThumbVariant,
  validateImageFile,
  type ImageAsset,
} from "@/lib/image-optimize";
import { ImageCropper, type CropRect } from "@/components/admin/cms/ImageCropper";

type CropJob =
  | { kind: "new"; file: File; url: string }
  | { kind: "adjust"; url: string; crop: CropRect | undefined };

export function ImageAssetField({
  label,
  hint,
  value,
  onChange,
  thumbEdge,
  fullEdge,
  cropAspect,
}: {
  label: string;
  hint?: string;
  value: ImageAsset | undefined;
  onChange: (next: ImageAsset | undefined) => void;
  thumbEdge?: number;
  fullEdge?: number;
  /** e.g. 4 / 3 — opens a crop step so the thumbnail fits this frame. */
  cropAspect?: number;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<CropJob | null>(null);

  // Free the local preview URL when a crop job ends.
  useEffect(() => {
    return () => {
      if (job?.kind === "new") URL.revokeObjectURL(job.url);
    };
  }, [job]);

  async function upload(file: File, thumbFile?: File, crop?: CropRect) {
    setError(null);
    setProgress(0);
    try {
      const asset = await uploadImageVariants(file, {
        thumbEdge,
        fullEdge,
        onProgress: setProgress,
        thumbFile,
      });
      onChange({ ...asset, alt: value?.alt ?? "", ...(crop ? { crop } : {}) });
    } catch (err) {
      // The previous image (if any) stays in place.
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  function choose(file: File | undefined) {
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      setError(problem);
      if (input.current) input.current.value = "";
      return;
    }
    if (cropAspect) setJob({ kind: "new", file, url: URL.createObjectURL(file) });
    else void upload(file);
  }

  async function applyCrop(cropped: File, crop: CropRect) {
    const current = job;
    setJob(null);
    if (!current) return;
    if (current.kind === "new") {
      await upload(current.file, cropped, crop);
      return;
    }
    if (!value) return;
    setError(null);
    setProgress(0);
    try {
      const thumb = await uploadThumbVariant(cropped, thumbEdge, setProgress);
      onChange({ ...value, ...thumb, crop });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the new crop.");
    } finally {
      setProgress(null);
    }
  }

  const busy = progress !== null;
  const preview = value?.thumb || value?.src;

  return (
    <div className="space-y-2">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label} <span className="normal-case tracking-normal">(optional)</span>
      </span>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}

      {preview ? (
        <div className="flex items-start gap-3">
          <img
            src={preview}
            alt={value?.alt ?? ""}
            width={value?.thumbWidth ?? 96}
            height={value?.thumbHeight ?? 72}
            className="aspect-[4/3] w-28 shrink-0 border border-border bg-muted object-cover"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <input
              value={value?.alt ?? ""}
              onChange={(e) => value && onChange({ ...value, alt: e.target.value })}
              placeholder="Alt text (describe the image)"
              aria-label={`${label} alt text`}
              className="w-full border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
            <div className="flex flex-wrap gap-3 text-sm">
              {cropAspect && value?.src && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setJob({ kind: "adjust", url: value.src, crop: value.crop })}
                  className="text-link underline-offset-4 hover:underline disabled:opacity-50"
                >
                  Adjust crop
                </button>
              )}
              <label
                htmlFor={id}
                className="cursor-pointer text-link underline-offset-4 hover:underline"
              >
                Replace
              </label>
              <button
                type="button"
                onClick={() => onChange(undefined)}
                className="text-destructive underline-offset-4 hover:underline"
              >
                Remove
              </button>
              {value?.width && (
                <span className="text-xs text-muted-foreground">
                  {value.width}×{value.height} WebP
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <label
          htmlFor={id}
          className={`flex min-h-[44px] cursor-pointer items-center justify-center border border-dashed border-border px-3 py-3 text-sm text-muted-foreground hover:border-foreground hover:text-foreground ${
            busy ? "pointer-events-none opacity-60" : ""
          }`}
        >
          Upload image
        </label>
      )}

      <input
        ref={input}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        disabled={busy}
        onChange={(e) => choose(e.target.files?.[0])}
      />
      {busy && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Optimizing and uploading… {progress}%
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {job && cropAspect && (
        <ImageCropper
          src={job.url}
          aspect={cropAspect}
          initialCrop={job.kind === "adjust" ? job.crop : undefined}
          title={`Crop ${label.toLowerCase()} (${cropAspect === 4 / 3 ? "4:3" : "fixed ratio"})`}
          onCancel={() => {
            setJob(null);
            if (input.current) input.current.value = "";
          }}
          onConfirm={applyCrop}
        />
      )}
    </div>
  );
}
