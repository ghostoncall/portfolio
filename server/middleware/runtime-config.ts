import { defineMiddleware } from "h3";
import { withRequestDb } from "../../src/db/client";
import { resolveRuntimeEnv, runWithRuntimeConfig } from "../../src/lib/runtime-config";

// Nitro routes such as RSS, sitemap and CV run outside the TanStack server entry.
export default defineMiddleware((event, next) =>
  runWithRuntimeConfig(resolveRuntimeEnv(event.req), () => withRequestDb(async () => next())),
);
