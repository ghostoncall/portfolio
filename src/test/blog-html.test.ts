/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures */
import { describe, expect, it } from "vitest";
import { bodyImages, prepareBlogHtml } from "@/lib/blog-html";
import { readingMinutes, readTimeLabel } from "@/lib/reading-time";

const fig = (src: string) =>
  `<figure class="kg-card kg-image-card"><img src="${src}" alt="a" width="800" height="600"></figure>`;

describe("prepareBlogHtml", () => {
  it("strips scripts, inline handlers and javascript: links, but not prose", () => {
    const out = prepareBlogHtml(
      `<p onclick="x()">only = 5 and someone=me</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>`,
    );
    expect(out).not.toMatch(/script|onclick|javascript:/i);
    expect(out).toContain("only = 5 and someone=me");
  });

  it("first image eager + high priority, later images lazy", () => {
    const out = prepareBlogHtml(fig("/a.webp") + fig("/b.webp"));
    const imgs = out.match(/<img[^>]*>/g)!;
    expect(imgs[0]).toMatch(/loading="eager"/);
    expect(imgs[0]).toMatch(/fetchpriority="high"/);
    expect(imgs[1]).toMatch(/loading="lazy"/);
    expect(imgs[1]).toMatch(/decoding="async"/);
  });

  it("applies per-image layouts by src", () => {
    const out = prepareBlogHtml(fig("/a.webp") + fig("/b.webp"), {
      imageLayouts: { "/b.webp": { align: "right", size: "s" } },
    });
    expect(out).toMatch(/kg-image-card kg-layout-right kg-size-s"><img src="\/b\.webp"/);
    expect(out).not.toMatch(/kg-layout[^"]*"><img src="\/a\.webp"/);
  });

  it("turns YouTube iframes into click-to-play placeholders", () => {
    const out = prepareBlogHtml(
      `<figure class="kg-card kg-embed-card"><iframe width="200" height="113" src="https://www.youtube.com/embed/dQw4w9WgXcQ?feature=oembed" title="Demo"></iframe></figure>`,
    );
    expect(out).not.toMatch(/<iframe/);
    expect(out).toContain(
      'data-embed="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&amp;rel=0"',
    );
    expect(out).toContain('aria-label="Play video: Demo"');
  });

  it("replaces an old image alignment even with single-quoted figure classes", () => {
    const out = prepareBlogHtml(
      `<figure class='kg-card kg-image-card kg-layout-right kg-size-l'><img src="/x?a=1&amp;b=2"></figure>`,
      {
        imageLayouts: { "/x?a=1&b=2": { align: "left", size: "s" } },
      },
    );
    expect(out).toContain('class="kg-card kg-image-card kg-layout-left kg-size-s"');
    expect(out).not.toContain("kg-layout-right");
    expect(bodyImages(out)[0]?.src).toBe("/x?a=1&b=2");
  });

  it("replaces non-allowlisted iframes with a link", () => {
    const out = prepareBlogHtml(`<iframe src="https://evil.example/x"></iframe>`);
    expect(out).not.toMatch(/<iframe/);
    expect(out).toContain('href="https://evil.example/x"');
  });

  it("opens external links in a new tab, keeps own-site links", () => {
    const out = prepareBlogHtml(
      `<a href="https://github.com/x">gh</a><a href="https://www.mysite.com/a">own</a><a href="/b">rel</a>`,
      { siteHost: "mysite.com" },
    );
    expect(out).toContain(
      '<a href="https://github.com/x" target="_blank" rel="noopener noreferrer">',
    );
    expect(out).toContain('<a href="https://www.mysite.com/a">');
    expect(out).toContain('<a href="/b">');
  });

  it("lists body images for the editor", () => {
    expect(bodyImages(fig("/a.webp") + fig("/a.webp") + fig("/c.png"))).toEqual([
      { src: "/a.webp", alt: "a" },
      { src: "/c.png", alt: "a" },
    ]);
  });
});

describe("reading time", () => {
  const post = (html: string) => ({ body: { html, lexical: {} }, blocks: [] }) as any;

  it("never shows zero minutes", () => {
    expect(readingMinutes(post("<p>Hi</p>"))).toBe(1);
  });

  it("counts words at ~230 wpm, ignoring markup", () => {
    const words = Array.from({ length: 690 }, () => "word").join(" ");
    expect(readingMinutes(post(`<p class="x">${words}</p>`))).toBe(3);
  });

  it("adds time for images and embeds", () => {
    const words = Array.from({ length: 460 }, () => "word").join(" ");
    const base = readingMinutes(post(`<p>${words}</p>`));
    const imgs = Array.from({ length: 6 }, () => '<img src="/x.webp">').join("");
    expect(readingMinutes(post(`<p>${words}</p>${imgs}`))).toBeGreaterThan(base);
  });

  it("respects a manual override only in manual mode", () => {
    const p = { ...post("<p>Hi</p>"), readTime: "12 min read" };
    expect(readTimeLabel({ ...p, readTimeMode: "manual" })).toBe("12 min read");
    expect(readTimeLabel({ ...p, readTimeMode: "auto" })).toBe("1 min read");
  });
});
