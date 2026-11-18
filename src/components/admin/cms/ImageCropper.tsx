// Fixed-aspect crop tool for thumbnails (admin only, no dependencies).
//
// Drag (mouse or touch) to position, slider/buttons to zoom, arrow keys to
// nudge. Zoom ranges from "whole image" (letterboxed in the paper colour) to
// 4× a fill crop, so an image can be cropped *or* fitted into the frame.
// Output: a canvas-rendered File plus the crop as fractions of the image.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

export type CropRect = { x: number; y: number; w: number; h: number };

const PAPER = "#fdfdfb"; // --background: letterbox colour when zoomed out

export function ImageCropper({
  src,
  aspect = 4 / 3,
  initialCrop,
  outputWidth = 960,
  title = "Crop thumbnail",
  onCancel,
  onConfirm,
}: {
  src: string;
  aspect?: number;
  initialCrop?: CropRect | undefined;
  outputWidth?: number;
  title?: string;
  onCancel: () => void;
  onConfirm: (file: File, crop: CropRect) => void | Promise<void>;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [frameW, setFrameW] = useState(0);
  const [zoom, setZoom] = useState(1); // 1 = fill the frame
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const initialised = useRef(false);

  const frameH = frameW / aspect;
  const nw = img?.naturalWidth ?? 1;
  const nh = img?.naturalHeight ?? 1;
  const coverScale = frameW ? Math.max(frameW / nw, frameH / nh) : 1;
  const containScale = frameW ? Math.min(frameW / nw, frameH / nh) : 1;
  const minZoom = containScale / coverScale;
  const scale = coverScale * zoom;

  // Load the image (CORS-enabled so the canvas can be exported).
  useEffect(() => {
    const el = new Image();
    let disposed = false;
    initialised.current = false;
    setImg(null);
    setLoadError(null);
    setCenter(null);
    setZoom(1);
    if (/^https?:/i.test(src)) el.crossOrigin = "anonymous";
    el.onload = () => {
      if (!disposed) setImg(el);
    };
    el.onerror = () =>
      !disposed &&
      setLoadError("This image couldn't be loaded for cropping. Try uploading it again.");
    el.src = src;
    return () => {
      disposed = true;
      el.onload = null;
      el.onerror = null;
    };
  }, [src]);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setFrameW(Math.floor(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [img]);

  /** Keep the image covering the frame where it's larger than the frame. */
  const clamp = useCallback(
    (c: { x: number; y: number }, s: number) => {
      const half = (frame: number) => frame / (2 * s);
      const axis = (v: number, natural: number, frame: number) =>
        natural * s >= frame
          ? Math.min(Math.max(v, half(frame)), natural - half(frame))
          : natural / 2;
      return { x: axis(c.x, nw, frameW), y: axis(c.y, nh, frameH) };
    },
    [nw, nh, frameW, frameH],
  );

  // First layout: restore the saved crop, else centre at "fill".
  useEffect(() => {
    if (!img || !frameW || initialised.current) return;
    initialised.current = true;
    if (initialCrop && initialCrop.w > 0) {
      const s = frameW / (initialCrop.w * nw);
      const z = Math.min(4, Math.max(minZoom, s / coverScale));
      setZoom(z);
      setCenter(
        clamp(
          {
            x: (initialCrop.x + initialCrop.w / 2) * nw,
            y: (initialCrop.y + initialCrop.h / 2) * nh,
          },
          coverScale * z,
        ),
      );
    } else {
      setCenter({ x: nw / 2, y: nh / 2 });
    }
  }, [img, frameW, initialCrop, nw, nh, minZoom, coverScale, clamp]);

  const c = center ? clamp(center, scale) : { x: nw / 2, y: nh / 2 };

  const setZoomKeepingCenter = useCallback(
    (z: number) => {
      const next = Math.min(4, Math.max(minZoom, z));
      setZoom(next);
      setCenter((prev) => (prev ? clamp(prev, coverScale * next) : prev));
    },
    [minZoom, clamp, coverScale],
  );

  // React's delegated wheel events can be passive. The crop surface needs its
  // own non-passive handler; wheel elsewhere still scrolls the dialog normally.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !img || !frameW || busy) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const delta =
        event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? frameW : 1);
      setZoomKeepingCenter(zoom * Math.exp(-delta * 0.002));
    };
    frame.addEventListener("wheel", wheel, { passive: false });
    return () => frame.removeEventListener("wheel", wheel);
  }, [img, frameW, busy, zoom, setZoomKeepingCenter]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!img || !frameW || busy) return;
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setCenter((prev) =>
      clamp({ x: (prev?.x ?? c.x) - dx / scale, y: (prev?.y ?? c.y) - dy / scale }, scale),
    );
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (!img || !frameW || busy) return;
    const step = 12 / scale;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      setCenter(clamp({ x: c.x + m[0], y: c.y + m[1] }, scale));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      e.stopPropagation();
      setZoomKeepingCenter(zoom * 1.1);
    } else if (e.key === "-") {
      e.preventDefault();
      e.stopPropagation();
      setZoomKeepingCenter(zoom / 1.1);
    }
  }

  async function confirm() {
    if (!img || !frameW) return;
    setBusy(true);
    try {
      const sw = frameW / scale;
      const sh = frameH / scale;
      const sx = c.x - sw / 2;
      const sy = c.y - sh / 2;
      const outW = Math.round(Math.min(outputWidth, Math.max(sw, 1)));
      const outH = Math.round(outW / aspect);
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, outW, outH);
      ctx.imageSmoothingQuality = "high";
      // Destination rect for the visible part of the image (handles zoom-out).
      const k = outW / sw;
      ctx.drawImage(img, -sx * k, -sy * k, nw * k, nh * k);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.92));
      if (!blob) throw new Error("Your browser couldn't export the cropped image.");
      await onConfirm(new File([blob], "thumbnail.webp", { type: "image/webp" }), {
        x: sx / nw,
        y: sy / nh,
        w: sw / nw,
        h: sh / nh,
      });
    } catch (err) {
      setLoadError(
        err instanceof DOMException && err.name === "SecurityError"
          ? "This image's server doesn't allow re-cropping. Upload it again to crop."
          : err instanceof Error
            ? err.message
            : "Cropping failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  const left = frameW / 2 - c.x * scale;
  const top = frameH / 2 - c.y * scale;

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent
        className="max-w-[min(94vw,40rem)]"
        style={{
          width: "min(94vw, 40rem)",
          maxHeight: "calc(100dvh - 2rem)",
          overflowY: "auto",
          left: "50%",
          top: "50%",
          translate: "none",
          transform: "translate(-50%, -50%)",
          animation: "none",
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          frameRef.current?.focus({ preventScroll: true });
        }}
        onKeyDown={(event) => {
          if (!(event.target as HTMLElement).closest("input,textarea,select")) onKeyDown(event);
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Drag to position · zoom to crop, or zoom all the way out to fit the whole image. Arrow
          keys and +/− also work.
        </DialogDescription>

        {loadError ? (
          <p role="alert" className="text-sm text-destructive">
            {loadError}
          </p>
        ) : (
          <>
            <div
              ref={frameRef}
              role="application"
              aria-label="Crop area. Use arrow keys to move, plus and minus to zoom."
              tabIndex={0}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              className="relative mx-auto cursor-grab touch-none select-none overflow-hidden border border-border outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
              style={{
                width: `min(100%, max(8rem, calc((100dvh - 19rem) * ${aspect})))`,
                aspectRatio: String(aspect),
                background: PAPER,
              }}
            >
              {img && frameW > 0 && (
                <img
                  src={img.src}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute max-w-none"
                  style={{ left, top, width: nw * scale, height: nh * scale }}
                />
              )}
              {/* Rule-of-thirds guide */}
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i} className="border border-white/40" />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <button
                type="button"
                aria-label="Zoom out"
                disabled={!img || busy}
                onClick={() => setZoomKeepingCenter(zoom / 1.1)}
                className="border border-border px-2.5 py-1"
              >
                −
              </button>
              <label className="flex flex-1 items-center gap-2">
                <span className="text-xs text-muted-foreground">Zoom</span>
                <input
                  type="range"
                  min={minZoom}
                  max={4}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoomKeepingCenter(Number(e.target.value))}
                  className="flex-1"
                  aria-label="Zoom"
                />
              </label>
              <button
                type="button"
                aria-label="Zoom in"
                disabled={!img || busy}
                onClick={() => setZoomKeepingCenter(zoom * 1.1)}
                className="border border-border px-2.5 py-1"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setZoomKeepingCenter(1)}
                className="border border-border px-2.5 py-1 text-xs hover:bg-accent"
              >
                Fill frame
              </button>
              <button
                type="button"
                onClick={() => setZoomKeepingCenter(minZoom)}
                className="border border-border px-2.5 py-1 text-xs hover:bg-accent"
              >
                Whole image
              </button>
            </div>
          </>
        )}

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy || !img || !!loadError}
            className="bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Apply crop"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
