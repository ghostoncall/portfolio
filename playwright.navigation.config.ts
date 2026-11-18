import { defineConfig } from "@playwright/test";
import base from "./playwright.koenig.config";
export default defineConfig({
  ...base,
  testMatch: "navigation-settings.test.ts",
  outputDir: ".wrangler/navigation-results",
});
