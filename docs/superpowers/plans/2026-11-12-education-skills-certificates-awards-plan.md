# Education, Skills, Certificates & Awards Enhancement — Implementation Plan

**Goal:** Add an Education section to the Overview page and a unified Skills/Certificates/Awards admin interface, all flowing Admin → Supabase → Public site with full CRUD, publish/unpublish, reorder, draft/hide. Phone-compatible throughout.

**Stack:** TanStack Start + React 19 + Vite 8 + Tailwind v4 + Nitro + Supabase/Postgres (drizzle). Reuse: `pages` staging model, generic CRUD server functions, Sheet/SaveBar/ConfirmDialog/SortableList/MediaField components, `ADMIN_EMAIL` auth guard, RLS `pages_admin_all`, Supabase Storage for images.

## Global Constraints (from spec)
- Every field optional; partially completed entries savable/publishable; empty fields hidden publicly (no "N/A").
- Reuse existing components/infrastructure first; no new paid services/dependencies.
- Table-based `pages.kind` enum extended with `"education"` and `"awards"`.
- All server functions require `requireAdmin`; public reads filter published content.
- Images via Supabase Storage `media` bucket (browser PUT to signed URL, max 50 MB).
- Headed Playwright E2E tests for full lifecycle of all four content types.
- Phone compatibility: responsive grids, small thumbnails, touch targets ≥44px, no horizontal overflow.

## File Inventory

**Create:**
- `src/lib/education.ts` — education/awards content type helpers (stableId, nextSort reuse)
- `src/components/public/EducationView.tsx` — public education section
- `src/components/public/SkillTile.tsx` — compact skill tile
- `src/components/public/CertificateTile.tsx` — compact certificate tile
- `src/components/public/AwardTile.tsx` — compact award tile
- `src/components/public/SkillsCertificatesAwardsView.tsx` — unified tile grid view
- `src/routes/onlyme.education.tsx` — education admin (list + Sheet editor)
- `src/routes/onlyme.skills-certificates-awards.tsx` — unified admin for 3 sections
- `tests/e2e/education-skills-certificates-awards.test.ts` — headed E2E suite

**Modify:**
- `src/db/schema.ts` — add `"education"`, `"awards"` to `pages.kind` enum
- `drizzle/` migration + `supabase/migrations/` — enum change SQL
- `src/content/site.ts` — EducationEntry, Award, EducationPageContent, AwardPageContent types; PageKind union
- `src/lib/cms-validation.ts` — educationPageSchema, awardPageSchema, validatePageDoc cases
- `src/lib/cms-normalize.ts` — normalizeEducationPage, normalizeAwardPage
- `src/lib/server-fns.ts` — createItem kind support, getPublishedEducation, getPublishedAwards, extend getPublishedSkillsBundle
- `src/routes/index.tsx` — add Education section to Overview
- `src/routes/skills.tsx` — use unified tile view (skills + certificates + awards)

## Phase Order

### Phase 1: Schema migration + types + validation + normalization
1. Add "education"/"awards" to pages.kind enum (schema.ts)
2. Create Drizzle + Supabase migration SQL
3. Add EducationEntry/Award types + PageKind union (site.ts)
4. Add educationPageSchema/awardPageSchema + validatePageDoc cases (cms-validation.ts)
5. Add normalizeEducationPage/normalizeAwardPage (cms-normalize.ts)
6. `npx tsc --noEmit`, `npx prettier`, `npx eslint` — clean

### Phase 2: Server functions
7. Extend createItem to accept page kind for education/awards
8. Add getPublishedEducation, getPublishedAwards, extend getPublishedSkillsBundle with awards
9. `tsc` + lint clean

### Phase 3: Admin UI — Education management
10. Create onlyme.education.tsx (list + Sheet drawer editor, publish/unpublish/delete/reorder)
11. Verify against onlyme.experience.tsx patterns

### Phase 4: Admin UI — Unified Skills/Certificates/Awards
12. Create onlyme.skills-certificates-awards.tsx (three expandable sections, Sheet editors)

### Phase 5: Public — Education section on Overview
13. Create EducationView.tsx
14. Wire into index.tsx Overview page (after intro/profile, before Featured Work)

### Phase 6: Public — Unified tile view for Skills/Certificates/Awards
15. Create SkillTile/CertificateTile/AwardTile + SkillsCertificatesAwardsView
16. Wire into skills.tsx public route

### Phase 7: Headed E2E tests
17. Write education-skills-certificates-awards.test.ts (full lifecycle × 4 content types, empty/partial entries, responsive)
18. Run headed, fix failures, rerun

### Phase 8: Regression + final report
19. Re-run volunteering-readmore + experience-logo + mobile test suites
20. Fix regressions, final report

---

## Interfaces (exact signatures for later tasks)

**Schema enum:**
```ts
kind: text("kind", { enum: ["blocks", "skills", "experience", "certificates", "volunteering", "education", "awards"] })
```

**EducationEntry type (site.ts):**
```ts
export type EducationEntry = {
  id: string; institution: string; degree: string; field: string; specialization?: string;
  startDate?: string; endDate?: string; current?: boolean; location?: string; status?: string;
  logo?: MediaItem; cgpa?: string; gradingScale?: string; distinctions?: string[];
  scholarships?: string[]; coursework: { category: string; courses: string[] }[];
  research?: { title: string; description?: string; area?: string; technologies?: string[];
    publications?: string[]; projectLinks?: string[]; supervisor?: string }[];
  visible?: boolean; sort: number;
}
```

**Award type (site.ts):**
```ts
export type Award = {
  id: string; title: string; issuer?: string; date?: string; category?: string;
  description?: string; reason?: string; document?: MediaItem; image?: MediaItem;
  relatedEducation?: string; relatedProject?: string; referenceUrl?: string;
  visible?: boolean; sort: number;
}
```

**Server functions:** reuse existing signatures; `getPublishedEducation()` returns `EducationPageContent`, `getPublishedAwards()` returns `AwardPageContent`.

**createItem extension:** `data.table === "pages"` accepts `data.kind` ("education"|"awards"|"blocks") and creates empty doc accordingly.

---

## Review Focus (inputs most likely to bite)
1. Enum migration applied to both local drizzle and Supabase — missing either breaks type safety / deploy.
2. Empty education/awards entries must render nothing publicly (no empty containers).
3. Sheet drawer editors must not lose partial data on save.
4. Publish/unpublish toggles `published`/`staged` + `publishedAt` correctly.
5. Tile images small (`aspect-[4/3] w-40`), no overflow on 320px phones.
6. Kind validation: creating education/awards pages rows must pass `assertValidContent` for pages.

---

**Plan complete.** Please confirm this plan captures what you want; I'll execute Phase 1 next (schema migration + types), then proceed phase by phase with headed testing at the end.
