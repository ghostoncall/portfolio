// Public résumé file: GET /cv/view (inline, used by the on-page viewer) and
// GET /cv/download (attachment). Both serve the currently *published* résumé
// from the settings row id "resume" (src/lib/resume.ts) by proxying it from
// Supabase Storage, so visitors never see the bucket or object path.
import { defineEventHandler, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "../../../src/db/client";
import { getEnv } from "../../../src/lib/runtime-config";
import { settings } from "../../../src/db/schema";
import { isResumeVisible, type ResumeSettings } from "../../../src/lib/resume";

const NOT_FOUND = () =>
  new Response("No résumé is published.", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });

export default defineEventHandler(async (event) => {
  const action = getRouterParam(event, "action");
  if (action !== "view" && action !== "download") {
    return new Response("Not found", { status: 404 });
  }

  const row = await getDb()
    .select({ published: settings.published })
    .from(settings)
    .where(eq(settings.id, "resume"))
    .limit(1);
  const published = row[0]?.published as unknown as ResumeSettings | undefined;
  const doc = published?.current;
  if (!isResumeVisible(published) || !doc) return NOT_FOUND();

  const supabaseUrl =
    getEnv("VITE_SUPABASE_URL") ??
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_URL;
  if (!supabaseUrl) return new Response("Storage is not configured.", { status: 500 });

  const upstream = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/media/${doc.storagePath}`,
    { signal: AbortSignal.timeout(15_000) },
  );
  if (!upstream.ok || !upstream.body) return NOT_FOUND();

  // RFC 6266: ASCII fallback plus the UTF-8 original (e.g. "Résumé.pdf").
  const asciiName = doc.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  const disposition = `${action === "download" ? "attachment" : "inline"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`;

  const headers = new Headers({
    "content-type": "application/pdf",
    "content-disposition": disposition,
    "x-content-type-options": "nosniff",
    // Every request checks visibility, even when the PDF version is unchanged.
    "cache-control": "no-store",
    "cdn-cache-control": "no-store",
  });
  const length = upstream.headers.get("content-length");
  if (length) headers.set("content-length", length);

  return new Response(upstream.body, { status: 200, headers });
});
