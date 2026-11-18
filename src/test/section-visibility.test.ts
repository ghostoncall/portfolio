import { describe, expect, it } from "vitest";
import { buildNav } from "@/components/site-nav";
import { cleanCopy, pageCopy, PUBLIC_PAGE_SLUGS } from "@/lib/site-copy";
import {
  sectionForPath,
  sectionSettingsId,
  sectionVisible,
  visibilityFromRows,
  publicPathVisible,
  type SectionVisibility,
} from "@/lib/section-visibility";
import { siteFromRoot } from "@/lib/root-data";
import type { SiteIdentity } from "@/db/schema";

const site: SiteIdentity = {
  name: "Ada",
  title: "Engineer",
  edition: "2026",
  email: "",
  socials: [],
  copy: {
    pages: {
      skills: { navLabel: "Skills and Certificates", childNavLabel: "Technical Skills" },
      awards: { navLabel: "Achievements" },
    },
  },
};

describe("section visibility and navigation", () => {
  it("defaults old settings to visible and reads the existing résumé flag without a migration", () => {
    const flags = visibilityFromRows([
      { id: "resume", published: { current: { fileName: "CV.pdf" }, visible: false } },
    ]);
    expect(sectionSettingsId("resume")).toBe("resume");
    expect(flags.resume).toBe(false);
    for (const section of PUBLIC_PAGE_SLUGS.filter((section) => section !== "resume"))
      expect(sectionVisible(flags, section)).toBe(true);
  });

  it("changes labels without changing headings, routes or section identities", () => {
    const before = buildNav(undefined, null, []);
    const after = buildNav(site, null, []);
    expect(after.map(({ slug, to }) => ({ slug, to }))).toEqual(
      before.map(({ slug, to }) => ({ slug, to })),
    );
    const skills = after.find((entry) => entry.slug === "skills")!;
    expect(skills.label).toBe("Skills and Certificates");
    expect(skills.children).toContainEqual({
      key: "skills",
      label: "Technical Skills",
      to: "/skills",
    });
    expect(skills.children).toContainEqual({ key: "awards", label: "Achievements", to: "/awards" });
    expect(pageCopy(site, "skills").title).toBe("Skills");
    expect(cleanCopy(site.copy)).toEqual(site.copy);
    expect(
      pageCopy({ ...site, copy: { pages: { skills: { navLabel: " " } } } }, "skills").navLabel,
    ).toBe("Skills, Certificates & Awards");
  });

  it("hides each section independently and never leaves a menu pointing at a hidden section", () => {
    for (const hidden of PUBLIC_PAGE_SLUGS) {
      const flags = { [hidden]: false };
      const nav = buildNav(site, ["contact", "skills", "education"], [], true, flags);
      for (const entry of nav) {
        expect(publicPathVisible(flags, entry.to)).toBe(true);
        for (const child of entry.children ?? [])
          expect(publicPathVisible(flags, child.to)).toBe(true);
      }
      if (hidden === "skills")
        expect(nav.find((entry) => entry.slug === "skills")?.to).toBe("/certificates");
      else if (!["certificates", "awards"].includes(hidden))
        expect(nav.some((entry) => entry.slug === hidden)).toBe(false);
    }
    expect(
      buildNav(site, null, [], true, { skills: false, certificates: false, awards: false }).some(
        (entry) => entry.slug === "skills",
      ),
    ).toBe(false);
    const onlyAwards = buildNav(site, null, [], true, { skills: false, certificates: false }).find(
      (entry) => entry.slug === "skills",
    )!;
    expect(onlyAwards.to).toBe("/awards");
    expect(onlyAwards.children).toEqual([{ key: "awards", label: "Achievements", to: "/awards" }]);
  });

  it("restores original labels, order, links and all saved content after hiding/showing", () => {
    const award = {
      image: { src: "/images/profile.jpeg", alt: "Award" },
      description: "**Formatted**",
      metadata: { year: 2026 },
    };
    const row = { id: "section:awards", published: { visible: false, content: award } };
    const snapshot = structuredClone(row);
    const order = ["experience", "skills", "overview"];
    const hidden = buildNav(site, order, [], true, visibilityFromRows([row]));
    expect(
      hidden
        .find((entry) => entry.slug === "skills")
        ?.children?.some((child) => child.key === "awards"),
    ).toBe(false);
    expect(row).toEqual(snapshot);
    const shown = buildNav(
      site,
      order,
      [],
      true,
      visibilityFromRows([{ ...row, published: { ...row.published, visible: true } }]),
    );
    const entries = (nav: ReturnType<typeof buildNav>) =>
      nav.map(({ isActive: _active, ...entry }) => entry);
    expect(entries(shown)).toEqual(entries(buildNav(site, order, [], true)));
    expect(
      shown
        .find((entry) => entry.slug === "skills")
        ?.children?.find((child) => child.key === "awards")?.label,
    ).toBe("Achievements");
    expect(row.published.content).toEqual(award);
  });

  it("covers descendant URLs and leaves unknown/non-section routes alone", () => {
    expect(sectionForPath("/projects/example?x=1#anchor")).toBe("projects");
    expect(sectionForPath("/blog/journal/")).toBe("blog");
    expect(sectionForPath("/cv/download")).toBe("resume");
    expect(sectionForPath("/onlyme/awards")).toBeUndefined();
    expect(publicPathVisible({ projects: false }, "/projects/example")).toBe(false);
    expect(publicPathVisible({ projects: false }, "/projectsdifferent")).toBe(true);
  });

  it("guards direct URLs and sends a hidden homepage to the first visible section", async () => {
    const parent = (sectionVisibility: SectionVisibility) =>
      Promise.resolve({
        loaderData: {
          site,
          sectionVisibility,
          navOrder: [
            "projects",
            "skills",
            "education",
            "blog",
            "experience",
            "volunteering",
            "resume",
            "contact",
            "overview",
          ],
        },
      });
    await expect(siteFromRoot(parent({ awards: false }), "awards")).rejects.toMatchObject({
      isNotFound: true,
      routeId: "__root__",
    });
    await expect(
      siteFromRoot(parent({ overview: false, projects: false, skills: false }), "overview"),
    ).rejects.toMatchObject({ options: { to: "/certificates" } });
    await expect(
      siteFromRoot(
        parent(Object.fromEntries(PUBLIC_PAGE_SLUGS.map((section) => [section, false]))),
        "overview",
      ),
    ).rejects.toMatchObject({ isNotFound: true });
    await expect(siteFromRoot(parent({}), "awards")).resolves.toEqual(site);
  });
});
