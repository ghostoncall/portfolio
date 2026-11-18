// Edge cache for public HTML on Cloudflare Pages (Workers Cache API).
//
// Pages Functions responses are never cached by Cloudflare's CDN on their
// own — Cache-Control / s-maxage headers are ignored for them — so without
// this every visit waits for server rendering plus a database round trip.
// Here a rendered public page is stored in the data centre's cache:
//
//   age ≤ 60 s      → served from cache
//   60 s – 1 day    → served from cache immediately, re-rendered in the
//                     background (stale-while-revalidate)
//   publish/unpublish in the admin → that data centre's copies are dropped
//
// Browsers always revalidate (max-age=0), so they never hold a stale page.
// Outside the Workers runtime (local Node server, tests) `caches.default`
// doesn't exist and everything here is a no-op.

const FRESH_MS = 60_000;
const KEEP_SECONDS = 86_400;
const STORED_AT = "x-edge-stored-at";
export const BROWSER_HTML_CACHE = "public, max-age=0, must-revalidate";

type WaitUntil = (promise: Promise<unknown>) => void;

function edgeCache(): Cache | null {
  const c = (globalThis as { caches?: CacheStorage & { default?: Cache } }).caches;
  return c?.default ?? null;
}

/** The `waitUntil` Cloudflare attaches to the request (via Nitro). */
export function waitUntilOf(request: Request): WaitUntil | null {
  const r = request as Request & {
    waitUntil?: WaitUntil;
    runtime?: { cloudflare?: { context?: { waitUntil?: WaitUntil } } };
  };
  const ctx = r.runtime?.cloudflare?.context;
  if (ctx?.waitUntil) return ctx.waitUntil.bind(ctx);
  return typeof r.waitUntil === "function" ? r.waitUntil.bind(r) : null;
}

/** Only anonymous public page GETs are cached — never admin or API calls. */
export function isCacheableRequest(request: Request): boolean {
  if (request.method !== "GET") return false;
  const { pathname } = new URL(request.url);
  if (pathname === "/onlyme" || pathname.startsWith("/onlyme/")) return false;
  if (pathname.startsWith("/_serverFn") || pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/cv/")) return false;
  return true;
}

function isCacheableResponse(response: Response): boolean {
  return (
    response.status === 200 &&
    !response.headers.has("set-cookie") &&
    (response.headers.get("content-type") ?? "").includes("text/html") &&
    !/no-store|private/i.test(response.headers.get("cache-control") ?? "")
  );
}

/** Changes on every deploy (see vite.config.ts), so old pages are never reused. */
const BUILD_ID = String((import.meta.env as Record<string, unknown>)["BUILD_ID"] ?? "dev");

function cacheKey(request: Request): Request {
  const url = new URL(request.url);
  url.hash = "";
  url.searchParams.set("__build", BUILD_ID);
  return new Request(url.toString(), { method: "GET" });
}

function forBrowser(response: Response, status: "HIT" | "STALE" | "MISS"): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", BROWSER_HTML_CACHE);
  headers.delete(STORED_AT);
  headers.set("x-edge-cache", status);
  return new Response(response.body, { status: response.status, headers });
}

async function store(cache: Cache, request: Request, response: Response): Promise<void> {
  const headers = new Headers(response.headers);
  headers.set("cache-control", `public, s-maxage=${KEEP_SECONDS}`);
  headers.set(STORED_AT, String(Date.now()));
  await cache.put(cacheKey(request), new Response(response.body, { status: 200, headers }));
}

/**
 * Serve `request` from the edge cache when possible; otherwise call `render`
 * and store a cacheable result. `render` must be self-contained (it may run
 * again in the background after the response has been sent).
 */
export async function withEdgeCache(
  request: Request,
  render: () => Promise<Response>,
): Promise<Response> {
  const cache = edgeCache();
  if (!cache || !isCacheableRequest(request)) return render();

  const waitUntil = waitUntilOf(request);
  let cached: Response | undefined;
  try {
    cached = await cache.match(cacheKey(request));
  } catch {
    cached = undefined;
  }

  if (cached) {
    const age = Date.now() - Number(cached.headers.get(STORED_AT) ?? 0);
    if (age <= FRESH_MS) return forBrowser(cached, "HIT");
    if (waitUntil) {
      waitUntil(
        render()
          .then((fresh) => (isCacheableResponse(fresh) ? store(cache, request, fresh) : undefined))
          .catch(() => undefined),
      );
      return forBrowser(cached, "STALE");
    }
  }

  const response = await render();
  if (!isCacheableResponse(response)) return response;
  const [forClient, forCache] = response.body ? response.body.tee() : [null, null];
  const write = store(cache, request, new Response(forCache, response)).catch(() => undefined);
  if (waitUntil) waitUntil(write);
  else await write;
  return forBrowser(new Response(forClient, response), "MISS");
}

/** Public pages whose cached copies are dropped when the admin publishes. */
const PUBLIC_PATHS = [
  "/",
  "/education",
  "/projects",
  "/blog",
  "/blog/journal",
  "/skills",
  "/certificates",
  "/awards",
  "/experience",
  "/volunteering",
  "/resume",
  "/contact",
];

/**
 * Drop this data centre's cached copies of the public pages (plus any extra
 * paths, e.g. a post or project URL). Other data centres pick up the change
 * within the 60-second freshness window.
 */
export async function purgePublicPages(request: Request, extraPaths: string[] = []): Promise<void> {
  const cache = edgeCache();
  if (!cache) return;
  const origin = new URL(request.url).origin;
  await Promise.all(
    [...PUBLIC_PATHS, ...extraPaths].map((path) =>
      cache.delete(cacheKey(new Request(new URL(path, origin).toString()))).catch((error) => {
        console.error(
          `[edge-cache] Could not invalidate ${path}; the cached page will recover through normal revalidation within ${FRESH_MS / 1000} seconds.`,
          error,
        );
        return false;
      }),
    ),
  );
}
