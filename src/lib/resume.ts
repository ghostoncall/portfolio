// Shared (client + server) definitions for the Résumé / CV section.
//
// Source of truth: the `settings` row with id "resume". Like every other CMS
// document it has a `staged` copy (what the admin just uploaded) and a
// `published` copy (what the public site serves). Both hold a ResumeDoc or
// null. The PDF bytes live in the Supabase Storage `media` bucket under
// `resume/`; the public site never sees that path — it reads the file through
// /cv/view and /cv/download (server/routes/cv/[action].ts).

export type ResumeDoc = {
  /** Object path inside the `media` bucket. Server/admin only. */
  storagePath: string;
  /** Original filename, used for the download. */
  fileName: string;
  size: number;
  uploadedAt: string;
  /** Changes on every upload; used as a cache-busting key in file URLs. */
  version: string;
};

/** What the public page receives — no storage path. */
export type PublicResume = Omit<ResumeDoc, "storagePath">;

import { isVisible, type VisibilitySettings } from "@/lib/section-visibility";

export type ResumeSettings = VisibilitySettings & { current: ResumeDoc | null };
export type PublicResumeSettings = { current: PublicResume | null; visible: boolean };

/** Existing settings remain visible until the owner explicitly hides them. */
export function isResumeVisible(settings: ResumeSettings | null | undefined): boolean {
  return isVisible(settings);
}

export function publicResumeSettings(
  settings: ResumeSettings | null | undefined,
): PublicResumeSettings {
  const visible = isResumeVisible(settings);
  const doc = settings?.current;
  if (!visible || !doc) return { visible, current: null };
  const { storagePath: _private, ...current } = doc;
  void _private;
  return { visible, current };
}

export const RESUME_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const RESUME_MIME = "application/pdf";

/** Same-origin URL for the published file. `version` busts CDN/browser caches. */
export function resumeFileUrl(resume: PublicResume, mode: "view" | "download"): string {
  return `/cv/${mode}?v=${encodeURIComponent(resume.version)}`;
}

/** Download filename: the uploaded name, reduced to safe characters, always .pdf. */
export function safeResumeFileName(name: string): string {
  const base = name
    .replace(/\.pdf$/i, "")
    .replace(/[^\p{L}\p{N} ._()-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${base || "Resume"}.pdf`;
}
