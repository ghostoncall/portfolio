import { test, expect, type Page } from "@playwright/test";
type Snapshot = {
  visibility: Record<string, boolean>;
  site: { staged: { copy?: unknown }; published: { copy?: unknown } };
  award: unknown;
  resume: unknown;
};
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  errors.set(page, []);
  page.on("pageerror", (error) => errors.get(page)!.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.get(page)!.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
async function mount(page: Page, initialPath = "/onlyme/settings", reset = true) {
  await page.goto("/onlyme/login");
  await page.evaluate(
    async (options) =>
      (
        await import(/* @vite-ignore */ "/tests/fixtures/navigation-settings.tsx")
      ).mountNavigationFixture(options),
    { initialPath, reset },
  );
  await expect(page.locator("#navigation-fixture").getByRole("banner")).toBeVisible();
}
const root = (page: Page) => page.locator("#navigation-fixture");
async function go(page: Page, path: string) {
  await root(page).getByTestId(`fixture-go-${path}`).click();
}
async function snapshot(page: Page) {
  return page.evaluate(() =>
    (
      window as typeof window & { __navigationFixture: { snapshot(): Snapshot } }
    ).__navigationFixture.snapshot(),
  );
}

test("custom labels publish to both menus, survive reload and keep original page headings/URLs", async ({
  page,
}) => {
  await mount(page);
  await root(page)
    .getByLabel("Skills menu title", { exact: false })
    .fill("Skills and Certificates");
  await root(page).getByLabel("Awards menu title", { exact: false }).fill("Achievements");
  await root(page)
    .getByLabel("Skills subpage menu title", { exact: false })
    .fill("Technical Skills");
  await root(page).getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(root(page).getByRole("button", { name: "Save draft", exact: true })).toBeDisabled();
  expect(JSON.stringify((await snapshot(page)).site.published.copy)).not.toContain("Achievements");
  await root(page).getByRole("button", { name: "Publish", exact: true }).click();
  await expect(root(page).getByRole("button", { name: "Publish", exact: true })).toBeEnabled();
  expect(
    await root(page).evaluate((element) => element.scrollWidth - element.clientWidth),
  ).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 375, height: 850 });
  expect(
    await root(page).evaluate((element) => element.scrollWidth - element.clientWidth),
  ).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await go(page, "/awards");
  const desktop = root(page).getByRole("navigation", { name: "Site index", exact: true });
  await expect(
    desktop.getByRole("link", { name: "Skills and Certificates", exact: false }),
  ).toHaveAttribute("href", "/skills");
  await expect(desktop.getByRole("link", { name: "Achievements", exact: true })).toHaveAttribute(
    "href",
    "/awards",
  );
  await expect(
    root(page).getByRole("heading", { name: "Awards & Recognitions", exact: true }),
  ).toBeVisible();
  await mount(page, "/awards", false);
  await expect(
    root(page)
      .getByRole("navigation", { name: "Site index", exact: true })
      .getByRole("link", { name: "Achievements", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 850 });
  await root(page).getByRole("button", { name: "Menu", exact: true }).click();
  const menu = root(page).getByRole("dialog", { name: "Site menu", exact: true });
  await expect(
    menu.getByRole("link", { name: "Skills and Certificates", exact: true }),
  ).toHaveAttribute("href", "/skills");
  await expect(menu.getByRole("link", { name: "Achievements", exact: true })).toHaveAttribute(
    "href",
    "/awards",
  );
  await expect(menu.getByRole("link", { name: "Technical Skills", exact: true })).toHaveAttribute(
    "href",
    "/skills",
  );
});

test("hide and restore awards preserves every field, image, formatting and custom title", async ({
  page,
}) => {
  await mount(page);
  const original = (await snapshot(page)).award;
  await root(page).getByLabel("Awards menu title", { exact: false }).fill("Achievements");
  await root(page).getByRole("button", { name: "Publish", exact: true }).click();
  await expect(root(page).getByRole("button", { name: "Publish", exact: true })).toBeEnabled();
  await go(page, "/awards");
  await expect(root(page).getByTestId("award-tile")).toBeVisible();
  await go(page, "/onlyme/settings");
  await root(page)
    .getByRole("checkbox", { name: "Show Awards on the site", exact: true })
    .uncheck();
  await expect(
    root(page).getByRole("checkbox", { name: "Show Awards on the site", exact: true }),
  ).toBeEnabled();
  await go(page, "/awards");
  await expect(root(page).getByTestId("section-unavailable")).toBeVisible();
  await expect(root(page).getByTestId("award-tile")).toHaveCount(0);
  await go(page, "/skills");
  await expect(
    root(page)
      .getByRole("navigation", { name: "Site index", exact: true })
      .getByRole("link", { name: "Achievements", exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 850 });
  await root(page).getByRole("button", { name: "Menu", exact: true }).click();
  const mobile = root(page).getByRole("dialog", { name: "Site menu", exact: true });
  await expect(mobile.getByRole("link", { name: "Achievements", exact: true })).toHaveCount(0);
  await expect(mobile.getByRole("link", { name: "Certificates", exact: true })).toBeVisible();
  await mobile.getByRole("button", { name: "Close", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await mount(page, "/onlyme/settings", false);
  await expect(
    root(page).getByRole("checkbox", { name: "Show Awards on the site", exact: true }),
  ).not.toBeChecked();
  await expect(root(page).getByLabel("Awards menu title", { exact: false })).toHaveValue(
    "Achievements",
  );
  expect((await snapshot(page)).award).toEqual(original);
  await root(page).getByRole("checkbox", { name: "Show Awards on the site", exact: true }).check();
  await expect(
    root(page).getByRole("checkbox", { name: "Show Awards on the site", exact: true }),
  ).toBeEnabled();
  await go(page, "/awards");
  const tile = root(page).getByTestId("award-tile");
  await expect(tile).toContainText("Original recognition reason");
  await expect(tile.locator("strong")).toHaveText("formatted");
  await expect(tile.locator("img")).toHaveAttribute("src", "/images/profile.jpeg");
  await expect(tile.getByRole("link")).toHaveAttribute("href", "https://example.com/credential");
  await expect(
    root(page)
      .getByRole("navigation", { name: "Site index", exact: true })
      .getByRole("link", { name: "Achievements", exact: true }),
  ).toBeVisible();
  expect((await snapshot(page)).award).toEqual(original);
});

test("independent switches preserve drafts, résumé data and working grouped links", async ({
  page,
}) => {
  await mount(page);
  const originalResume = (await snapshot(page)).resume;
  await root(page).getByLabel("Skills menu title", { exact: false }).fill("Unsaved custom menu");
  await root(page)
    .getByRole("checkbox", { name: "Show Awards on the site", exact: true })
    .uncheck();
  await root(page)
    .getByRole("checkbox", { name: "Show Skills on the site", exact: true })
    .uncheck();
  await expect(
    root(page).getByRole("checkbox", { name: "Show Awards on the site", exact: true }),
  ).toBeEnabled();
  await expect(
    root(page).getByRole("checkbox", { name: "Show Skills on the site", exact: true }),
  ).toBeEnabled();
  await expect(root(page).getByLabel("Skills menu title", { exact: false })).toHaveValue(
    "Unsaved custom menu",
  );
  const stored = await snapshot(page);
  expect(stored.visibility).toMatchObject({ skills: false, awards: false });
  await go(page, "/");
  await expect(
    root(page)
      .getByRole("navigation", { name: "Site index", exact: true })
      .getByRole("link", { name: "Skills, Certificates & Awards", exact: false }),
  ).toHaveAttribute("href", "/certificates");
  await go(page, "/onlyme/settings");
  await root(page)
    .getByRole("checkbox", { name: "Show Résumé / CV on the site", exact: true })
    .uncheck();
  await expect(
    root(page).getByRole("checkbox", { name: "Show Résumé / CV on the site", exact: true }),
  ).toBeEnabled();
  await go(page, "/onlyme/resume");
  await expect(
    root(page).getByRole("checkbox", { name: "Show Résumé / CV on the site", exact: true }),
  ).not.toBeChecked();
  await expect(root(page).getByText("Original CV.pdf", { exact: false }).first()).toBeVisible();
  await root(page)
    .getByRole("checkbox", { name: "Show Résumé / CV on the site", exact: true })
    .check();
  await expect(
    root(page).getByRole("checkbox", { name: "Show Résumé / CV on the site", exact: true }),
  ).toBeEnabled();
  await go(page, "/onlyme/settings");
  await expect(
    root(page).getByRole("checkbox", { name: "Show Résumé / CV on the site", exact: true }),
  ).toBeChecked();
  expect((await snapshot(page)).resume).toEqual(originalResume);
});

test("hidden projects leave Overview and a hidden Overview opens the next visible section", async ({
  page,
}) => {
  await mount(page);
  await root(page)
    .getByRole("checkbox", { name: "Show Projects on the site", exact: true })
    .uncheck();
  await expect(
    root(page).getByRole("checkbox", { name: "Show Projects on the site", exact: true }),
  ).toBeEnabled();
  await go(page, "/");
  await expect(root(page).getByText("Original overview content", { exact: true })).toBeVisible();
  await expect(root(page).getByText("Preserved featured project", { exact: true })).toHaveCount(0);
  await go(page, "/onlyme/settings");
  for (const name of ["Overview", "Education", "Blog", "Skills"]) {
    const checkbox = root(page).getByRole("checkbox", {
      name: `Show ${name} on the site`,
      exact: true,
    });
    await checkbox.uncheck();
    await expect(checkbox).toBeEnabled();
  }
  await go(page, "/");
  await expect(
    root(page).getByRole("heading", { name: "Certificates", exact: true }),
  ).toBeVisible();
  await expect(root(page).getByText("Original overview content", { exact: true })).toHaveCount(0);
});

test("long custom titles wrap inside desktop and mobile navigation", async ({ page }) => {
  await mount(page);
  await root(page)
    .getByLabel("Skills menu title", { exact: false })
    .fill("NavigationTitle".repeat(20));
  await root(page)
    .getByLabel("Skills subpage menu title", { exact: false })
    .fill("SubpageTitle".repeat(20));
  await root(page).getByRole("button", { name: "Publish", exact: true }).click();
  await expect(root(page).getByRole("button", { name: "Publish", exact: true })).toBeEnabled();
  expect(
    await root(page).evaluate((element) => element.scrollWidth - element.clientWidth),
  ).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 375, height: 850 });
  expect(
    await root(page).evaluate((element) => element.scrollWidth - element.clientWidth),
  ).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await go(page, "/awards");
  const desktop = root(page).getByRole("navigation", { name: "Site index", exact: true });
  expect(
    await desktop.evaluate((element) => element.scrollWidth - element.clientWidth),
  ).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 375, height: 850 });
  await root(page).getByRole("button", { name: "Menu", exact: true }).click();
  const mobile = root(page).getByRole("navigation", { name: "Site", exact: true });
  expect(
    await mobile.evaluate((element) => element.scrollWidth - element.clientWidth),
  ).toBeLessThanOrEqual(1);
  await expect(mobile.locator('a[href="/skills"]').first()).toHaveAttribute("href", "/skills");
});
