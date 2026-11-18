import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  devServer: { port: 8080 },
  serverDir: "server",
  preset: "cloudflare-pages",
  cloudflare: {
    pages: {
      // Static files go straight to Pages' asset server, never the Worker.
      // Folder wildcards keep _routes.json far below Cloudflare's 100-rule
      // limit; Nitro's default lists every file and silently drops the ones
      // past 100, which then 404 (that happened once the build passed ~97
      // files).
      routes: {
        exclude: ["/assets/*", "/fonts/*", "/images/*", "/favicon.svg", "/robots.txt"],
      },
    },
  },
  rolldownConfig: {
    output: {
      codeSplitting: {
        groups: [
          {
            // Pages route modules cannot import shared code from the Worker entry.
            name: "request-runtime",
            test: /[\\/]src[\\/](?:db[\\/]|lib[\\/]runtime-config\.ts$)/,
            priority: 10,
          },
        ],
      },
    },
  },
  routeRules: {
    // Static files are served by Cloudflare Pages directly; these become
    // entries in the generated _headers file. Font files carry a content hash
    // in their name, so they never change in place.
    "/fonts/**": { headers: { "cache-control": "public, max-age=31536000, immutable" } },
    "/images/**": { headers: { "cache-control": "public, max-age=604800" } },
    "/favicon.svg": { headers: { "cache-control": "public, max-age=86400" } },
    "/rss.xml": { headers: { "content-type": "application/rss+xml; charset=utf-8" } },
    "/sitemap.xml": { headers: { "content-type": "application/xml; charset=utf-8" } },
  },
});
