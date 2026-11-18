import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import type { CardLayout } from "../../src/components/admin/koenig/layout";

type NodeJSON = {
  type: string;
  children?: NodeJSON[];
  portfolioLayout?: CardLayout;
  images?: { alt?: string }[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};
type Value = { lexical: { root: NodeJSON }; html: string };
type FixtureWindow = Window & { __koenigFixture?: { snapshot(): Value } };
const source = "http://127.0.0.1:5173/images/profile.jpeg";
const errors = new WeakMap<Page, string[]>();
async function mount(page: Page, initial: unknown = {}) {
  await page.goto("/onlyme/login");
  await page.evaluate(async (initial) => {
    const { mountKoenigFixture } = await import(
      /* @vite-ignore */ "/tests/fixtures/koenig-editor.tsx"
    );
    mountKoenigFixture(initial);
  }, initial);
  await expect(page.getByRole("combobox", { name: "Add element", exact: true })).toBeVisible();
  await page.waitForFunction(() => !!(window as FixtureWindow).__koenigFixture?.snapshot);
}
async function snapshot(page: Page): Promise<Value> {
  return page.evaluate(() => (window as FixtureWindow).__koenigFixture!.snapshot());
}
function flatten(node: NodeJSON): NodeJSON[] {
  return [node, ...(node.children ?? []).flatMap(flatten)];
}
async function nodes(page: Page, type: string) {
  return flatten((await snapshot(page)).lexical.root).filter((n) => n.type === type);
}
async function insert(page: Page, type: string) {
  await page.getByRole("combobox", { name: "Add element", exact: true }).selectOption(type);
}
async function field(page: Page, label: string, value: string) {
  const input = page.locator(".koenig-controls").getByLabel(label, { exact: true });
  await input.fill(value);
  await input.press("Tab");
}
async function image(page: Page) {
  await insert(page, "image");
  await field(page, "Image URL", source);
  await expect.poll(async () => (await nodes(page, "image"))[0]?.src).toBe(source);
}
async function reopen(page: Page) {
  await page.getByTestId("save-draft").click();
  await page.getByTestId("reopen").click();
  await expect(page.locator("#fixture-editor .portfolio-koenig")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  errors.set(page, []);
  page.on("pageerror", (error) => errors.get(page)!.push(error.message));
  await page.route(
    /^https:\/\/(www\.youtube(?:-nocookie)?\.com|player\.vimeo\.com|i\.ytimg\.com|media\.example\.com)\//,
    (route) => route.fulfill({ contentType: "text/html", body: "<p>Provider fixture</p>" }),
  );
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

test("image controls mutate nodes, preview, history and saved JSON", async ({ page }) => {
  await mount(page);
  await image(page);
  for (const align of ["Left", "Center", "Right"] as const) {
    await page.getByRole("button", { name: align, exact: true }).click();
    await expect
      .poll(async () => (await nodes(page, "image"))[0]?.portfolioLayout?.align)
      .toBe(align.toLowerCase());
    await expect(
      page.locator(`#fixture-preview [data-portfolio-layout="${align.toLowerCase()}"]`),
    ).toBeVisible();
  }
  for (const size of ["S", "M", "L"] as const) {
    await page.getByRole("button", { name: size, exact: true }).click();
    await expect
      .poll(async () => (await nodes(page, "image"))[0]?.portfolioLayout?.size)
      .toBe(size.toLowerCase());
    const ratio = await page
      .locator("#fixture-preview .kg-content")
      .evaluate(
        (root) =>
          root.querySelector("figure")!.getBoundingClientRect().width /
          root.getBoundingClientRect().width,
      );
    expect(ratio).toBeCloseTo({ S: 0.34, M: 0.45, L: 0.58 }[size], 2);
  }
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await nodes(page, "image"))[0]?.portfolioLayout?.size).toBe("m");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(async () => (await nodes(page, "image"))[0]?.portfolioLayout?.size).toBe("l");
  const saved = await snapshot(page);
  await reopen(page);
  expect(await snapshot(page)).toEqual(saved);
  await page.locator('#fixture-editor [data-kg-card="image"] img').click();
  await page
    .locator(".koenig-controls")
    .getByRole("button", { name: "Full width", exact: true })
    .click();
  expect((await nodes(page, "image"))[0]?.cardWidth).toBe("full");
  await page.getByRole("button", { name: "Custom", exact: true }).click();
  await page.getByLabel("Custom width", { exact: true }).fill("280");
  await expect.poll(async () => (await nodes(page, "image"))[0]?.portfolioLayout?.width).toBe(280);
  await expect(page.locator("#fixture-preview figure")).toHaveCSS("width", "280px");
  await page.setViewportSize({ width: 375, height: 900 });
  const stacked = await page.locator("#fixture-preview .kg-content").evaluate((root) => ({
    image: root.querySelector("figure")!.getBoundingClientRect().width,
    content: root.getBoundingClientRect().width,
  }));
  // Fixed dimensions now retain their requested size when they fit on mobile.
  // Wider dimensions clamp to the article without changing the saved value.
  expect(stacked.image).toBeCloseTo(Math.min(280, stacked.content), 0);
  expect((await nodes(page, "image"))[0]?.portfolioLayout?.width).toBe(280);
});

test("image alt, hyperlink, caption, source and replacement persist independently", async ({
  page,
}) => {
  await mount(page);
  await image(page);
  await page.getByRole("button", { name: "Left", exact: true }).click();
  await page.getByRole("button", { name: "S", exact: true }).click();
  await field(page, "Alt text", "A meaningful description");
  await field(page, "Image link", "https://example.com/image");
  await page.getByRole("button", { name: "Edit caption", exact: true }).click();
  await page.keyboard.type("A preserved caption");
  await expect
    .poll(async () => (await nodes(page, "image"))[0]?.caption)
    .toContain("A preserved caption");
  await expect(page.locator("#fixture-preview figcaption")).toContainText("A preserved caption");
  await page.locator('#fixture-editor [data-kg-card="image"] img').click();
  await page
    .getByLabel("Replace image", { exact: true })
    .setInputFiles(path.resolve("public/images/profile.jpeg"));
  await expect.poll(async () => (await nodes(page, "image"))[0]?.src).toContain("upload=");
  const node = (await nodes(page, "image"))[0]!;
  expect(node.alt).toBe("A meaningful description");
  expect(node.href).toBe("https://example.com/image");
  expect(node.caption).toContain("A preserved caption");
  expect(node.portfolioLayout).toEqual({ align: "left", size: "s" });
  await reopen(page);
  expect((await nodes(page, "image"))[0]).toEqual(node);
  await page.locator('#fixture-editor [data-kg-card="image"] img').click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  expect(await nodes(page, "image")).toHaveLength(2);
  await field(page, "Alt text", "Only the duplicate");
  const copies = await nodes(page, "image");
  expect(copies[0]?.alt).toBe("A meaningful description");
  expect(copies[1]?.alt).toBe("Only the duplicate");
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  expect(await nodes(page, "image")).toHaveLength(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await nodes(page, "image")).toHaveLength(2);
});

test("image-only HTML imports are retained and legacy layouts remain compatible", async ({
  page,
}) => {
  await mount(page, {
    body: {
      lexical: {},
      html: `<figure class="kg-card kg-image-card"><img src="${source}" class="kg-image" alt="Legacy photo"></figure>`,
    },
    imageLayouts: { [source]: { align: "left", size: "s" } },
  });
  expect(await nodes(page, "image")).toHaveLength(1);
  expect((await nodes(page, "image"))[0]?.portfolioLayout).toEqual({ align: "left", size: "s" });
  await expect(page.locator("#fixture-preview img")).toHaveAttribute("alt", "Legacy photo");
  await reopen(page);
  expect(await nodes(page, "image")).toHaveLength(1);
  const body = await snapshot(page);
  await mount(page, { body, imageLayouts: { [source]: { align: "left", size: "s" } } });
  await page.locator('#fixture-editor [data-kg-card="image"] img').click();
  await page.getByRole("button", { name: "Right", exact: true }).click();
  await expect(page.locator("#fixture-preview figure")).toHaveAttribute(
    "data-portfolio-layout",
    "right",
  );
  await page.getByRole("button", { name: "Default", exact: true }).click();
  await expect(page.locator("#fixture-preview figure")).toHaveAttribute(
    "data-portfolio-layout",
    "default",
  );
});

test("YouTube URL, dimensions, alignment, caption and history survive save and preview switches", async ({
  page,
}) => {
  await mount(page);
  await insert(page, "embed");
  await page
    .getByLabel("Embed URL", { exact: true })
    .fill("https://www.youtube.com/watch?v=AAAAAAAAAAA");
  await page.getByRole("button", { name: "Apply URL", exact: true }).click();
  await expect
    .poll(async () => (await nodes(page, "embed"))[0]?.html)
    .toContain("youtube.com/embed");
  await page.getByRole("button", { name: "Right", exact: true }).click();
  await page.getByRole("button", { name: "M", exact: true }).click();
  await expect(page.locator("#fixture-preview .kg-facade")).toHaveAttribute(
    "data-embed",
    /youtube-nocookie/,
  );
  const saved = await snapshot(page);
  await reopen(page);
  expect(await snapshot(page)).toEqual(saved);
  await page.getByTestId("toggle-preview").click();
  await expect(page.locator("#fixture-editor")).toBeHidden();
  await expect(page.locator("#fixture-preview .kg-facade")).toBeVisible();
  await page.getByTestId("toggle-preview").click();
  expect(await snapshot(page)).toEqual(saved);
  await page.locator('#fixture-editor [data-kg-card="embed"]').click();
  await page.getByLabel("Embed URL", { exact: true }).fill("https://vimeo.com/123456");
  await page.getByRole("button", { name: "Apply URL", exact: true }).click();
  await expect.poll(async () => (await nodes(page, "embed"))[0]?.html).toContain("vimeo.com");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await nodes(page, "embed"))[0]?.url).toContain("youtube.com");
});

test("failed embed requests retain the existing document", async ({ page }) => {
  await mount(page);
  await insert(page, "embed");
  await page
    .getByLabel("Embed URL", { exact: true })
    .fill("https://www.youtube.com/watch?v=AAAAAAAAAAA");
  await page.getByRole("button", { name: "Apply URL", exact: true }).click();
  await expect.poll(async () => (await nodes(page, "embed"))[0]?.html).toContain("youtube");
  const before = await snapshot(page);
  await page.getByLabel("Embed URL", { exact: true }).fill("https://www.youtube.com/watch?v=fail");
  await page.getByRole("button", { name: "Apply URL", exact: true }).click();
  await expect(page.locator(".koenig-controls [role=alert]")).toContainText("unavailable");
  expect(await snapshot(page)).toEqual(before);
});

for (const [type, label, value, property] of [
  ["button", "Button text", "Read more", "buttonText"],
  ["codeblock", "Code", "const answer = 42;", "code"],
  ["html", "HTML", "<p>Controlled HTML</p>", "html"],
  ["markdown", "Markdown", "## Markdown heading", "markdown"],
  ["audio", "Title", "Audio title", "title"],
  ["file", "Title", "Useful download", "fileTitle"],
  ["callout", "Icon", "✓", "calloutEmoji"],
] as const)
  test(`${type} properties update the native node and survive reopening`, async ({ page }) => {
    await mount(page);
    await insert(page, type);
    await field(page, label, value);
    await expect.poll(async () => (await nodes(page, type))[0]?.[property]).toBe(value);
    const before = await snapshot(page);
    await reopen(page);
    expect(await snapshot(page)).toEqual(before);
  });

test("gallery uploads, alt text and order use native image arrays", async ({ page }) => {
  await mount(page);
  await insert(page, "gallery");
  await page
    .getByLabel("Add gallery images", { exact: true })
    .setInputFiles([
      path.resolve("public/images/profile.jpeg"),
      path.resolve("public/images/profile.webp"),
    ]);
  await expect.poll(async () => (await nodes(page, "gallery"))[0]?.images?.length).toBe(2);
  await field(page, "Image 1 alt text", "First image");
  await field(page, "Image 2 alt text", "Second image");
  await page
    .locator(".koenig-controls-gallery")
    .getByRole("button", { name: "Later", exact: true })
    .first()
    .click();
  expect((await nodes(page, "gallery"))[0]?.images?.[0]?.alt).toBe("Second image");
  const before = await snapshot(page);
  await reopen(page);
  expect(await snapshot(page)).toEqual(before);
});

test("native text formatting and headings persist without another Lexical instance", async ({
  page,
}) => {
  await mount(page);
  const paragraph = page
    .locator("#fixture-editor .portfolio-koenig > [data-kg=editor] > .kg-prose > p")
    .first();
  await paragraph.click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  await page.getByRole("button", { name: "bold", exact: true }).click();
  await expect(page.locator("#fixture-preview strong").first()).toContainText("Opening paragraph.");
  await page.getByLabel("Text block", { exact: true }).selectOption("h2");
  await expect(page.locator("#fixture-preview h2")).toContainText("Opening paragraph.");
  const before = await snapshot(page);
  await reopen(page);
  expect(await snapshot(page)).toEqual(before);
});

test("divider controls do not show irrelevant image settings", async ({ page }) => {
  await mount(page);
  await insert(page, "horizontalrule");
  await expect(page.getByRole("group", { name: "Element alignment", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Image URL", { exact: true })).toHaveCount(0);
  expect(await nodes(page, "horizontalrule")).toHaveLength(1);
  await page.getByRole("button", { name: "Move up", exact: true }).click();
  expect((await snapshot(page)).lexical.root.children?.[0]?.type).toBe("horizontalrule");
});

test("editor body and quotes match the excerpt scale; new images start at medium", async ({
  page,
}) => {
  await mount(page, {
    body: { lexical: {}, html: "<p>Ordinary paragraph.</p><blockquote>A quotation.</blockquote>" },
  });
  const excerptSize = await page
    .getByTestId("excerpt-scale")
    .evaluate((el) => getComputedStyle(el).fontSize);
  const canvas = page.locator('#fixture-editor .portfolio-koenig > [data-kg="editor"] > .kg-prose');
  await expect(canvas.locator("p").first()).toHaveCSS("font-size", excerptSize);
  await expect(canvas.locator("blockquote")).toHaveCSS("font-size", excerptSize);
  await image(page);
  expect((await nodes(page, "image"))[0]?.portfolioLayout).toEqual({ align: "center", size: "m" });
  const ratio = await canvas.evaluate(
    (el) =>
      el.querySelector("[data-lexical-decorator]")!.getBoundingClientRect().width /
      el.getBoundingClientRect().width,
  );
  expect(ratio).toBeCloseTo(0.45, 2);
});

test("native image width toolbar and original/custom sizing agree with the document", async ({
  page,
}) => {
  await mount(page);
  await image(page);
  await page.getByRole("button", { name: "Wide width", exact: true }).click();
  await expect
    .poll(async () => (await nodes(page, "image"))[0]?.portfolioLayout)
    .toEqual({ align: "center", size: "wide" });
  await page.getByRole("button", { name: "Regular width", exact: true }).click();
  expect((await nodes(page, "image"))[0]?.portfolioLayout?.align).toBe("default");
  await page.getByRole("button", { name: "Original", exact: true }).click();
  await expect(page.locator("#fixture-preview figure")).toHaveCSS("width", "500px");
  await page.getByRole("button", { name: "Custom", exact: true }).click();
  await page.getByLabel("Width unit", { exact: true }).selectOption("%");
  await page.getByLabel("Custom width", { exact: true }).fill("65");
  const ratio = await page
    .locator("#fixture-preview .kg-content")
    .evaluate(
      (el) =>
        el.querySelector("figure")!.getBoundingClientRect().width /
        el.getBoundingClientRect().width,
    );
  expect(ratio).toBeCloseTo(0.65, 2);
});

test("YouTube player settings persist and render in the public click-to-play facade", async ({
  page,
}) => {
  await mount(page);
  await insert(page, "embed");
  await field(page, "Embed URL", "https://www.youtube.com/watch?v=AAAAAAAAAAA");
  await page.getByRole("button", { name: "Apply URL", exact: true }).click();
  await page.getByLabel("Video ratio", { exact: true }).selectOption("4/3");
  await page.getByLabel("Start at (seconds)", { exact: true }).fill("35");
  await page.getByLabel("Player controls", { exact: true }).uncheck();
  await page.getByLabel("Loop video", { exact: true }).check();
  const data = (await nodes(page, "embed"))[0]!;
  expect(data.metadata.width).toBe(400);
  expect(data.metadata.height).toBe(300);
  expect(data.html).toContain("start=35");
  expect(data.html).toContain("controls=0");
  await expect(page.locator("#fixture-preview .kg-facade")).toHaveCSS("aspect-ratio", "4 / 3");
  const saved = await snapshot(page);
  await reopen(page);
  expect(await snapshot(page)).toEqual(saved);
  await page.locator("#fixture-preview .kg-facade button").click();
  await expect(page.locator("#fixture-preview iframe")).toHaveAttribute(
    "src",
    /start=35.*controls=0.*loop=1/,
  );
});

test("embed resolution ignores an older async response and bookmark metadata stays editable", async ({
  page,
}) => {
  await mount(page);
  await insert(page, "embed");
  await field(page, "Embed URL", "https://www.youtube.com/watch?v=slow");
  await page.getByRole("button", { name: "Apply URL", exact: true }).click();
  await field(page, "Embed URL", "https://vimeo.com/123456");
  await page.getByRole("button", { name: "Apply URL", exact: true }).click();
  await expect
    .poll(async () => (await nodes(page, "embed"))[0]?.url)
    .toBe("https://vimeo.com/123456");
  await page.waitForTimeout(600);
  expect((await nodes(page, "embed"))[0]?.url).toBe("https://vimeo.com/123456");
  await field(page, "Embed URL", "https://example.com/article");
  await page.getByRole("button", { name: "Apply URL", exact: true }).click();
  await expect
    .poll(async () => (await nodes(page, "bookmark"))[0]?.metadata?.title)
    .toBe("Resolved bookmark");
  await field(page, "Title", "My bookmark title");
  await field(page, "Description", "My description");
  expect((await nodes(page, "bookmark"))[0]?.metadata?.title).toBe("My bookmark title");
  await expect(page.locator("#fixture-preview .kg-bookmark-title")).toHaveText("My bookmark title");
  const saved = await snapshot(page);
  await reopen(page);
  expect(await snapshot(page)).toEqual(saved);
});

for (const [type, label, property, text] of [
  ["toggle", "heading", "heading", "Toggle heading"],
  ["header", "heading", "header", "Header heading"],
  ["product", "title", "productTitle", "Product title"],
  ["callout", "text", "calloutText", "Callout text"],
] as const)
  test(`${type} retains its native nested rich editor and serialized content`, async ({ page }) => {
    await mount(page);
    await insert(page, type);
    await page
      .locator(".koenig-controls")
      .getByRole("button", { name: `Edit ${label}`, exact: true })
      .click();
    await page.waitForTimeout(100);
    await page.keyboard.type(text);
    await expect.poll(async () => (await nodes(page, type))[0]?.[property]).toContain(text);
    await expect(page.locator("#fixture-preview")).toContainText(text);
    const saved = await snapshot(page);
    await reopen(page);
    expect(await snapshot(page)).toEqual(saved);
  });

test("video poster, loop and caption render as a functioning native player", async ({ page }) => {
  await mount(page);
  await insert(page, "video");
  await field(page, "Video URL", "https://media.example.com/movie.mp4");
  await field(page, "Poster URL", source);
  await page.getByLabel("Loop", { exact: true }).check();
  await page.getByRole("button", { name: "Edit caption", exact: true }).click();
  await page.keyboard.type("Video caption");
  await expect(page.locator("#fixture-preview video")).toHaveAttribute("controls", "");
  await expect(page.locator("#fixture-preview video")).toHaveAttribute("poster", source);
  await expect(page.locator("#fixture-preview video")).toHaveAttribute("loop", "");
  await expect(page.locator("#fixture-preview figcaption")).toContainText("Video caption");
  const saved = await snapshot(page);
  await reopen(page);
  expect(await snapshot(page)).toEqual(saved);
});

test("duplicate captions have independent nested editor state", async ({ page }) => {
  await mount(page);
  await image(page);
  await page.getByRole("button", { name: "Edit caption", exact: true }).click();
  await page.keyboard.type("Original caption");
  await page.locator('#fixture-editor [data-kg-card="image"] img').click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await page.getByRole("button", { name: "Edit caption", exact: true }).click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Duplicate caption");
  const list = await nodes(page, "image");
  expect(list[0]?.caption).toContain("Original caption");
  expect(list[1]?.caption).toContain("Duplicate caption");
  await page.keyboard.press("Control+z");
  expect((await nodes(page, "image"))[0]?.caption).toContain("Original caption");
});

async function cropDialog(page: Page) {
  await page.goto("/onlyme/login");
  await page.evaluate(async () => {
    const { mountCropFixture } = await import(
      /* @vite-ignore */ "/tests/fixtures/koenig-editor.tsx"
    );
    mountCropFixture();
  });
  await page.getByTestId("open-crop").click();
  await expect(page.getByRole("application").locator("img")).toBeVisible();
}

for (const viewport of [
  { width: 1530, height: 790 },
  { width: 800, height: 480 },
  { width: 800, height: 300 },
  { width: 375, height: 667 },
])
  test(`crop dialog stays within ${viewport.width}x${viewport.height} and its footer is reachable`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await cropDialog(page);
    const dialog = page.getByRole("dialog");
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    await page.getByRole("button", { name: "Apply crop", exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Apply crop", exact: true })).toBeInViewport();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });

test("crop keyboard, wheel, drag and zoom controls change and export the actual crop", async ({
  page,
}) => {
  await cropDialog(page);
  const frame = page.getByRole("application"),
    slider = page.getByRole("slider", { name: "Zoom", exact: true });
  await expect(frame).toBeFocused();
  await page.keyboard.press("+");
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(1);
  await slider.fill("2");
  const position = await frame.locator("img").evaluate((el) => (el as HTMLElement).style.left);
  await frame.press("ArrowRight");
  await expect
    .poll(async () => frame.locator("img").evaluate((el) => (el as HTMLElement).style.left))
    .not.toBe(position);
  await frame.hover();
  await page.mouse.wheel(0, -80);
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(2);
  const beforeMinus = Number(await slider.inputValue());
  await page.keyboard.press("-");
  await expect.poll(async () => Number(await slider.inputValue())).toBeLessThan(beforeMinus);
  const area = (await frame.boundingBox())!;
  const beforeDrag = await frame.locator("img").evaluate((el) => (el as HTMLElement).style.top);
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
  await page.mouse.down();
  await page.mouse.move(area.x + area.width / 2 + 20, area.y + area.height / 2 + 20, { steps: 4 });
  await page.mouse.up();
  expect(await frame.locator("img").evaluate((el) => (el as HTMLElement).style.top)).not.toBe(
    beforeDrag,
  );
  await page.getByRole("button", { name: "Whole image", exact: true }).click();
  expect(Number(await slider.inputValue())).toBeLessThan(1);
  await page.getByRole("button", { name: "Fill frame", exact: true }).click();
  expect(Number(await slider.inputValue())).toBe(1);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  expect(Number(await slider.inputValue())).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Apply crop", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const result = JSON.parse((await page.getByTestId("crop-result").textContent())!);
  expect(result.type).toBe("image/webp");
  expect(result.size).toBeGreaterThan(0);
  expect(result.width / result.height).toBeCloseTo(4 / 3, 2);
  expect(result.crop.w).toBeLessThan(1);
});

test("list, link, selection size and alignment commands preserve native text formatting", async ({
  page,
}) => {
  await mount(page);
  const paragraph = page
    .locator('#fixture-editor .portfolio-koenig > [data-kg="editor"] > .kg-prose > p')
    .first();
  await paragraph.click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  await page.getByLabel("Selected text size", { exact: true }).selectOption("16px");
  await field(page, "Text link", "https://example.com/article");
  await page.getByRole("button", { name: "Apply link", exact: true }).click();
  await expect(
    page.locator('#fixture-preview a[href="https://example.com/article"]'),
  ).toContainText("Opening paragraph.");
  await page.getByLabel("Text block", { exact: true }).selectOption("bullet");
  await expect(page.locator("#fixture-preview ul li")).toContainText("Opening paragraph.");
  await page.getByLabel("Text alignment", { exact: true }).selectOption("right");
  expect((await nodes(page, "listitem"))[0]?.format).toBe("right");
  const saved = await snapshot(page);
  await reopen(page);
  expect(await snapshot(page)).toEqual(saved);
});
