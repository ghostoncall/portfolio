import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  devServer: { port: 8080 },
  serverDir: "server",
  preset: "cloudflare-pages",
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
    "/rss.xml": { headers: { "content-type": "application/rss+xml; charset=utf-8" } },
    "/sitemap.xml": { headers: { "content-type": "application/xml; charset=utf-8" } },
  },
});
