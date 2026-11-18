import { defineConfig } from "@playwright/test";
import base from "./playwright.koenig.config";
export default defineConfig({
  ...base,
  testMatch: "overview-editor.test.ts",
  outputDir: ".wrangler/overview-test-results",
});
