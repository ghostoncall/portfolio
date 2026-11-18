import { test, expect } from "@playwright/test";

test("Overview Edit opens the editor and its published content matches the homepage", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/onlyme/login");
  await page.evaluate(async () =>
    (await import(/* @vite-ignore */ "/tests/fixtures/overview-editor.tsx")).mountOverviewFixture(),
  );
  const root = page.locator("#overview-fixture");
  await root.getByTestId("page-edit-link").click();
  await expect(root.getByRole("heading", { name: "overview", exact: true })).toBeVisible();
  await expect(root.getByTestId("pages-table")).toHaveCount(0);
  await root
    .locator('input[value="Original published overview"]')
    .fill("Draft overview with real shared preview");
  await root.getByRole("button", { name: "Split", exact: true }).click();
  await expect(root.getByLabel("Live preview")).toContainText(
    "Draft overview with real shared preview",
  );
  await expect(root.getByLabel("Live preview")).toContainText("Published featured project");
  await root.getByTestId("cms-save").click();
  await expect(root.getByTestId("cms-save")).toBeDisabled();
  const draft = await page.evaluate(() => {
    type Content = { blocks: { body: string }[] };
    const fixture = window as typeof window & {
      __overviewFixture: { snapshot(): { staged: Content; published: Content } };
    };
    return fixture.__overviewFixture.snapshot();
  });
  expect(draft.staged.blocks[0].body).toBe("Draft overview with real shared preview");
  expect(draft.published.blocks[0].body).toBe("Original published overview");
  await root.getByTestId("cms-publish").click();
  await expect(root.getByRole("status", { name: "Page save status" })).toHaveText("Published");
  await root.getByTestId("overview-public-view").click();
  await expect(root.locator("article").first()).toContainText(
    "Draft overview with real shared preview",
  );
  await expect(root.locator("article").first()).toContainText("Published featured project");
  expect(errors).toEqual([]);
});

test("natural banner settings persist from the Overview editor to the public homepage", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/onlyme/login");
  await page.evaluate(async () =>
    (await import(/* @vite-ignore */ "/tests/fixtures/overview-editor.tsx")).mountOverviewFixture({
      initialPath: "/onlyme/pages/overview",
    }),
  );

  const root = page.locator("#overview-fixture");
  await root.getByRole("button", { name: /Media$/ }).click();
  const editor = root.getByText("Media block", { exact: true }).locator("..").locator("..");
  const ratioSelect = editor
    .getByText("Ratio", { exact: true })
    .locator("..")
    .getByRole("combobox");
  await expect(ratioSelect).toHaveValue("natural");
  await expect(ratioSelect.locator('option[value="natural"]')).toHaveText(
    "Natural (uploaded image)",
  );
  await editor.getByRole("button", { name: "Add media item" }).click();

  const banner =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='400'%3E%3Crect width='1200' height='400' fill='%232b4f81'/%3E%3C/svg%3E";
  await editor.getByLabel("Media item 1 URL").fill(banner);
  await editor.getByLabel("Media item 1 alt text").fill("Natural fixture banner");
  await root.getByRole("button", { name: "Split", exact: true }).click();

  const previewImage = root.getByLabel("Live preview").getByRole("img", {
    name: "Natural fixture banner",
  });
  await expect(previewImage).toBeVisible();
  await expect
    .poll(async () => {
      const box = await previewImage.boundingBox();
      return box ? box.width / box.height : 0;
    })
    .toBeCloseTo(3, 1);

  await root.getByTestId("cms-save").click();
  await root.getByTestId("cms-publish").click();
  const stored = await page.evaluate(() => {
    type MediaBlock = {
      type: "media";
      ratio?: string;
      fit?: string;
      items?: { src?: string; alt?: string }[];
    };
    const fixture = window as typeof window & {
      __overviewFixture: { snapshot(): { published: { blocks: MediaBlock[] } } };
    };
    return fixture.__overviewFixture
      .snapshot()
      .published.blocks.find((block) => block.type === "media");
  });
  expect(stored).toMatchObject({
    ratio: "natural",
    fit: "contain",
    items: [{ src: banner, alt: "Natural fixture banner" }],
  });

  await root.getByTestId("overview-public-view").click();
  const publicImage = root.getByRole("img", { name: "Natural fixture banner" });
  await expect(publicImage).toBeVisible();
  await expect
    .poll(async () => {
      const box = await publicImage.boundingBox();
      return box ? box.width / box.height : 0;
    })
    .toBeCloseTo(3, 1);
  expect(errors).toEqual([]);
});
