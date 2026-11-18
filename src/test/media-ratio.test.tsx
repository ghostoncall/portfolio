import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BlockEditor } from "@/components/admin/BlockEditor";
import { MediaItemFields } from "@/components/admin/MediaPicker";
import { Media, resolveMediaAspectRatio, type MediaItem } from "@/components/media";

describe("natural media ratios", () => {
  it("uses stored intrinsic dimensions for a natural banner", () => {
    const item: MediaItem = {
      src: "/banner.webp",
      alt: "Wide banner",
      width: 2400,
      height: 800,
    };

    expect(resolveMediaAspectRatio(item, "natural")).toBe("2400/800");

    render(<Media items={[item]} ratio="natural" fit="cover" position="top" />);
    const image = screen.getByRole("img", { name: "Wide banner" });
    expect(image).toHaveAttribute("width", "2400");
    expect(image).toHaveAttribute("height", "800");
    expect(image).toHaveStyle({ objectPosition: "top" });
    expect(image.parentElement?.style.aspectRatio).toContain("2400");
  });

  it("preserves the legacy 16/9 default when an old block has no ratio metadata", () => {
    render(<Media items={[{ src: "/legacy.jpg", alt: "Legacy" }]} />);
    const image = screen.getByRole("img", { name: "Legacy" });
    expect(image.parentElement?.style.aspectRatio).toContain("16");
    expect(image).toHaveClass("object-cover");
  });

  it("lets an unknown external image flow at its natural size", () => {
    render(<Media items={[{ src: "/unknown.jpg", alt: "Unknown" }]} ratio="natural" />);
    const image = screen.getByRole("img", { name: "Unknown" });
    expect(image.parentElement?.style.aspectRatio ?? "").toBe("");
    expect(image).toHaveClass("h-auto", "w-full");
  });

  it("keeps intrinsic metadata when another media field changes", () => {
    const onChange = vi.fn();
    render(
      <MediaItemFields
        label="Banner"
        value={{ src: "/banner.webp", alt: "Before", width: 2400, height: 800 }}
        onChange={onChange}
        previewRatio="natural"
      />,
    );

    fireEvent.change(screen.getByLabelText("Banner alt text"), {
      target: { value: "After" },
    });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        src: "/banner.webp",
        alt: "After",
        width: 2400,
        height: 800,
      }),
    );
  });

  it("defaults newly added media blocks to Natural without changing existing blocks", () => {
    const onChange = vi.fn();
    render(<BlockEditor blocks={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Media$/ }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        type: "media",
        ratio: "natural",
        fit: "contain",
      }),
    ]);
  });
});
