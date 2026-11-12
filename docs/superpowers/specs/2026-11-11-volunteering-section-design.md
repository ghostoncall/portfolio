# Volunteering Section Design

**Date:** 2026-11-11  
**Branch:** `v0.3` (working branch, changes uncommitted)  
**Status:** Draft — awaiting approval

---

## Intent and why

Add a **Volunteering** section to the portfolio — an editorial-style "personal volunteering journal" integrated into the engineering portfolio. It sits immediately before Contact on the public site, and gets a dedicated entry in the Admin Panel navigation.

The user wants to communicate who they are beyond engineering: what they care about, how they contribute to communities, motivations, reflections, learnings, and future aspirations. Content includes an introduction, a visual journal of volunteering experiences (photos, videos, captions, links), a values subsection ("Why I Choose Volunteering"), a forward-looking subsection ("Looking Ahead"), and an "Open to Volunteering Opportunities" CTA that links to the existing Contact form with a subject prefill.

**Everything must be manageable through the existing Admin Panel** — no source-code edits, no manual DB changes, no separate CMS.

---

## Goals / Non-goals / Anti-goals

### Goals
- Public Volunteering page before Contact, editorially styled (alternating media/text, lightbox, read-more modals).
- Admin Panel section: create/edit/delete/duplicate/archive/restore/reorder/feature/publish/unpublish volunteering entries.
- Every subsection (introduction, why volunteering, looking ahead, interests, CTA) editable in Admin.
- Draft/publish lifecycle: drafts never leak to public; publish makes content live; revert restores prior published version.
- Reuse existing infrastructure: `useCmsDraft`, `SaveBar`, `SortableList`, `MediaField`/`MediaGallery`, Zod validation, `post_revisions`-style versioning, Supabase Storage.
- Same design system (colors, typography, spacing, components) as the rest of the site.

### Non-goals
- Per-entry independent publish/unpublish (the `pages` document model publishes the whole document at once — same as today's Skills/Certificates/Experience). Instead, each entry gets a `visible` flag; hiding an entry + re-publishing removes it from the public site.
- A separate contact form (reuse existing Contact page with subject prefill).
- New paid services or proprietary dependencies.

### Anti-goals
- Duplicate infrastructure (parallel media system, separate content DB, hardcoded frontend content).
- Draft content visible to public visitors.
- Silent partial publishes (failed publish must not leave partially updated content).
- Breaking existing Projects/Experience/Certificates/Contact functionality.

---

## Constraints

- Option A (single `pages` document) is mandatory per user decision.
- Document-level publish only: `draft.publish()` writes `staged → published` for the whole Volunteering document.
- Per-entry visibility controlled by `visible` boolean on each entry.
- Admin navigation must place Volunteering immediately before Contact on the public site (admin nav order is independent but should be consistent).
- Must follow existing theme (editorial academic-catalog: ink #1a1a1a on white, serif display, hairline rules, square corners, no gradients).
- Must pass `tsc --noEmit`, `eslint`, and `vitest` without regressions.

---

## Approaches considered

| Approach | Fits per-entry publish? | Reuses existing infra? | Effort | Verdict |
|----------|------------------------|------------------------|--------|---------|
| **A: `pages` document** (chosen) | No — document-level publish; `visible` flag per entry instead | Yes — `useCmsDraft`, `SaveBar`, `SortableList`, `getPublishedPage` all work generically on `pages` | Low | **Selected** |
| B: Dedicated `volunteering` table | Yes — per-row publish/unpublish/archive | Partial — needs new table, migration, RLS, public routes | High | Rejected per user choice |

Approach A was chosen by the user. The `visible`-flag compromise was accepted: hiding an entry = `visible: false`, then Publish the document; the entry remains in staged/published but is filtered out on the public site.

---

## Design

### 1. Data model (no new tables)

The `pages` table already exists with columns `slug`, `title`, `kind`, `published`, `staged`, `sort`, `publishedAt`, `updatedAt`. We add:

- **`slug`**: `"volunteering"` (new page row)
- **`kind`**: `"volunteering"` — added to the `PageKind` enum in `src/db/schema.ts`
- **`published` / `staged`**: `VolunteeringPageContent` JSONB document

**`src/content/site.ts`** — add types:

```ts
export type VolunteeringEntry = {
  id: string;
  title: string;
  organisation: string;
  date?: string;           // "2024" or "Mar 2023 – Jun 2024"
  location?: string;
  category?: string;
  shortDescription?: string;
  narrative?: string;      // rich text (blocks) — detailed personal story
  contribution?: string;   // what I did
  reflections?: string;    // my thoughts
  takeaways?: string[];    // key learnings
  media: MediaItem[];      // photos + videos, with captions/alt text
  featuredImage?: MediaItem;
  featured?: boolean;
  visible?: boolean;       // public visibility toggle
  sort: number;
  links?: ProjectLink[];   // external links
};

export type VolunteeringPageContent = {
  kind: "volunteering";
  introduction: {
    heading?: string;
    body?: string;         // rich text
    image?: MediaItem;
  };
  entries: VolunteeringEntry[];
  whyVolunteering: {
    heading?: string;
    body?: string;         // rich text
  };
  lookingAhead: {
    heading?: string;
    body?: string;         // rich text
  };
  interests: string[];     // future causes/communities
  cta: {
    heading?: string;
    body?: string;
    buttonText?: string;   // defaults to "Get in touch"
  };
};

export type PageContent =
  | { kind: "blocks"; blocks: Block[] }
  | SkillsPageContent
  | CertificatesPageContent
  | ExperiencePageContent
  | VolunteeringPageContent;

export type PageKind = PageContent["kind"];
```

**`src/db/schema.ts`** — add `"volunteering"` to the `pages.kind` enum:

```ts
kind: text("kind", { enum: ["blocks", "skills", "experience", "certificates", "volunteering"] })
  .$type<PageKind>()
  .notNull(),
```

No new tables, no new migration strictly required for the enum (Drizzle push handles it; existing pattern is enum-in-column). RLS already covers `pages` via `pages_admin_all` (authenticated all) and server-side reads bypass RLS. Public reads go through `getPublishedPage` which returns `published` only — drafts never leak.

### 2. Validation

**`src/lib/cms-validation.ts`** — add `volunteeringPageSchema` (Zod), all fields optional except none strictly required (user can start with title + one photo). Add case in `assertValidContent` for `pages` → `kind === "volunteering"`.

Media items reuse `MediaItem` type; links reuse `projectLinkSchema` pattern (label/href optional so blank "add link" rows save — same fix we applied to projects).

### 3. Normalization

**`src/lib/cms-normalize.ts`** — add `normalizeVolunteeringPage(raw)`:

- Keys off `kind === "volunteering"` OR `Array.isArray(r.entries)`.
- Maps each entry with `stableId("vol", ...)` for missing IDs, `visible: r.visible !== false`, `sort: Number(r.sort ?? i)`.
- Preserves unknown legacy keys (same pattern as `normalizeProject`).

### 4. Server functions (all existing, zero new code needed)

- `getPublishedPage({ data: { slug: "volunteering" } })` — returns `published` JSONB (public)
- `listStaged({ data: { table: "pages" } })` — admin list, finds row by slug
- `getStaged({ data: { table: "pages", slug: "volunteering" } })` — admin editor load
- `updateStaged({ data: { table: "pages", slug: "volunteering", content } })` — staged write
- `publishItem({ data: { table: "pages", slug: "volunteering" } })` — staged → published
- `revertItem({ data: { table: "pages", slug: "volunteering" } })` — published → staged
- `assertValidContent("pages", content)` — validation on write

No new server functions required. The generic `pages` support already exists.

### 5. Admin Panel

**New route: `src/routes/onlyme.volunteering.tsx`**

Follows the `onlyme.experience.tsx` pattern exactly:

- `useCmsDraft<VolunteeringPageContent>({ table: "pages", slug: "volunteering", normalize: normalizeVolunteeringPage })`
- `useUnsavedChanges(draft.dirty)` for navigation-away protection
- List of entries with: title, organisation, category, visible badge, action buttons (Edit / Hide-Show / Duplicate / Delete)
- "New entry" button opens a drawer/sheet editor with all editable fields:
  - Title, Organisation, Date, Location, Category, Short description
  - Detailed narrative (rich text — reuse `BlockEditor`/`Lexical`)
  - My contribution, My reflections, Key takeaways
  - Media gallery (images + videos via `MediaGallery`, captions, alt text, featured image toggle)
  - External links
  - Featured toggle, Visible toggle, Display order
- `SaveBar` at top: Save staged / Publish / Revert, dirty indicator, status text showing real errors
- `SortableList` for entry reordering (writes `sort` into each entry)
- Per-entry `visible` toggle (Hide/Show) — entry stays in document but filtered on public site
- Duplicate, Delete (with confirm dialog)
- Empty state when no entries

**Admin navigation** (`src/routes/onlyme.tsx`): add to `navItems` between Experience and Blogs:

```ts
{ to: "/onlyme/volunteering", label: "Volunteering", icon: "🤝" },
```

### 6. Public-facing page

**New route: `src/routes/volunteering.tsx`**

Follows `src/routes/experience.tsx` loader pattern:

```tsx
loader: async () => {
  const [content, site] = await Promise.all([
    (getPublishedPage as any)({ data: { slug: "volunteering" } }),
    (getSiteIdentity as any)(),
  ]);
  return { content: normalizeVolunteeringPage(content ?? {}), site };
},
```

**Layout** (editorial, reusing `PageShell`):

- **A. Introduction: Beyond Engineering** — heading, body, optional photo.
- **B. Volunteering Experiences** — editorial cards: media prominent (photos/videos with lightbox), text panel alongside. Alternating alignment. Filter `visible !== false`. Sort by `sort`. Featured entries highlighted.
  - Each card: title, organisation, date, location, category, short intro, media gallery, narrative, contribution, reflections, takeaways, links.
  - Lightbox for images (reuse existing media lightbox pattern if present, else simple modal).
  - Videos: no autoplay with sound, native controls.
- **C. Read More** — long narratives show preview + expand in modal/drawer.
- **D. Why I Choose Volunteering** — heading + rich text body.
- **E. Looking Ahead** — heading + rich text body + interests list.
- **F. Open to Volunteering Opportunities** — CTA heading, description, button linking to `/contact` with subject prefill "Volunteering Opportunity".

Reuse `PageShell`, `SideMenu`, existing typography, spacing, breakpoints.

### 7. Draft/publish lifecycle

- Create/edit → `patch()` → autosave to `staged` (debounced 2s) or explicit `draft.save()`.
- Drafts are invisible to public (`getPublishedPage` reads `published` only).
- **Publish** → `draft.publish()` → `save()` then `publishItem` → `staged → published`, `isPublic = true`, `publishedAt = now`. Toast "Published".
- **Revert** → `draft.revert()` → `published → staged`, restores prior published document. Confirm dialog first.
- **Unpublish an entry** → set `visible: false` on entry → Publish document → entry removed from public site.
- **Archive/restore** → entry-level `visible` flag serves as archive; no separate archive table needed within document model.

### 8. Version history

Reuse the existing `post_revisions` table pattern lightly: on each `publishItem` for `pages`, insert a snapshot into a `page_revisions` concept. Looking at the schema, `post_revisions` exists for blog posts. For Volunteering (pages model), we'll store revision snapshots as JSONB in a new `page_revisions` table OR — simpler and consistent with existing practice — rely on `staged`/`published` as the two-version system (current draft vs current published), which is what the existing CMS already does for Skills/Certificates/Experience.

Decision: **No new versioning table.** The existing two-version model (`staged` + `published`) is the established convention in this codebase for pages. Revert restores `published → staged`. This matches the user's "revert to earlier published version" need within the existing architecture. If they later want full audit history, that's a separate enhancement.

### 9. Cache invalidation / sync

- `getPublishedPage` is called in the public route loader — SSR fetches fresh from DB on each navigation.
- After publish, `router.invalidate()` (already used in projects routes) ensures client-side cache refresh.
- No static generation to revalidate (TanStack Start SSR).

### 10. Security

- Admin routes guarded by `onlyme.tsx` `beforeLoad` (requires Supabase session).
- Server fns call `requireAdmin(request)`.
- Public reads return `published` only; `staged` never exposed.
- RLS: `pages_admin_all` (authenticated all) already covers admin; server bypasses RLS via `DATABASE_URL` owner connection.
- Storage: existing `media_assets` table + Supabase Storage policies reused; no new storage bucket.

### 11. Files to create / modify

**Create:**
1. `src/routes/volunteering.tsx` — public page
2. `src/routes/onlyme.volunteering.tsx` — admin editor

**Modify:**
3. `src/content/site.ts` — `VolunteeringEntry`, `VolunteeringPageContent`, add to `PageContent`/`PageKind`
4. `src/db/schema.ts` — add `"volunteering"` to `pages.kind` enum
5. `src/lib/cms-validation.ts` — `volunteeringPageSchema`, case in `assertValidContent`
6. `src/lib/cms-normalize.ts` — `normalizeVolunteeringPage`
7. `src/routes/onlyme.tsx` — add Volunteering nav item

---

## What's left to the builder (after approval)

- Write `VolunteeringEntry` / `VolunteeringPageContent` types in `site.ts`.
- Add `"volunteering"` to `pages.kind` enum in `schema.ts`.
- Add `volunteeringPageSchema` + `assertValidContent` case.
- Add `normalizeVolunteeringPage`.
- Build `onlyme.volunteering.tsx` admin (list + drawer editor + SaveBar + SortableList).
- Build `volunteering.tsx` public page (editorial layout, lightbox, read-more, CTA).
- Add admin nav item.
- Run `tsc`, `eslint`, `vitest`.
- Headed Playwright E2E: create → draft (not public) → preview → publish → appears public → edit → save draft (public unchanged) → publish → updated public → revert → restored public → unpublish entry → hidden → refresh persists.
- Restore any test data to baseline.

---

**Approval requested:** Please confirm this design matches your intent, especially the document-level publish with per-entry `visible` flag (instead of per-entry independent publish), and the decision to reuse the existing two-version staged/published model rather than adding a new revisions table. Once approved, I'll implement and verify with headed Playwright E2E.
