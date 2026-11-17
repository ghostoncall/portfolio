/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures */
import { describe, expect, it } from "vitest";
import { cleanHeadingStyle, headingInlineStyle, typographyCss } from "@/lib/typography";
import { mergePage } from "@/lib/merge-additions";

describe("heading typography", () => {
  it("emits CSS variables only for chosen options", () => {
    expect(typographyCss(undefined)).toBe("");
    expect(
      typographyCss({ titles: { font: "sans", bold: true }, headings: { italic: true } }),
    ).toBe(
      ':root{--title-font:"Lato", system-ui, sans-serif;--title-weight:700;--heading-style:italic}',
    );
  });

  it("never interpolates unknown values (no CSS injection)", () => {
    const evil = { titles: { font: "x;}body{display:none" as any, bold: "yes" as any } };
    expect(typographyCss(evil)).toBe("");
    expect(cleanHeadingStyle({ font: "}</style><script>", italic: true })).toEqual({
      italic: true,
    });
  });

  it("per-heading inline style can switch bold/italic off", () => {
    expect(headingInlineStyle({ font: "serif", bold: false, italic: true })).toEqual({
      fontFamily: '"Libre Baskerville", Georgia, serif',
      fontWeight: 400,
      fontStyle: "italic",
    });
  });
});

describe("overview additions", () => {
  it("are appended only when missing, and never once the admin owns the page", () => {
    const fromDb = { kind: "blocks", blocks: [{ type: "text", body: "Hello" }] };
    const merged = mergePage("overview", fromDb);
    expect(merged.blocks.length).toBe(2);
    // Running the merge on already-merged content doesn't duplicate.
    expect(mergePage("overview", merged).blocks.length).toBe(2);
    // After the admin saved the page in the editor, it is exactly what they saved.
    const owned = {
      kind: "blocks",
      blocks: [{ type: "text", body: "Only this" }],
      additionsApplied: true,
    };
    expect(mergePage("overview", owned).blocks).toEqual(owned.blocks);
  });
});
