import { describe, expect, it } from "vitest";
import { isResumeVisible, publicResumeSettings, type ResumeDoc } from "@/lib/resume";
import { buildNav } from "@/components/site-nav";

const doc: ResumeDoc = {
  storagePath: "resume/private-object.pdf",
  fileName: "Resume.pdf",
  size: 100,
  uploadedAt: "2026-11-18T00:00:00Z",
  version: "v1",
};

describe("Résumé visibility", () => {
  it("keeps existing settings visible without a migration", () => {
    expect(isResumeVisible(undefined)).toBe(true);
    expect(isResumeVisible({ current: doc })).toBe(true);
    expect(publicResumeSettings({ current: null })).toEqual({ visible: true, current: null });
  });

  it("hides public metadata without removing the saved PDF", () => {
    const settings = { current: doc, visible: false };
    expect(publicResumeSettings(settings)).toEqual({ visible: false, current: null });
    expect(settings.current).toBe(doc);
    expect(publicResumeSettings({ ...settings, visible: true }).current?.fileName).toBe(
      "Resume.pdf",
    );
  });

  it("never exposes the storage path in public metadata", () => {
    const result = publicResumeSettings({ current: doc, visible: true });
    expect(result.current).not.toHaveProperty("storagePath");
    expect(result.current?.version).toBe("v1");
  });

  it("excludes hidden résumé from both saved and default navigation orders", () => {
    for (const order of [null, ["resume", "contact", "overview"]]) {
      const shown = buildNav(undefined, order, [], true).map((item) => item.slug);
      const hidden = buildNav(undefined, order, [], false).map((item) => item.slug);
      expect(shown).toContain("resume");
      expect(hidden).toEqual(shown.filter((slug) => slug !== "resume"));
    }
  });
});
