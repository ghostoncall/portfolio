import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { withRequestDb } from "@/db/client";
import { resolveRuntimeEnv, runWithRuntimeConfig } from "@/lib/runtime-config";

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

// Defense-in-depth: /onlyme pages must never render without a Supabase
// session, even if a client-side route guard is bypassed.
async function guardAdminArea(request: Request): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const { pathname, search } = new URL(request.url);
  if (!pathname.startsWith("/onlyme")) return null;
  if (pathname === "/onlyme/login" || pathname.startsWith("/onlyme/login/")) return null;

  const { getAuthUser } = await import("./lib/supabase.server");
  const user = await getAuthUser(request);
  if (user) return null;

  const target = new URL("/onlyme/login", request.url);
  target.searchParams.set("from", `${pathname}${search}`);
  return Response.redirect(target, 302);
}

// Public HTML is identical for every visitor (no auth, no cookies), so let
// Netlify's CDN serve it: fresh for 60 s, then stale-while-revalidate so
// visitors never wait on a cold function + database round trip. Browsers
// always revalidate (max-age=0), so a publish is visible within ~1 minute.
// Only plain 200 HTML GETs outside the admin area qualify; anything that sets
// a cookie, errors, or is a server-function call (JSON) is left untouched.
const PUBLIC_HTML_CDN_CACHE = "public, durable, s-maxage=60, stale-while-revalidate=86400";

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
  headers.set("cache-control", "public, max-age=0, must-revalidate");
  headers.set("netlify-cdn-cache-control", PUBLIC_HTML_CDN_CACHE);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env?: unknown, ctx?: unknown) {
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

          const guardResponse = await guardAdminArea(request);
          if (guardResponse) return guardResponse;

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
  },
};
