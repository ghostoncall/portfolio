import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { withRequestDb } from "@/db/client";
import { resolveRuntimeEnv, runWithRuntimeConfig } from "@/lib/runtime-config";
import { BROWSER_HTML_CACHE, purgePublicPages, waitUntilOf, withEdgeCache } from "@/lib/edge-cache";

type ServerEntry = {
  fetch: (request: Request, env?: unknown, ctx?: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Uploaded media lives in Supabase Storage, not on the local filesystem.
// public/uploads/ is empty in production, so this is a no-op on Netlify.
async function serveUpload(request: Request): Promise<Response | null> {
  return null;
}

// Public HTML is identical for every visitor (no auth, no cookies). On
// Cloudflare it is kept in the edge cache by withEdgeCache (src/lib/edge-cache.ts):
// fresh for 60 s, then stale-while-revalidate, so visitors never wait on a
// cold render + database round trip. Browsers always revalidate (max-age=0).
// `cdn-cache-control` carries the same policy for any standards-based CDN
// placed in front. Only plain 200 HTML GETs outside the admin area qualify;
// anything that sets a cookie, errors, or is a server-function call (JSON) is
// left untouched.
const PUBLIC_HTML_CDN_CACHE = "public, s-maxage=60, stale-while-revalidate=86400";

function applyCachePolicy(request: Request, response: Response): Response {
  if (request.method !== "GET" && request.method !== "HEAD") return response;
  const { pathname } = new URL(request.url);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;

  // Never let an admin page be stored by any cache.
  if (pathname === "/onlyme" || pathname.startsWith("/onlyme/")) {
    const headers = new Headers(response.headers);
    headers.set("cache-control", "private, no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  if (response.status !== 200) return response;
  if (response.headers.has("set-cookie")) return response;
  if (response.headers.has("cache-control")) return response; // route chose its own policy

  const headers = new Headers(response.headers);
  headers.set("cache-control", BROWSER_HTML_CACHE);
  headers.set("cdn-cache-control", PUBLIC_HTML_CDN_CACHE);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env?: unknown, ctx?: unknown) {
    // Public pages may be answered from (or refreshed into) the edge cache;
    // render() may also run again in the background to refresh a stale copy.
    const response = await withEdgeCache(request, () => render(request, env, ctx));
    purgeAfterAdminWrite(request, response);
    return response;
  },
};

/**
 * A successful admin write (publish, unpublish, delete, résumé, settings…)
 * drops this data centre's cached public pages so the admin sees the change
 * at once; elsewhere it shows within the 60-second freshness window. The
 * editor's URL tells us which post or project page changed too.
 */
function purgeAfterAdminWrite(request: Request, response: Response): void {
  if (request.method !== "POST" || !response.ok) return;
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/_serverFn/")) return;
  if (!/(^|;\s*)sb-[^=]*-auth-token/.test(request.headers.get("cookie") ?? "")) return;
  const extra: string[] = [];
  try {
    const from = new URL(request.headers.get("referer") ?? "").pathname;
    const m = /^\/onlyme\/(blogs|projects)\/([a-z0-9-]+)/.exec(from);
    if (m) extra.push(`/${m[1] === "blogs" ? "blog" : "projects"}/${m[2]}`);
  } catch {
    // no referer — the section pages are purged regardless
  }
  const job = purgePublicPages(request, extra).catch((error) => {
    console.error(
      "[edge-cache] Admin write succeeded, but immediate cache invalidation failed. Public HTML will recover through normal revalidation within 60 seconds.",
      error,
    );
  });
  waitUntilOf(request)?.(job);
}

async function render(request: Request, env?: unknown, ctx?: unknown): Promise<Response> {
  {
    try {
      // Inject environment variables into the runtime config so server
      // functions can read DATABASE_URL, ADMIN_EMAIL, SMTP_*, etc.
      const envObj = resolveRuntimeEnv(request, env);

      // Each request gets its own lazily-created database client (closed on
      // completion). On Netlify Functions each invocation is isolated, so the
      // process-wide singleton fallback in db/client.ts is safe.
      return await runWithRuntimeConfig(envObj, () =>
        withRequestDb(async () => {
          const uploadResponse = await serveUpload(request);
          if (uploadResponse) return uploadResponse;

          const handler = await getServerEntry();
          // Inject the raw Request into server-function context so handlers can
          // access request headers (e.g. for session verification via `requireAdmin`).
          const response = await handler.fetch(
            request,
            {
              ...envObj,
              context: {
                ...(envObj?.["context"] as Record<string, unknown>),
                request,
              },
            },
            ctx,
          );
          return applyCachePolicy(request, await normalizeCatastrophicSsrResponse(response));
        }),
      );
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  }
}
