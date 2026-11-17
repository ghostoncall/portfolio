import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AwardTile } from "@/components/public/AwardTile";

const base = { id: "a1", title: "3rd place, ML Hackathon", sort: 0 };

describe("AwardTile images", () => {
  it("renders no image or empty space when the award has no image", () => {
    const { container } = render(<AwardTile award={base} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("button", { name: /view image/i })).toBeNull();
  });

  it("shows the thumbnail and opens the full image; Escape closes it", async () => {
    render(
      <AwardTile
        award={{
          ...base,
          thumbnail: {
            src: "https://cdn.example/full.webp",
            thumb: "https://cdn.example/thumb.webp",
            width: 1600,
            height: 1200,
            thumbWidth: 480,
            thumbHeight: 360,
            alt: "Certificate",
          },
        }}
      />,
    );
    const thumb = screen.getByRole("button", { name: /view image: 3rd place/i });
    const img = thumb.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("https://cdn.example/thumb.webp");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("width")).toBe("480");

    fireEvent.click(thumb);
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector('img[src="https://cdn.example/full.webp"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: /close/i })).toBeTruthy();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("falls back to a legacy image field", () => {
    render(<AwardTile award={{ ...base, image: { src: "/images/old.png", alt: "Old" } }} />);
    expect(screen.getByRole("button", { name: /view image/i })).toBeTruthy();
  });
});
