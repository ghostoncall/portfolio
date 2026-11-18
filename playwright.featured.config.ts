import { defineConfig } from "@playwright/test";
import base from "./playwright.koenig.config";
export default defineConfig({
  ...base,
  testMatch: "overview-featured.test.ts",
  outputDir: ".wrangler/featured-results",
  use: { ...base.use, viewport: { width: 1600, height: 1200 } },
});
