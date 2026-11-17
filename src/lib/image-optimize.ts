// Browser-side image optimization for admin uploads.
//
// The app has no server-side image library (uploads go straight from the
// browser to Supabase Storage), so images are resized and re-encoded here,
// before upload: decode → scale down to a max edge → encode as WebP. The
// server still validates type and size (createMediaUpload).
//
// GIFs (animation) and SVGs (vector) are passed through untouched, as is any
// format the browser can't decode (e.g. HEIC on most desktops).
import { uploadFileToLibrary } from "@/lib/media-upload";
import type { ImageAsset } from "@/content/site";

export type { ImageAsset };

export const IMAGE_INPUT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const IMAGE_MAX_INPUT_BYTES = 25 * 1024 * 1024;

export type OptimizedImage = { file: File; width: number; height: number };

function canOptimize(file: File): boolean {
  return IMAGE_INPUT_TYPES.includes(file.type);
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, {
        imageOrientation: "from-image",
      } as ImageBitmapOptions);
    } catch {
      // fall through to <img> decoding
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sizeOf(src: ImageBitmap | HTMLImageElement) {
  return "naturalWidth" in src
    ? { w: src.naturalWidth, h: src.naturalHeight }
    : { w: src.width, h: src.height };
}

/** Resize so the longest edge is ≤ maxEdge, then encode as WebP. */
export async function optimizeImage(
  file: File,
  {
    maxEdge = 1600,
    quality = 0.82,
    suffix = "",
  }: { maxEdge?: number; quality?: number; suffix?: string } = {},
): Promise<OptimizedImage> {
  if (!canOptimize(file)) {
    return { file, width: 0, height: 0 };
  }
  const source = await decode(file);
  const { w, h } = sizeOf(source);
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { file, width: w, height: h };
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
  if ("close" in source) source.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  // Browsers without WebP encoding return PNG/null — keep the original then.
  if (!blob || blob.type !== "image/webp" || (blob.size >= file.size && scale === 1)) {
    return { file, width: w, height: h };
  }
  const base = file.name.replace(/\.[a-z0-9]+$/i, "") || "image";
  return {
    file: new File([blob], `${base}${suffix}.webp`, { type: "image/webp" }),
    width,
    height,
  };
}

/** Re-crop: upload only a new thumbnail variant (the full image is unchanged). */
export async function uploadThumbVariant(
  cropped: File,
  thumbEdge = 480,
  onProgress?: (p: number) => void,
): Promise<Pick<ImageAsset, "thumb" | "thumbWidth" | "thumbHeight">> {
  const thumb = await optimizeImage(cropped, { maxEdge: thumbEdge, quality: 0.8, suffix: "-thumb" });
  const row = await uploadFileToLibrary(thumb.file, onProgress ? { onProgress } : {});
  return {
    thumb: row.url,
    thumbWidth: thumb.width || undefined,
    thumbHeight: thumb.height || undefined,
  };
}

export function validateImageFile(file: File): string | null {
  if (!IMAGE_INPUT_TYPES.includes(file.type)) {
    return "Please choose a JPEG, PNG, WebP or AVIF image.";
  }
  if (file.size > IMAGE_MAX_INPUT_BYTES) {
    return `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 25 MB.`;
  }
  return null;
}

/**
 * Optimize and upload two variants: `thumbEdge` for listings and `fullEdge`
 * for expanded viewing. Both are WebP with real pixel dimensions recorded so
 * pages can reserve space (no layout shift).
 */
export async function uploadImageVariants(
  file: File,
  {
    thumbEdge = 480,
    fullEdge = 1800,
    onProgress,
    thumbFile,
  }: {
    thumbEdge?: number | undefined;
    fullEdge?: number | undefined;
    onProgress?: ((p: number) => void) | undefined;
    /** A pre-cropped image to use for the thumbnail (the full image stays whole). */
    thumbFile?: File | undefined;
  } = {},
): Promise<ImageAsset> {
  const error = validateImageFile(file);
  if (error) throw new Error(error);
  const [full, thumb] = await Promise.all([
    optimizeImage(file, { maxEdge: fullEdge, quality: 0.84 }),
    optimizeImage(thumbFile ?? file, { maxEdge: thumbEdge, quality: 0.8, suffix: "-thumb" }),
  ]);
  const fullRow = await uploadFileToLibrary(full.file, {
    onProgress: (p) => onProgress?.(Math.round(p * 0.8)),
  });
  const thumbRow = await uploadFileToLibrary(thumb.file, {
    onProgress: (p) => onProgress?.(80 + Math.round(p * 0.2)),
  });
  return {
    src: fullRow.url,
    width: full.width || undefined,
    height: full.height || undefined,
    thumb: thumbRow.url,
    thumbWidth: thumb.width || undefined,
    thumbHeight: thumb.height || undefined,
  };
}
