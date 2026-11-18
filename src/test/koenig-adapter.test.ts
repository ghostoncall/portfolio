import { describe, expect, it } from "vitest";
import { standaloneCard } from "@/components/admin/koenig/standalone";
import { withLegacyLayouts } from "@/components/admin/koenig/layout";
import { OEMBED_PROVIDERS } from "@/lib/oembed-providers";
import { prepareBlogHtml } from "@/lib/blog-html";

describe("Koenig compatibility", () => {
  it("adopts legacy layouts without mutating the original saved post or overriding node metadata", () => {
    const body = {
      root: {
        children: [
          { type: "image", src: "/same.jpg" },
          { type: "image", src: "/same.jpg", portfolioLayout: { align: "right", size: "l" } },
        ],
      },
    };
    const original = JSON.stringify(body);
    const migrated = withLegacyLayouts(body, { "/same.jpg": { align: "left", size: "s" } });
    expect(JSON.stringify(body)).toBe(original);
    expect(JSON.stringify(migrated)).toContain('"align":"left"');
    expect(JSON.stringify(migrated)).toContain('"align":"right"');
  });
  it("retains authoritative node HTML despite an old image map", () => {
    const html =
      '<figure class="kg-card kg-image-card kg-layout-right" data-portfolio-layout="right"><img src="/same.jpg"></figure>';
    expect(prepareBlogHtml(html, { imageLayouts: { "/same.jpg": { align: "left" } } })).toContain(
      "kg-layout-right",
    );
  });
  it("keeps native audio and video exports playable without Ghost frontend scripts", () => {
    const node = document.createElement("div");
    node.innerHTML =
      '<audio src="/track.wav"></audio><div class="kg-audio-player"><button>Inert control</button></div>';
    standaloneCard(node, "audio");
    expect(node.querySelector("audio")!.controls).toBe(true);
    expect(node.querySelector("audio")!.getAttribute("src")).toBe("/track.wav");
    expect(node.querySelector("button")).toBeNull();
    const video = document.createElement("figure");
    video.setAttribute("data-kg-custom-thumbnail", "/poster.jpg");
    video.innerHTML =
      '<video src="/movie.mp4" loop muted></video><figcaption>Caption</figcaption><div class="kg-video-overlay"><button>Play</button></div>';
    standaloneCard(video, "video");
    expect(video.querySelector("video")!.controls).toBe(true);
    expect(video.querySelector("video")!.loop).toBe(true);
    expect(video.querySelector("video")!.getAttribute("poster")).toBe("/poster.jpg");
    expect(video.querySelector("figcaption")!.textContent).toBe("Caption");
  });
  it("keeps toggle heading/content in a keyboard-operable native disclosure", () => {
    const node = document.createElement("div");
    node.innerHTML =
      '<div class="kg-toggle-heading"><h4 class="kg-toggle-heading-text">Heading</h4><button>Expand</button></div><div class="kg-toggle-content"><p>Content</p></div>';
    standaloneCard(node, "toggle");
    expect(node.querySelector("details > summary")!.textContent).toBe("Heading");
    expect(node.querySelector("details .kg-toggle-content")!.textContent).toBe("Content");
  });
  it("retains video options, private Vimeo tokens and custom responsive ratios through preview sanitization", () => {
    const youtube = prepareBlogHtml(
      '<iframe src="https://www.youtube.com/embed/AAAAAAAAAAA?start=35&amp;controls=0&amp;loop=1&amp;playlist=AAAAAAAAAAA" data-portfolio-embed-ratio="4/3"></iframe>',
    );
    expect(youtube).toContain("start=35");
    expect(youtube).toContain("controls=0");
    expect(youtube).toContain("loop=1");
    expect(youtube).toContain("aspect-ratio: 4 / 3");
    expect(youtube).not.toContain("<iframe");
    expect(
      prepareBlogHtml('<iframe src="https://player.vimeo.com/video/123?h=abc123"></iframe>'),
    ).toContain("h=abc123");
  });
  it("matches only fixed official provider hosts, with no lookalike-host escape", () => {
    for (const url of [
      "https://youtu.be/AAAAAAAAAAA",
      "https://vimeo.com/123",
      "https://open.spotify.com/track/abc",
      "https://soundcloud.com/user/track",
      "https://codepen.io/user/pen/abc",
      "https://x.com/user/status/123",
    ])
      expect(OEMBED_PROVIDERS.some((p) => p.test.test(url))).toBe(true);
    for (const url of [
      "https://open.spotify.com.evil.test/track",
      "https://youtube.com.evil.test/watch",
      "https://soundcloud.com@evil.test/x",
      "http://127.0.0.1/x",
    ])
      expect(OEMBED_PROVIDERS.some((p) => p.test.test(url))).toBe(false);
    const soundcloud = prepareBlogHtml(
      '<iframe src="https://w.soundcloud.com/player/?url=x"></iframe><script>alert(1)</script>',
    );
    expect(soundcloud).toContain('<iframe loading="lazy"');
    expect(soundcloud).not.toContain("<script");
  });
});
