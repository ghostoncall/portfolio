import { defineConfig } from "@playwright/test";
import base from "./playwright.koenig.config";
export default defineConfig({
  ...base,
  testMatch: "koenig-sizing.test.ts",
  outputDir: ".wrangler/koenig-sizing-results",
  use: { ...base.use, viewport: { width: 1800, height: 1200 } },
});
