/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures */
import { describe, expect, it } from "vitest";
import { cleanCopy, copyText, featuredCount, pageCopy, safeImageSrc } from "@/lib/site-copy";
import { mergePage, mergeProjects } from "@/lib/merge-additions";
import { buildNav, childActive } from "@/components/site-nav";
import * as add from "@/content/additions";

const site = (copy: any = {}) => ({ name: "Ada", title: "AI", edition: "", email: "", socials: [], copy }) as any;

describe("editable page copy", () => {
  it("falls back to defaults and lets admins override titles and labels", () => {
    expect(pageCopy(site(), "contact").title).toBe("Correspondence");
    expect(pageCopy(site(), "overview").title).toBe("Ada");
    const custom = site({ pages: { contact: { title: "Say hello", navLabel: "Write" } } });
    expect(pageCopy(custom, "contact")).toMatchObject({ title: "Say hello", navLabel: "Write" });
    // A blank title can't hide a page heading — it falls back to the default.
    expect(pageCopy(site({ pages: { skills: { title: "  " } } }), "skills").title).toBe("Skills");
  });

  it("hides optional lines when they are cleared", () => {
    expect(copyText(site(), "featuredHeading")).toBe("Featured Work");
    expect(copyText(site({ featuredHeading: "" }), "featuredHeading")).toBe("");
    expect(copyText(site({ contactFormNote: "" }), "contactFormNote")).toBe("");
    // The home brand is never blank (the header would be empty).
    expect(copyText(site({ homeBrand: "" }), "homeBrand")).toBe("engineerthisaryan");
  });

  it("clamps the featured count and sanitises saved copy", () => {
    expect(featuredCount(site())).toBe(3);
    expect(featuredCount(site({ featuredCount: 99 }))).toBe(12);
    const cleaned = cleanCopy({
      featuredHeading: "",
      pages: { contact: { title: " Hi ", navLabel: "" }, bogus: { title: "x" } },
      evil: "<script>",
    } as any);
    expect(cleaned).toEqual({ featuredHeading: "", pages: { contact: { title: "Hi" } } });
  });

  it("only allows same-site or http(s) image sources", () => {
    expect(safeImageSrc("/images/me.webp")).toBe("/images/me.webp");
    expect(safeImageSrc("https://cdn.example/me.jpg")).toBe("https://cdn.example/me.jpg");
    expect(safeImageSrc("javascript:alert(1)")).toBe("");
    expect(safeImageSrc("//evil.example/x.png")).toBe("");
  });
});

describe("single source of truth for code-defined content", () => {
  it("stops appending additions once a page is owned by the admin", () => {
    const owned = { kind: "education", entries: [], additionsApplied: true };
    expect(mergePage("education", owned)).toBe(owned);
    // Not yet owned: the code entries are still merged in (unchanged behaviour).
    const before = mergePage("education", { kind: "education", entries: [] });
    expect(before.entries.length).toBe(add.education.entries.length);
  });

  it("keeps cleared fields cleared after adoption", () => {
    const btech = { ...add.education.entries[0]!, specialization: undefined };
    const owned = { kind: "education", entries: [btech], additionsApplied: true };
    expect(mergePage("education", owned).entries[0].specialization).toBeUndefined();
  });

  it("does not resurrect deleted projects once adopted", () => {
    expect(mergeProjects([], false, true)).toEqual([]);
    expect(mergeProjects([], false, false).length).toBe(add.projects.length);
  });
});

describe("navigation model", () => {
  it("uses admin labels and order, and marks sub-pages active", () => {
    const nav = buildNav(site({ pages: { contact: { navLabel: "Write to me" } } }), ["contact", "overview"], [
      { slug: "rag", title: "RAG" },
    ]);
    expect(nav[0]!.slug).toBe("contact");
    expect(nav[0]!.label).toBe("Write to me");
    const projects = nav.find((n) => n.slug === "projects")!;
    expect(projects.children?.map((c) => c.label)).toEqual(["RAG"]);
    expect(projects.isActive("/projects/rag")).toBe(true);
    expect(childActive(projects.children![0]!, "/projects/rag/")).toBe(true);
    const skills = nav.find((n) => n.slug === "skills")!;
    expect(skills.isActive("/awards")).toBe(true);
    expect(nav.find((n) => n.slug === "overview")!.isActive("/blog")).toBe(false);
  });
});
