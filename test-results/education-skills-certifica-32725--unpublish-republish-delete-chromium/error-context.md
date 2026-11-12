# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: education-skills-certificates-awards.test.ts >> Education, Skills, Certificates & Awards — headed E2E >> education — create partial, publish, edit, unpublish, republish, delete
- Location: tests/e2e/education-skills-certificates-awards.test.ts:86:3

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/onlyme\/?$/
Received string:  "http://localhost:8080/onlyme/login?"
Timeout: 20000ms

Call log:
  - Expect "toHaveURL" with timeout 20000ms
    - waiting for navigation to finish...
    - navigated to "http://localhost:8080/onlyme/login?"
    5 × locator resolved to <html lang="en">…</html>
      - unexpected value "http://localhost:8080/onlyme/login?"
    34 × locator resolved to <html lang="en" class="lenis">…</html>
       - unexpected value "http://localhost:8080/onlyme/login?"

```

```yaml
- banner:
  - link "GitHub GitHub":
    - /url: https://github.com/amehnd
    - img "GitHub"
    - text: GitHub
  - link "LinkedIn LinkedIn":
    - /url: https://linkedin.com/in/aryann-m
    - img "LinkedIn"
    - text: LinkedIn
  - link "Aryan Mehndiratta":
    - /url: /
  - text: Portfolio 2026 Edition
- heading "Admin Access" [level=1]
- paragraph: Sign in to manage the portfolio.
- text: Email
- textbox "you@example.com"
- text: Password
- textbox "••••••••"
- button "Show password"
- button "Sign In"
- contentinfo
- contentinfo:
  - text: © 2026 Aryan Mehndiratta
  - link "RSS Feed":
    - /url: /rss.xml
  - link "Sitemap":
    - /url: /sitemap.xml
- region "Notifications alt+T"
```

# Test source

```ts
  1   | // Headed E2E suite: Education, Skills, Certificates, Awards lifecycle.
  2   | //
  3   | // Covers create → edit → publish → unpublish → republish → delete for every
  4   | // content type, empty/partial entries, and responsive checks across six
  5   | // viewports. Runs in HEADED mode; every wait is condition-based.
  6   | 
  7   | import dotenv from "dotenv";
  8   | dotenv.config();
  9   | import { test, expect, type Page } from "@playwright/test";
  10  | 
  11  | const VIEWPORTS = [
  12  |   { name: "small-phone", width: 320, height: 568 },
  13  |   { name: "standard-phone", width: 375, height: 812 },
  14  |   { name: "modern-phone", width: 390, height: 844 },
  15  |   { name: "large-phone", width: 430, height: 932 },
  16  |   { name: "tablet", width: 768, height: 1024 },
  17  |   { name: "desktop", width: 1440, height: 900 },
  18  | ];
  19  | 
  20  | async function setViewport(page: Page, vp) {
  21  |   await page.setViewportSize({ width: vp.width, height: vp.height });
  22  | }
  23  | 
  24  | async function goto(page: Page, path: string) {
  25  |   let lastErr: any = null;
  26  |   for (let attempt = 0; attempt < 2; attempt += 1) {
  27  |     try {
  28  |       await page.goto(path, { waitUntil: "domcontentloaded", timeout: 45_000 });
  29  |       await page.locator("body").waitFor({ state: "visible", timeout: 15_000 });
  30  |       return;
  31  |     } catch (e) {
  32  |       lastErr = e;
  33  |       await page.waitForTimeout(1000);
  34  |     }
  35  |   }
  36  |   throw lastErr;
  37  | }
  38  | 
  39  | async function loginAsAdmin(page: Page) {
  40  |   await goto(page, "/onlyme/login");
  41  |   await page.locator('input[type=email]').waitFor({ state: "visible", timeout: 15_000 });
  42  |   const adminEmail = process.env.ADMIN_EMAIL ?? "abc@gmail.com";
  43  |   const adminPassword = process.env.ADMIN_PASSWORD ?? "hello@123abc";
  44  |   await page.locator('input[type=email]').click();
  45  |   await page.locator('input[type=email]').pressSequentially(adminEmail, { delay: 50 });
  46  |   await page.locator('input[type=password]').click();
  47  |   await page.locator('input[type=password]').pressSequentially(adminPassword, { delay: 50 });
  48  |   await page.evaluate(() => {
  49  |     const button = document.querySelector<HTMLButtonElement>("form button[type=submit]");
  50  |     button?.click();
  51  |   });
> 52  |   await expect(page).toHaveURL(/\/onlyme\/?$/, { timeout: 20_000 });
      |                      ^ Error: expect(page).toHaveURL(expected) failed
  53  | }
  54  | 
  55  | async function clickAndWait(
  56  |   page: Page,
  57  |   selector: string,
  58  |   until: () => Promise<boolean>,
  59  |   label: string,
  60  |   max = 12,
  61  | ) {
  62  |   for (let i = 0; i < max; i += 1) {
  63  |     try {
  64  |       await page.waitForFunction((sel) => !!document.querySelector(sel), sel, { timeout: 3_000 });
  65  |       await page.locator(selector).click();
  66  |     } catch {
  67  |       // ignore transient errors during hydration
  68  |     }
  69  |     await page.waitForTimeout(250);
  70  |     if (await until()) return;
  71  |   }
  72  |   throw new Error("clickAndWait failed: " + label);
  73  | }
  74  | 
  75  | async function waitForEl(page: Page, selector: string, timeout = 15_000) {
  76  |   await page.waitForFunction((sel) => !!document.querySelector(sel), sel, { timeout });
  77  | }
  78  | 
  79  | test.describe.configure({ mode: "serial" });
  80  | 
  81  | test.describe("Education, Skills, Certificates & Awards — headed E2E", () => {
  82  | 
  83  |   // ------------------------------------------------------------------
  84  |   // Education — full lifecycle
  85  |   // ------------------------------------------------------------------
  86  |   test("education — create partial, publish, edit, unpublish, republish, delete", async ({
  87  |     page,
  88  |   }) => {
  89  |     await setViewport(page, { width: 1440, height: 900 });
  90  |     await loginAsAdmin(page);
  91  |     await goto(page, "/onlyme/education");
  92  | 
  93  |     // open new entry
  94  |     await page.locator('button[data-testid="add-education"]').click();
  95  |     await page.waitForSelector('input[data-testid="education-institution"]', {
  96  |       state: "visible",
  97  |       timeout: 10_000,
  98  |     });
  99  | 
  100 |     await page.locator('input[data-testid="education-institution"]').fill("Test University");
  101 |     await page.locator('input[data-testid="education-degree"]').fill("Bachelor of Science");
  102 |     await page.locator('button[data-testid="education-save"]').click();
  103 | 
  104 |     // row added to draft list
  105 |     await expect(page.locator('[data-testid="education-row"]').first()).toBeVisible({
  106 |       timeout: 10_000,
  107 |     });
  108 | 
  109 |     // publish
  110 |     await page.locator('button[data-testid="cms-publish"]').click();
  111 |     await page.waitForTimeout(800);
  112 | 
  113 |     // appears publicly
  114 |     await goto(page, "/");
  115 |     await expect(page.locator("section h2:has-text('Education')")).toBeVisible();
  116 |     await expect(page.locator("text=Test University")).toBeVisible();
  117 |     await expect(page.locator("text=Bachelor of Science")).toBeVisible();
  118 | 
  119 |     // edit published → update publicly
  120 |     await goto(page, "/onlyme/education");
  121 |     await page.locator('button[data-testid="education-edit"]').click();
  122 |     await page.waitForSelector('input[data-testid="education-cgpa"]', {
  123 |       state: "visible",
  124 |       timeout: 10_000,
  125 |     });
  126 |     await page.locator('input[data-testid="education-cgpa"]').fill("3.9");
  127 |     await page.locator('button[data-testid="education-save"]').click();
  128 |     await page.locator('button[data-testid="cms-publish"]').click();
  129 |     await page.waitForTimeout(800);
  130 |     await goto(page, "/");
  131 |     await expect(page.locator("text=3.9")).toBeVisible();
  132 | 
  133 |     // unpublish → disappears
  134 |     await goto(page, "/onlyme/education");
  135 |     await page.locator('button[data-testid="cms-publish"]').click();
  136 |     await page.waitForTimeout(800);
  137 |     await goto(page, "/");
  138 |     await expect(page.locator("section h2:has-text('Education')")).toBeHidden();
  139 | 
  140 |     // republish → reappears without duplication
  141 |     await goto(page, "/onlyme/education");
  142 |     await page.locator('button[data-testid="cms-publish"]').click();
  143 |     await page.waitForTimeout(800);
  144 |     await goto(page, "/");
  145 |     await expect(page.locator("section h2:has-text('Education')")).toBeVisible();
  146 |     expect(await page.locator("text=Bachelor of Science").count()).toBe(1);
  147 | 
  148 |     // delete → removed from admin list
  149 |     await goto(page, "/onlyme/education");
  150 |     await clickAndWait(
  151 |       page,
  152 |       'button[data-testid="education-delete"]',
```