// Runtime configuration bridge for the server runtime.
//
// Environment variables are passed through the `env` argument of the fetch
// handler (from Nitro) and/or read from `process.env`. Values are scoped to a
// single request via AsyncLocalStorage so an object obtained in one request is
// never reused in another under concurrency.

import { AsyncLocalStorage } from "node:async_hooks";

type RuntimeScope = { env: Record<string, unknown> };

const scope = new AsyncLocalStorage<RuntimeScope>();

// Kept for code that runs outside a request (Node dev server boot, CLI
// scripts). Never used to serve a request.
let outsideRequestConfig: Record<string, unknown> | undefined;

/** Call once from the server entry (server.ts) with the env object. */
export function setRuntimeConfig(env: Record<string, unknown>): void {
  outsideRequestConfig = env;
}

/** Run `fn` with the env belonging to this request. */
export function runWithRuntimeConfig<T>(
  env: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  outsideRequestConfig = env;
  return scope.run({ env }, fn);
}

function currentEnv(): Record<string, unknown> | undefined {
  return scope.getStore()?.env ?? outsideRequestConfig;
}

/** Read a string env var: request env first, then process.env (local dev). */
export function getEnv(key: string): string | undefined {
  const value = currentEnv()?.[key];
  return typeof value === "string" ? value : process.env[key];
}

/** Read a non-string binding (Hyperdrive, KV, D1, ...) from the request env. */
export function getBinding<T = unknown>(key: string): T | undefined {
  return currentEnv()?.[key] as T | undefined;
}
