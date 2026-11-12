// Runtime configuration bridge for Cloudflare Pages.
//
// Cloudflare Pages Functions pass environment variables through the `env`
// parameter of the fetch handler, not via `process.env` or `.env` files.
// This module lets server.ts inject those values once, and all server code
// reads them through getEnv() with a process.env fallback for local dev.

let config: Record<string, string> | undefined;

/** Call once from the server entry (server.ts) with the CF Pages env object. */
export function setRuntimeConfig(env: Record<string, unknown>): void {
  config = env as Record<string, string>;
}

/** Read an env var: CF Pages runtime config first, then process.env (local dev). */
export function getEnv(key: string): string | undefined {
  return config?.[key] ?? process.env[key];
}
