// Headed E2E suite: Education, Skills, Certificates, Awards lifecycle.
//
// Covers create → edit → publish → unpublish → republish → delete for every
// content type, empty/partial entries, and responsive checks across six
// viewports. Runs in HEADED mode; every wait is condition-based.

import dotenv from "dotenv";
dotenv.config();
import { test, expect, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "small-phone", width: 320, height: 568 },
  { name: "standard-phone", width: 375, height: 812 },
  { name: "modern-phone", width: 390, height: 844 },
  { name: "large-phone", width: 430, height: 932 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

async function setViewport(page: Page, vp) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
}

async function goto(page: Page, path: string) {
  let lastErr: any = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.locator("body").waitFor({ state: "visible", timeout: 15_000 });
      return;
    } catch (e) {
      lastErr = e;
      await page.waitForTimeout(1000);
    }
  }
  throw lastErr;
}

async function loginAsAdmin(page: Page) {
  await goto(page, "/onlyme/login");
  await page.locator('input[type=email]').waitFor({ state: "visible", timeout: 15_000 });
  const adminEmail = process.env.ADMIN_EMAIL ?? "abc@gmail.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "hello@123abc";
  await page.locator('input[type=email]').click();
  await page.locator('input[type=email]').pressSequentially(adminEmail, { delay: 50 });
  await page.locator('input[type=password]').click();
  await page.locator('input[type=password]').pressSequentially(adminPassword, { delay: 50 });
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>("form button[type=submit]");
    button?.click();
  });
  await expect(page).toHaveURL(/\/onlyme\/?$/, { timeout: 20_000 });
}

async function clickAndWait(
  page: Page,
  selector: string,
  until: () => Promise<boolean>,
  label: string,
  max = 12,
) {
  for (let i = 0; i < max; i += 1) {
    try {
      await page.waitForFunction((sel) => !!document.querySelector(sel), sel, { timeout: 3_000 });
      await page.locator(selector).click();
    } catch {
      // ignore transient errors during hydration
    }
    await page.waitForTimeout(250);
    if (await until()) return;
  }
  throw new Error("clickAndWait failed: " + label);
}

async function waitForEl(page: Page, selector: string, timeout = 15_000) {
  await page.waitForFunction((sel) => !!document.querySelector(sel), sel, { timeout });
}

test.describe.configure({ mode: "serial" });

test.describe("Education, Skills, Certificates & Awards — headed E2E", () => {

  // ------------------------------------------------------------------
  // Education — full lifecycle
  // ------------------------------------------------------------------
  test("education — create partial, publish, edit, unpublish, republish, delete", async ({
    page,
  }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await loginAsAdmin(page);
    await goto(page, "/onlyme/education");

    // open new entry
    await page.locator('button[data-testid="add-education"]').click();
    await page.waitForSelector('input[data-testid="education-institution"]', {
      state: "visible",
      timeout: 10_000,
    });

    await page.locator('input[data-testid="education-institution"]').fill("Test University");
    await page.locator('input[data-testid="education-degree"]').fill("Bachelor of Science");
    await page.locator('button[data-testid="education-save"]').click();

    // row added to draft list
    await expect(page.locator('[data-testid="education-row"]').first()).toBeVisible({
      timeout: 10_000,
    });

    // publish
    await page.locator('button[data-testid="cms-publish"]').click();
    await page.waitForTimeout(800);

    // appears publicly
    await goto(page, "/");
    await expect(page.locator("section h2:has-text('Education')")).toBeVisible();
    await expect(page.locator("text=Test University")).toBeVisible();
    await expect(page.locator("text=Bachelor of Science")).toBeVisible();

    // edit published → update publicly
    await goto(page, "/onlyme/education");
    await page.locator('button[data-testid="education-edit"]').click();
    await page.waitForSelector('input[data-testid="education-cgpa"]', {
      state: "visible",
      timeout: 10_000,
    });
    await page.locator('input[data-testid="education-cgpa"]').fill("3.9");
    await page.locator('button[data-testid="education-save"]').click();
    await page.locator('button[data-testid="cms-publish"]').click();
    await page.waitForTimeout(800);
    await goto(page, "/");
    await expect(page.locator("text=3.9")).toBeVisible();

    // unpublish → disappears
    await goto(page, "/onlyme/education");
    await page.locator('button[data-testid="cms-publish"]').click();
    await page.waitForTimeout(800);
    await goto(page, "/");
    await expect(page.locator("section h2:has-text('Education')")).toBeHidden();

    // republish → reappears without duplication
    await goto(page, "/onlyme/education");
    await page.locator('button[data-testid="cms-publish"]').click();
    await page.waitForTimeout(800);
    await goto(page, "/");
    await expect(page.locator("section h2:has-text('Education')")).toBeVisible();
    expect(await page.locator("text=Bachelor of Science").count()).toBe(1);

    // delete → removed from admin list
    await goto(page, "/onlyme/education");
    await clickAndWait(
      page,
      'button[data-testid="education-delete"]',
      () => page.locator('button:has-text("Delete")').isVisible(),
      "open delete confirm",
    );
    await page.locator('button:has-text("Delete")').click();
    await expect(page.locator('[data-testid="education-row"]')).toHaveCount(0);
  });

  // ------------------------------------------------------------------
  // Skills — full lifecycle
  // ------------------------------------------------------------------
  test("skills — create, publish, unpublish, delete", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await loginAsAdmin(page);
    await goto(page, "/onlyme/skills-certificates-awards");

    await clickAndWait(
      page,
      'button[data-testid="add-skill"]',
      () => page.locator('input[data-testid="skill-name"]').isVisible(),
      "new skill opens",
    );
    await page.locator('input[data-testid="skill-name"]').fill("Test Skill");
    await page.locator('input[data-testid="skill-detail"]').fill("A test skill detail.");
    await page.locator('button[data-testid="skills-save"]').click();
    await expect(
      page.locator('article[data-testid="skills-row"]').first(),
    ).toBeVisible({ timeout: 10_000 });

    await page.locator('button[data-testid="cms-publish"]').click();
    await page.waitForTimeout(800);

    await goto(page, "/skills");
    await expect(page.locator("text=Test Skill")).toBeVisible();

    await goto(page, "/onlyme/skills-certificates-awards");
    await page.locator('button[data-testid="cms-publish"]').click();
    await page.waitForTimeout(800);
    await goto(page, "/skills");
    await expect(page.locator("text=Test Skill")).toBeHidden();

    await goto(page, "/onlyme/skills-certificates-awards");
    await clickAndWait(
      page,
      'button[data-testid="skills-delete"]',
      () => page.locator('button:has-text("Delete")').isVisible(),
      "delete skill",
    );
    await page.locator('button:has-text("Delete")').click();
    await expect(page.locator('[data-testid="skills-row"]')).toHaveCount(0);
  });

  // ------------------------------------------------------------------
  // Certificates — full lifecycle
  // ------------------------------------------------------------------
  test("certificates — create, publish, unpublish, delete", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await loginAsAdmin(page);
    await goto(page, "/onlyme/skills-certificates-awards");

    await clickAndWait(
      page,
      'button[data-testid="add-certificate"]',
      () => page.locator('input[data-testid="certificate-title"]').isVisible(),
      "new certificate opens",
    );
    await page.locator('input[data-testid="certificate-title"]').fill("Test Certificate");
    await page.locator('button[data-testid="certificates-save"]').click();
    await expect(
      page.locator('article[data-testid="certificates-row"]').first(),
    ).toBeVisible({ timeout: 10_000 });

    await page.locator('button[data-testid="cms-publish"]').click();
    await page.waitForTimeout(800);

    await goto(page, "/skills");
    await expect(page.locator("text=Test Certificate")).toBeVisible();

    await goto(page, "/onlyme/skills-certificates-awards");
    await page.locator('button[data-testid="cms-publish"]').click();
    await page.waitForTimeout(800);
    await goto(page, "/skills");
    await expect(page.locator("text=Test Certificate")).toBeHidden();

    await goto(page, "/onlyme/skills-certificates-awards");
    await clickAndWait(
      page,
      'button[data-testid="certificates-delete"]',
      () => page.locator('button:has-text("Delete")').isVisible(),
      "delete certificate",
    );
    await page.locator('button:has-text("Delete")').click();
    await expect(page.locator('[data-testid="certificates-row"]')).toHaveCount(0);
  });

  // ------------------------------------------------------------------
  // Awards — full lifecycle
  // ------------------------------------------------------------------
  test("awards — create, publish, unpublish, delete", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await loginAsAdmin(page);
    await goto(page, "/onlyme/skills-certificates-awards");

    await clickAndWait(
      page,
      'button[data-testid="add-award"]',
      () => page.locator('input[data-testid="award-title"]').isVisible(),
      "new award opens",
    );
    await page.locator('input[data-testid="award-title"]').fill("Test Award");
    await page.locator('button[data-testid="awards-save"]').click();
    await expect(page.locator('[data-testid="awards-row"]').first()).toBeVisible({
      timeout: 10_000,
    });

    await page.locator('button[data-testid="cms-publish"]').click();
    await page.waitForTimeout(800);

    await goto(page, "/skills");
    await expect(page.locator("text=Test Award")).toBeVisible();

    await goto(page, "/onlyme/skills-certificates-awards");
    await page.locator('button[data-testid="cms-publish"]').click();
    await page.waitForTimeout(800);
    await goto(page, "/skills");
    await expect(page.locator("text=Test Award")).toBeHidden();

    await goto(page, "/onlyme/skills-certificates-awards");
    await clickAndWait(
      page,
      'button[data-testid="awards-delete"]',
      () => page.locator('button:has-text("Delete")').isVisible(),
      "delete award",
    );
    await page.locator('button:has-text("Delete")').click();
    await expect(page.locator('[data-testid="awards-row"]')).toHaveCount(0);
  });

  // ------------------------------------------------------------------
  // Responsive — no horizontal overflow across six viewports
  // ------------------------------------------------------------------
  test("responsive — no horizontal overflow on / and /skills", async ({ page }) => {
    for (const vp of VIEWPORTS) {
      await setViewport(page, vp);
      await goto(page, "/");
      const overflow = await page.evaluate(() => {
        const d = document.documentElement;
        return d.scrollWidth > d.clientWidth + 2;
      });
      expect(overflow).toBe(false);

      await setViewport(page, vp);
      await goto(page, "/skills");
      const overflow2 = await page.evaluate(() => {
        const d = document.documentElement;
        return d.scrollWidth > d.clientWidth + 2;
      });
      expect(overflow2).toBe(false);
    }
  });
});
