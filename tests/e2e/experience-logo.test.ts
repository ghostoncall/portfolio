// End-to-end coverage for admin-managed company logos on /experience.
//
// Everything here is real: a headed browser drives the actual admin UI, the
// upload goes through the real Supabase Storage pipeline, and the public page
// is asserted from the server-rendered HTML plus the live DOM. Waits are all
// condition-based (URL / locator / database state), never fixed sleeps.
//
// The suite is serial on purpose: test 2 publishes the entry test 1 created,
// test 3 replaces its logo, and so on. beforeAll snapshots the experience
// document and afterAll restores it and deletes the uploaded media, so a run
// never leaves test content behind.

import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ROOT,
  cleanupTestMedia,
  getExperienceEntry,
  restoreExperiencePage,
  snapshotExperiencePage,
  type PageSnapshot,
} from "./support/cms";

const FIXTURES = path.join(ROOT, "tests/e2e/fixtures");
const PRIMARY_LOGO = path.join(FIXTURES, "e2e-logo-primary.png"); // 667×374, transparent
const SECONDARY_LOGO = path.join(FIXTURES, "e2e-logo-secondary.png"); // 360×200, transparent
const INVALID_FILE = path.join(FIXTURES, "e2e-not-an-image.exe");
const PRIMARY_SIZE = { width: 667, height: 374 };
const SECONDARY_SIZE = { width: 360, height: 200 };

const ROLE = "Logo Integration Engineer";
const ORG = `E2E Logo Co ${Date.now().toString(36)}`;
const OVERVIEW = `E2E overview for ${ORG}.`;

const MAX_RENDERED_WIDTH = 160;
const MAX_RENDERED_HEIGHT = 96;

let snapshot: PageSnapshot;
let primaryUrl = "";
let secondaryUrl = "";

async function login(page: Page) {
  await page.goto("/onlyme/login");

  // Wait for React to hydrate the controlled inputs before typing, otherwise
  // the values can be reset the moment hydration replaces the DOM.
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

async function openExperienceAdmin(page: Page) {
  await page.goto("/onlyme/experience");
  await expect(page.getByTestId("add-experience")).toBeVisible({ timeout: 20_000 });
}

const drawerRole = (page: Page) => page.getByTestId("experience-role");
const logoField = (page: Page) => page.getByTestId("media-item-fields");
const picker = (page: Page) => page.getByTestId("media-picker");

function entryRow(page: Page) {
  return page.locator('[data-testid="experience-row"]').filter({ hasText: ORG });
}

function publicEntry(page: Page) {
  return page.getByTestId("experience-entry").filter({ hasText: ORG });
}

/** Asserts the two-column row: logo left, content right, same band. */
async function expectTwoColumnRow(page: Page, ratio: number) {
  const entry = publicEntry(page);
  const logo = entry.getByTestId("experience-logo");
  const content = entry.getByTestId("experience-content");
  await expect(logo).toBeVisible();
  await expect(content).toBeVisible();

  const logoBox = await logo.boundingBox();
  const contentBox = await content.boundingBox();
  const entryBox = await entry.boundingBox();
  expect(logoBox && contentBox && entryBox).toBeTruthy();

  // Logo sits in the left column; the content starts to its right.
  expect(logoBox!.x + logoBox!.width).toBeLessThanOrEqual(contentBox!.x + 1);

  // Same horizontal row — the vertical spans overlap and the tops align.
  const overlap =
    Math.min(logoBox!.y + logoBox!.height, contentBox!.y + contentBox!.height) -
    Math.max(logoBox!.y, contentBox!.y);
  expect(overlap, "logo and content must share a row, not stack").toBeGreaterThan(0);
  expect(Math.abs(logoBox!.y - contentBox!.y)).toBeLessThan(8);

  // Stays inside the entry, contained at its capped size with the source ratio.
  expect(logoBox!.x).toBeGreaterThanOrEqual(entryBox!.x - 1);
  expect(logoBox!.x + logoBox!.width).toBeLessThanOrEqual(entryBox!.x + entryBox!.width + 1);
  expect(logoBox!.width).toBeGreaterThan(0);
  expect(logoBox!.height).toBeGreaterThan(0);
  expect(logoBox!.width).toBeLessThanOrEqual(MAX_RENDERED_WIDTH + 1);
  expect(logoBox!.height).toBeLessThanOrEqual(MAX_RENDERED_HEIGHT + 1);
  expect(Math.abs(logoBox!.width / logoBox!.height - ratio)).toBeLessThan(0.05);

  // The entry itself never overflows or pushes content past its right edge.
  const overflow = await entry.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(contentBox!.x + contentBox!.width).toBeLessThanOrEqual(entryBox!.x + entryBox!.width + 1);

  return { logoBox: logoBox!, contentBox: contentBox!, entryBox: entryBox! };
}

async function uploadLogo(page: Page, file: string, expected: { width: number; height: number }) {
  const field = logoField(page);
  await expect(field).toHaveAttribute("data-label", "Logo");

  await field.getByTestId("media-pick").click();
  await expect(picker(page)).toBeVisible();

  // The picker's input is intentionally hidden; setInputFiles works on it and
  // fires the same change event a real file dialog would.
  await picker(page).getByTestId("media-file-input").setInputFiles(file);

  // The picker closes only after the upload finished and the asset was selected.
  await expect(picker(page)).toHaveCount(0, { timeout: 30_000 });

  const preview = field.getByTestId("media-preview");
  await expect(preview).toBeVisible();

  // Prove the stored bytes are a real image of the expected size — a 1×1 or
  // corrupt upload fails here instead of silently rendering nothing.
  await expect
    .poll(() => preview.evaluate((img) => (img as HTMLImageElement).naturalWidth), {
      timeout: 15_000,
    })
    .toBe(expected.width);
  await expect
    .poll(() => preview.evaluate((img) => (img as HTMLImageElement).naturalHeight))
    .toBe(expected.height);

  const src = await preview.getAttribute("src");
  expect(src, "the selected asset should expose a URL").toBeTruthy();
  return src as string;
}

async function saveDraft(page: Page) {
  const save = page.getByTestId("cms-save");
  await expect(save).toBeEnabled({ timeout: 20_000 });
  await save.click();
  await expect(page.getByTestId("cms-dirty")).toHaveAttribute("aria-label", "saved", {
    timeout: 20_000,
  });
}

async function publishAndWait(page: Page, expectedLogo: string | null) {
  await page.getByTestId("cms-publish").click();
  await expect
    .poll(
      async () => {
        const entry = await getExperienceEntry(ORG);
        return entry.published?.logo?.src ?? null;
      },
      { timeout: 30_000, intervals: [300, 600, 1200] },
    )
    .toBe(expectedLogo);
}

test.describe.configure({ mode: "serial" });

test.describe("Experience company logos — admin to public", () => {
  test.beforeAll(async () => {
    snapshot = await snapshotExperiencePage();
  });

  test.afterAll(async () => {
    if (snapshot) await restoreExperiencePage(snapshot);
    const removed = await cleanupTestMedia();
    if (removed.length) console.log(`Cleanup removed media: ${removed.join(", ")}`);
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("1. creates an entry and uploads a transparent PNG logo", async ({ page }) => {
    await openExperienceAdmin(page);
    await page.getByTestId("add-experience").click();
    await expect(drawerRole(page)).toBeVisible();

    await drawerRole(page).fill(ROLE);
    await page.getByTestId("experience-org").fill(ORG);
    await page.getByTestId("experience-overview-input").fill(OVERVIEW);

    primaryUrl = await uploadLogo(page, PRIMARY_LOGO, PRIMARY_SIZE);
    expect(primaryUrl).toMatch(/\/storage\/v1\/object\/public\/media\/.+\.png$/);

    await page.getByTestId("experience-save").click();
    await expect(drawerRole(page)).toHaveCount(0, { timeout: 20_000 });

    await expect(entryRow(page)).toContainText(ROLE);
    await saveDraft(page);

    // The draft really persisted, with the logo attached.
    await expect
      .poll(async () => (await getExperienceEntry(ORG)).staged?.logo?.src ?? null, {
        timeout: 20_000,
      })
      .toBe(primaryUrl);
  });

  test("2. publishes and renders the logo on the public page", async ({ page }) => {
    await openExperienceAdmin(page);
    await publishAndWait(page, primaryUrl);

    await page.goto("/experience");
    const entry = publicEntry(page);
    await expect(entry).toBeVisible({ timeout: 20_000 });
    await expect(entry).toContainText(ROLE);
    await expect(entry).toContainText(OVERVIEW);

    const logo = entry.getByTestId("experience-logo");
    await expect(logo).toBeVisible();
    expect(await logo.getAttribute("src")).toBe(primaryUrl);

    // The image actually decodes at its real dimensions.
    await expect
      .poll(() => logo.evaluate((img) => (img as HTMLImageElement).naturalWidth), {
        timeout: 20_000,
      })
      .toBe(PRIMARY_SIZE.width);
    await expect
      .poll(() => logo.evaluate((img) => (img as HTMLImageElement).naturalHeight))
      .toBe(PRIMARY_SIZE.height);

    // Two-column row: logo on the left, all entry content on the right.
    const { logoBox, contentBox } = await expectTwoColumnRow(
      page,
      PRIMARY_SIZE.width / PRIMARY_SIZE.height,
    );

    // object-fit: contain — the rendered ratio matches the source ratio.
    const renderedRatio = logoBox.width / logoBox.height;
    const naturalRatio = PRIMARY_SIZE.width / PRIMARY_SIZE.height;
    expect(Math.abs(renderedRatio - naturalRatio)).toBeLessThan(0.05);

    // Clean styling: no border, no shadow, no background frame.
    const style = await logo.evaluate((img) => {
      const computed = getComputedStyle(img);
      const wrapper = img.parentElement ? getComputedStyle(img.parentElement) : null;
      return {
        borderWidth: computed.borderTopWidth,
        boxShadow: computed.boxShadow,
        backgroundImage: computed.backgroundImage,
        wrapperBorderWidth: wrapper?.borderTopWidth ?? "0px",
      };
    });
    expect(style.borderWidth).toBe("0px");
    expect(style.wrapperBorderWidth).toBe("0px");
    expect(style.boxShadow).toBe("none");
    expect(style.backgroundImage).toBe("none");

    // The overview lives in the right-hand content column, beside the logo.
    const overview = entry.getByTestId("experience-overview");
    const overviewBox = await overview.boundingBox();
    expect(overviewBox).toBeTruthy();
    expect(overviewBox!.x).toBeGreaterThanOrEqual(contentBox.x - 1);
    expect(overviewBox!.y).toBeGreaterThan(logoBox.y);

    // The public URL is served, so the page isn't showing a broken image.
    const asset = await page.request.get(primaryUrl);
    expect(asset.status()).toBe(200);
    expect(asset.headers()["content-type"]).toContain("image/png");
  });

  test("3. replaces the logo with a different image", async ({ page }) => {
    await openExperienceAdmin(page);
    await entryRow(page).getByTestId("experience-edit").click();
    await expect(drawerRole(page)).toBeVisible();

    // The existing logo is shown before replacing it.
    await expect(logoField(page).getByTestId("media-preview")).toHaveAttribute("src", primaryUrl);

    secondaryUrl = await uploadLogo(page, SECONDARY_LOGO, SECONDARY_SIZE);
    expect(secondaryUrl).not.toBe(primaryUrl);

    await page.getByTestId("experience-save").click();
    await expect(drawerRole(page)).toHaveCount(0, { timeout: 20_000 });
    await saveDraft(page);
    await publishAndWait(page, secondaryUrl);

    await page.goto("/experience");
    const logo = publicEntry(page).getByTestId("experience-logo");
    await expect(logo).toBeVisible({ timeout: 20_000 });
    expect(await logo.getAttribute("src")).toBe(secondaryUrl);

    await expect
      .poll(() => logo.evaluate((img) => (img as HTMLImageElement).naturalWidth), {
        timeout: 20_000,
      })
      .toBe(SECONDARY_SIZE.width);

    await expectTwoColumnRow(page, SECONDARY_SIZE.width / SECONDARY_SIZE.height);
  });

  test("4. keeps the logo inside the layout at desktop, tablet and mobile widths", async ({
    page,
  }) => {
    await page.goto("/experience");
    const entry = publicEntry(page);
    await expect(entry).toBeVisible({ timeout: 20_000 });

    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      const { logoBox, contentBox } = await expectTwoColumnRow(
        page,
        SECONDARY_SIZE.width / SECONDARY_SIZE.height,
      );

      // The two-column layout survives every breakpoint (logo left of content).
      expect(logoBox.x).toBeLessThan(contentBox.x);
      expect(logoBox.width).toBeLessThanOrEqual(MAX_RENDERED_WIDTH + 1);

      // Small screens scale the logo down rather than overlapping the text.
      if (viewport.width < 640) {
        expect(logoBox.width).toBeLessThanOrEqual(80 + 1);
        expect(logoBox.height).toBeLessThanOrEqual(56 + 1);
      }
    }
  });

  test("5. removes the logo without breaking the entry", async ({ page }) => {
    await openExperienceAdmin(page);
    await entryRow(page).getByTestId("experience-edit").click();
    await expect(drawerRole(page)).toBeVisible();

    await logoField(page).getByTestId("media-remove").click();
    await expect(logoField(page).getByTestId("media-preview")).toHaveCount(0);
    await expect(logoField(page).getByTestId("media-pick")).toHaveText("Choose from library");

    await page.getByTestId("experience-save").click();
    await expect(drawerRole(page)).toHaveCount(0, { timeout: 20_000 });
    await saveDraft(page);
    await publishAndWait(page, null);

    await page.goto("/experience");
    const entry = publicEntry(page);
    await expect(entry).toBeVisible({ timeout: 20_000 });
    await expect(entry.getByTestId("experience-logo")).toHaveCount(0);
    await expect(entry.getByTestId("experience-logo-column")).toHaveCount(0);
    await expect(entry).toContainText(ROLE);
    await expect(entry).toContainText(OVERVIEW);
  });

  test("6. persists across reloads and leaves other entries untouched", async ({ page }) => {
    await openExperienceAdmin(page);
    await page.reload();
    await expect(entryRow(page)).toContainText(ROLE, { timeout: 20_000 });

    await page.goto("/experience");
    await page.reload();
    const entry = publicEntry(page);
    await expect(entry).toBeVisible({ timeout: 20_000 });
    await expect(entry.getByTestId("experience-logo")).toHaveCount(0);

    // Entries that never had a logo still render normally, with no empty column.
    for (const org of ["Company Name", "Previous Company"]) {
      const other = page.getByTestId("experience-entry").filter({ hasText: org });
      await expect(other).toBeVisible();
      await expect(other.getByTestId("experience-logo")).toHaveCount(0);
      await expect(other.getByTestId("experience-logo-column")).toHaveCount(0);

      const contentBox = await other.getByTestId("experience-content").boundingBox();
      const entryBox = await other.boundingBox();
      expect(contentBox).toBeTruthy();
      expect(entryBox).toBeTruthy();
      // Content starts at the entry's left edge — no reserved logo gutter.
      expect(Math.abs(contentBox!.x - entryBox!.x)).toBeLessThan(2);
    }
  });

  test("7. rejects a file that is not an image", async ({ page }) => {
    await openExperienceAdmin(page);
    await page.getByTestId("add-experience").click();
    await expect(drawerRole(page)).toBeVisible();

    const rowsBefore = await page.locator('[data-testid="experience-row"]').count();

    await logoField(page).getByTestId("media-pick").click();
    await expect(picker(page)).toBeVisible();
    await picker(page)
      .getByTestId("media-file-input")
      .setInputFiles({
        name: "e2e-not-an-image.exe",
        mimeType: "application/x-msdownload",
        buffer: fs.readFileSync(INVALID_FILE),
      });

    await expect(picker(page).getByTestId("media-error")).toContainText(/Unsupported file type/i, {
      timeout: 20_000,
    });
    await expect(picker(page)).toBeVisible();
    await expect(page.getByTestId("media-preview")).toHaveCount(0);

    await picker(page).getByRole("button", { name: "Close media picker" }).click();
    await expect(picker(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(drawerRole(page)).toHaveCount(0);

    // Abandoned entry was not added, and no logo leaked into the draft.
    await expect(page.locator('[data-testid="experience-row"]')).toHaveCount(rowsBefore);
    await expect.poll(async () => (await getExperienceEntry(ORG)).staged?.logo ?? null).toBe(null);
  });
});
