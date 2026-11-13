# Portfolio v0.6 — Final Report

Branch: `v0.6` (commit `7447033`, not pushed). Dev server at `http://localhost:8080`. Live Supabase DB via transaction pooler.

---

## Critical issue — root cause, failure point, fix, evidence

### 1. Education page always empty
**Root cause:** `src/routes/education.tsx` was the only route that received loader data as function props instead of calling `Route.useLoaderData()`, so `content` was always `undefined` and `EducationView` rendered nothing.
**Failure point:** `src/routes/education.tsx` — loader data never consumed by the component.
**Fix:** Changed the component to read data via `Route.useLoaderData()`.
**Evidence:** `/education` SSR HTML now contains "Sample University of Technology", "Northridge Institute", "Meridian College", "Bachelor of Science". E2E: `/education renders with sample data` PASSED. Tile count `/education -> 3`.

### 2. Nav glitching / reordering itself
**Root cause chain:**
- `SideMenu` ran an async `getPublishedNavOrder()` fetch on the client, causing a re-render race that made the nav reorder under the cursor.
- The nav expand button double-toggled because click events bubbled from child links into the button.
- All `pages.nav_order` values were `0`, making any DB sort unstable.
**Fix:**
- Nav order is now SSR-driven: full order stored in the `settings` row `id="nav"` as `{order: string[]}`, fetched once in the root loader (`src/routes/__root.tsx`) and distributed via `NavOrderContext` (`src/components/nav-projects.ts`) — no client refetch.
- `getPublishedNavOrder()` returns `string[]` from the settings row only; `[]` means "use defaults", never DB tie-order.
- `reorderNav` validates `NAV_SLUGS`, upserts the settings row, and mirrors `pages.navOrder`. Empty/missing → canonical `DEFAULT_NAV`.
- Expand button uses `stopPropagation` (`src/components/SideMenu.tsx`).
- `PageShell` mobile drawer receives `navOrder` prop and renders in the ordered sequence.
**Evidence:** Desktop nav group 6/6 passed; order in nav row = `[overview, education, projects, blog, skills, experience, volunteering, contact]`. Nav reordering group 2/2 passed. `/` home shows Education only as a nav link (not rendered), `/education` separate route.

### 3. Clicks not working
Partly the nav expand-button double-toggle (stopPropagation fix above) plus the publish/write race below.

### 4. Publish race (staged/published could diverge)
**Root cause:** `publishItem` published whatever was in `staged` without the editor's on-screen draft, and overlapping autosaves could publish a stale staged version.
**Failure point:** `src/components/admin/cms/useCmsDraft.ts` `publish()` and `src/lib/server-fns.ts` `publishItem`.
**Fix:**
- `publishItem` now accepts `data.content` and writes `staged` + `published` in ONE UPDATE, so the live snapshot is exactly what's on screen (`src/lib/server-fns.ts`).
- `useCmsDraft` reads from a always-current `dataRef`, serializes all staged writes through a `writeChain`/`enqueue` so an older request can never clobber a newer one, and publish enqueues through the same chain. Autosave no longer bumps the supersede id.
**Evidence:** Admin CRUD lifecycle group 6/6 passed (create→save→refresh→verify→edit→publish→public→unpublish→gone→republish→hide). Image upload publish→display public PASSED after the earlier fix.

### 5. Education public logo never rendered
**Root cause:** `EducationView` never rendered the `logo` field at all.
**Fix:** Added logo column rendering (`<img data-testid="education-logo">` inside `data-testid="education-logo-column"`) mirroring `ExperienceView`.
**Evidence:** `/education -> 3 tiles`, each with logo column; E2E upload/replace/remove tests pass.

---

## "Why do skills, certificates, and projects have the same subfields?"

They do **not** share subfields — this was a visual misunderstanding. The admin page `/onlyme/skills-certificates-awards` intentionally reuses **one mini-admin pattern/layout** (one expandable sheet editor with common Field components), but each section has distinct fields:

| Section | Route | Fields |
|---------|-------|--------|
| Skills | `/skills` | name, category, level, detail |
| Certificates | `/certificates` | title, issuer, dates, credential, category, description, media |
| Awards | `/awards` | title, issuer, date, description, media |
| Projects | `/projects` | title, summary, tech, links, blocks |

Projects children in nav are project titles; Skills group children are the three distinct child links `/skills`, `/certificates`, `/awards`. Only the visual card treatment (tile grid) is shared by design. DB-persisted nav order is reflected publicly for all.

---

## Per-section test results (headed Playwright, chromimum, 1440×900 primary)

Full suite: **35/35 passed, EXIT 0** (4.6m), run after all fixes. Groups:

| Group | Tests | Status |
|-------|-------|--------|
| Desktop navigation (1440×900) | 6 | PASSED |
| Public pages render with sample data | 4 | PASSED |
| Admin CRUD lifecycle (Education) | 6 | PASSED |
| Image upload (Education media field) | 4 | PASSED |
| Nav reordering | 2 | PASSED |
| Mobile viewports | 7 | PASSED |
| Regression | 6 | PASSED |

### Responsive results
- Desktop 1440×900: all groups green.
- Mobile 360/375/390/430 × 800–932 + tablet 768×1024: hamburger visible, touch target ≥ 44px (fixed via `justify-center min-w-[44px]`), all sections accessible, no horizontal overflow, images scale, forms usable, page scrolls. **Mobile group 7/7 PASSED.**
- Education only on `/education` route, not on Overview (home), for all viewports.

### Earlier fixed test issues (all now green)
- oversized upload: Playwright cannot send buffers > 50 MB → create 51 MB file on disk (`mkdtempSync`/`writeFileSync`).
- Nav reorder tests: start from restored default order + wait for "Nav order saved" toast.
- Image tests: unique per-run media institution name (`Date.now()`).
- Radix dialog uses `role="dialog"` not `<dialog>`.
- Lenis smooth-scroll assertion; strict-mode multi-match; hidden media input requires picker open.
- `/contact` heading is "Correspondence" (matched `/Correspondence|Contact/i`).
- Mobile scroll test performed on `/` (contact page may fit without scrolling).

---

## Data created / retained / cleaned

**Sample data (retained, non-destructive — no existing records overwritten or deleted):**
- awards: 5 (was 0)
- certificates: 5 (was 2)
- experience: 5 (was 2)
- education: 3 (Sample University of Technology, Northridge Institute, Meridian College)
- skills: 9
- volunteering: 3 (existing)
- projects: 3 (existing), posts: 4 (existing)

**Backfill script:** `src/db/backfill-demo.ts` (committed) — non-destructive; only inserts missing entries, never resets or deletes.

**Cleaned:**
- 8 unreferenced `e2e-logo-primary.png` media assets removed from Supabase Storage bucket `media` AND from `media_assets` table (0 referenced by content). Media assets: 25 → 17, 0 e2e-named.
- 0 E2E leftovers in `pages` (published/staged).
- Temp scripts `audit-db.ts`, `peek-tmp.ts`, `cleanup-e2e-media.ts`, `final-audit.ts` deleted.
- `test-results/` restored to HEAD (tracked, not committed).
- `playwright-report/` added to `.gitignore` (not committed).

**DB audit (post-run):**
- All 7 pages `public=true`; nav row = default order.
- `pages.nav_order` mirror: overview:0, education:1, skills:4, experience:5, volunteering:6, awards:0, certificates:0.
- SSR tile counts: `/` 3 (Featured Work only, no Education), `/education` 3, `/projects` 3, `/skills` 9, `/certificates` 5, `/awards` 5, `/experience` 5, `/volunteering` 3.

---

## Verification

- `npx eslint --fix` on all changed files: clean.
- `npx tsc --noEmit`: only the 5 **pre-existing** errors (`CertificatePreviewDialog.tsx` ×2, `CertificateTile.tsx` ×2, `src/content/site.ts` ×2) — none from this work.
- `npm run build`: **EXIT 0** (passes).
- Full headed E2E suite: **35/35 passed, EXIT 0**.

---

## Remaining genuine issues (not from this work; pre-existing)

1. `npx tsc --noEmit` has 5 pre-existing type errors unrelated to this work (`CertificatePreviewDialog.tsx` `cert.image` possibly undefined ×2; `CertificateTile.tsx` `cert.image` possibly undefined ×2; `src/content/site.ts` `ratio`/`href` not on `MediaItem`). Build still passes; these existed before.
2. `test-results/` directory is tracked in git and contains test artifacts (mutated by runs) — restored to HEAD before commit but remains tracked; consider adding to `.gitignore` in future.
3. No service-role key in `.env` (only `VITE_SUPABASE_ANON_KEY`), so storage cleanup scripts must use the anon key (worked here because the `media` bucket allowed it). Future admin storage ops needing service role would require adding `SUPABASE_SERVICE_ROLE_KEY` (never commit `.env`).
4. `drizzle-kit push` hangs; direct `postgres` client + `dotenv.config()` is the supported path for DB scripts.

---

## Commit summary

- Branch `v0.6`, commit `7447033`, 17 files changed (+654/−291).
- `src/db/backfill-demo.ts` newly added.
- `.env` NOT committed.
- Not pushed (per instructions; prior branches `v0.4`, `v0.5` already pushed to `https://github.com/ghostoncall/portfolio.git`).
