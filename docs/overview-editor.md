# Overview editing

The Overview link already pointed to `/onlyme/pages/overview`, but its parent `/onlyme/pages` route always rendered the page table without an Outlet. The URL changed while the editor stayed hidden. The parent now presents its matched child editor, retaining the list at the parent URL.

The homepage and Overview draft preview share `OverviewView` and the same featured-project selection function. Introductory text, headings, lists, media, quotes and other blocks use the existing typed Block array and renderer. Page heading/photo/featured settings remain in the existing Settings editor; project content remains in Projects, with direct links from Overview. There is no duplicate content store.

Media fields now edit the actual draft immediately. They support library selection or direct URLs, alt text, captions, multiple items, ordering/removal, layout, ratio and fit. Original per-item metadata is preserved. Media and image editors no longer call React hooks from a conditional block loop, so adding/removing these blocks is safe. Cleared captions remain cleared.

The existing Save staged, autosave and Publish updates paths remain in use. Publishing sends the current draft to the existing server function and invalidates the cached homepage route. The existing server cache purge already includes `/`. The ownership marker prevents code additions from reappearing after the author deletes them.

Tests use the real nested router, editor, client RPC serialization and public renderer with isolated transport data. They verify Edit navigation, immediate preview, draft/live separation, media metadata, current-content publishing and homepage cache invalidation without writing real content.
