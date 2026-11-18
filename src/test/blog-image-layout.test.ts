import { describe, expect, it } from "vitest";
import { imageLayoutForSource, syncEditorImageLayouts } from "@/lib/blog-image-layout";
import { blogThemeVars, DEFAULT_BLOG_SETTINGS, validBodyFontSize } from "@/lib/blog-settings";

describe("Blog image editing", () => {
  it("updates the actual image container and resets to its native layout", () => {
    const host = document.createElement("div");
    host.innerHTML = `<div class="kg-prose" contenteditable="true"><div data-lexical-decorator="true"><div data-kg-card="image"><figure><img src="/photo.jpg"></figure></div></div><p>Article text</p></div>`;
    const root = host.firstElementChild!;
    const wrapper = root.firstElementChild!;
    const img = host.querySelector("img");
    syncEditorImageLayouts(host, { "/photo.jpg": { align: "left", size: "s" } });
    expect(root.classList.contains("kg-content")).toBe(true);
    expect(wrapper.className).toBe("kg-layout-left kg-size-s");
    syncEditorImageLayouts(host, { "/photo.jpg": { align: "right", size: "l" } });
    expect(wrapper.className).toBe("kg-layout-right kg-size-l");
    syncEditorImageLayouts(host, {});
    expect(wrapper.className).toBe("");
    expect(wrapper.hasAttribute("data-blog-image-layout")).toBe(false);
    expect(host.querySelector("img")).toBe(img);
    expect(host.querySelector("p")?.textContent).toBe("Article text");
  });

  it("matches saved image URLs with HTML-escaped query parameters", () => {
    const layout = { align: "left", size: "s" } as const;
    expect(imageLayoutForSource({ "/photo?a=1&b=2": layout }, "/photo?a=1&amp;b=2")).toBe(layout);
    expect(imageLayoutForSource({ "/photo?a=1&amp;b=2": layout }, "/photo?a=1&b=2")).toBe(layout);
  });
});

describe("Blog body type size", () => {
  it("uses the saved theme by default and retains a post's explicit body size", () => {
    const theme = {
      ...DEFAULT_BLOG_SETTINGS,
      typography: { ...DEFAULT_BLOG_SETTINGS.typography, baseSize: 18 },
    };
    expect(blogThemeVars(theme)["--blog-font-size"]).toBe("18px");
    expect(blogThemeVars(theme, 20)["--blog-font-size"]).toBe("20px");
    expect(blogThemeVars(theme, Number.NaN)["--blog-font-size"]).toBe("18px");
    expect(validBodyFontSize(200)).toBeUndefined();
  });
});
