import { defineMiddleware } from "h3";
import { withRequestDb } from "../../src/db/client";
import { resolveRuntimeEnv, runWithRuntimeConfig } from "../../src/lib/runtime-config";

// Nitro routes such as RSS, sitemap and CV run outside the TanStack server entry.
export default defineMiddleware((event, next) => {
  const url = new URL(event.req.url);
  if (url.hostname === "www.engineerthisaryan.com") {
    url.hostname = "engineerthisaryan.com";
    url.protocol = "https:";
    url.port = "";
    return Response.redirect(url, 308);
  }

  return runWithRuntimeConfig(resolveRuntimeEnv(event.req), () =>
    withRequestDb(async () => next()),
  );
});
