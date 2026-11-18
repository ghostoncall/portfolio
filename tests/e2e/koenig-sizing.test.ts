import { test, expect, type Page } from "@playwright/test";
import { sizingBody, sizingCards } from "../fixtures/sizing-cards";
import type { CardLayout } from "../../src/components/admin/koenig/layout";

type FixtureCard = {
  type: string;
  width?: number;
  height?: number;
  portfolioLayout: CardLayout;
};

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  errors.set(page, []);
  page.on("pageerror", (error) => errors.get(page)!.push(error.message));
  await page.route(/^https:\/\/(www.youtube.com|player.vimeo.com|media.example.com)\//, (route) =>
    route.fulfill({ contentType: "text/html", body: "Provider fixture" }),
  );
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
async function mount(page: Page, type: string, options: Record<string, unknown> = {}) {
  await page.goto("/onlyme/login");
  await page.evaluate(
    async (initial) => {
      (await import(/* @vite-ignore */ "/tests/fixtures/koenig-editor.tsx")).mountKoenigFixture(
        initial,
      );
    },
    { body: sizingBody(type), canvasWidth: 1500, ...options },
  );
  await expect(page.getByLabel("Add element", { exact: true })).toBeEnabled();
  await page
    .locator(`#fixture-editor [data-kg-card="${type}"]`)
    .click({ position: { x: 4, y: 4 } });
  await expect(
    page.getByRole("button", { name: "Resize bottom right", exact: true }),
  ).toBeVisible();
}
async function card(page: Page, type: string) {
  return page.evaluate((type) => {
    const fixture = window as typeof window & {
      __koenigFixture: { snapshot(): { lexical: { root: { children: FixtureCard[] } } } };
    };
    const node = fixture.__koenigFixture
      .snapshot()
      .lexical.root.children.find((node) => node.type === type);
    if (!node) throw new Error(`Missing ${type} fixture card`);
    return node;
  }, type);
}
async function actual(page: Page) {
  return page.locator(".koenig-resize-boundary").evaluate((el) => ({
    width: parseFloat((el as HTMLElement).style.width),
    height: parseFloat((el as HTMLElement).style.height),
  }));
}
async function contained(page: Page) {
  const canvas = await page
    .locator('.portfolio-koenig > [data-kg="editor"] > .kg-prose')
    .boundingBox();
  const selected = await page.locator(".koenig-resize-boundary").boundingBox();
  expect(selected!.x).toBeGreaterThanOrEqual(canvas!.x - 1);
  expect(selected!.x + selected!.width).toBeLessThanOrEqual(canvas!.x + canvas!.width + 1);
}
async function dimensions(page: Page, type: string, width: number, height: number) {
  if (type !== "horizontalrule")
    await page.getByLabel("Lock aspect ratio", { exact: true }).uncheck();
  await page.getByLabel("Custom width", { exact: true }).fill(String(width));
  await page
    .getByLabel(type === "horizontalrule" ? "Divider thickness" : "Custom height", { exact: true })
    .fill(String(height));
  await page.keyboard.press("Tab");
  await expect.poll(async () => Math.round((await actual(page)).width)).toBe(width);
  if (type !== "horizontalrule")
    await expect.poll(async () => Math.round((await actual(page)).height)).toBe(height);
  await expect.poll(async () => (await card(page, type))?.portfolioLayout?.height).toBe(height);
}

for (const type of Object.keys(sizingCards)) {
  test(`${type}: numeric dimensions resize actual canvas, preview and saved node`, async ({
    page,
  }) => {
    await mount(page, type);
    const height = type === "horizontalrule" ? 3 : 300;
    await dimensions(page, type, 500, height);
    await contained(page);
    const preview = page.locator(`#fixture-preview [data-portfolio-element="${type}"]`);
    await expect.poll(async () => Math.round((await preview.boundingBox())!.width)).toBe(500);
    await expect.poll(async () => Math.round((await preview.boundingBox())!.height)).toBe(height);
    const saved = await card(page, type);
    await page.getByTestId("save-draft").click();
    await page.getByTestId("reopen").click();
    await expect(page.getByLabel("Add element", { exact: true })).toBeEnabled();
    expect(await card(page, type)).toEqual(saved);
    await expect.poll(async () => Math.round((await preview.boundingBox())!.height)).toBe(height);
    await page.setViewportSize({ width: 375, height: 900 });
    await page
      .locator(`#fixture-editor [data-kg-card="${type}"]`)
      .click({ position: { x: 20, y: type === "horizontalrule" ? 1 : 10 } });
    await expect(page.locator(".koenig-resize-boundary")).toBeVisible();
    await contained(page);
    expect(await card(page, type)).toEqual(saved);
  });
  test(`${type}: direct drag updates dimensions live and is one undo action`, async ({ page }) => {
    await mount(page, type);
    await dimensions(page, type, 500, type === "horizontalrule" ? 3 : 300);
    const before = (await card(page, type)).portfolioLayout;
    const handle = page.getByRole("button", { name: "Resize bottom right", exact: true });
    await handle.scrollIntoViewIfNeeded();
    const bounds = (await handle.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      bounds.x + bounds.width / 2 + 80,
      bounds.y + bounds.height / 2 + (type === "horizontalrule" ? 2 : 60),
      { steps: 8 },
    );
    await expect.poll(async () => (await card(page, type)).portfolioLayout.width).toBe(580);
    await expect.poll(async () => Math.round((await actual(page)).width)).toBe(580);
    if (type !== "horizontalrule")
      await expect.poll(async () => Math.round((await actual(page)).height)).toBe(360);
    await expect(page.getByLabel("Custom width", { exact: true })).toHaveValue("580");
    await page.mouse.up();
    const after = (await card(page, type)).portfolioLayout;
    expect(after.height).toBe(type === "horizontalrule" ? 5 : 360);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await card(page, type)).portfolioLayout).toEqual(before);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect.poll(async () => (await card(page, type)).portfolioLayout).toEqual(after);
    await page.getByTestId("save-draft").click();
    await page.getByTestId("reopen").click();
    await expect(page.getByLabel("Add element", { exact: true })).toBeEnabled();
    expect((await card(page, type)).portfolioLayout).toEqual(after);
  });
}

test("image: exact sizes, aspect lock, percentages, mobile constraints and zoom-aware handles", async ({
  page,
}) => {
  await mount(page, "image", { zoom: 0.8 });
  for (const [width, height] of [
    [500, 300],
    [800, 600],
    [1000, 400],
  ])
    await dimensions(page, "image", width, height);
  await page.getByLabel("Lock aspect ratio", { exact: true }).check();
  await page.getByLabel("Custom width", { exact: true }).fill("500");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Custom height", { exact: true })).toHaveValue("200");
  const handle = page.getByRole("button", { name: "Resize right", exact: true });
  await handle.scrollIntoViewIfNeeded();
  const bounds = (await handle.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 80, bounds.y + bounds.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect.poll(async () => (await card(page, "image")).portfolioLayout.width).toBe(600);
  expect((await card(page, "image")).portfolioLayout.height).toBe(240);
  const saved = (await card(page, "image")).portfolioLayout;
  await page.setViewportSize({ width: 375, height: 900 });
  expect((await card(page, "image")).portfolioLayout).toEqual(saved);
  const editorWidth = await page
    .locator('#fixture-editor .portfolio-koenig > [data-kg="editor"] > .kg-prose')
    .evaluate((el) => el.clientWidth);
  expect((await actual(page)).width).toBeLessThanOrEqual(editorWidth + 1);
});

test("resize cancellation restores the previous node and keyboard handles remain usable", async ({
  page,
}) => {
  await mount(page, "image");
  await dimensions(page, "image", 500, 300);
  const before = (await card(page, "image")).portfolioLayout;
  const handle = page.getByRole("button", { name: "Resize bottom right", exact: true });
  await handle.scrollIntoViewIfNeeded();
  const bounds = (await handle.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 90, bounds.y + bounds.height / 2 + 50, {
    steps: 6,
  });
  await expect.poll(async () => (await card(page, "image")).portfolioLayout.width).toBe(590);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect((await card(page, "image")).portfolioLayout).toEqual(before);
  await handle.focus();
  await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(async () => (await card(page, "image")).portfolioLayout.width).toBe(510);
});

test("all eight handles resize their appropriate axes on the actual canvas", async ({ page }) => {
  await mount(page, "image");
  await dimensions(page, "image", 500, 300);
  for (const [edge, dx, dy] of [
    ["top left", -20, -10],
    ["top", 0, -10],
    ["top right", 20, -10],
    ["left", -20, 0],
    ["right", 20, 0],
    ["bottom left", -20, 10],
    ["bottom", 0, 10],
    ["bottom right", 20, 10],
  ] as const) {
    const before = (await card(page, "image")).portfolioLayout;
    const handle = page.getByRole("button", { name: `Resize ${edge}`, exact: true });
    await handle.scrollIntoViewIfNeeded();
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 4 });
    await page.mouse.up();
    const expectedWidth = before.width + Math.abs(dx),
      expectedHeight = before.height + Math.abs(dy);
    await expect.poll(async () => Math.round((await actual(page)).width)).toBe(expectedWidth);
    await expect.poll(async () => Math.round((await actual(page)).height)).toBe(expectedHeight);
  }
});

test("touch dragging resizes a card without rewriting dimensions on viewport changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await mount(page, "image");
  await dimensions(page, "image", 450, 300);
  const handle = page.getByRole("button", { name: "Resize bottom right", exact: true });
  await handle.scrollIntoViewIfNeeded();
  const box = (await handle.boundingBox())!,
    x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 5; step++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + (45 * step) / 5, y: y + (30 * step) / 5 }],
    });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(async () => (await card(page, "image")).portfolioLayout.width).toBe(495);
  expect((await card(page, "image")).portfolioLayout.height).toBe(330);
});

test("reset, original size and automatic height preserve intrinsic image dimensions", async ({
  page,
}) => {
  await mount(page, "image");
  await dimensions(page, "image", 800, 600);
  expect((await card(page, "image")).width).toBe(500);
  expect((await card(page, "image")).height).toBe(500);
  await page.getByRole("button", { name: "Original", exact: true }).click();
  await expect.poll(async () => Math.round((await actual(page)).width)).toBe(500);
  await expect.poll(async () => Math.round((await actual(page)).height)).toBe(500);
  await page.getByRole("button", { name: "Auto dimensions", exact: true }).click();
  expect((await card(page, "image")).portfolioLayout.width).toBeUndefined();
  expect((await card(page, "image")).portfolioLayout.height).toBeUndefined();
  await page.getByRole("button", { name: "Reset dimensions", exact: true }).click();
  expect((await card(page, "image")).portfolioLayout).toEqual({ align: "default", size: "full" });
});

test("property fields follow undo/redo even while an input still has focus", async ({ page }) => {
  await mount(page, "image");
  await dimensions(page, "image", 500, 300);
  const field = page.getByLabel("Custom width", { exact: true });
  await field.fill("700");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(field).toHaveValue("500");
  expect((await card(page, "image")).portfolioLayout.width).toBe(500);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(field).toHaveValue("700");
});

for (const type of ["image", "embed"])
  test(`${type}: percentage sizing keeps a locked ratio on mobile without changing saved dimensions`, async ({
    page,
  }) => {
    await mount(page, type);
    await dimensions(page, type, 500, 300);
    await page.getByLabel("Lock aspect ratio", { exact: true }).check();
    await page.getByLabel("Width unit", { exact: true }).selectOption("%");
    await page.getByLabel("Custom width", { exact: true }).fill("65");
    await page.keyboard.press("Tab");
    const saved = (await card(page, type)).portfolioLayout;
    await page.setViewportSize({ width: 375, height: 900 });
    const preview = page.locator(`#fixture-preview [data-portfolio-element="${type}"]`);
    await expect
      .poll(async () => {
        const box = (await preview.boundingBox())!;
        return box.width / box.height;
      })
      .toBeCloseTo(5 / 3, 2);
    await expect
      .poll(async () => {
        const box = await actual(page);
        return box.width / box.height;
      })
      .toBeCloseTo(5 / 3, 2);
    expect((await card(page, type)).portfolioLayout).toEqual(saved);
  });

test("ratio toggles preserve saved units and dimensions, including a constrained mobile canvas", async ({
  page,
}) => {
  await mount(page, "image");
  await dimensions(page, "image", 500, 300);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByLabel("Lock aspect ratio", { exact: true }).check();
  expect((await card(page, "image")).portfolioLayout).toMatchObject({
    width: 500,
    height: 300,
    unit: "px",
    locked: true,
  });
  await page.setViewportSize({ width: 1800, height: 1200 });
  await page.getByLabel("Width unit", { exact: true }).selectOption("%");
  await page.getByLabel("Custom width", { exact: true }).fill("65");
  await page.keyboard.press("Tab");
  const saved = (await card(page, "image")).portfolioLayout;
  await page.getByLabel("Lock aspect ratio", { exact: true }).uncheck();
  expect((await card(page, "image")).portfolioLayout).toMatchObject({
    width: saved.width,
    height: saved.height,
    unit: "%",
    locked: false,
  });
  await page.getByLabel("Lock aspect ratio", { exact: true }).check();
  await expect(page.getByLabel("Width unit", { exact: true })).toHaveValue("%");
  await page.getByLabel("Custom width", { exact: true }).fill("");
  await page.getByLabel("Lock aspect ratio", { exact: true }).uncheck();
  expect((await card(page, "image")).portfolioLayout).toMatchObject({ width: 100, unit: "%" });
});

test("locked numerical sizes preserve the ratio at minimum and maximum dimensions", async ({
  page,
}) => {
  await mount(page, "image");
  await dimensions(page, "image", 1000, 100);
  await page.getByLabel("Lock aspect ratio", { exact: true }).check();
  await page.getByLabel("Custom width", { exact: true }).fill("48");
  await page.keyboard.press("Tab");
  expect((await card(page, "image")).portfolioLayout).toMatchObject({ width: 240, height: 24 });
  await page.getByLabel("Custom height", { exact: true }).fill("8192");
  await page.keyboard.press("Tab");
  expect((await card(page, "image")).portfolioLayout).toMatchObject({ width: 8192, height: 819 });
});

test("selection handles follow the gallery when its settings panel changes height", async ({
  page,
}) => {
  await mount(page, "gallery");
  await dimensions(page, "gallery", 500, 300);
  await page
    .getByLabel("Add gallery images", { exact: true })
    .setInputFiles("public/images/profile.webp");
  await expect(page.getByLabel("Image 3 alt text", { exact: true })).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const target = document
          .querySelector('#fixture-editor [data-kg-card="gallery"] figure > div:first-child')!
          .getBoundingClientRect();
        const handles = document.querySelector(".koenig-resize-boundary")!.getBoundingClientRect();
        return Math.abs(target.top - handles.top) + Math.abs(target.left - handles.left);
      }),
    )
    .toBeLessThan(1);
  await contained(page);
});

test("selected resize handles stay behind the crop dialog", async ({ page }) => {
  await mount(page, "image");
  await dimensions(page, "image", 500, 300);
  await page
    .getByRole("button", { name: "Resize bottom right", exact: true })
    .scrollIntoViewIfNeeded();
  await page.evaluate(async () => {
    (await import(/* @vite-ignore */ "/tests/fixtures/koenig-editor.tsx")).openCropOverEditor();
  });
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("[data-resize-handle]")).toHaveCount(8);
  const aboveDialog = await page.locator("[data-resize-handle]").evaluateAll((handles) =>
    handles.some((handle) => {
      const box = handle.getBoundingClientRect();
      return document
        .elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
        ?.closest("[data-resize-handle]");
    }),
  );
  expect(aboveDialog).toBe(false);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("sized audio, video, downloads and toggles keep their native public interactions", async ({
  page,
}) => {
  const wav = Buffer.alloc(44 + 16000);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(16000, 40);
  await page.route("https://media.example.com/audio.wav", (route) =>
    route.fulfill({ contentType: "audio/wav", body: wav }),
  );
  await mount(page, "audio");
  await dimensions(page, "audio", 500, 300);
  const audio = page.locator("#fixture-preview audio");
  await audio.evaluate(async (el: HTMLAudioElement) => {
    el.muted = true;
    await el.play();
  });
  await expect
    .poll(async () => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0);
  await audio.evaluate((el: HTMLAudioElement) => el.pause());

  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const stream = canvas.captureStream(15),
      recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" }),
      chunks: Blob[] = [];
    await new Promise<void>((resolve) => {
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => resolve();
      recorder.start();
      canvas.getContext("2d")!.fillRect(0, 0, 160, 90);
      let frame = 0;
      const interval = setInterval(() => {
        canvas.getContext("2d")!.fillStyle = frame++ % 2 ? "white" : "black";
        canvas.getContext("2d")!.fillRect(0, 0, 80, 90);
      }, 50);
      setTimeout(() => {
        clearInterval(interval);
        recorder.stop();
      }, 1100);
    });
    stream.getTracks().forEach((track) => track.stop());
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  await page.route("https://media.example.com/video.webm", (route) =>
    route.fulfill({ contentType: "video/webm", body: Buffer.from(bytes) }),
  );
  await mount(page, "video");
  await dimensions(page, "video", 500, 300);
  const video = page.locator("#fixture-preview video");
  await video.evaluate(async (el: HTMLVideoElement) => {
    el.muted = true;
    await el.play();
  });
  await expect
    .poll(async () => video.evaluate((el: HTMLVideoElement) => el.currentTime))
    .toBeGreaterThan(0);

  await page.context().route("https://media.example.com/file.pdf", (route) =>
    route.fulfill({
      contentType: "application/octet-stream",
      headers: { "content-disposition": 'attachment; filename="file.pdf"' },
      body: "%PDF-1.4\n%%EOF",
    }),
  );
  await mount(page, "file");
  await dimensions(page, "file", 500, 300);
  const link = page.locator('#fixture-preview a[href="https://media.example.com/file.pdf"]');
  const pendingDownload = page.waitForEvent("download", { timeout: 8000 });
  await link.click();
  expect((await pendingDownload).suggestedFilename()).toBe("file.pdf");

  await mount(page, "toggle");
  await dimensions(page, "toggle", 500, 300);
  await page.locator("#fixture-preview summary").click();
  await expect(page.locator("#fixture-preview details")).toHaveAttribute("open", "");
  await expect(page.locator("#fixture-preview .kg-toggle-content")).toBeVisible();
});
