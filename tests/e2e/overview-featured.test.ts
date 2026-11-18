import { test, expect, type Locator, type Page } from "@playwright/test";
import type { BlocksPage } from "../../src/lib/featured-projects";
type Fixture = {
  snapshot(): { staged: BlocksPage; published: BlocksPage };
  projects(): unknown[];
  calls: string[];
};
const root = (page: Page) => page.locator("#overview-fixture");
const panel = (page: Page) => root(page).getByRole("region", { name: "Featured Work settings" });
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  await page.context().grantPermissions(["local-network-access"], {
    origin: "http://127.0.0.1:5173",
  });
  errors.set(page, []);
  page.on("pageerror", (error) => errors.get(page)!.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.get(page)!.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
async function mount(page: Page, restore = false, initialPath = "/onlyme/pages/overview") {
  await page.route("**/__featured-fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body>
      <script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
      <script type="module" src="/@vite/client"></script><script type="module">import '/src/styles.css';</script>
    </body></html>`,
    }),
  );
  await page.goto("/__featured-fixture");
  await page.waitForFunction(
    () =>
      (window as typeof window & { __vite_plugin_react_preamble_installed__?: boolean })
        .__vite_plugin_react_preamble_installed__ === true,
  );
  await page.evaluate(
    async (options) =>
      (await import(/* @vite-ignore */ "/tests/fixtures/overview-editor.tsx")).mountOverviewFixture(
        options,
      ),
    { featured: true, restore, initialPath },
  );
  if (initialPath !== "/")
    await expect(
      panel(page).getByLabel("Show Featured Work on Overview", { exact: true }),
    ).toBeEnabled();
}
const snapshot = (page: Page) =>
  page.evaluate(() =>
    (window as typeof window & { __overviewFixture: Fixture }).__overviewFixture.snapshot(),
  );
const catalog = (page: Page) =>
  page.evaluate(() =>
    (window as typeof window & { __overviewFixture: Fixture }).__overviewFixture.projects(),
  );
async function feature(page: Page) {
  return (await snapshot(page)).staged.blocks.find((block) => block.type === "featured-projects");
}
async function publish(page: Page) {
  await root(page).getByTestId("cms-publish").click();
  await expect(root(page).getByRole("status", { name: "Page save status" })).toHaveText(
    "Published",
  );
}
async function previewOrder(page: Page) {
  return root(page)
    .getByLabel("Live preview")
    .locator("[data-featured-project]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-featured-project")),
    );
}
async function drag(page: Page, handle: Locator, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  await handle.scrollIntoViewIfNeeded();
  const from = (await handle.boundingBox())!,
    to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 6, from.y + from.height / 2, { steps: 2 });
  await page.mouse.move(to.x + Math.min(to.width / 2, 50), to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
}

test("project and section drag order persists through draft, reopen, publish and the cached homepage", async ({
  page,
}) => {
  await mount(page, false, "/");
  await expect(root(page).getByTestId("featured-projects")).toBeVisible();
  const before = await catalog(page);
  await root(page).getByTestId("overview-edit-view").click();
  await expect(
    panel(page).getByLabel("Show Featured Work on Overview", { exact: true }),
  ).toBeEnabled();
  await root(page).getByRole("button", { name: "Split", exact: true }).click();
  await drag(
    page,
    panel(page).getByRole("button", {
      name: "Drag featured project Published featured project",
      exact: true,
    }),
    panel(page).locator('[data-featured-row="third-project"]'),
  );
  await expect
    .poll(async () => (await feature(page))?.projectSlugs)
    .toEqual(["second-project", "third-project", "case-study"]);
  await expect
    .poll(() => previewOrder(page))
    .toEqual(["second-project", "third-project", "case-study"]);
  await drag(
    page,
    root(page).getByRole("button", { name: "Drag Featured Work section", exact: true }),
    root(page).getByRole("button", { name: "Drag Overview block 1", exact: true }),
  );
  await expect
    .poll(async () => (await snapshot(page)).staged.blocks[0].type)
    .toBe("featured-projects");
  // The Overview editor autosaves; by this point the persisted draft is clean.
  await expect(root(page).getByTestId("cms-save")).toBeDisabled();
  expect((await snapshot(page)).published.blocks[0].type).toBe("text");
  await mount(page, true);
  await expect
    .poll(async () => (await snapshot(page)).staged.blocks[0].type)
    .toBe("featured-projects");
  await root(page).getByRole("button", { name: "Split", exact: true }).click();
  await expect
    .poll(() => previewOrder(page))
    .toEqual(["second-project", "third-project", "case-study"]);
  await publish(page);
  await root(page).getByTestId("overview-public-view").click();
  await expect
    .poll(async () =>
      root(page)
        .locator("[data-featured-project]")
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute("data-featured-project")),
        ),
    )
    .toEqual(["second-project", "third-project", "case-study"]);
  expect((await snapshot(page)).published.blocks[0].type).toBe("featured-projects");
  expect(await catalog(page)).toEqual(before);
});

test("hide/show preserves the selection and heading while removing only a featured entry keeps project records", async ({
  page,
}) => {
  await mount(page);
  const before = await catalog(page);
  await panel(page).getByLabel("Featured Work heading", { exact: true }).fill("Selected projects");
  await panel(page)
    .getByRole("button", { name: "Remove Second featured project from Featured Work", exact: true })
    .click();
  await expect
    .poll(async () => (await feature(page))?.projectSlugs)
    .toEqual(["case-study", "third-project"]);
  await panel(page).getByLabel("Show Featured Work on Overview", { exact: true }).uncheck();
  await publish(page);
  await root(page).getByTestId("overview-public-view").click();
  await expect(root(page).getByTestId("featured-projects")).toHaveCount(0);
  await mount(page, true);
  await expect(
    panel(page).getByLabel("Show Featured Work on Overview", { exact: true }),
  ).not.toBeChecked();
  await expect(panel(page).getByLabel("Featured Work heading", { exact: true })).toHaveValue(
    "Selected projects",
  );
  await expect(panel(page).locator("[data-featured-row]")).toHaveCount(2);
  await panel(page).getByLabel("Show Featured Work on Overview", { exact: true }).check();
  await publish(page);
  await root(page).getByTestId("overview-public-view").click();
  await expect(
    root(page).getByRole("heading", { name: "Selected projects", exact: true }),
  ).toBeVisible();
  await expect(root(page).locator('[data-featured-project="second-project"]')).toHaveCount(0);
  expect(await catalog(page)).toEqual(before);
});

test("removed or empty Featured Work stays removed after publishing/reloading and can be added again", async ({
  page,
}) => {
  await mount(page);
  const before = await catalog(page);
  await panel(page).getByRole("button", { name: "Clear featured projects", exact: true }).click();
  await publish(page);
  await root(page).getByTestId("overview-public-view").click();
  await expect(root(page).getByTestId("featured-projects")).toHaveCount(0);
  await root(page).getByTestId("overview-edit-view").click();
  await expect(panel(page).getByLabel("Add a featured project", { exact: true })).toBeEnabled();
  await panel(page)
    .getByLabel("Add a featured project", { exact: true })
    .selectOption("third-project");
  await panel(page)
    .getByRole("button", { name: "Remove Featured Work section", exact: true })
    .click();
  await expect(panel(page)).toHaveCount(0);
  await publish(page);
  await mount(page, true, "/");
  await expect(root(page).getByTestId("featured-projects")).toHaveCount(0);
  await root(page).getByTestId("overview-edit-view").click();
  await expect(panel(page)).toHaveCount(0);
  await root(page).getByRole("button", { name: "Featured Work", exact: true }).click();
  await expect(
    panel(page).getByLabel("Show Featured Work on Overview", { exact: true }),
  ).toBeChecked();
  await publish(page);
  await root(page).getByTestId("overview-public-view").click();
  await expect(root(page).getByTestId("featured-projects")).toBeVisible();
  expect(await catalog(page)).toEqual(before);
});

test("keyboard controls support ordering and ordinary editor typing keeps focus", async ({
  page,
}) => {
  await mount(page);
  const moveDown = panel(page).getByRole("button", {
    name: "Move featured project Published featured project down",
    exact: true,
  });
  await moveDown.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(async () => (await feature(page))?.projectSlugs)
    .toEqual(["second-project", "case-study", "third-project"]);
  const body = root(page).locator('[data-overview-block="text"] input').first();
  await body.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" edited safely");
  await expect(body).toBeFocused();
  await expect(body).toHaveValue("Original published overview edited safely");
});
