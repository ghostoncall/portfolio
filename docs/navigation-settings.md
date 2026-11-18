# Navigation titles and section visibility

Open `/onlyme/settings`.

- **Navigation management** edits existing `SiteIdentity.copy.pages[slug].navLabel` values. **Save draft** keeps the changes staged; **Publish** makes them public. The current live label and original target are shown beside each field. Empty labels keep their previous default behavior. The optional `childNavLabel` lets the Skills subpage label differ from its grouped menu label and page heading.
- **Section visibility** saves each checkbox immediately, using the same flag-only settings-row upsert and checkbox component as Résumé / CV. Hidden sections remain editable in the admin. Their original content, published/staged copies, records, media and metadata are retained.

No routes, section identifiers, content records or SQL table definitions are renamed. No database migration or initial write is needed. Existing sections default to visible; the original résumé setting remains authoritative for Résumé / CV.

## Persistence and public rendering

`section-visibility.ts` supplies the shared default rule, supported-section identifiers and URL lookup. Each non-résumé section has a namespaced `settings` row (`section:awards`, for example) containing the existing optional `visible` flag in both staged/published JSON. Résumé / CV continues using its original `resume` row, retaining PDF metadata and upload/publish behavior.

`section-visibility.server.ts` changes only `{visible}` with PostgreSQL `jsonb_set`, preserving every other field. Concurrent switches use independent rows; résumé document updates still change only `{current}`, so uploads cannot reset visibility and visibility cannot replace PDFs. The admin endpoints use the existing session authorization and validate section identifiers/boolean input. Public reads expose flags only. Title publishing remains the existing site-settings workflow and cannot overwrite visibility flags.

The root loader reads the flags once for desktop/mobile menus, public route guards, featured projects on Overview and footer links. A hidden public page returns the existing root not-found response. A hidden Overview redirects `/` to the first visible menu destination, retaining working home links. If Skills is hidden, its group links to the first visible Certificates/Awards child; if all three are hidden, the whole group disappears. Saved custom titles/order are retained throughout.

Sitemaps omit hidden sections and their descendants. Hiding Blog also hides its feed link and feed response. Existing blog subsection visibility remains in Blog settings. Admin previews/editors can still fetch their original content. Successful writes invalidate client route caches (including prefetched pages) and use the existing server cache-purge mechanism; the existing Cloudflare freshness policy is unchanged.

## Verification

Unit tests cover defaults, label-only changes, independent groups, direct-route guards, atomic flag-only SQL, authorization, résumé compatibility, concurrent UI updates and failed-save recovery. Browser tests use the actual admin forms, root loader, public routes and shared desktop/mobile menus with an isolated durable transport. They test save/publish, reload persistence, hidden-page access, award image/formatting/metadata restoration, cross-editor résumé switches, Overview visibility, and long labels. They never write real content or change real visibility settings.
