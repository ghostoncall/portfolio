// Universal media placeholder / viewer.
// Drop <Media /> anywhere. Give it zero, one or many items of ANY file type
// (jpg, png, gif, svg, mp4, mov, mp3, pdf, ppt/pptx, doc/docx, xls/xlsx,
// YouTube/Vimeo links, zip, anything). It detects the type from the URL,
// preserves the configured or intrinsic frame, and becomes a carousel when
// there is more than one item. Empty slots render as tidy placeholders.
//
// Self-contained: depends only on React + Tailwind (shadcn color tokens:
// background, foreground, muted, muted-foreground, border).

import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";

export type MediaKind =
  "image" | "video" | "audio" | "pdf" | "office" | "youtube" | "vimeo" | "embed" | "file";

export type MediaItem = {
  /** URL or path to the file, e.g. "/files/talk.pptx" or "https://youtu.be/…". Leave empty for a placeholder. */
  src?: string;
  /** Force a type instead of auto-detecting from the extension. */
  kind?: MediaKind;
  /** Display name for documents / files. */
  title?: string;
  alt?: string;
  caption?: string;
  credit?: string;
  /** Intrinsic dimensions recorded by the media library. */
  width?: number;
  height?: number;
  /** Poster image for videos. */
  poster?: string;
};

export type MediaFit = "cover" | "contain";
export type MediaPosition = "center" | "top" | "bottom" | "left" | "right";

export const MEDIA_RATIO_OPTIONS = [
  { label: "Natural (uploaded image)", value: "natural" },
  { label: "Banner (3:1)", value: "3/1" },
  { label: "Wide banner (21:9)", value: "21/9" },
  { label: "Wide (16:9)", value: "16/9" },
  { label: "Landscape (3:2)", value: "3/2" },
  { label: "Standard (4:3)", value: "4/3" },
  { label: "Square (1:1)", value: "1/1" },
  { label: "Portrait (3:4)", value: "3/4" },
] as const;

export const MEDIA_POSITION_OPTIONS: { label: string; value: MediaPosition }[] = [
  { label: "Center", value: "center" },
  { label: "Top", value: "top" },
  { label: "Bottom", value: "bottom" },
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
];

export type MediaProps = {
  items?: MediaItem[] | undefined;
  /** Number of empty placeholder slots to show when `items` is empty. */
  count?: number | undefined;
  /** How several items are shown. Default: carousel. */
  layout?: "carousel" | "grid" | "stack" | undefined;
  /** Frame aspect ratio or "natural". Missing keeps the legacy 16/9 default. */
  ratio?: string | undefined;
  /** How images/videos fill the frame. Default cover. */
  fit?: MediaFit | undefined;
  /** Which part stays visible when a fixed frame crops media. Default center. */
  position?: MediaPosition | undefined;
  caption?: string | undefined;
  credit?: string | undefined;
  captionContent?: ReactNode | undefined;
  creditContent?: ReactNode | undefined;
  frameClassName?: string | undefined;
  className?: string | undefined;
};

export function resolveMediaAspectRatio(
  item: Pick<MediaItem, "width" | "height"> | undefined,
  ratio: string,
): string | undefined {
  if (ratio !== "natural") return ratio;
  const width = Number(item?.width ?? 0);
  const height = Number(item?.height ?? 0);
  return width > 0 && height > 0 ? `${width}/${height}` : undefined;
}

const EXT: Record<Exclude<MediaKind, "youtube" | "vimeo" | "embed" | "file">, string[]> = {
  image: ["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "bmp", "ico", "heic", "tif", "tiff"],
  video: ["mp4", "webm", "mov", "m4v", "ogv", "mkv"],
  audio: ["mp3", "wav", "ogg", "oga", "m4a", "flac", "aac"],
  pdf: ["pdf"],
  office: ["ppt", "pptx", "pps", "ppsx", "doc", "docx", "xls", "xlsx", "odt", "odp", "ods", "rtf"],
};

export function fileExtension(src: string): string {
  const clean = src.split(/[?#]/)[0] ?? "";
  const match = clean.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? "";
}

export function fileName(src: string): string {
  const clean = src.split(/[?#]/)[0] ?? "";
  const last = clean.split("/").filter(Boolean).pop() ?? clean;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

export function detectMediaKind(item: MediaItem): MediaKind | "empty" {
  if (!item.src) return "empty";
  if (item.kind) return item.kind;
  const src = item.src;
  if (/^data:image\//i.test(src)) return "image";
  if (/^data:video\//i.test(src)) return "video";
  if (/(^|\/\/|\.)(youtube\.com|youtu\.be)\//i.test(src)) return "youtube";
  if (/(^|\/\/|\.)vimeo\.com\//i.test(src)) return "vimeo";
  const ext = fileExtension(src);
  for (const [kind, list] of Object.entries(EXT)) {
    if (list.includes(ext)) return kind as MediaKind;
  }
  return "file";
}

export function youtubeEmbedUrl(src: string): string {
  const m = src.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : src;
}

export function vimeoEmbedUrl(src: string): string {
  const m = src.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? `https://player.vimeo.com/video/${m[1]}` : src;
}

const caps = "font-sans text-[0.68rem] uppercase tracking-[0.18em]";
const fill = "absolute inset-0 h-full w-full";

/** Office files need a public absolute URL for the online viewer; resolve after hydration. */
function useOfficeViewerUrl(src: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    try {
      const abs = new URL(src, window.location.href);
      const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(abs.hostname);
      setUrl(
        local
          ? null
          : `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(abs.href)}`,
      );
    } catch {
      setUrl(null);
    }
  }, [src]);
  return url;
}

function EmptySlot({ index, total }: { index?: number; total?: number }) {
  return (
    <div
      className={`${fill} flex flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted p-4 text-center`}
    >
      <span className={`${caps} text-foreground`}>
        Media{total && total > 1 ? ` ${String((index ?? 0) + 1).padStart(2, "0")}` : ""}
      </span>
      <span className="font-serif text-xs italic text-muted-foreground">
        Image · Video · Audio · PDF · Slides · Document · Any file
      </span>
    </div>
  );
}

function FileCard({ item, ext }: { item: MediaItem; ext: string }) {
  const name = item.title ?? fileName(item.src ?? "");
  return (
    <div
      className={`${fill} flex flex-col items-center justify-center gap-4 border border-border bg-muted p-6 text-center`}
    >
      <div className="flex h-20 w-16 items-end justify-start bg-foreground p-2">
        <span className={`${caps} text-background`}>{ext || "file"}</span>
      </div>
      <p className="max-w-full truncate font-serif text-lg text-foreground">{name}</p>
      <div className="flex gap-6">
        <a
          href={item.src}
          target="_blank"
          rel="noreferrer"
          className={`${caps} text-foreground underline-offset-4 hover:underline`}
        >
          Open
        </a>
        <a
          href={item.src}
          download
          className={`${caps} text-foreground underline-offset-4 hover:underline`}
        >
          Download
        </a>
      </div>
    </div>
  );
}

function OfficeSlot({ item, ext }: { item: MediaItem; ext: string }) {
  const viewer = useOfficeViewerUrl(item.src ?? "");
  if (!viewer) return <FileCard item={item} ext={ext} />;
  return (
    <iframe
      src={viewer}
      loading="lazy"
      title={item.title ?? fileName(item.src ?? "")}
      className={`${fill} border border-border bg-background`}
    />
  );
}

function Slot({
  item,
  fit,
  position,
  naturalFlow,
  index,
  total,
}: {
  item: MediaItem;
  fit: MediaFit;
  position: MediaPosition;
  naturalFlow: boolean;
  index: number;
  total: number;
}) {
  const kind = detectMediaKind(item);
  const src = item.src ?? "";
  const ext = fileExtension(src);
  const objectFit = fit === "cover" ? "object-cover" : "object-contain";
  const mediaClass = naturalFlow ? "block h-auto w-full" : `${fill} ${objectFit}`;
  const title = item.title ?? item.alt ?? item.caption ?? "Media";
  const width = Number(item.width ?? 0) > 0 ? Number(item.width) : undefined;
  const height = Number(item.height ?? 0) > 0 ? Number(item.height) : undefined;

  switch (kind) {
    case "empty":
      return <EmptySlot index={index} total={total} />;
    case "image":
      return (
        <img
          src={src}
          alt={item.alt ?? item.caption ?? ""}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
          className={`${mediaClass} bg-muted`}
          style={{ objectPosition: position }}
        />
      );
    case "video":
      return (
        <video
          src={src}
          poster={item.poster}
          width={width}
          height={height}
          controls
          playsInline
          preload="metadata"
          className={`${mediaClass} bg-foreground`}
          style={{ objectPosition: position }}
        />
      );
    case "audio":
      return (
        <div
          className={`${fill} flex flex-col items-center justify-center gap-4 border border-border bg-muted p-6`}
        >
          <span className={`${caps} text-muted-foreground`}>Audio</span>
          <p className="max-w-full truncate font-serif text-lg text-foreground">
            {item.title ?? fileName(src)}
          </p>
          <audio src={src} controls preload="metadata" className="w-full max-w-md" />
        </div>
      );
    case "pdf":
      return (
        <iframe
          src={src}
          loading="lazy"
          title={title}
          className={`${fill} border border-border bg-background`}
        />
      );
    case "office":
      return <OfficeSlot item={item} ext={ext} />;
    case "youtube":
      return (
        <iframe
          src={youtubeEmbedUrl(src)}
          loading="lazy"
          title={title}
          className={fill}
          allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      );
    case "vimeo":
      return (
        <iframe
          src={vimeoEmbedUrl(src)}
          loading="lazy"
          title={title}
          className={fill}
          allow="fullscreen; picture-in-picture"
          allowFullScreen
        />
      );
    case "embed":
      return (
        <iframe
          src={src}
          loading="lazy"
          title={title}
          className={`${fill} border border-border`}
          allowFullScreen
        />
      );
    default:
      return <FileCard item={item} ext={ext} />;
  }
}

function Frame({
  ratio,
  className,
  children,
}: {
  ratio?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div
      className={`${ratio ? "relative" : ""} w-full overflow-hidden ${className ?? ""}`}
      style={ratio ? { aspectRatio: ratio } : undefined}
    >
      {children}
    </div>
  );
}

function ItemCaption({ item }: { item: MediaItem }) {
  const kind = detectMediaKind(item);
  const showOpen = kind === "pdf" || kind === "office";
  if (!item.caption && !item.credit && !showOpen) return null;
  return (
    <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-muted-foreground">
      <span className="font-serif">{item.caption}</span>
      <span className="flex gap-4">
        {item.credit && <span className={caps}>{item.credit}</span>}
        {showOpen && (
          <a
            href={item.src}
            target="_blank"
            rel="noreferrer"
            className={`${caps} text-foreground hover:underline`}
          >
            Open file ↗
          </a>
        )}
      </span>
    </div>
  );
}

export function Media({
  items,
  count = 1,
  layout = "carousel",
  ratio = "16/9",
  fit = "cover",
  position = "center",
  caption,
  credit,
  captionContent,
  creditContent,
  frameClassName,
  className = "",
}: MediaProps) {
  const slots: MediaItem[] =
    items && items.length > 0 ? items : Array.from({ length: Math.max(1, count) }, () => ({}));
  const total = slots.length;
  const [index, setIndex] = useState(0);
  const current = Math.min(index, total - 1);
  const go = (delta: number) => setIndex((i) => (i + delta + total) % total);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
  };

  const framedSlot = (item: MediaItem, itemIndex: number) => {
    const kind = detectMediaKind(item);
    const resolvedRatio = resolveMediaAspectRatio(item, ratio);
    const naturalFlow =
      ratio === "natural" && !resolvedRatio && (kind === "image" || kind === "video");
    return (
      <Frame ratio={naturalFlow ? undefined : (resolvedRatio ?? "16/9")} className={frameClassName}>
        <Slot
          item={item}
          fit={fit}
          position={position}
          naturalFlow={naturalFlow}
          index={itemIndex}
          total={total}
        />
      </Frame>
    );
  };

  let body: ReactNode;
  if (total === 1) {
    body = (
      <>
        {framedSlot(slots[0]!, 0)}
        <ItemCaption item={slots[0]!} />
      </>
    );
  } else if (layout === "grid" || layout === "stack") {
    body = (
      <div className={layout === "grid" ? "grid gap-6 sm:grid-cols-2" : "space-y-8"}>
        {slots.map((item, i) => (
          <div key={i}>
            {framedSlot(item, i)}
            <ItemCaption item={item} />
          </div>
        ))}
      </div>
    );
  } else {
    const item = slots[current]!;
    body = (
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={caption ?? "Media gallery"}
        tabIndex={0}
        onKeyDown={onKey}
        className="outline-none focus-visible:ring-1 focus-visible:ring-foreground"
      >
        <div key={current}>{framedSlot(item, current)}</div>
        <ItemCaption item={item} />
        <div className="mt-3 flex items-center justify-between gap-4 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous item"
            className={`${caps} text-foreground hover:underline`}
          >
            ← Prev
          </button>
          <div className="flex flex-1 items-center justify-center gap-1.5">
            {slots.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show item ${i + 1}`}
                aria-current={i === current ? "true" : undefined}
                className={`h-px w-6 transition-colors ${i === current ? "bg-foreground" : "bg-border hover:bg-muted-foreground"}`}
                style={{ height: i === current ? 2 : 1 }}
              />
            ))}
          </div>
          <span className={`${caps} tabular-nums text-muted-foreground`}>
            {String(current + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next item"
            className={`${caps} text-foreground hover:underline`}
          >
            Next →
          </button>
        </div>
      </div>
    );
  }

  return (
    <figure className={`my-10 ${className}`}>
      {body}
      {(caption || credit) && (
        <figcaption className="mt-3 flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
          <span className="font-serif">{captionContent ?? caption}</span>
          {(creditContent || credit) && <span className={caps}>{creditContent ?? credit}</span>}
        </figcaption>
      )}
    </figure>
  );
}

export default Media;
