import { describe, expect, it } from "vitest";
import { normalizeLayout, layoutWidth } from "@/components/admin/koenig/layout";
import {
  resizedDimensions,
  RESIZE_EDGES,
  sizingRatio,
  SIZE_TYPES,
} from "@/components/admin/koenig/sizing";
import { prepareBlogHtml } from "@/lib/blog-html";

describe("Koenig document dimensions", () => {
  it("preserves old custom widths and new independent dimensions without overwriting intrinsic size", () => {
    expect(normalizeLayout({ align: "left", size: "custom", width: 500, unit: "px" })).toEqual({
      align: "left",
      size: "custom",
      width: 500,
      unit: "px",
    });
    const layout = {
      align: "center",
      size: "custom",
      width: 800,
      height: 600,
      unit: "px",
      locked: false,
      aspectRatio: 4 / 3,
    } as const;
    expect(normalizeLayout(JSON.parse(JSON.stringify(layout)))).toEqual(layout);
    expect(layoutWidth(layout, 1600)).toBe("min(100%, 800px)");
    expect(normalizeLayout({ ...layout, width: -1 })).toBeNull();
    expect(normalizeLayout({ ...layout, height: Infinity })).toBeNull();
  });
  it("supports auto dimensions and percentage widths with a definite pixel height", () => {
    expect(normalizeLayout({ align: "center", size: "custom", locked: true })).toEqual({
      align: "center",
      size: "custom",
      unit: "px",
      locked: true,
    });
    expect(
      layoutWidth({ align: "center", size: "custom", width: 65, unit: "%", height: 300 }),
    ).toBe("min(100%, 65%)");
  });
  it("respects all eight handles, side axes, aspect ratios, and article boundaries", () => {
    expect(RESIZE_EDGES).toHaveLength(8);
    expect(SIZE_TYPES.size).toBe(16);
    expect(resizedDimensions(500, 300, 80, 60, "se", false, 5 / 3, "image", 1500)).toEqual({
      width: 580,
      height: 360,
    });
    expect(resizedDimensions(500, 300, 80, 60, "e", false, 5 / 3, "image", 1500)).toEqual({
      width: 580,
      height: 300,
    });
    expect(resizedDimensions(500, 300, 80, 60, "s", false, 5 / 3, "image", 1500)).toEqual({
      width: 500,
      height: 360,
    });
    expect(resizedDimensions(500, 300, -80, -60, "nw", false, 5 / 3, "image", 1500)).toEqual({
      width: 580,
      height: 360,
    });
    expect(resizedDimensions(500, 300, 100, 0, "e", true, 5 / 3, "image", 1500)).toEqual({
      width: 600,
      height: 360,
    });
    expect(resizedDimensions(500, 300, 2000, 0, "e", true, 5 / 3, "image", 900)).toEqual({
      width: 900,
      height: 540,
    });
    expect(resizedDimensions(500, 3, 50, 200, "se", false, 1, "horizontalrule", 1500)).toEqual({
      width: 550,
      height: 32,
    });
  });
  it("uses original image/video dimensions until the author explicitly locks a different ratio", () => {
    expect(sizingRatio(null, { width: 1600, height: 900 }, 500, 500)).toBe(16 / 9);
    expect(
      sizingRatio(
        { align: "center", size: "custom", aspectRatio: 2 },
        { width: 1600, height: 900 },
        500,
        300,
      ),
    ).toBe(2);
  });
  it("keeps sized video facades at their saved geometry without admitting arbitrary CSS", () => {
    const html =
      '<iframe src="https://www.youtube.com/embed/AAAAAAAAAAA" data-portfolio-frame-width="500" data-portfolio-frame-height="300"></iframe>';
    expect(prepareBlogHtml(html)).toContain('data-portfolio-element="embed"');
    expect(prepareBlogHtml(html)).toContain("height:min(300px, calc(100cqw * 0.6))");
    expect(prepareBlogHtml(html.replace('height="300"', 'height="url(evil)"'))).not.toContain(
      "url(evil)",
    );
  });
});
