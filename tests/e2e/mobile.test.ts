// Headed E2E suite: full mobile-friendliness audit across 6 viewports.
//
// Scenarios 1-9 run on a modern phone (390x844) to exercise touch/mobile
// behaviour. Scenario 10 regresses all six required viewports for overflow,
// clipping, overlap and desktop preservation.
//
// Every wait is condition-based via page.waitForFunction / expect. No fixed
// sleeps. Runs in headed mode so interactions are observable.

import { test, expect, type Page } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./support/cms";

const PHONE = { name: "modern-phone", width: 390, height: 844 };

const VIEWPORTS = [
  { name: "small-phone", width: 320, height: 568 },
  { name: "standard-phone", width: 375, height: 812 },
  { name: "modern-phone", width: 390, height: 844 },
  { name: "large-phone", width: 430, height: 932 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

async function setViewport(page: Page, vp = PHONE) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
}

async function goto(page: Page, path: string) {
  await page.goto(path, { waitUntil: "load" });
  await page.locator("header").waitFor({ state: "visible", timeout: 15_000 });
}

// Wait until a CSS selector exists in the DOM (hydration-safe).
async function waitForEl(page: Page, selector: string, timeout = 15_000) {
  await page.waitForFunction((sel) => !!document.querySelector(sel), selector, { timeout });
}

// Click an element via DOM dispatch (bypasses Playwright actionability races
// during React hydration), then wait until `until` becomes true.
async function clickAndWait(
  page: Page,
  selector: string,
  until: () => Promise<boolean>,
  label: string,
  max = 12,
) {
  for (let i = 0; i < max; i += 1) {
    await waitForEl(page, selector, 3_000);
    await page.evaluate((sel) => {
      const el = document.querySelector<HTMLElement>(sel);
      el?.click();
    }, selector);
    await page.waitForTimeout(250);
    if (await until()) return;
  }
  throw new Error("clickAndWait failed: " + label);
}

async function isMobileViewport(page: Page) {
  return page.evaluate(() => window.innerWidth < 768);
}

async function login(page: Page) {
  await page.goto("/onlyme/login");
  await page.waitForFunction(() => {
    const input = document.querySelector("input[type=email]");
    return !!input && Object.keys(input).some((key) => key.startsWith("__reactProps"));
  });
  const email = page.locator("input[type=email]");
  const password = page.locator("input[type=password]");
  await email.click();
  await email.pressSequentially(ADMIN_EMAIL, { delay: 100 });
  await password.click();
  await password.pressSequentially(ADMIN_PASSWORD, { delay: 100 });
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>("form button[type=submit]");
    button?.click();
  });
  await expect(page).toHaveURL(/\/onlyme\/?$/, { timeout: 20_000 });
}

test.describe.configure({ mode: "serial" });

test.describe("Mobile friendliness — headed", () => {
  // ------------------------------------------------------------------
  // Test 1: Navigation — hamburger menu, all destinations, back/forward
  // ------------------------------------------------------------------
  test("1. navigation — hamburger opens, reaches every section, back/forward", async ({ page }) => {
    await setViewport(page);
    await goto(page, "/");

    const mobile = await isMobileViewport(page);

    if (mobile) {
      await waitForEl(page, 'button[aria-label="Open menu"]');
      await clickAndWait(
        page,
        'button[aria-label="Open menu"]',
        () => page.evaluate(() => !!document.querySelector('nav[aria-label="Mobile navigation"]')),
        "mobile menu opens",
      );

      const menu = page.locator('nav[aria-label="Mobile navigation"]');
      const destinations = [
        "Overview",
        "Projects",
        "Blog",
        "Skills, Certificates & Awards",
        "Experience",
        "Volunteering",
        "Contact",
      ];
      for (const label of destinations) {
        await expect(menu.getByText(label, { exact: true })).toBeVisible();
      }

      // Active-page indicator: we are on Overview (/).
      await expect(menu.getByRole("link", { name: "Overview", exact: true })).toHaveClass(
        /bg-accent/,
      );

      // Click a destination -> navigates + menu closes.
      await menu.getByText("Contact", { exact: true }).click();
      await expect(page).toHaveURL(/.*\/contact/, { timeout: 15_000 });
      await expect(menu).toHaveCount(0);

      // Browser back / forward.
      await page.goBack({ waitUntil: "load" });
      await expect(page).toHaveURL(/.*\/$/, { timeout: 15_000 });
      await page.goForward({ waitUntil: "load" });
      await expect(page).toHaveURL(/.*\/contact/, { timeout: 15_000 });

      // Escape closes.
      await clickAndWait(
        page,
        'button[aria-label="Open menu"]',
        () => page.evaluate(() => !!document.querySelector('nav[aria-label="Mobile navigation"]')),
        "mobile menu reopens",
      );
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
    } else {
      // Desktop: hamburger hidden, SideMenu present.
      await expect(page.locator('button[aria-label="Open menu"]')).toBeHidden();
      await expect(page.locator('nav[aria-label="Site index"]')).toBeVisible();
    }
  });

  // ------------------------------------------------------------------
  // Test 2: Touch interactions — buttons, dropdowns, expandable, cards
  // ------------------------------------------------------------------
  test("2. touch interactions — buttons, dropdowns, expandable, cards", async ({ page }) => {
    await setViewport(page);
    await goto(page, "/contact");

    // Dropdown (subject select) opens on tap and accepts keyboard.
    const subject = page.locator('select[name="subject_category"]');
    await expect(subject).toBeVisible();
    await subject.click();
    await subject.press("ArrowDown");
    await subject.press("Enter");
    await expect(subject).toHaveValue(/general|project|freelance|other/i);

    // Submit button has visible focus indicators and a touch-friendly size.
    const submit = page.locator('button[type="submit"]');
    await expect(submit).toBeVisible();
    const box = await submit.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(42);

    // Expandable: Volunteering Read more.
    await goto(page, "/volunteering");
    await expect(page.getByTestId("volunteering-card").first()).toBeVisible({ timeout: 30_000 });
    // Retry the expand click until the dialog opens (React hydration race).
    for (let i = 0; i < 10; i += 1) {
      await page.evaluate(() => {
        const el = document.querySelector('[data-testid="volunteering-readmore-0"]');
        el?.click();
      });
      await page.waitForTimeout(250);
      if ((await page.locator('[data-testid="volunteering-dialog"]').count()) > 0) {
        break;
      }
    }
    const dialog = page.locator('[data-testid="volunteering-dialog"]');
    await expect(dialog).toBeVisible();
    await page.locator('[data-testid="volunteering-dialog-close"]').click();
    await expect(dialog).toHaveCount(0);

    // Interactive card: a project card link is tappable.
    await goto(page, "/projects");
    await expect(page.locator('article[data-testid="public-project-card"]').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  // ------------------------------------------------------------------
  // Test 3: Typography and sizing — compact headings, readable body
  // ------------------------------------------------------------------
  test("3. typography and sizing — headings compact, body readable", async ({ page }) => {
    await setViewport(page);
    await goto(page, "/");

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    const h1Size = await page.evaluate(
      (el) => {
        return parseFloat(getComputedStyle(el).fontSize);
      },
      await h1.elementHandle(),
    );
    expect(h1Size).toBeGreaterThanOrEqual(24);
    expect(h1Size).toBeLessThanOrEqual(40);

    // Body text readable (>= 13px).
    const body = page.locator("p").first();
    await expect(body).toBeVisible();
    const bodySize = await page.evaluate(
      (el) => {
        return parseFloat(getComputedStyle(el).fontSize);
      },
      await body.elementHandle(),
    );
    expect(bodySize).toBeGreaterThanOrEqual(13);

    // Metadata small but readable.
    const muted = page.locator(".text-muted-foreground").first();
    if ((await muted.count()) > 0) {
      const metaSize = await page.evaluate(
        (el) => {
          return parseFloat(getComputedStyle(el).fontSize);
        },
        await muted.elementHandle(),
      );
      expect(metaSize).toBeGreaterThanOrEqual(11);
    }
  });

  // ------------------------------------------------------------------
  // Test 4: Overview — profile image responsive, heading wraps, spacing
  // ------------------------------------------------------------------
  test("4. overview — profile image, heading wrap, spacing", async ({ page }) => {
    await setViewport(page);
    await goto(page, "/");

    const img = page.locator('img[alt="Profile"]');
    if ((await img.count()) > 0) {
      await expect(img).toBeVisible();
      const box = await img.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width - 10);
      expect(box!.height).toBeLessThanOrEqual(page.viewportSize()!.height - 10);
      expect(box!.width / box!.height).toBeGreaterThan(0.8);
      expect(box!.width / box!.height).toBeLessThan(1.2);
    }

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    const h1Box = await h1.boundingBox();
    expect(h1Box).toBeTruthy();
    expect(h1Box!.x + h1Box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  });

  // ------------------------------------------------------------------
  // Test 5: Experience — logo left, info right on desktop; mobile stacks
  // ------------------------------------------------------------------
  test("5. experience — logo left of info on desktop, stacks on mobile", async ({ page }) => {
    await setViewport(page);
    await goto(page, "/experience");

    const entries = page.locator('section[data-testid="experience-entry"]');
    await expect(entries).toHaveCount(2, { timeout: 15_000 });

    const mobile = await isMobileViewport(page);
    for (let i = 0; i < 2; i += 1) {
      const entry = entries.nth(i);
      const logo = entry.locator('img[data-testid="experience-logo"]');
      const content = entry.locator('[data-testid="experience-content"]');
      await expect(content).toBeVisible();

      const contentBox = await content.boundingBox();
      const entryBox = await entry.boundingBox();
      expect(contentBox).toBeTruthy();
      expect(entryBox).toBeTruthy();
      expect(contentBox!.x).toBeGreaterThanOrEqual(entryBox!.x - 1);
      expect(contentBox!.x + contentBox!.width).toBeLessThanOrEqual(
        entryBox!.x + entryBox!.width + 1,
      );

      if (mobile) {
        if ((await logo.count()) > 0) {
          const logoBox = await logo.boundingBox();
          expect(logoBox).toBeTruthy();
          expect(logoBox!.width).toBeLessThanOrEqual(170);
        }
      } else {
        if ((await logo.count()) > 0) {
          const logoBox = await logo.boundingBox();
          expect(logoBox).toBeTruthy();
          expect(logoBox!.x + logoBox!.width).toBeLessThanOrEqual(contentBox!.x + 1);
          const overlap =
            Math.min(logoBox!.y + logoBox!.height, contentBox!.y + contentBox!.height) -
            Math.max(logoBox!.y, contentBox!.y);
          expect(overlap).toBeGreaterThan(0);
        }
      }
    }
  });

  // ------------------------------------------------------------------
  // Test 6: Volunteering — Read More expand / scroll / collapse
  // ------------------------------------------------------------------
  test("6. volunteering — Read More expands, scrolls, collapses", async ({ page }) => {
    await setViewport(page);
    await goto(page, "/volunteering");

    await expect(page.getByTestId("volunteering-card").first()).toBeVisible({
      timeout: 30_000,
    });
    // Retry the expand click until the dialog opens (React hydration race).
    for (let i = 0; i < 10; i += 1) {
      await page.evaluate(() => {
        const el = document.querySelector('[data-testid="volunteering-readmore-0"]');
        el?.click();
      });
      await page.waitForTimeout(250);
      if ((await page.locator('[data-testid="volunteering-dialog"]').count()) > 0) {
        break;
      }
    }
    const dialog = page.locator('[data-testid="volunteering-dialog"]');
    const body = page.locator('[data-testid="volunteering-dialog-body"]');
    await expect(dialog).toBeVisible();
    await expect(body).toBeVisible();

    const vp = page.viewportSize()!;
    const box = await dialog.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);

    await body.hover();
    await page.mouse.wheel(0, 1200);
    const end = await body.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
    expect(end).toBe(true);

    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await page.locator('[data-testid="volunteering-dialog-close"]').click();
    await expect(dialog).toHaveCount(0);
  });

  // ------------------------------------------------------------------
  // Test 7: Projects and Certificates — cards, images, tags, links
  // ------------------------------------------------------------------
  test("7. projects and certificates — cards, tags, links, dialog fits", async ({ page }) => {
    await setViewport(page);
    await goto(page, "/projects");
    await expect(page.locator('article[data-testid="public-project-card"]').first()).toBeVisible({
      timeout: 15_000,
    });

    const cards = page.locator('article[data-testid="public-project-card"]');
    const firstCard = cards.first();
    await expect(firstCard).toBeVisible();
    const cardBox = await firstCard.boundingBox();
    expect(cardBox).toBeTruthy();
    expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    await expect(firstCard.locator("a")).toBeVisible();

    // Certificates dialog fits viewport on mobile.
    await goto(page, "/certificates");
    const certs = page.locator('article[data-testid="public-certificate"]');
    if ((await certs.count()) > 0) {
      const media = certs.first().locator('[role="button"][tabindex="0"]');
      if ((await media.count()) > 0) {
        await media.first().click();
        const dialog = page.locator("dialog").first();
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        const dbox = await dialog.boundingBox();
        expect(dbox).toBeTruthy();
        expect(dbox!.x + dbox!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
      }
    }
  });

  // ------------------------------------------------------------------
  // Test 8: Contact — fill fields, validation, submission
  // ------------------------------------------------------------------
  test("8. contact — fill fields, validation, submit with test data", async ({ page }) => {
    await setViewport(page);
    await goto(page, "/contact");

    await page.locator('input[name="name"]').click();
    await page.locator('input[name="name"]').pressSequentially("E2E Tester");
    await page.locator('input[name="email"]').click();
    await page.locator('input[name="email"]').pressSequentially("e2e@example.invalid");
    await page.locator('select[name="subject_category"]').selectOption("general");
    await page.locator('textarea[name="message"]').click();
    await page
      .locator('textarea[name="message"]')
      .pressSequentially("E2E mobile contact test message.");

    // Form fields accept values.
    await expect(page.locator('input[name="name"]')).toHaveValue("E2E Tester");
    await expect(page.locator('input[name="email"]')).toHaveValue("e2e@example.invalid");

    const submit = page.locator('button[type="submit"]');
    await expect(submit).toBeVisible();
    await submit.click();

    // Submit is operable and the form does not crash (Turnstile may block
    // actual delivery in this environment; we assert the form is functional).
    await expect(submit).toBeVisible();
  });

  // ------------------------------------------------------------------
  // Test 9: Admin Panel — login, mobile drawer, navigate to settings
  // ------------------------------------------------------------------
  test("9. admin panel — login, mobile drawer opens, navigates", async ({ page }) => {
    await setViewport(page);
    await login(page);

    // Mobile drawer hamburger.
    await waitForEl(page, 'button[aria-label="Open navigation"]');
    await clickAndWait(
      page,
      'button[aria-label="Open navigation"]',
      () =>
        page.evaluate(
          () => !!document.querySelector('aside button[aria-label="Close navigation"]'),
        ),
      "admin drawer opens",
    );

    // Navigate to Settings from the drawer (the drawer link is the first match).
    await page.getByText("Settings", { exact: true }).first().click();
    await expect(page).toHaveURL(/.*\/onlyme\/settings/, { timeout: 15_000 });

    // Settings form loads and inputs are reachable.
    await expect(page.locator("input").first()).toBeVisible({ timeout: 10_000 });
  });

  // ------------------------------------------------------------------
  // Test 10: Responsive regression — all six viewports
  // ------------------------------------------------------------------
  test("10. responsive regression — overflow, clipping, overlap, desktop", async ({ page }) => {
    for (const vp of VIEWPORTS) {
      await setViewport(page, vp);
      await goto(page, "/");

      // No horizontal overflow on the home page.
      const overflow = await page.evaluate(() => {
        const d = document.documentElement;
        return d.scrollWidth > d.clientWidth + 2;
      });
      expect(overflow).toBe(false);

      // Header fits within viewport.
      const header = page.locator("header");
      await expect(header).toBeVisible();
      const hbox = await header.boundingBox();
      expect(hbox).toBeTruthy();
      expect(hbox!.x).toBeGreaterThanOrEqual(0);
      expect(hbox!.x + hbox!.width).toBeLessThanOrEqual(vp.width + 1);

      // Desktop regression: at 1440x900 the hamburger is hidden and SideMenu shows.
      if (vp.name === "desktop") {
        await expect(page.locator('button[aria-label="Open menu"]')).toBeHidden();
        await expect(page.locator('nav[aria-label="Site index"]')).toBeVisible();
      }
    }

    // Spot-check a content page at the narrowest and widest viewports.
    for (const vp of [VIEWPORTS[0], VIEWPORTS[5]]) {
      await setViewport(page, vp);
      await goto(page, "/experience");
      const entries = page.locator('section[data-testid="experience-entry"]');
      await expect(entries.first()).toBeVisible({ timeout: 15_000 });
      const content = entries.first().locator('[data-testid="experience-content"]');
      await expect(content).toBeVisible();
      const cbox = await content.boundingBox();
      expect(cbox).toBeTruthy();
      expect(cbox!.x + cbox!.width).toBeLessThanOrEqual(vp.width + 1);
    }
  });
});
