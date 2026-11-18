/* eslint-disable @typescript-eslint/no-explicit-any */
// Reusable media picker used by the post editor (cover, social image) and the
// media library. Lists library assets, searches by filename, uploads new files
// through the same signed-URL path the editor uses.
import { useEffect, useMemo, useRef, useState } from "react";
import { X, Search, Upload, ImageIcon } from "lucide-react";
import { listMedia } from "@/lib/server-fns";
import { uploadFileToLibrary } from "@/lib/media-upload";
import { formatBytes, MEDIA_MAX_BYTES } from "@/lib/media-config";
import type { MediaAssetRow } from "@/db/schema";
import {
  resolveMediaAspectRatio,
  type MediaFit,
  type MediaItem,
  type MediaPosition,
} from "@/components/media";

const field =
  "w-full border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring";

function isImage(asset: MediaAssetRow) {
  return asset.type?.startsWith("image/");
}

export function MediaThumb({
  asset,
  className = "",
}: {
  asset: MediaAssetRow;
  className?: string;
}) {
  if (isImage(asset)) {
    return (
      <img
        src={asset.url}
        alt={asset.alt ?? asset.name}
        className={`h-full w-full object-cover ${className}`}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-muted text-muted-foreground ${className}`}
    >
      <span className="label-caps px-2 text-center text-[10px]">
        {asset.type?.split("/")[1] ?? "file"}
      </span>
    </div>
  );
}

export function MediaPicker({
  open,
  onClose,
  onSelect,
  accept = "any",
  title = "Choose media",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAssetRow) => void;
  accept?: "image" | "any";
  title?: string;
}) {
  const [assets, setAssets] = useState<MediaAssetRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await (listMedia as any)();
      setAssets(rows as MediaAssetRow[]);
    } catch (e: any) {
      setError(e?.message ?? "Could not load media.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void load();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return assets
      .filter((a) => (accept === "image" ? isImage(a) : true))
      .filter((a) => !term || a.name.toLowerCase().includes(term))
      .slice()
      .reverse();
  }, [assets, search, accept]);

  async function handleUpload(file: File) {
    setUploading(true);
    setProgress(0);
    setError(null);
    try {
      const uploadFile = file.type.startsWith("image/")
        ? await (
            await import("@/lib/image-optimize")
          ).optimizeImage(file, {
            maxEdge: 2000,
            quality: 0.84,
          })
        : null;
      const asset = await uploadFileToLibrary(uploadFile?.file ?? file, {
        onProgress: setProgress,
      });
      setAssets((prev) => [...prev, asset]);
      onSelect(asset);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      data-testid="media-picker"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-medium text-foreground">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close media picker"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
          <label className="relative flex-1 min-w-[12rem]">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by filename…"
              className={`${field} pl-8`}
            />
          </label>
          <input
            ref={inputRef}
            type="file"
            accept={accept === "image" ? "image/*" : undefined}
            className="hidden"
            data-testid="media-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            data-testid="media-upload-trigger"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? `Uploading ${progress}%` : "Upload"}
          </button>
          <span className="text-xs text-muted-foreground">Max {formatBytes(MEDIA_MAX_BYTES)}</span>
        </div>

        {error && (
          <p
            data-testid="media-error"
            className="border-b border-border px-5 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {uploading && (
          <div className="h-1 w-full bg-muted">
            <div className="h-1 bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <ImageIcon className="h-8 w-8" />
              <p className="text-sm">No media{search ? " matches that search" : " yet"}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {visible.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    onSelect(asset);
                    onClose();
                  }}
                  className="group overflow-hidden border border-border text-left hover:border-foreground"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-muted">
                    <MediaThumb asset={asset} />
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs text-foreground">{asset.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatBytes(asset.size)}
                      {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Text fields representing a MediaItem (src / alt / caption) + picker. */
export function MediaItemFields({
  label,
  value,
  onChange,
  accept = "image",
  previewRatio = "16/9",
  previewFit = "cover",
  previewPosition = "center",
}: {
  label: string;
  value: MediaItem | undefined;
  onChange: (value: MediaItem) => void;
  accept?: "image" | "any";
  previewRatio?: string;
  previewFit?: MediaFit;
  previewPosition?: MediaPosition;
}) {
  const [open, setOpen] = useState(false);
  const item = value ?? {};
  const previewAspectRatio = resolveMediaAspectRatio(item, previewRatio);
  const naturalWithoutMetadata = previewRatio === "natural" && !previewAspectRatio;
  return (
    <div
      className="space-y-2 border border-border p-3"
      data-testid="media-item-fields"
      data-label={label}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <button
          type="button"
          data-testid="media-pick"
          onClick={() => setOpen(true)}
          className="text-xs text-link hover:underline"
        >
          {item.src ? "Replace / view" : "Choose from library"}
        </button>
      </div>
      {item.src && (
        <div
          className="w-full overflow-hidden bg-muted"
          style={previewAspectRatio ? { aspectRatio: previewAspectRatio } : undefined}
        >
          <img
            src={item.src}
            alt={item.alt ?? ""}
            width={item.width}
            height={item.height}
            data-testid="media-preview"
            className={
              naturalWithoutMetadata
                ? "block h-auto w-full"
                : `h-full w-full ${previewFit === "cover" ? "object-cover" : "object-contain"}`
            }
            style={{ objectPosition: previewPosition }}
          />
        </div>
      )}
      <input
        value={item.src ?? ""}
        onChange={(e) => {
          const next = { ...item, src: e.target.value };
          if (e.target.value !== item.src) {
            delete next.width;
            delete next.height;
          }
          onChange(next);
        }}
        placeholder="Image URL"
        aria-label={`${label} URL`}
        className={field}
      />
      <input
        value={item.alt ?? ""}
        onChange={(e) => onChange({ ...item, alt: e.target.value })}
        placeholder="Alt text (describe the image)"
        aria-label={`${label} alt text`}
        className={field}
      />
      <input
        value={item.caption ?? ""}
        onChange={(e) => onChange({ ...item, caption: e.target.value })}
        placeholder="Caption"
        aria-label={`${label} caption`}
        className={field}
      />
      {item.src && (
        <button
          type="button"
          data-testid="media-remove"
          onClick={() => {
            const next = { ...item, src: "" };
            delete next.width;
            delete next.height;
            onChange(next);
          }}
          className="text-xs text-destructive hover:underline"
        >
          Remove image
        </button>
      )}
      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        accept={accept}
        title={label}
        onSelect={(asset) => {
          const next: MediaItem = {
            ...item,
            src: asset.url,
            alt: item.alt || asset.alt || asset.name,
          };
          if (asset.width) next.width = asset.width;
          else delete next.width;
          if (asset.height) next.height = asset.height;
          else delete next.height;
          onChange(next);
        }}
      />
    </div>
  );
}
