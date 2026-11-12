# Education, Skills, Certificates & Awards Enhancement — Design Doc

**Date:** 2026-11-12  
**Area:** Portfolio public site + admin panel + Supabase schema  
**Size:** Project

## Intent & Why
The portfolio is used for MS/MSc CS applications in Canada. It needs an **Education section** (academic credentials for admissions committees) and a **unified Skills/Certificates/Awards management system** in the admin panel, following the existing Projects interaction pattern. All content must flow Admin → Supabase → Public site with full CRUD, publish/unpublish, reorder, and draft/hide behavior.

## Goals
1. **Education section** on the Overview page (after intro/profile, before Featured Work): institution, degree, field, specialization, dates, status, location, logo, CGPA/GPA, grading scale, distinctions, scholarships, categorized coursework, research/projects with supervisor links — all optional, hidden when empty.
2. **Unified admin interface** with exactly three expandable sections: Skills, Certificates, Awards — heading + `+` icon to expand, Sheet drawer editor, same interaction pattern as Projects/Experience.
3. **Compact tile-based public layout** for Skills/Certificates/Awards on `/skills`: desktop multi-column grid, tablet 2-col, mobile 1-col, small thumbnails, truncation, no empty containers.
4. **Full CRUD + publish/unpublish + reorder + preview** through admin → Supabase → public site.
5. **Reuse first:** existing `pages` staging model, generic CRUD server functions, Sheet/SaveBar/ConfirmDialog/SortableList/MediaField components, Supabase Storage for images, `ADMIN_EMAIL` auth guard, RLS `pages_admin_all`.

## Non-Goals / Anti-Goals
- No new standalone tables unless technically essential (avoid diverging from how skills/certificates already work).
- No new paid services or dependencies.
- No generic résumé templates, graduation-cap icons, excessive animations, or large headings.
- No hardcoded sample content on the live site.
- Do not break existing Projects, Experience, Overview, Skills, Certificates functionality.

## Constraints
- Table-based/email-safe patterns not applicable here (web UI, not email).
- `pages.kind` is a Postgres enum/check constraint — adding `"education"` and `"awards"` requires a Drizzle migration.
- All server functions require `requireAdmin(request)` (Supabase session + optional `ADMIN_EMAIL` allowlist).
- RLS `pages_admin_all` grants authenticated=ALL on `pages` — education/awards rows inherit this automatically.
- Public reads of `pages` are not RLS-filtered (no `isPublic` column), so published content must be filtered in server functions (`getPublishedPage` already checks `publishedAt`).
- Images via Supabase Storage `media` bucket + `mediaAssets` table, browser PUT to signed URL, max 50 MB.
- Every field optional; partially completed entries savable/publishable; empty fields hidden publicly (no "N/A" placeholders).

## Approaches Considered

| Approach | Description | Trade-off | Verdict |
|---|---|---|---|
| **A. Store education/awards in `pages` table** (extend `kind` enum) | Single `pages` row per content domain (`kind="education"`, `kind="awards"`), JSONB content, staging/publish model | Reuses generic CRUD, RLS, admin UI patterns, minimal migration. Education is one row (not per-institution), consistent with how skills/certificates/experience already work. | **Selected** |
| B. New standalone `education`/`awards` tables | Proper columns, per-row publish, custom server functions + admin UI | More code, new tables/migrations, diverges from existing content pattern | Rejected |

### Admin UI Approach (selected)
Unified expandable page: three sections (Skills, Certificates, Awards), each with heading + `+` icon to open a Sheet drawer editor. List view shows existing entries with edit/delete/publish/unpublish/reorder. Follows `onlyme.experience.tsx` Sheet pattern + `onlyme.projects.tsx` list pattern.

### Public Layout (selected)
- Education: structured institutional cards on Overview, timeline feel, all fields optional.
- Skills/Certificates/Awards: CSS Grid tile layout on `/skills`; desktop `grid-cols-3`, tablet `grid-cols-2`, mobile `grid-cols-1`; small thumbnails (`aspect-[4/3] w-40`), text truncation, empty entries hidden.

## Files to Create
- `src/lib/education.ts` — education content type + helpers (optional, if shared types needed)
- `src/components/public/EducationView.tsx` — public education section rendering
- `src/components/public/SkillTile.tsx`, `CertificateTile.tsx`, `AwardTile.tsx` — compact public tiles
- `tests/e2e/education-skills-certificates-awards.test.ts` — headed E2E suite

## Files to Modify
- `src/db/schema.ts` — add `"education"` and `"awards"` to `pages.kind` enum
- `drizzle/` + `supabase/migrations/` — migration to extend enum
- `src/lib/server-fns.ts` — ensure generic CRUD covers education/awards (add `getPublishedEducation`, `getPublishedSkillsCertificatesAwardsBundle` if needed)
- `src/routes/index.tsx` — add Education section to Overview page
- `src/routes/skills.tsx` — add Awards to public skills page
- `src/routes/onlyme.education.tsx` or extend `onlyme.skills.tsx` — unified admin page for Skills/Certificates/Awards
- `src/components/PageShell.tsx` — possibly add admin nav entry (if not already present)

## What's Left to Builder
- Write and apply the Drizzle/Supabase migration
- Implement server functions for education/awards publish/unpublish/CRUD
- Build the unified admin UI (Skills/Certificates/Awards expandable sections)
- Build public EducationView + tile components
- Update Overview and /skills pages
- Write and execute headed E2E tests (full lifecycle for all four content types)
- Regression-test existing Projects, Experience, Overview, Skills, Certificates

## Open Question for User
Your `site.email` in `src/content/site.ts` is `"you@example.com"` (placeholder) while SMTP uses the real `engineerthisaryan@gmail.com`. For the Education section branding/header, should the email templates and site identity use `site.name`/`site.edition` (currently "Your Name" / "Portfolio 2026" placeholders), or do you want those updated to your real name/identity? (This affects the education page header and any email subject lines.)

---

**Please approve this design (or request changes) before I write the implementation plan.**
