import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { withRequestDb } from "@/db/client";
import { runWithRuntimeConfig } from "@/lib/runtime-config";

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

/**
 * Resolve runtime environment variables for the request.
 *
 * On Netlify (Node.js) environment variables are available via `process.env`.
 * Nitro may also pass an `env` object as the second argument to the fetch
 * handler; if present it is merged on top of `process.env`.
 */
function resolveRuntimeEnv(env?: unknown): Record<string, unknown> {
  const base: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(process.env)) {
    base[key] = value;
  }
  if (env && typeof env === "object") {
    Object.assign(base, env as Record<string, unknown>);
  }
  return base;
}

export default {
  async fetch(request: Request, env?: unknown, ctx?: unknown) {
    try {
      // Inject environment variables into the runtime config so server
      // functions can read DATABASE_URL, ADMIN_EMAIL, SMTP_*, etc.
      const envObj = resolveRuntimeEnv(env);
      console.log(
        `[envprobe] ${new URL(request.url).pathname} keys=${Object.keys(envObj).length}`,
      );

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
          return await normalizeCatastrophicSsrResponse(response);
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
