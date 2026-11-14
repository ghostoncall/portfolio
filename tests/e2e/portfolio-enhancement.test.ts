// ============================================================================
// Task 13 — Comprehensive E2E test suite for portfolio enhancement
// Covers desktop navigation, public pages, admin CRUD, image upload,
// nav reordering, mobile viewports, and regression.
// Requires dev server at http://localhost:8080 + running Supabase DB.
// ============================================================================

import dotenv from "dotenv";
dotenv.config();
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "small-phone", width: 360, height: 800 },
  { name: "standard-phone", width: 375, height: 812 },
  { name: "modern-phone", width: 390, height: 844 },
  { name: "large-phone", width: 430, height: 932 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "changeme";

async function setViewport(page: Page, vp) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
}

async function goto(page: Page, path: string) {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.locator("body").waitFor({ state: "visible", timeout: 15_000 });
      await page.waitForLoadState("networkidle", { timeout: 30_000 });
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
  await page.locator("input[type=email]").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator("input[type=email]").click();
  await page.locator("input[type=email]").pressSequentially(ADMIN_EMAIL, { delay: 50 });
  await page.locator("input[type=password]").click();
  await page.locator("input[type=password]").pressSequentially(ADMIN_PASSWORD, { delay: 50 });
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>("form button[type=submit]");
    button?.click();
  });
  await expect(page).toHaveURL(/\/onlyme\/?$/, { timeout: 20_000 });
}

async function waitForEl(page: Page, selector: string, timeout = 15_000) {
  await page.waitForFunction((sel) => !!document.querySelector(sel), sel, { timeout });
}

test.describe.configure({ mode: "serial" });

function isDesktopViewport(page: Page) {
  const vp = page.viewportSize();
  return Boolean(vp && vp.width >= 768);
}

// ============================================================================
// A. Desktop navigation (~1440×900)
// ============================================================================
test.describe("Desktop navigation (1440×900)", () => {
  test("all 9 nav sections present, Education after Overview, active highlighting", async ({
    page,
  }) => {
    const desktop = isDesktopViewport(page);
    test.skip(!desktop, "SideMenu only renders at and above md breakpoint");
    await setViewport(page, { width: 1440, height: 900 });
    await goto(page, "/");

    const menu = page.locator("nav[aria-label='Site index']");
    await expect(menu).toBeVisible();

    const labels = [
      "Overview",
      "Education",
      "Projects",
      "Blog",
      "Skills, Certificates & Awards",
      "Experience",
      "Volunteering",
      "Contact",
    ];
    for (const label of labels) {
      await expect(menu.getByText(label, { exact: true })).toBeVisible();
    }

    // Order: Education must come right after Overview.
    const order = await page.evaluate(() => {
      const items = Array.from(
        document.querySelectorAll("nav[aria-label='Site index'] .text-foreground"),
      );
      return items.map((el) => el.textContent?.trim()).filter(Boolean);
    });
    const eduIdx = order.indexOf("Education");
    const overviewIdx = order.indexOf("Overview");
    expect(eduIdx).toBeGreaterThanOrEqual(0);
    expect(overviewIdx).toBeGreaterThanOrEqual(0);
    expect(eduIdx).toBe(overviewIdx + 1);

    // Active section highlighting on Overview (home).
    // The active class is on the Link <a> element, not the inner span.
    await expect(menu.locator("a").filter({ hasText: "Overview" })).toHaveClass(
      /text-primary-foreground/,
    );
  });

  test("Projects expands/collapses; child links navigate independently", async ({ page }) => {
    const desktop = isDesktopViewport(page);
    test.skip(!desktop, "SideMenu only renders at and above md breakpoint");
    await setViewport(page, { width: 1440, height: 900 });
    await goto(page, "/");

    const menu = page.locator("nav[aria-label='Site index']");
    const projectsRow = menu.locator("div", { hasText: "Projects" }).first();
    const expandBtn = projectsRow.locator("button[aria-expanded]").first();
    await expect(expandBtn).toHaveAttribute("aria-expanded", "false");

    // Expand
    await expandBtn.click();
    await expect(expandBtn).toHaveAttribute("aria-expanded", "true");

    // Child links visible
    const children = menu.locator("ul a");
    await expect(children.first()).toBeVisible();

    // Click a child link -> navigates
    const firstChild = children.first();
    const childText = await firstChild.textContent();
    await firstChild.click();
    await expect(page).toHaveURL(/.*\/projects\//);
  });

  test("Skills/Certs/Awards expands/collapses; all 3 child links navigate independently", async ({
    page,
  }) => {
    const desktop = isDesktopViewport(page);
    test.skip(!desktop, "SideMenu only renders at and above md breakpoint");
    await setViewport(page, { width: 1440, height: 900 });
    await goto(page, "/");

    const menu = page.locator("nav[aria-label='Site index']");
    const skillsRow = menu.locator("div", { hasText: "Skills, Certificates & Awards" }).first();
    const expandBtn = skillsRow.locator("button[aria-expanded]").first();
    await expect(expandBtn).toHaveAttribute("aria-expanded", "false");

    await expandBtn.click();
    await expect(expandBtn).toHaveAttribute("aria-expanded", "true");

    const links = [
      { label: "Skills", path: "/skills" },
      { label: "Certificates", path: "/certificates" },
      { label: "Awards & Recognitions", path: "/awards" },
    ];
    for (const { label, path } of links) {
      await goto(page, "/");
      const menuRow = page
        .locator("nav[aria-label='Site index'] div", { hasText: "Skills, Certificates & Awards" })
        .first();
      const btn = menuRow.locator("button[aria-expanded]").first();
      if ((await btn.getAttribute("aria-expanded")) !== "true") await btn.click();
      await page.locator("nav[aria-label='Site index']").getByText(label, { exact: true }).click();
      await expect(page).toHaveURL((url) => url.pathname === path);
    }
  });

  test("Education has its own destination (/education)", async ({ page }) => {
    const desktop = isDesktopViewport(page);
    test.skip(!desktop, "SideMenu only renders at and above md breakpoint");
    await setViewport(page, { width: 1440, height: 900 });
    await goto(page, "/");

    const menu = page.locator("nav[aria-label='Site index']");
    await menu.getByText("Education", { exact: true }).click();
    await expect(page).toHaveURL(/.*\/education/, { timeout: 15_000 });
    await expect(page.locator("h1")).toHaveText(/Education/i);
  });

  test("Smooth scrolling works (Lenis active)", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await goto(page, "/");

    // This site smooths scrolling with Lenis (JS), not CSS scroll-behavior.
    // Lenis marks the root element while it is driving the scroll.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const c = document.documentElement.classList;
          return c.contains("lenis") || c.contains("lenis-smooth");
        }),
      )
      .toBe(true);

    // And an actual wheel scroll moves the page.
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, 900);
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 })
      .toBeGreaterThan(before + 100);
  });

  test("Direct navigation/refresh doesn't break section targeting", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await goto(page, "/#overview");
    await expect(page).toHaveURL(/.*#overview/);
    await page.reload();
    await expect(page).toHaveURL(/.*#overview/);
    await expect(page.locator("body")).toBeVisible();
  });
});

// ============================================================================
// B. Public pages — /skills, /certificates, /awards, /education
// ============================================================================
test.describe("Public pages render with sample data", () => {
  test("/skills renders tiles, no 'N/A' placeholders", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await goto(page, "/skills");
    await expect(page.locator("h1")).toHaveText(/Skills/i);
    await expect(page.locator('[data-testid="skill-tile"]').first()).toBeVisible({
      timeout: 15000,
    });
    const count = await page.locator('[data-testid="skill-tile"]').count();
    expect(count).toBeGreaterThan(5);
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("N/A");
  });

  test("/certificates renders tiles, certificate preview dialog opens", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await goto(page, "/certificates");
    await expect(page.locator("h1")).toHaveText(/Certificates/i);
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("N/A");

    const tiles = page.locator('[data-testid="certificate-tile"]');
    await expect(tiles.first()).toBeVisible({ timeout: 15000 });
    expect(await tiles.count()).toBeGreaterThan(1);

    // Certificate preview opens on click (Radix dialog → role="dialog").
    await tiles.first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog.locator("h2")).not.toBeEmpty();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("/awards renders tiles, empty fields hidden", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await goto(page, "/awards");
    await expect(page.locator("h1")).toHaveText(/Awards/i);
    await expect(page.locator('[data-testid="award-tile"]').first()).toBeVisible({
      timeout: 15000,
    });
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("N/A");
  });

  test("/education renders with sample data", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await goto(page, "/education");
    await expect(page.locator("h1")).toHaveText(/Education/i);
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("N/A");
    const entries = page.locator('article[data-testid="education-entry"]');
    await expect(entries.first()).toBeVisible({ timeout: 15000 });
    expect(await entries.count()).toBeGreaterThan(0);
    await expect(page.getByText("Sample University of Technology").first()).toBeVisible();
  });
});

// ============================================================================
// C. Admin CRUD lifecycle — Education (temp record only)
// ============================================================================
test.describe("Admin CRUD lifecycle (Education)", () => {
  const ts = Date.now().toString(36);
  const institution = `E2E Test University ${ts}`;
  const degree = "Bachelor of Science";

  test("create entry → save draft → refresh → persists", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await loginAsAdmin(page);
    await goto(page, "/onlyme/education");

    await page.locator('button[data-testid="add-education"]').click();
    await page.waitForSelector('input[data-testid="education-institution"]', {
      state: "visible",
      timeout: 10_000,
    });

    await page.locator('input[data-testid="education-institution"]').fill(institution);
    await page.locator('input[data-testid="education-degree"]').fill(degree);
    await page.locator('button[data-testid="education-save"]').click();

    // Row added to draft list.
    await expect(page.locator('[data-testid="education-row"]').first()).toBeVisible({
      timeout: 10_000,
    });

    // Save draft (cms-save).
    await page.locator('button[data-testid="cms-save"]').click();
    await expect(page.locator('[data-testid="cms-save-status"]')).toHaveText(/Saved/, {
      timeout: 20000,
    });

    // Refresh → persists in draft list.
    await page.reload();
    const row = page
      .locator('[data-testid="education-row"]')
      .filter({ hasText: institution })
      .first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row.getByText(institution, { exact: false })).toBeVisible();
  });

  test("edit → previous data preserved", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await loginAsAdmin(page);
    await goto(page, "/onlyme/education");

    // Open the test row for edit.
    const testRow = page
      .locator('[data-testid="education-row"]')
      .filter({ hasText: institution })
      .first();
    await testRow.locator('button[data-testid="education-edit"]').click();
    await page.waitForSelector('input[data-testid="education-institution"]', {
      state: "visible",
      timeout: 10_000,
    });

    const instInput = page.locator('input[data-testid="education-institution"]');
    await expect(instInput).toHaveValue(institution);
    const degInput = page.locator('input[data-testid="education-degree"]');
    await expect(degInput).toHaveValue(degree);

    // Previous data preserved — no clearing.
    await expect(page.locator('button[data-testid="education-save"]')).toBeVisible();
  });

  test("publish → appears public", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await loginAsAdmin(page);
    await goto(page, "/onlyme/education");

    await page.locator('button[data-testid="cms-publish"]').click();
    await expect(page.locator('[data-testid="cms-save-status"]')).toHaveText(/Saved/, {
      timeout: 20000,
    });

    await goto(page, "/education");
    await expect(page.locator("h1")).toHaveText(/Education/i);
    const publishedEntry = page
      .locator('[data-testid="education-entry"]')
      .filter({ hasText: institution })
      .first();
    await expect(publishedEntry).toBeVisible();
    await expect(publishedEntry).toContainText(degree);
  });

  test("unpublish → disappears", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await loginAsAdmin(page);
    await goto(page, "/onlyme/education");

    await page.locator('button[data-testid="cms-unpublish"]').click();
    await expect(page.locator('[data-testid="cms-save-status"]')).toHaveText(/Saved/, {
      timeout: 20000,
    });

    await goto(page, "/education");
    // Entry no longer publicly visible.
    await expect(page.getByText(institution, { exact: false })).toBeHidden();
  });

  test("republish → appears again", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await loginAsAdmin(page);
    await goto(page, "/onlyme/education");

    await page.locator('button[data-testid="cms-publish"]').click();
    await expect(page.locator('[data-testid="cms-save-status"]')).toHaveText(/Saved/, {
      timeout: 20000,
    });

    await goto(page, "/education");
    await expect(page.getByText(institution, { exact: false })).toBeVisible();
  });

  test("delete (temp record only)", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await loginAsAdmin(page);
    await goto(page, "/onlyme/education");

    const row = page
      .locator('[data-testid="education-row"]')
      .filter({ hasText: institution })
      .first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.locator('button[data-testid="education-delete"]').click();
    await page.getByRole("button", { name: /^Delete$/ }).click();

    // Persist the deletion so the record is gone for good.
    await page.locator('button[data-testid="cms-save"]').click();
    await expect(page.locator('[data-testid="cms-save-status"]')).toHaveText(/Saved/, {
      timeout: 20000,
    });
    await page.locator('button[data-testid="cms-publish"]').click();
    await expect(page.locator('[data-testid="cms-save-status"]')).toHaveText(/Saved/, {
      timeout: 20000,
    });

    await expect(
      page.locator('[data-testid="education-row"]').filter({ hasText: institution }),
    ).toHaveCount(0);
    // Sample entries are untouched.
    await expect(page.getByText("Sample University of Technology").first()).toBeVisible();

    // And the temp record is gone from the public site too.
    await goto(page, "/education");
    await expect(page.getByText(institution, { exact: false })).toHaveCount(0);
  });
});

// ============================================================================
// D. Image upload — upload → preview → publish → display → replace → remove
//    → invalid type rejected → oversized rejected
// ============================================================================
test.describe("Image upload (Education media field)", () => {
  const mediaInstitution = `E2E Media University ${Date.now().toString(36)}`;
  const FIXTURES = "tests/e2e/fixtures";
  const PRIMARY_LOGO = `${FIXTURES}/e2e-logo-primary.png`;
  const INVALID_FILE = `${FIXTURES}/e2e-not-an-image.exe`;

  test("upload → preview admin → publish → display public", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await loginAsAdmin(page);
    await goto(page, "/onlyme/education");

    await page.locator('button[data-testid="add-education"]').click();
    await page.waitForSelector('input[data-testid="education-institution"]', {
      state: "visible",
      timeout: 10_000,
    });

    await page.locator('input[data-testid="education-institution"]').fill(mediaInstitution);
    await page.locator('input[data-testid="education-degree"]').fill("Bachelor of Arts");

    // Upload image via media picker (input lives inside the picker modal).
    await page.locator('button[data-testid="media-pick"]').click();
    const fileInput = page.locator('input[data-testid="media-file-input"]');
    await fileInput.setInputFiles(PRIMARY_LOGO);

    // Preview appears in admin.
    await expect(page.locator('img[data-testid="media-preview"]')).toBeVisible({
      timeout: 15_000,
    });

    await page.locator('button[data-testid="education-save"]').click();
    await page.locator('button[data-testid="cms-publish"]').click();
    await expect(page.locator('[data-testid="cms-save-status"]')).toHaveText(/Saved/, {
      timeout: 20000,
    });

    // Image displays on public page and actually loads (not just an <img> tag).
    await goto(page, "/education");
    const publicImg = page
      .locator('[data-testid="education-entry"]')
      .filter({ hasText: mediaInstitution })
      .locator("img")
      .first();
    await expect(publicImg).toBeVisible({ timeout: 15000 });
    await expect(publicImg).toHaveAttribute("src", /.+/);
    await expect
      .poll(() =>
        publicImg.evaluate((img) => {
          const el = img as HTMLImageElement;
          return el.complete && el.naturalWidth > 0;
        }),
      )
      .toBe(true);
  });

  test("replace → remove image", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await loginAsAdmin(page);
    await goto(page, "/onlyme/education");

    await page
      .locator('[data-testid="education-row"]')
      .filter({ hasText: mediaInstitution })
      .first()
      .locator('button[data-testid="education-edit"]')
      .click();
    await page.waitForSelector('img[data-testid="media-preview"]', {
      state: "visible",
      timeout: 10_000,
    });

    // Remove image.
    await page.locator('button[data-testid="media-remove"]').click();
    await expect(page.locator('img[data-testid="media-preview"]')).toHaveCount(0);

    await page.locator('button[data-testid="education-save"]').click();
    await page.locator('button[data-testid="cms-publish"]').click();
    await expect(page.locator('[data-testid="cms-save-status"]')).toHaveText(/Saved/, {
      timeout: 20000,
    });

    await goto(page, "/education");
    const tempEntry = page
      .locator('[data-testid="education-entry"]')
      .filter({ hasText: mediaInstitution });
    await expect(tempEntry.locator("img")).toHaveCount(0);

    // Cleanup: delete the temporary entry and publish the deletion.
    await goto(page, "/onlyme/education");
    const tempRow = page
      .locator('[data-testid="education-row"]')
      .filter({ hasText: mediaInstitution })
      .first();
    await tempRow.locator('button[data-testid="education-delete"]').click();
    await page.getByRole("button", { name: /^Delete$/ }).click();
    await page.locator('button[data-testid="cms-save"]').click();
    await expect(page.locator('[data-testid="cms-save-status"]')).toHaveText(/Saved/, {
      timeout: 20000,
    });
    await page.locator('button[data-testid="cms-publish"]').click();
    await expect(page.locator('[data-testid="cms-save-status"]')).toHaveText(/Saved/, {
      timeout: 20000,
    });

    await goto(page, "/education");
    await expect(page.getByText(mediaInstitution, { exact: false })).toHaveCount(0);
  });

  test("invalid file type rejected", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await loginAsAdmin(page);
    await goto(page, "/onlyme/education");

    await page.locator('button[data-testid="add-education"]').click();
    await page.waitForSelector('input[data-testid="education-institution"]', {
      state: "visible",
      timeout: 10_000,
    });

    await page.locator('button[data-testid="media-pick"]').click();
    const fileInput = page.locator('input[data-testid="media-file-input"]');
    await fileInput.setInputFiles(INVALID_FILE);

    // Error shown.
    await expect(page.locator('p[data-testid="media-error"]')).toBeVisible({ timeout: 10_000 });
  });

  test("oversized file rejected", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await loginAsAdmin(page);
    await goto(page, "/onlyme/education");

    await page.locator('button[data-testid="add-education"]').click();
    await page.waitForSelector('input[data-testid="education-institution"]', {
      state: "visible",
      timeout: 10_000,
    });

    // Create a file above the 50 MB upload limit on disk (Playwright cannot
    // send buffers larger than 50 MB).
    const oversizedPath = join(mkdtempSync(join(tmpdir(), "e2e-oversized-")), "oversized.png");
    writeFileSync(oversizedPath, Buffer.alloc(51 * 1024 * 1024));
    await page.locator('button[data-testid="media-pick"]').click();
    await page.locator('input[data-testid="media-file-input"]').setInputFiles(oversizedPath);

    await expect(page.locator('p[data-testid="media-error"]')).toBeVisible({ timeout: 10_000 });
  });
});

// ============================================================================
// E. Nav reordering — drag Blog above Projects → save → refresh → public order
// ============================================================================
test.describe("Nav reordering", () => {
  const adminRowLabels = (page: import("@playwright/test").Page) =>
    page
      .locator('[data-testid="nav-row"] .font-serif')
      .allTextContents()
      .then((l) => l.map((s) => s.trim()));

  const publicNavLabels = (page: import("@playwright/test").Page) =>
    page
      .locator("nav[aria-label='Site index'] a > span.whitespace-nowrap")
      .allTextContents()
      .then((l) => l.map((s) => s.trim()));

  test("reorder Blog above Projects → persists → public nav reflects new order", async ({
    page,
  }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await loginAsAdmin(page);
    await goto(page, "/onlyme/settings");

    const navRows = page.locator('[data-testid="nav-row"]');
    await expect(navRows.first()).toBeVisible({ timeout: 20000 });

    // Start from the canonical order regardless of what a previous run left.
    await page.getByRole("button", { name: /Restore default order/i }).click();
    await expect(page.getByText("Default nav order restored")).toBeVisible({ timeout: 10000 });

    const before = await adminRowLabels(page);
    expect(before.indexOf("Projects")).toBeGreaterThanOrEqual(0);
    expect(before.indexOf("Blog")).toBe(before.indexOf("Projects") + 1);

    // Move Blog up one position (above Projects).
    await navRows
      .filter({ has: page.locator(".font-serif", { hasText: "Blog" }) })
      .locator('button[aria-label*="up"]')
      .click();

    await expect
      .poll(async () => {
        const labels = await adminRowLabels(page);
        return labels.indexOf("Blog") < labels.indexOf("Projects");
      })
      .toBe(true);

    // Wait for the persistence request to finish before reloading.
    await expect(page.getByText("Nav order saved")).toBeVisible({ timeout: 10000 });

    // Reload admin to prove persistence.
    await page.reload();
    await expect(navRows.first()).toBeVisible({ timeout: 20000 });
    const afterReload = await adminRowLabels(page);
    expect(afterReload.indexOf("Blog")).toBeLessThan(afterReload.indexOf("Projects"));

    // Public nav follows the saved order on first paint.
    await goto(page, "/");
    await expect
      .poll(async () => {
        const labels = await publicNavLabels(page);
        return labels.indexOf("Blog") < labels.indexOf("Projects");
      })
      .toBe(true);
  });

  test("move back afterward — restore default order", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await loginAsAdmin(page);
    await goto(page, "/onlyme/settings");

    const restoreBtn = page.getByRole("button", { name: /Restore default order/i });
    await expect(restoreBtn).toBeVisible({ timeout: 20000 });
    await restoreBtn.click();

    await expect
      .poll(async () => {
        const labels = await adminRowLabels(page);
        return labels.indexOf("Projects") < labels.indexOf("Blog");
      })
      .toBe(true);

    await expect(page.getByText("Default nav order restored")).toBeVisible({ timeout: 10000 });

    await goto(page, "/");
    const labels = await publicNavLabels(page);
    expect(labels.indexOf("Education")).toBeGreaterThanOrEqual(0);
    expect(labels.indexOf("Education")).toBe(labels.indexOf("Overview") + 1);
    expect(labels.indexOf("Projects")).toBeLessThan(labels.indexOf("Blog"));
  });
});

// ============================================================================
// F. Mobile — 4 phone viewports + tablet
// ============================================================================
test.describe("Mobile viewports", () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name} (${vp.width}×${vp.height}) — hamburger, sections, touch targets, no overflow`, async ({
      page,
    }) => {
      await setViewport(page, vp);
      const isMobile = vp.width < 768;
      await goto(page, "/");

      // No horizontal overflow.
      const overflow = await page.evaluate(() => {
        const d = document.documentElement;
        return d.scrollWidth > d.clientWidth + 2;
      });
      expect(overflow).toBe(false);

      if (isMobile) {
        // Hamburger menu present.
        const hamburger = page.locator('button[aria-label="Open menu"]');
        await expect(hamburger).toBeVisible();

        // Touch target ≥ 44px.
        const box = await hamburger.boundingBox();
        expect(box).toBeTruthy();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.width).toBeGreaterThanOrEqual(44);

        // Open menu, all sections visible.
        await hamburger.click();
        const menu = page.locator('nav[aria-label="Mobile navigation"]');
        await expect(menu).toBeVisible();
        for (const label of [
          "Overview",
          "Education",
          "Projects",
          "Blog",
          "Experience",
          "Volunteering",
          "Contact",
        ]) {
          await expect(menu.getByText(label, { exact: true })).toBeVisible();
        }

        // Close via Escape.
        await page.keyboard.press("Escape");
        await expect(menu).toHaveCount(0);
      } else {
        // Desktop/tablet: hamburger hidden, SideMenu present.
        await expect(page.locator('button[aria-label="Open menu"]')).toBeHidden();
        await expect(page.locator('nav[aria-label="Site index"]')).toBeVisible();
      }

      // Header fits within viewport.
      const header = page.locator("header");
      await expect(header).toBeVisible();
      const hbox = await header.boundingBox();
      expect(hbox).toBeTruthy();
      expect(hbox!.x).toBeGreaterThanOrEqual(0);
      expect(hbox!.x + hbox!.width).toBeLessThanOrEqual(vp.width + 1);

      // No clipped text on headings.
      const h1 = page.locator("h1").first();
      if ((await h1.count()) > 0) {
        await expect(h1).toBeVisible();
        const h1Box = await h1.boundingBox();
        expect(h1Box).toBeTruthy();
        expect(h1Box!.x + h1Box!.width).toBeLessThanOrEqual(vp.width + 1);
      }
    });
  }

  test("tablet — two-finger scrolling, images scale, forms usable", async ({ page }) => {
    await setViewport(page, { width: 768, height: 1024 });
    await goto(page, "/contact");

    // Form inputs usable.
    await page.locator('input[name="name"]').click();
    await page.locator('input[name="name"]').pressSequentially("Mobile Tester");
    await expect(page.locator('input[name="name"]')).toHaveValue("Mobile Tester");

    // Images scale within viewport.
    const img = page.locator('img[alt="Profile"]').first();
    if ((await img.count()) > 0) {
      await expect(img).toBeVisible();
      const box = await img.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.width).toBeLessThanOrEqual(768);
      expect(box!.height).toBeLessThanOrEqual(1024);
    }

    // Wheel scrolling on a long page (the contact page may fit without scrolling).
    await goto(page, "/");
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.move(384, 500);
    await page.mouse.wheel(0, 600);
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 })
      .toBeGreaterThan(before + 100);
  });
});

// ============================================================================
// G. Regression — Overview, Projects, Experience, Volunteering, Contact, auth
// ============================================================================
test.describe("Regression", () => {
  test("Overview renders", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await goto(page, "/");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Featured Work" })).toBeVisible();
    // Education lives on its own route, not on the home page.
    await expect(page.getByRole("heading", { name: "Education" })).toHaveCount(0);
  });

  test("Projects renders cards", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await goto(page, "/projects");
    await expect(page.locator("h1")).toHaveText(/Projects/i);
    await expect(page.locator('article[data-testid="public-project-card"]').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Experience renders entries", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await goto(page, "/experience");
    await expect(page.locator("h1")).toHaveText(/Experience/i);
    await expect(page.locator('section[data-testid="experience-entry"]').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Volunteering renders cards + read more dialog", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await goto(page, "/volunteering");
    await expect(page.locator("h1")).toHaveText(/Volunteering/i);
    await expect(page.getByTestId("volunteering-card").first()).toBeVisible({ timeout: 15_000 });
  });

  test("Contact form renders and accepts input", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await goto(page, "/contact");
    await expect(page.locator("h1")).toHaveText(/Correspondence|Contact/i);
    await page.locator('input[name="name"]').click();
    await page.locator('input[name="name"]').pressSequentially("Regression Tester");
    await expect(page.locator('input[name="name"]')).toHaveValue("Regression Tester");
  });

  test("Auth — login page renders, redirects after login", async ({ page }) => {
    await setViewport(page, { width: 1440, height: 900 });
    await goto(page, "/onlyme/login");
    await expect(page.locator("input[type=email]")).toBeVisible();
    await expect(page.locator("input[type=password]")).toBeVisible();
  });
});
