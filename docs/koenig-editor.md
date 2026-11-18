# Koenig editor integration

The installed editor is **`@tryghost/koenig-lexical` 2.1.0**, with its own bundled **Lexical 0.13.1**. Keep its composer, node registry, card views and default plugins. Importing runtime commands from the separately installed `lexical` package creates a second runtime and cannot safely operate on Koenig's nodes.

## Runtime boundary

`tools/koenig-runtime.ts` exposes the inspected bundle's Lexical, HTML, selection, rich-text, list, link, shared-history and native edit-card APIs. Its normalized bundle SHA-256 guard deliberately fails on an unreviewed package upgrade. Reinspect the source map and update the bindings/hash together when upgrading. This plugin also retains the existing browser-only SSR stub. The standard Vite plugin order is unchanged.

`src/components/admin/koenig/` owns the integration. No global theme CSS, database schema, authentication or publishing contract is changed.

## Document and rendering flow

1. The contextual panel reads the selected **actual native node**. Its controls dispatch native commands or registered editor commands inside discrete transactions.
2. Node setters call `getWritable()`. Alignment/size use optional `portfolioLayout` metadata carried through native clone, importJSON and exportJSON. Node type/version and existing fields remain compatible.
3. Native createDOM/updateDOM lifecycles reflect that metadata in the editor. There is no MutationObserver or DOM mutation standing in for an editor transaction.
4. A single committed read produces JSON and HTML together. Nested native rich editors provide their canonical caption/text HTML, including renderers that read private fields or `getDataset()`.
5. The unchanged post body contract stores `{ lexical, html, fontSize? }`. The existing public `BlogRenderer` renders the same HTML as the preview. Save flushes the current editor snapshot. One editor instance remains mounted through editor/split/preview mode switches.

The old source-keyed `post.imageLayouts` map is read for compatibility and adopted in memory. Node metadata takes precedence; existing saved content is not destructively migrated. Duplicate images can share a source URL while keeping independent layout, caption and alt settings. The obsolete external image-layout panel is replaced by contextual node controls.

Koenig's upstream `HtmlOutputPlugin` drops media-only imports/exports because it checks text content. The root integration uses the same bundled native HTML converters without that text filter. All other native plugins remain mounted. Native nested HTML plugins remain intact.

Controls must live **inside** KoenigEditor's container with `data-kg-settings-panel`, because its native outside-click handler deselects cards and deletes empty cards. Keeping an external panel caused embed/image updates to target a removed or stale selection.

The native shared history tracks both the root and nested caption editors. Before a contextual root edit, its current history entry is rebased to the previous root state if a caption owned the entry. This makes the first Undo restore the property just changed. History is seeded when reopening a document.

## Editing coverage

| Element                                                       | Controls                                                                                                                                                                           |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image                                                         | Source URL, replacement upload, alt, title, link, native rich caption, left/center/right/full, S/M/L/wide/original/custom px or %, move/duplicate/remove                           |
| Embed                                                         | URL resolution/replacement, native caption, alignment/size, editable native HTML; YouTube start/controls/loop, Vimeo loop, responsive video ratios, iframe height where applicable |
| Bookmark                                                      | URL resolution, title, description, author, publisher, thumbnail/icon, native caption, layout                                                                                      |
| Gallery                                                       | Native image array, uploads (up to nine), source URL with measured dimensions, alt, order/removal, native caption and layout                                                       |
| Audio/video/file                                              | Native source/title/artwork/poster/loop/file fields as applicable, replacement uploads, captions where supported, layout                                                           |
| Paragraph/heading/quote/list                                  | Native marks, block type, alignment, selection font size, links, indent/outdent                                                                                                    |
| Code/HTML/Markdown                                            | Native source and language fields, native code caption                                                                                                                             |
| Button/callout/header/product/toggle                          | Supported fields plus native rich text editors; **Edit in card** opens the existing native advanced settings (colors, backgrounds, layout, etc.)                                   |
| Divider/public preview marker                                 | Position, duplicate and removal; no irrelevant image settings                                                                                                                      |
| Existing email/CTA/signup/Transistor and inline utility nodes | Original node types, serialization, native editors and configured feature restrictions retained                                                                                    |

New images (including native insertion/paste/upload) start centered at medium size. Existing images keep their saved layout. On narrow containers, layout floats stack. The editor's normal body/quote size is 0.875rem (14px at a 16px root), matching the admin excerpt field; explicit author font sizes still work. This is editor-scoped and leaves the public article theme unchanged.

Ghost's exported audio/video/toggle markup normally needs Ghost frontend scripts that this site does not load. The isolated export adapter uses native media controls and a native details/summary disclosure, preserving native classes/import data. Gallery exports include their native row ratios inline. No global card stylesheet or script is injected.

## Provider boundaries

The existing admin-only embed resolver now recognizes fixed official endpoints for [YouTube](https://www.youtube.com/oembed), [Vimeo](https://vimeo.com/api/oembed.json), [Spotify](https://developer.spotify.com/documentation/embeds/reference/oembed), [SoundCloud](https://developers.soundcloud.com/docs/oembed), [CodePen](https://blog.codepen.io/documentation/oembed/) and X (`publish.twitter.com/oembed`, verified with a public read). Unsupported URLs keep the existing bookmark fallback. Public-URL validation, authentication, response limits and timeouts remain in place.

X uses `omit_script=true`; it displays the returned static post content/link. Arbitrary third-party scripts remain stripped from published HTML. Providers can reject private/deleted content or require their own account permissions. Membership, Stripe, snippets, Unsplash/GIF and Transistor integrations are not enabled by this work; controls do not invent those services.

## Crop dialog

`ImageCropper` retains the existing crop/export math and image upload flow. It now has explicit centered viewport bounds, a height-aware crop frame, initial/pointer focus, dialog keyboard handling, non-passive wheel zoom and visible zoom buttons. It scrolls internally on short screens. Image loads clean up after source changes. The exported WebP and fractional crop rectangle use the real adjusted position/zoom.

## Verification

### Visual resizing

`ResizeSystem.tsx` and `sizing.ts` extend the existing `portfolioLayout` field; there is no second dimensions store or database migration. Custom layouts may now contain `width`, `unit` (`px` or `%`), `height` (pixels), `locked`, and `aspectRatio`. Missing dimensions mean automatic sizing. The node's original image/video width and height are retained as intrinsic metadata, so Original sizing and subsequent proportional calculations remain correct.

The contextual dimensions panel and eight canvas handles call the same root editor command. Pointer updates are coalesced with `requestAnimationFrame`, respect the editor's transform scale, and merge into one native history entry. Escape/pointer cancellation restores the old layout and prior history stacks. Handle arrow keys support 1px or Shift+10px steps. Pointer capture supports mouse and touch without global drag handlers.

Measurements read the visible native card surface (image, iframe, video thumbnail, button, code surface, card container or divider line). A `ResizeObserver` tracks the selected surface and canvas; hidden previews retain valid metrics without producing NaN geometry. Measurements never write viewport dimensions back into the document. Fixed widths clamp to the available article width on small screens; media heights scale proportionally when necessary, with `object-fit: contain` to avoid distortion. Cards retain their own typography and can scroll overflowing content. Dividers have a meaningful 1–32px thickness limit.

Native gallery/header viewport breakouts and card hover padding are contained within the editor canvas. The editor has its own stacking context, keeping selected resize handles behind the existing crop dialog and other page dialogs. Custom exported cards carry local inline sizing styles through the existing HTML pipeline. Sized YouTube/Vimeo facades retain their geometry and player settings. No global theme stylesheet is changed.

Caption/text focus now mounts the native edit view synchronously during the click before focusing its nested editor, preventing an immediate first keystroke from being dropped.

Run:

```powershell
npm.cmd test
npx.cmd tsc --noEmit
npx.cmd playwright test --config playwright.koenig.config.ts
npx.cmd playwright test --config playwright.sizing.config.ts
npx.cmd playwright test --config playwright.overview.config.ts
npm.cmd run build
```

Browser tests use the installed Edge channel, the production editor/renderer/crop component and editor-scoped fake network services. They exercise real user interactions and assert native JSON, exported HTML, measured preview geometry, history, save/reopen, independent duplicate captions, asynchronous URL races, mobile stacking, typography, and cropped WebP output. They never write or publish real posts.
