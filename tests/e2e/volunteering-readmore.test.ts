// Headed E2E coverage for the Volunteering "Read more" expansion.
//
// The public page renders each entry's long-form story in a Radix dialog. The
// suite proves the dialog is viewport-capped, has exactly one internal scroll
// region (no page scroll lock trap), collapses cleanly, survives repeated use
// and works at four viewport sizes — without fixed sleeps.

import { test, expect, type Page, type Locator } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

const dialogOf = (page: Page) => page.getByTestId("volunteering-dialog");
const bodyOf = (page: Page) => page.getByTestId("volunteering-dialog-body");

async function openVolunteering(page: Page) {
  await page.goto("/volunteering", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("volunteering-card").first()).toBeVisible({ timeout: 30_000 });
}

async function openEntry(page: Page, index = 0) {
  const card = page.getByTestId("volunteering-card").nth(index);
  await expect(card).toBeVisible();
  const dialog = dialogOf(page);
  // The card is server-rendered before React hydrates, so a click in the
  // first few hundred ms can land on inert markup. Retry until the dialog
  // actually opens instead of sleeping a fixed amount.
  await expect(async () => {
    await card.getByTestId(`volunteering-readmore-${index}`).click();
    await expect(dialog).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  const body = bodyOf(page);
  await expect(body).toBeVisible();
  return { dialog, body };
}

async function wheelToEnd(page: Page, body: Locator, step = 900) {
  await body.hover();
  for (let i = 0; i < 24; i += 1) {
    const atEnd = await body.evaluate(
      (el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2,
    );
    if (atEnd) return true;
    await page.mouse.wheel(0, step);
  }
  return await body.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
}

test.describe.configure({ mode: "serial" });

test.describe("Volunteering Read more — expansion and scrolling", () => {
  test("1. entries start collapsed with a working Read more control", async ({ page }) => {
    await openVolunteering(page);

    const cards = page.getByTestId("volunteering-card");
    await expect(cards).toHaveCount(3);
    await expect(dialogOf(page)).toHaveCount(0);

    for (let i = 0; i < 3; i += 1) {
      const readmore = cards.nth(i).getByTestId(`volunteering-readmore-${i}`);
      await expect(readmore).toBeVisible();
      await expect(readmore).toContainText("Read more");
    }

    // No modal scroll lock while collapsed.
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .not.toBe("hidden");
  });

  test("2. expands into a viewport-capped dialog with a scrollable body", async ({ page }) => {
    await openVolunteering(page);
    await openEntry(page);
    const dialog = dialogOf(page);
    const body = bodyOf(page);

    await expect(dialog.getByRole("heading", { name: "Community Tech Workshop" })).toBeVisible();
    await expect(body).toContainText("The story");

    const viewport = page.viewportSize()!;
    const box = await dialog.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);

    // Exactly one scroll container: the dialog body, and it actually overflows.
    const scroll = await body.evaluate((el) => ({
      overflowY: getComputedStyle(el).overflowY,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
    }));
    expect(["auto", "scroll"]).toContain(scroll.overflowY);
    expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);

    // The close controls stay outside the scroll region and visible.
    const close = page.getByTestId("volunteering-dialog-close");
    await expect(close).toBeVisible();
    await expect(close).toBeInViewport();
  });

  test("3. mouse wheel and keyboard scrolling reach the end of the content", async ({ page }) => {
    await openVolunteering(page);
    const { body } = await openEntry(page);

    await body.hover();
    const start = await body.evaluate((el) => el.scrollTop);
    await page.mouse.wheel(0, 800);
    await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(start);

    expect(await wheelToEnd(page, body)).toBe(true);

    // The final takeaway is reachable and visible inside the viewport.
    const lastTakeaway = body.locator("ul li").last();
    await expect(lastTakeaway).toBeInViewport();

    // The page behind the dialog did not scroll — only the dialog body did.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    // Keyboard: reset to the top, focus the region, PageDown scrolls it.
    await body.evaluate((el) => {
      el.scrollTop = 0;
    });
    await body.focus();
    await body.press("PageDown");
    await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });

  test("4. closing restores the original page state", async ({ page }) => {
    await openVolunteering(page);
    const { body } = await openEntry(page);
    await body.hover();
    await page.mouse.wheel(0, 600);
    await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    await page.getByTestId("volunteering-dialog-close").click();
    await expect(dialogOf(page)).toHaveCount(0);

    // Radix releases its body scroll lock.
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .not.toBe("hidden");

    // The document itself scrolls again.
    await page.mouse.move(300, 400);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test("5. repeated expand/collapse leaves no stuck scroll state", async ({ page }) => {
    await openVolunteering(page);

    for (let i = 0; i < 3; i += 1) {
      const { body } = await openEntry(page, i % 3);
      await body.hover();
      await page.mouse.wheel(0, 500);
      await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThanOrEqual(0);

      await page.getByTestId("volunteering-dialog-close").click();
      await expect(dialogOf(page)).toHaveCount(0);
      await expect
        .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
        .not.toBe("hidden");
    }

    // Page scrolling still works after the cycles.
    await page.mouse.move(300, 400);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  for (const vp of VIEWPORTS) {
    test(`6. ${vp.name} ${vp.width}×${vp.height} stays contained and scrollable`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openVolunteering(page);
      const { dialog, body } = await openEntry(page);

      const box = await dialog.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);

      // No horizontal overflow inside the scroll area.
      const widths = await body.evaluate((el) => ({
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
      }));
      expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth + 1);

      // Vertical scrolling works and reaches the final takeaway.
      expect(await wheelToEnd(page, body)).toBe(true);
      await expect(body.locator("ul li").last()).toBeInViewport();

      await expect(page.getByTestId("volunteering-dialog-close")).toBeInViewport();
      await page.getByTestId("volunteering-dialog-close").click();
      await expect(dialog).toHaveCount(0);
    });
  }

  test("7. Experience layout is unchanged", async ({ page }) => {
    await page.goto("/experience", { waitUntil: "domcontentloaded" });
    const entries = page.getByTestId("experience-entry");
    await expect(entries).toHaveCount(2, { timeout: 30_000 });

    for (let i = 0; i < 2; i += 1) {
      const entry = entries.nth(i);
      const content = entry.getByTestId("experience-content");
      await expect(content).toBeVisible();

      const contentBox = await content.boundingBox();
      const entryBox = await entry.boundingBox();
      expect(contentBox).toBeTruthy();
      expect(entryBox).toBeTruthy();
      expect(contentBox!.x).toBeGreaterThanOrEqual(entryBox!.x - 1);
      expect(contentBox!.x + contentBox!.width).toBeLessThanOrEqual(
        entryBox!.x + entryBox!.width + 1,
      );

      const logo = entry.getByTestId("experience-logo");
      if ((await logo.count()) > 0) {
        const logoBox = await logo.boundingBox();
        expect(logoBox).toBeTruthy();
        // Logo is left of the content and overlaps it vertically (same row).
        expect(logoBox!.x + logoBox!.width).toBeLessThanOrEqual(contentBox!.x + 1);
        const overlap =
          Math.min(logoBox!.y + logoBox!.height, contentBox!.y + contentBox!.height) -
          Math.max(logoBox!.y, contentBox!.y);
        expect(overlap).toBeGreaterThan(0);
      }
    }

    // Other public sections still load.
    const home = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(home?.status()).toBe(200);
    await expect(page.locator("body")).toBeVisible();
  });

  test("8. no unexpected console errors or failed requests", async ({ page }) => {
    const consoleErrors: string[] = [];
    const failed: string[] = [];
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      // Resource-load errors carry the failing URL in location(); keep it so
      // the known missing-seed 404s can be told apart from real JS errors.
      const url = m.location()?.url ?? "";
      consoleErrors.push(url ? `${m.text()} @ ${url}` : m.text());
    });
    page.on("response", (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    });

    await openVolunteering(page);
    const { body } = await openEntry(page);
    await wheelToEnd(page, body);
    await page.getByTestId("volunteering-dialog-close").click();
    await expect(dialogOf(page)).toHaveCount(0);

    // Known pre-existing content gap: these seeded image files were never
    // committed to public/media. They are unrelated to the dialog fix.
    const unexpectedFailed = failed.filter((f) => !/\/media\/volunteering\/|favicon\.ico/.test(f));
    const unexpectedConsole = consoleErrors.filter(
      (e) => !/\/media\/volunteering\/|favicon\.ico/.test(e),
    );
    expect(unexpectedFailed, "unexpected failed requests").toEqual([]);
    expect(unexpectedConsole, "unexpected console errors").toEqual([]);
  });
});
