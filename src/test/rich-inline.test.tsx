import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { hasRich, parseRich, plainText, Rich } from "@/lib/rich-inline";
import { PreviewPane } from "@/components/admin/cms/PreviewPane";

describe("inline formatting", () => {
  it("parses bold, italic, underline and fonts (nested)", () => {
    expect(parseRich("a **b** c")).toEqual(["a ", { t: "b", c: ["b"] }, " c"]);
    expect(parseRich("*it* and __u__")).toEqual([
      { t: "i", c: ["it"] },
      " and ",
      { t: "u", c: ["u"] },
    ]);
    expect(parseRich("[font:sans]**Hi**[/font]")).toEqual([
      { t: "f", font: "sans", c: [{ t: "b", c: ["Hi"] }] },
    ]);
  });

  it("leaves ordinary text alone", () => {
    for (const s of ["C++ and C#", "5 * 3 * 2", "snake_case_name", "AWS, GCP, OCI", "**unclosed"]) {
      expect(plainText(s)).toBe(s);
    }
    expect(hasRich("Python")).toBe(false);
    expect(hasRich("**Python**")).toBe(true);
  });

  it("supports escaping and rejects unknown fonts", () => {
    expect(plainText("\\*literal\\*")).toBe("*literal*");
    expect(parseRich("[font:evil;color:red]x[/font]")).toEqual(["[font:evil;color:red]x[/font]"]);
  });

  it("renders elements, never HTML", () => {
    const { container } = render(
      <p>
        <Rich text={"**Bold** <img src=x onerror=alert(1)> [font:serif]Serif[/font]"} />
      </p>,
    );
    expect(container.querySelector("strong")?.textContent).toBe("Bold");
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
    const span = container.querySelector("span[style]") as HTMLElement;
    expect(span.style.fontFamily).toContain("Libre Baskerville");
  });

  it("strips marks for meta tags", () => {
    expect(plainText("**AI** *Engineer* [font:sans]Portfolio[/font]")).toBe("AI Engineer Portfolio");
  });
});

describe("admin preview pane", () => {
  it("switches between editor, split and preview", () => {
    render(
      <PreviewPane renderEditor={() => <p>EDITOR</p>} renderPreview={() => <p>PREVIEW</p>} />,
    );
    expect(screen.getByText("EDITOR")).toBeTruthy();
    expect(screen.queryByText("PREVIEW")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Split" }));
    expect(screen.getByText("EDITOR")).toBeTruthy();
    expect(screen.getByText("PREVIEW")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.queryByText("EDITOR")).toBeNull();
    expect(screen.getByRole("button", { name: "Preview" }).getAttribute("aria-pressed")).toBe("true");
  });
});
