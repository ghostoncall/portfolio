// Server-side stub for the browser-only Ghost editor.
//
// `@tryghost/koenig-lexical` bundles Lexical + React DOM and touches `document`
// at module scope. The admin editor is mounted client-only (KoenigBodyEditor
// gates on `mounted` and React.lazy-loads KoenigInner), so the server never
// renders it — but Rollup still pulls the package into the SSR chunk graph
// because it is dynamically imported from a route module. On Cloudflare
// Workers there is no DOM, so simply evaluating that chunk crashes every SSR
// request with "document is not defined".
//
// vite.config.ts aliases the package to this module for server environments
// only. The client build keeps the real editor.
import type { ComponentType } from "react";

export const KoenigComposer: ComponentType<Record<string, unknown>> = () => null;
export const KoenigEditor: ComponentType<Record<string, unknown>> = () => null;
export const HtmlOutputPlugin: ComponentType<Record<string, unknown>> = () => null;

export default {};
