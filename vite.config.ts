/**
 * Owned Vite config â€” replaces the removed vendor wrapper package that used
 * to sit here. Composes the same standard plugins in the same order that
 * wrapper assembled, minus its editor-only plumbing (badge, telemetry,
 * devtools piping, sandbox shims, publishing manifest).
 * Server entry stays "server" (src/server.ts â€” SSR error wrapper) as before.
 */
import { loadEnv, mergeConfig } from "vite";
import { defineConfig, type ConfigEnv, type UserConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import { koenigRuntime } from "./tools/koenig-runtime";

export default ({ command, mode }: ConfigEnv): UserConfig => {
  // VITE_* env vars â†’ import.meta.env define (same as the removed wrapper did).
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), "VITE_"))) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  // A per-build id. The edge HTML cache keys on it, so a new deploy never
  // serves pages that point at the previous build's (now missing) asset files.
  envDefine["import.meta.env.BUILD_ID"] = JSON.stringify(
    process.env["CF_PAGES_COMMIT_SHA"] || Date.now().toString(36),
  );

  const isDevBuild = command === "build" && mode === "development";

  let config: UserConfig = {
    define: envDefine,
    ...(isDevBuild
      ? {
          environments: {
            client: { define: { "process.env.NODE_ENV": JSON.stringify("development") } },
          },
          esbuild: { keepNames: true },
        }
      : {}),
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      exclude: ["@tryghost/koenig-lexical"],
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    plugins: [
      // Browser-only packages must never enter the server bundle: Workers has
      // no DOM, and Rollup can hoist their module-scope DOM access into a chunk
      // that server code (drizzle/nodemailer) imports on every request.
      koenigRuntime(),
      tailwindcss(),
      tsconfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        // Redirect the bundled server entry to src/server.ts (SSR error wrapper).
        // inlineCss: the site stylesheet (~18 KB gzip) ships inside the HTML as
        // a <style> tag instead of a render-blocking <link>, saving a full
        // network round trip before first paint (measured: see FINAL report).
        server: { entry: "server", build: { inlineCss: true } },
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      // Build-time server bundling, same as the removed wrapper's default.
      ...(command === "build"
        ? [
            nitro({
              defaultPreset: "cloudflare-pages",
              cloudflare: {
                // Pages preserves dashboard secrets alongside Wrangler variables.
                wrangler: { vars: { NODE_VERSION: "26.8.1" } },
              },
            }),
          ]
        : []),
      react(),
    ],
  };

  config = mergeConfig({ server: { host: "::", port: 8080 } }, config);
  config = mergeConfig(config, {
    server: { watch: { awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 } } },
  });

  return config;
};
