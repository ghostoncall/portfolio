# Portfolio Enhancement v0.6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comprehensive enhancement of the portfolio website across 10 phases: navigation fixes (Education after Overview, Skills/Certs/Awards accordion), Education as separate top-level section, polished Skills/Certificates/Awards tile design, drag-and-drop nav reordering, comprehensive sample data, full admin panel CRUD/publish lifecycle, responsive/mobile E2E testing, admin↔public integration, comprehensive testing and reporting.

**Architecture:** Reuse existing TanStack Start + React 19 + Vite 8 + Tailwind v4 + Drizzle + Supabase stack. All content flows Admin → Supabase → Public site. The `pages` table holds staged/published JSONB docs for each page kind. Add a `navOrder` column on `pages` for persisted nav reordering. Use existing `@dnd-kit/sortable` (already a dependency) for drag-and-drop. Three independent public pages: `/skills`, `/certificates`, `/awards`. Education both on homepage and at `/education`.

**Tech Stack:** TanStack Start (React 19) + Vite 8 + Tailwind v4 + nitro + Drizzle ORM + Supabase + `@dnd-kit/sortable` (already in package.json) + `@dnd-kit/core` + `@dnd-kit/utilities` (already in package.json).

**Spec:** `docs/superpowers/specs/2026-11-13-portfolio-enhancement-design.md`

## Global Constraints

- Preserve existing desktop experience and visual identity completely; no redesign into something unrelated.
- All fields optional; empty fields hidden publicly (no "N/A").
- Reuse existing components/infrastructure first; no new paid services; only new dependency is `@dnd-kit/sortable` (already in package.json).
- Touch targets ≥44px, clamp() typography, responsive layouts.
- Three independent pages: `/skills`, `/certificates`, `/awards`.
- Education immediately after Overview in navigation, also separate `/education` route.
- Drag-and-drop reordering of top-level nav sections persisted to DB via `navOrder` column on `pages`.
- Sample data marked as fictional/demo using clearly fictional names (no `demo:` field).
- All new feature code uncommitted on branch `v0.6`; no pushes without explicit permission.
- Do not commit `.env` (contains real secrets).
- Design language: editorial academic-catalog — ink #1a1a1a on white paper, serif display fonts, hairline rules, square corners, no gradients or flashy effects. Do not animate against the brief: restrained reveals only, or nothing.
- Stack is npm on Node 26 — no bun.
- vite.config.ts plugin order: tailwind → tsconfigPaths → tanstackStart → nitro → react.

## File Structure

### Files to Create

- `src/routes/education.tsx` — Public `/education` route page (loads `getPublishedEducation`, renders `EducationView`).
- `src/components/admin/cms/NavReorder.tsx` — Drag-and-drop top-level nav order manager for admin; lists page slugs with `navOrder`, calls `reorderNav` server fn.
- `docs/superpowers/specs/2026-11-13-portfolio-enhancement-design.md` — Design doc (this plan's companion).

### Files to Modify

- `src/db/schema.ts` — Add `navOrder: integer("nav_order").notNull().default(0)` column to `pages` table.
- `src/components/SideMenu.tsx` — Add Education after Overview; fix single-line label; align Skills/Certs/Awards children to match Projects submenu; read nav order from DB `navOrder` column.
- `src/components/PageShell.tsx` — Mirror `MOBILE_NAV_ITEMS` changes (add Education after Overview); match styling.
- `src/lib/server-fns.ts` — Add `reorderNav` server function (updates `navOrder` on `pages`); extend `publishAll` to set `isPublic` on pages; ensure `getPublishedPage` orders by `navOrder`.
- `src/content/site.ts` — Add comprehensive fictional sample data for Education, Skills, Certificates, Awards, Experience, Volunteering, Projects, Blog.
- `src/db/seed.ts` — Seed education page with sample data; add `navOrder` defaults; insert sample page rows.
- `src/routes/onlyme.tsx` — Admin sidebar already includes all sections; verify Education is listed.
- `src/routes/onlyme.index.tsx` — Dashboard stats (optional, counts per section).
- `drizzle/` — New migration SQL for `nav_order` column on `pages`.
- `supabase/migrations/` — New migration SQL for `nav_order` column on `pages`.
- `tests/e2e/portfolio-enhancement.test.ts` — Comprehensive E2E test suite (desktop + mobile + lifecycle + responsive).

### File Responsibility Boundaries

| File | Responsibility |
|------|---------------|
| `schema.ts` | DB table definition; `navOrder` column lives here |
| `server-fns.ts` | `reorderNav` writes `navOrder`; `publishAll` publishes pages; public getters check `isPublic` |
| `site.ts` | Content types + comprehensive fictional sample data arrays |
| `seed.ts` | One-shot DB seeding from `site.ts` sample data |
| `SideMenu.tsx` | Desktop nav; reads `navOrder` from DB; Education after Overview; single-line labels |
| `PageShell.tsx` | Mobile drawer nav; mirrors SideMenu structure |
| `education.tsx` | Public `/education` route |
| `NavReorder.tsx` | Admin drag-and-drop UI for nav section ordering |
| `SkillTile.tsx`, `CertificateTile.tsx`, `AwardTile.tsx` | Polished public tile presentation |
| `SkillsView.tsx`, `CertificatesView.tsx`, `AwardsView.tsx` | Public section wrappers (grid, headings) |
| `EducationView.tsx` | Public education rendering (already exists; polish) |
| `useCmsDraft.ts` | Staged-draft lifecycle (reuse as-is) |
| `SortableList.tsx` | DnD list primitive (reuse as-is; already uses `@dnd-kit`) |

## Review Focus

1. **Empty optional fields**: Public renderer must skip any field that is empty/undefined; never render "N/A" or placeholder text for missing optional fields.
2. **navOrder not hardcoded**: SideMenu must read nav order from DB (`navOrder` column), not from a hardcoded array; after reorder, the public nav must reflect new order on refresh.
3. **Education single line**: "Education" label must not wrap; Skills/Certs/Awards parent label must stay on one single line.
4. **No fabricated real credentials**: All sample data must use clearly fictional institutions/names; nothing presented as genuine.
5. **Unpublished content never public**: `getPublishedPage`/`getPublishedSkills`/etc. must check `isPublic`; admin preview shows staged regardless.
6. **Edit preserves unsaved fields**: Updating an entry via partial patch must not erase previously saved fields left empty in the current edit.
7. **Migration is additive**: `navOrder` column added safely; existing rows get a default order.
8. **Touch targets ≥44px**: Every interactive element (button, link, toggle, drag handle) must be at least 44px on mobile.
9. **sample data persistent**: Seed script inserts sample data that survives restarts; never temporary.
10. **Images optimized**: Upload validates file types/sizes; preview shown in admin and public; removal supported.

---

## Tasks

### Task 1: Add `navOrder` column to `pages` table (schema + migration)

**Files:**
- Create: `drizzle/0004_nav_order.sql`
- Create: `supabase/migrations/0004_nav_order.sql`
- Modify: `src/db/schema.ts` (add `navOrder` column to `pages`)

**Interfaces:**
- Consumes: existing `pages` table definition in `schema.ts`.
- Produces: `pages.navOrder` (integer, not null, default 0); migration SQL that adds the column safely.

- [ ] **Step 1: Add `navOrder` column to `pages` table definition**

```ts
// In src/db/schema.ts, inside the pages pgTable definition:
navOrder: integer("nav_order").notNull().default(0),
```

- [ ] **Step 2: Create Drizzle migration SQL** (`drizzle/0004_nav_order.sql`)

```sql
alter table pages add column if not exists nav_order integer not null default 0;
```

- [ ] **Step 3: Create Supabase migration SQL** (`supabase/migrations/0004_nav_order.sql`) — same idempotent SQL.
- [ ] **Step 4: Run `npm run lint` and `npm run build`** to verify typecheck passes.
- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/0004_nav_order.sql supabase/migrations/0004_nav_order.sql
git commit -m "feat: add navOrder column to pages table for nav reordering"
```

### Task 2: Add `reorderNav` server function

**Files:**
- Modify: `src/lib/server-fns.ts` — add `reorderNav` server fn.

**Interfaces:**
- Consumes: `data.slugs` (string[] of page slugs in new order); admin session (requireAdmin).
- Produces: updates `nav_order` column on `pages` rows; returns `{ ok: true, count }`.

- [ ] **Step 1: Write `reorderNav` server function**

```ts
export const reorderNav = createServerFn({ method: "POST", strict: false }).handler(
  async ({ data, context }: any) => {
    const { request } = context;
    await requireAdmin(request);
    const db = getDb();
    const slugs: string[] = Array.isArray(data?.slugs) ? data.slugs.map(String) : [];
    if (!slugs.length) return { ok: true, count: 0 };
    const now = new Date();
    await db.transaction(async (tx) => {
      for (let i = 0; i < slugs.length; i++) {
        await tx
          .update(pages)
          .set({ navOrder: i, updatedAt: now })
          .where(eq(pages.slug, slugs[i]!));
      }
    });
    return { ok: true, count: slugs.length };
  },
);
```

- [ ] **Step 2: Run `npm run lint`** to verify no type errors.
- [ ] **Step 3: Commit**

```bash
git add src/lib/server-fns.ts
git commit -m "feat: add reorderNav server function for nav section ordering"
```

### Task 3: Fix SideMenu navigation — Education after Overview, single-line labels, Projects alignment

**Files:**
- Modify: `src/components/SideMenu.tsx` — restructure `items` array, fix label styling, align children.

**Interfaces:**
- Consumes: none directly (will later consume `navOrder` from DB in Task 9).
- Produces: rendered nav with Education immediately after Overview; "Skills, Certificates & Awards" on one single line; child links aligned with Projects submenu; same +/- interaction, hover/active states, divider placement.

- [ ] **Step 1: Restructure `items` array — Education after Overview**

```ts
const items = [
  { to: "/", label: "Overview" },
  { to: "/education", label: "Education" },
  { to: "/projects", label: "Projects", children: true },
  { to: "/blog", label: "Blog" },
  { to: "/skills", label: "Skills, Certificates & Awards", children: true },
  { to: "/experience", label: "Experience" },
  { to: "/volunteering", label: "Volunteering" },
  { to: "/contact", label: "Contact" },
] as const;
```

- [ ] **Step 2: Fix typography so parent labels stay on one line**

Change `itemClass` to use `clamp()`-based sizing and `white-space: nowrap` on the label span so "Skills, Certificates & Awards" does not wrap. Ensure font size is not excessively small (minimum ~0.95rem via clamp).

- [ ] **Step 3: Align Skills/Certs/Awards children to match Projects submenu**

Use identical `space-y-1 px-3 pb-4 pt-2` ul container, same `text-sm text-muted-foreground hover:text-foreground` link classes, same `px-3 py-1` padding on li, same active underline style.

- [ ] **Step 4: Match +/− interaction, hover, active, expanded, collapsed states**

Ensure both expandable sections use the same button styling (`px-1 text-xl font-light leading-none`), same active color (`text-primary-foreground/80 hover:text-primary-foreground`), same background on active row (`bg-primary text-primary-foreground`).

- [ ] **Step 5: Run `npm run lint` and `npm run build`** to verify.
- [ ] **Step 6: Commit**

```bash
git add src/components/SideMenu.tsx
git commit -m "fix: navigation Education after Overview, single-line labels, Projects alignment"
```

### Task 4: Mirror nav changes in PageShell mobile drawer

**Files:**
- Modify: `src/components/PageShell.tsx` — `MOBILE_NAV_ITEMS` array.

**Interfaces:**
- Consumes: none.
- Produces: mobile drawer nav with Education after Overview; same label styling and children alignment as SideMenu.

- [ ] **Step 1: Add Education after Overview in `MOBILE_NAV_ITEMS`**

```ts
{ label: "Overview", href: "/" },
{ label: "Education", href: "/education" },
{ label: "Projects", href: "/projects", children: [] },
{ label: "Blog", href: "/blog" },
{
  label: "Skills, Certificates & Awards",
  href: "/skills",
  children: [
    { label: "Skills", href: "/skills" },
    { label: "Certificates", href: "/certificates" },
    { label: "Awards & Recognitions", href: "/awards" },
  ],
},
```

- [ ] **Step 2: Ensure mobile drawer label uses same single-line styling** — apply `whiteSpace: nowrap` and matching font sizing via inline style or className.
- [ ] **Step 3: Run `npm run lint` and `npm run build`** to verify.
- [ ] **Step 4: Commit**

```bash
git add src/components/PageShell.tsx
git commit -m "fix: mobile drawer nav mirrors SideMenu (Education after Overview)"
```

### Task 5: Create public `/education` route

**Files:**
- Create: `src/routes/education.tsx`

**Interfaces:**
- Consumes: `getPublishedEducation` (returns `EducationPageContent`), `getSiteIdentity`.
- Produces: rendered `/education` page with `EducationView`, SEO meta tags.

- [ ] **Step 1: Create `src/routes/education.tsx`** modeled on `src/routes/skills.tsx`

```tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { getSiteIdentity } from "@/lib/server-fns";
import { getPublishedEducation } from "@/lib/server-fns";
import { EducationView } from "@/components/public/EducationView";

export const Route = createFileRoute("/education")({
  loader: async () => {
    const [site, education] = await Promise.all([
      (getSiteIdentity as any)(),
      (getPublishedEducation as any)(),
    ]);
    return { site, education };
  },
  head: ({ loaderData }) => {
    const site = loaderData?.site;
    return {
      meta: [
        { title: `Education — ${site?.name ?? "Portfolio"}` },
        {
          name: "description",
          content:
            "Academic qualifications, degrees, coursework, research interests, and scholarly achievements.",
        },
        { property: "og:title", content: `Education — ${site?.name ?? "Portfolio"}` },
        {
          property: "og:description",
          content: "Academic qualifications, degrees, coursework, research interests, and scholarly achievements.",
        },
      ],
    };
  },
  component: EducationPage,
});

function EducationPage({ education, site }: { education: any; site: any }) {
  return (
    <PageShell crumbs={["Education"]} title="Education" site={site}>
      <EducationView content={education ?? { kind: "education", entries: [] }} />
    </PageShell>
  );
}
```

- [ ] **Step 2: Run `npm run lint` and `npm run build`** to verify.
- [ ] **Step 3: Commit**

```bash
git add src/routes/education.tsx
git commit -m "feat: add public /education route page"
```

### Task 6: Polish Skills tile design (refined hierarchy, whitespace, hover)

**Files:**
- Modify: `src/components/public/SkillTile.tsx` — refined visual treatment.
- Modify: `src/components/public/SkillsView.tsx` — grid spacing, heading.

**Interfaces:**
- Consumes: `Skill` type from `@/content/site`.
- Produces: refined SkillTile with better typography, whitespace, borders, hover state; consistent dimensions; restrained academic aesthetic.

- [ ] **Step 1: Rewrite `SkillTile.tsx`** with polished design — serif typography, hairline borders, subtle hover, clamp() font sizes, touch target ≥44px, no excessive shadows/gradients/animations.
- [ ] **Step 2: Update `SkillsView.tsx`** — grid `gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`, consistent card height via `min-h-[260px]`.
- [ ] **Step 3: Run `npm run lint` and `npm run build`** to verify.
- [ ] **Step 4: Commit**

```bash
git add src/components/public/SkillTile.tsx src/components/public/SkillsView.tsx
git commit -m "feat: polish Skills tile design for academic portfolio"
```

### Task 7: Polish Certificates tile design + preview dialog

**Files:**
- Modify: `src/components/public/CertificateTile.tsx` — refined card, thumbnail display.
- Create: `src/components/public/CertificatePreviewDialog.tsx` — enlarged preview on click.

**Interfaces:**
- Consumes: `Certificate` type from `@/content/site`.
- Produces: CertificateTile with thumbnail, hover state, click-to-preview; dialog shows enlarged image or opens original document.

- [ ] **Step 1: Rewrite `CertificateTile.tsx`** — thumbnail aspect ratio [4/3], issuer below title, verified link, hover state, touch target ≥44px.
- [ ] **Step 2: Create `CertificatePreviewDialog.tsx`** — Radix Dialog-based; on click shows image enlarged or opens credentialUrl/file in new tab.
- [ ] **Step 3: Wire preview into `CertificatesView.tsx`** — wrap each tile with dialog trigger.
- [ ] **Step 4: Run `npm run lint` and `npm run build`** to verify.
- [ ] **Step 5: Commit**

```bash
git add src/components/public/CertificateTile.tsx src/components/public/CertificatePreviewDialog.tsx src/components/public/CertificatesView.tsx
git commit -m "feat: polish Certificates tile design with preview dialog"
```

### Task 8: Polish Awards tile design (distinct treatment)

**Files:**
- Modify: `src/components/public/AwardTile.tsx` — distinct visual treatment vs Skills/Certificates.
- Modify: `src/components/public/AwardsView.tsx` — grid spacing.

**Interfaces:**
- Consumes: `Award` type from `@/content/site`.
- Produces: AwardTile with consistent but distinct styling (reason highlighted, reference URL), restrained academic aesthetic.

- [ ] **Step 1: Rewrite `AwardTile.tsx`** — serif typography, hairline borders, reason section visually separated, reference link, hover state, touch target ≥44px.
- [ ] **Step 2: Update `AwardsView.tsx`** — match grid spacing of SkillsView/CertificatesView.
- [ ] **Step 3: Run `npm run lint` and `npm run build`** to verify.
- [ ] **Step 4: Commit**

```bash
git add src/components/public/AwardTile.tsx src/components/public/AwardsView.tsx
git commit -m "feat: polish Awards tile design with distinct treatment"
```

### Task 9: Add comprehensive fictional sample data to `src/content/site.ts`

**Files:**
- Modify: `src/content/site.ts` — populate Education, Certificates, Awards, Experience, Volunteering entries with fictional sample data.

**Interfaces:**
- Consumes: type definitions already in `site.ts`.
- Produces: populated `education.entries`, `certificates.certificates`, `awards.entries`, plus enriched `experience.entries`, `volunteering` entries, `projects`, `posts` — all using clearly fictional names/institutions.

- [ ] **Step 1: Add Education sample entries** — 3 entries using fictional institutions (e.g., "Sample University of Technology", "Northridge Institute"), fictional degrees, coursework, research, supervisor names, CGPA, distinctions, scholarships. Mix complete and incomplete entries (some optional fields empty).
- [ ] **Step 2: Expand Certificates sample data** — 5 certificates with fictional issuers ("Cloud Platform Academy", "Data Science Institute"), credential IDs, dates, images, files, skillIds, descriptions. Mix with/without expiry, with/without image.
- [ ] **Step 3: Expand Awards sample data** — 5 awards with fictional issuers ("National Science Foundation", "Canadian Research Council"), categories, dates, reasons, reference URLs, documents, related education/project. Mix with/without optional fields.
- [ ] **Step 4: Enrich Experience and Volunteering** — add more entries with fictional companies/orgs, longer descriptions, achievements, tech stacks.
- [ ] **Step 5: Enrich Projects and Blog** — add 1-2 more fictional projects and blog posts.
- [ ] **Step 6: Run `npm run lint`** to verify typecheck.
- [ ] **Step 7: Commit**

```bash
git add src/content/site.ts
git commit -m "feat: add comprehensive fictional sample data across all sections"
```

### Task 10: Create `NavReorder` admin component (drag-and-drop nav ordering)

**Files:**
- Create: `src/components/admin/cms/NavReorder.tsx`

**Interfaces:**
- Consumes: `reorderNav` server fn; reads current nav order from `pages` table via `listStaged`.
- Produces: drag-and-drop list of top-level nav sections (Overview, Education, Projects, Blog, Skills/Certs/Awards, Experience, Volunteering, Contact) with drag handle, keyboard accessible, "Restore default order" button.

- [ ] **Step 1: Create `NavReorder.tsx`** using existing `SortableList` component (which already uses `@dnd-kit/sortable`); each item is a nav section label + slug; drag handle is `GripVertical`; move up/down buttons as keyboard alternative; "Restore default order" resets to Overview, Education, Projects, Blog, Skills/Certs/Awards, Experience, Volunteering, Contact.
- [ ] **Step 2: On reorder, call `reorderNav({ slugs })`** and show toast confirmation.
- [ ] **Step 3: Run `npm run lint`** to verify.
- [ ] **Step 4: Commit**

```bash
git add src/components/admin/cms/NavReorder.tsx
git commit -m "feat: add NavReorder drag-and-drop nav ordering admin component"
```

### Task 11: Wire `navOrder` into SideMenu + `publishAll` / `getPublishedPage` ordering

**Files:**
- Modify: `src/components/SideMenu.tsx` — read nav order from DB via `listStaged` on `pages` table; render items sorted by `navOrder`.
- Modify: `src/lib/server-fns.ts` — `publishAll` sets `isPublic` on pages; `getPublishedPage` and public getters order by `navOrder`.

**Interfaces:**
- Consumes: `pages` rows with `navOrder`; `reorderNav` persists changes.
- Produces: SideMenu renders sections in DB-persisted order; public site reflects reorder on refresh.

- [ ] **Step 1: Update SideMenu to fetch pages ordered by `navOrder`** — use `listStaged({ data: { table: "pages" } })`, filter to nav-relevant slugs, sort by `navOrder`, render dynamically instead of hardcoded array. Keep child links (Projects submenu, Skills/Certs/Awards children) under their parent.
- [ ] **Step 2: Ensure `getPublishedPage` and related public getters respect `isPublic`** — already done; verify no unpublished page leaks.
- [ ] **Step 3: Run `npm run lint` and `npm run build`** to verify.
- [ ] **Step 4: Commit**

```bash
git add src/components/SideMenu.tsx src/lib/server-fns.ts
git commit -m "feat: wire navOrder into SideMenu rendering and publishAll"
```

### Task 12: Add `navOrder` defaults and sample pages to `seed.ts`

**Files:**
- Modify: `src/db/seed.ts` — add `navOrder` values to page inserts; ensure education page seeded with sample data.

**Interfaces:**
- Consumes: `education`, `awards`, `skills`, `certificates` from `site.ts`.
- Produces: seed script inserts `navOrder` column values (0-7) matching desired default nav order.

- [ ] **Step 1: Add `navOrder` to each page insert in `seed.ts`** — overview: 0, education: 1, projects: 2, blog: 3, skills: 4, certificates: 5, awards: 6, experience: 7, volunteering: 8, contact: 9.
- [ ] **Step 2: Verify education page row is inserted with `isPublic: true`** so Education shows publicly.
- [ ] **Step 3: Run `npm run db:seed` against local DB** (if available) or verify script syntax.
- [ ] **Step 4: Commit**

```bash
git add src/db/seed.ts
git commit -m "feat: add navOrder defaults and education sample rows to seed script"
```

### Task 13: Write comprehensive E2E test suite (`tests/e2e/portfolio-enhancement.test.ts`)

**Files:**
- Create: `tests/e2e/portfolio-enhancement.test.ts`
- Update: `playwright.config.ts` — add mobile device projects (360×800, 375×812, 390×844, 430×932) + tablet + desktop.

**Interfaces:**
- Consumes: running dev server at `http://localhost:8080`; Playwright `@playwright/test`.
- Produces: pass/fail results for every spec requirement, separated into Passed / Failed-and-fixed / Failed-and-unresolved / Not-tested.

- [ ] **Step 1: Update `playwright.config.ts`** — add projects for Desktop Chrome, Mobile (4 viewports), Tablet (iPad), with `baseURL: "http://localhost:8080"`, headed mode, trace on failure.
- [ ] **Step 2: Write desktop navigation tests** — verify all 9 sections in nav order; Education after Overview; Projects expands/collapses; Skills/Certs/Awards expands/collapses; all 3 child links navigate independently; active highlighting; smooth scroll; direct navigation/refresh.
- [ ] **Step 3: Write public page tests** — `/skills`, `/certificates`, `/awards`, `/education` render with sample data; tiles display correctly; empty fields hidden; certificate preview dialog opens.
- [ ] **Step 4: Write admin CRUD lifecycle tests** — create entry → save draft → refresh → persists → edit → preserves previous data → publish → appears public → unpublish → disappears → republish → appears → hide → delete (temp record only).
- [ ] **Step 5: Write image upload tests** — upload image → preview in admin → publish → display public → replace → remove → invalid file type rejected → oversized file rejected.
- [ ] **Step 6: Write nav reordering tests** — drag Blog above Projects → save → refresh → public nav reflects new order → move back.
- [ ] **Step 7: Write mobile tests** — all 4 phone viewports + tablet; hamburger menu; expandable sections; touch targets ≥44px; forms usable; images scale; two-finger scrolling; no horizontal overflow; no clipped text.
- [ ] **Step 8: Write regression tests** — Overview, Projects, Experience, Volunteering, Contact form, auth, Supabase integrations, existing publish behavior.
- [ ] **Step 9: Run `npx playwright test --headed`** and record results; fix failures; mark Passed/Failed.
- [ ] **Step 10: Commit**

```bash
git add tests/e2e/portfolio-enhancement.test.ts playwright.config.ts
git commit -m "feat: add comprehensive E2E test suite for portfolio enhancement"
```

### Task 14: Admin panel completeness audit (all 9 sections CRUD + publish/unpublish)

**Files:**
- Modify: `src/routes/onlyme.tsx` — verify sidebar includes all sections.
- Modify: `src/routes/onlyme.index.tsx` — dashboard stats per section.
- Verify: `onlyme.education.tsx`, `onlyme.skills.tsx`, `onlyme.certificates.tsx`, `onlyme.skills-certificates-awards.tsx`, `onlyme.experience.tsx`, `onlyme.volunteering.tsx`, `onlyme.pages.tsx`, `onlyme.blogs.tsx`, `onlyme.settings.tsx` all have Add/Edit/Save/Delete/Draft/Publish/Unpublish/Hide/Republish/Reorder/Upload/Preview.

**Interfaces:**
- Consumes: existing admin routes; `useCmsDraft`; `SaveBar`; `ConfirmDialog`; `SortableList`; `MediaField`.
- Produces: verified that every section has complete admin controls.

- [ ] **Step 1: Audit each admin route** — confirm all 11 controls present (Add, Edit, Save, Delete, Draft, Publish, Unpublish, Hide, Republish, Reorder, Upload images, Preview).
- [ ] **Step 2: Fill gaps** — add missing controls to any route that lacks them (e.g., ensure `onlyme.pages.tsx` has publish/unpublish, `onlyme.settings.tsx` has upload/preview).
- [ ] **Step 3: Verify edit-preserves-fields** — partial updates don't erase saved fields.
- [ ] **Step 4: Confirm destroy confirmations** — `ConfirmDialog` used for delete.
- [ ] **Step 5: Run `npm run lint` and `npm run build`** to verify.
- [ ] **Step 6: Commit**

```bash
git add src/routes/onlyme.tsx src/routes/onlyme.index.tsx
git commit -m "feat: admin panel completeness audit and gap fixes"
```

### Task 15: Final verification — TypeScript, lint, build, E2E

**Files:**
- None (verification only).

**Interfaces:**
- Consumes: all changed files.
- Produces: clean `npm run lint`, clean `npm run build`, E2E results document.

- [ ] **Step 1: Run `npm run lint`** — fix any errors.
- [ ] **Step 2: Run `npm run build`** — fix any errors; verify plugin order unchanged.
- [ ] **Step 3: Run full E2E suite** — `npx playwright test --headed`; record Passed/Failed-and-fixed/Failed-and-unresolved/Not-tested.
- [ ] **Step 4: Verify `.env` is not tracked** — `git status` confirms `.env` not committed.
- [ ] **Step 5: Verify branch is `v0.6`** — not pushed (user will push).
- [ ] **Step 6: Final commit** of all remaining work.

```bash
git add -A
git commit -m "feat: complete portfolio enhancement v0.6 — all phases implemented and tested"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-13-portfolio-enhancement-plan.md`. Please review the plan. Does it capture what you want?

The tasks are interdependent (schema → server fn → SideMenu → sample data → NavReorder → E2E), so I recommend **Native execution** — I implement every task myself in this session with frequent commits, then one final review. This is fastest given the 15 tasks share interfaces defined earlier in the plan.


