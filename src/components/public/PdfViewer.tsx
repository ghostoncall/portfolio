// In-page PDF viewer for the Résumé / CV section (and its admin preview).
//
// Why PDF.js instead of an <iframe>: mobile browsers (Android Chrome, iOS
// Safari) don't render PDFs inside iframes, so the document would be
// invisible exactly where most visitors are. PDF.js draws real pages to canvas.
//
// Performance: nothing PDF-related ships with the page. The library and its
// worker are dynamically imported only once the viewer is close to the
// viewport, and each page is rendered only when it scrolls near view.
//
// Scrolling: the page stack sits in a bounded box with native overflow
// scrolling (wheel, trackpad, touch momentum); `data-lenis-prevent` keeps the
// site's Lenis smooth scroll from hijacking it. `overscroll-behavior: auto`
// (overriding Lenis' `contain` for prevented areas) lets the scroll chain to
// the page at either end, so the viewer never traps the visitor.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

type Status = "idle" | "loading" | "ready" | "error";

const ZOOM_STEPS = [1, 1.25, 1.5, 2] as const;

async function loadPdfJs() {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

export function PdfViewer({
  src,
  title,
  className = "",
  maxHeight = "min(85vh, 1100px)",
}: {
  src: string;
  title: string;
  className?: string;
  maxHeight?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageSizes, setPageSizes] = useState<{ w: number; h: number }[]>([]);
  const [width, setWidth] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(0);
  const zoom = ZOOM_STEPS[zoomIndex]!;

  // Start loading only when the viewer approaches the viewport.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return setNear(true);
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setNear(true),
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Track the available width so pages fit the container at zoom 1.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry!.contentRect.width);
      setWidth((prev) => (Math.abs(prev - w) > 4 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    setStatus("loading");
    setDoc(null);
    setPageSizes([]);
    (async () => {
      try {
        const pdfjs = await loadPdfJs();
        if (cancelled) return;
        const loading = pdfjs.getDocument({ url: src, disableRange: true, enableXfa: false });
        task = loading;
        const loaded = await loading.promise;
        // Page sizes up front so every placeholder has its final height (no CLS).
        const sizes = [];
        for (let i = 1; i <= loaded.numPages; i++) {
          const vp = (await loaded.getPage(i)).getViewport({ scale: 1 });
          sizes.push({ w: vp.width, h: vp.height });
        }
        if (cancelled) return;
        setPageSizes(sizes);
        setDoc(loaded);
        setStatus("ready");
      } catch (err) {
        console.error("[PdfViewer] could not load", err);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      void task?.destroy(); // frees the worker and the document
    };
  }, [near, src]);

  const pageCount = pageSizes.length;
  const scrollBoxStyle: CSSProperties = { maxHeight, overscrollBehavior: "auto" };

  return (
    <div ref={rootRef} className={`border border-border bg-muted/40 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
        <span className="label-caps" aria-live="polite">
          {status === "ready"
            ? `${pageCount} page${pageCount === 1 ? "" : "s"}`
            : status === "error"
              ? "Preview unavailable"
              : "Loading document…"}
        </span>
        <div className="flex items-center gap-1" role="group" aria-label="Zoom">
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={zoomIndex === 0 || status !== "ready"}
            aria-label="Zoom out"
            className="flex h-9 w-9 items-center justify-center border border-border bg-background text-base text-foreground transition-colors hover:bg-foreground hover:text-background disabled:pointer-events-none disabled:opacity-40"
          >
            −
          </button>
          <span className="w-12 text-center tabular-nums" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            disabled={zoomIndex === ZOOM_STEPS.length - 1 || status !== "ready"}
            aria-label="Zoom in"
            className="flex h-9 w-9 items-center justify-center border border-border bg-background text-base text-foreground transition-colors hover:bg-foreground hover:text-background disabled:pointer-events-none disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        // Let the browser scroll this box natively (Lenis drives the page).
        data-lenis-prevent=""
        tabIndex={0}
        role="region"
        aria-label={`${title} — document preview`}
        className="overflow-auto p-3 outline-none focus-visible:ring-1 focus-visible:ring-ring sm:p-5"
        style={scrollBoxStyle}
      >
        {status === "error" ? (
          <p className="py-10 text-center font-serif text-sm text-muted-foreground">
            The preview couldn’t be displayed in this browser.{" "}
            <a href={src} target="_blank" rel="noreferrer" className="text-link underline">
              Open the PDF
            </a>{" "}
            instead.
          </p>
        ) : status !== "ready" || !doc || width === 0 ? (
          // Reserve an A4-ish page so the section doesn't jump when pages arrive.
          <div className="mx-auto aspect-[1/1.414] w-full max-w-full animate-pulse bg-background motion-reduce:animate-none" />
        ) : (
          // Block layout + mx-auto (not flex centering): when zoomed wider than
          // the box, pages start at the left edge so every part is scrollable.
          <div className="space-y-4">
            {pageSizes.map((size, i) => (
              <PdfPage
                key={i}
                doc={doc}
                pageNumber={i + 1}
                pageCount={pageCount}
                cssWidth={Math.floor(width * zoom)}
                aspect={size.h / size.w}
                title={title}
                root={scrollRef.current}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PdfPage({
  doc,
  pageNumber,
  pageCount,
  cssWidth,
  aspect,
  title,
  root,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  pageCount: number;
  cssWidth: number;
  aspect: number;
  title: string;
  root: HTMLElement | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(pageNumber === 1);
  const cssHeight = Math.round(cssWidth * aspect);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setVisible(true),
      { root, rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [root, visible]);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    let cancelled = false;
    // Debounce so resizing/zooming doesn't queue a render per frame.
    const timer = window.setTimeout(async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvas, viewport });
      task.promise.catch(() => {}); // cancelled renders reject; ignore
    }, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      task?.cancel();
    };
  }, [doc, pageNumber, cssWidth, visible]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`${title}, page ${pageNumber} of ${pageCount}`}
      className="mx-auto block max-w-none border border-border bg-white"
      style={{ width: cssWidth, height: cssHeight }}
    />
  );
}
