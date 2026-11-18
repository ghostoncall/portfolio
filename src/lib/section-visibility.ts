import { PAGE_DEFAULTS, PUBLIC_PAGE_SLUGS, type PublicPageSlug } from "@/lib/site-copy";

/** Same optional flag and visible-by-default rule used by Résumé / CV. */
export type VisibilitySettings = { visible?: boolean };
export type SectionVisibility = Partial<Record<PublicPageSlug, boolean>>;

export function isVisible(settings: VisibilitySettings | null | undefined): boolean {
  return settings?.visible !== false;
}

export function sectionVisible(
  visibility: SectionVisibility | null | undefined,
  section: PublicPageSlug,
): boolean {
  return isVisible({ visible: visibility?.[section] ?? true });
}

export function isPublicSection(value: unknown): value is PublicPageSlug {
  return typeof value === "string" && PUBLIC_PAGE_SLUGS.includes(value as PublicPageSlug);
}

/** Keep the original résumé row; other sections use the same settings-row model. */
export function sectionSettingsId(section: PublicPageSlug): string {
  return section === "resume" ? "resume" : `section:${section}`;
}

export function visibilityFromRows(rows: { id: string; published: unknown }[]): SectionVisibility {
  const byId = new Map(rows.map((row) => [row.id, row.published as VisibilitySettings | null]));
  return Object.fromEntries(
    PUBLIC_PAGE_SLUGS.map((section) => [section, isVisible(byId.get(sectionSettingsId(section)))]),
  );
}

/** Include project/post descendants, retaining the existing paths and anchors. */
export function sectionForPath(path: string): PublicPageSlug | undefined {
  const pathname = path.split(/[?#]/, 1)[0]!.replace(/\/$/, "") || "/";
  if (pathname.startsWith("/cv/")) return "resume";
  return PUBLIC_PAGE_SLUGS.find((section) => {
    const target = PAGE_DEFAULTS[section].path;
    return pathname === target || (target !== "/" && pathname.startsWith(`${target}/`));
  });
}

export function publicPathVisible(visibility: SectionVisibility, path: string): boolean {
  const section = sectionForPath(path);
  return !section || sectionVisible(visibility, section);
}
