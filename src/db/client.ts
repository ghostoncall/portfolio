// Server-only Supabase (Postgres) connection.
//
// `createClient()` connects either via a Hyperdrive binding (Cloudflare) or
// straight to `DATABASE_URL` (Netlify / local Node). A raw Supabase
// transaction-pooler URL does not support prepared statements — hence
// `prepare: false` and TLS required when not using Hyperdrive.
//
// `withRequestDb()` (called from src/server.ts) runs each request inside an
// AsyncLocalStorage scope. `getDb()` creates the client lazily on first use
// within that scope. Without a Hyperdrive binding it falls back to a
// process-wide singleton, which is safe on Netlify because each function
// invocation is isolated.
//
// Import this only from server code (server functions, seed script).

import { AsyncLocalStorage } from "node:async_hooks";

import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getBinding, getEnv } from "@/lib/runtime-config";
import * as schema from "./schema";

// Load .env into process.env for local dev (Vite only injects VITE_* vars).
// The Workers runtime populates these via setRuntimeConfig() in server.ts,
// and getEnv() reads runtime config first, then process.env as a fallback.
dotenv.config();

type HyperdriveBinding = { connectionString?: string };

function createClient() {
  const hyperdriveUrl = getBinding<HyperdriveBinding>("HYPERDRIVE")?.connectionString;
  const url = hyperdriveUrl ?? getEnv("DATABASE_URL");

  if (!url) {
    throw new Error(
      "No database connection configured. Bind Hyperdrive as HYPERDRIVE or set DATABASE_URL (see .env.example).",
    );
  }

  const viaHyperdrive = Boolean(hyperdriveUrl);
  const pool = postgres(url, {
    // Hyperdrive pools the origin and supports prepared statements.
    // A raw Supabase transaction-pooler URL does not.
    prepare: viaHyperdrive,
    fetch_types: false, // no array types in this schema — saves a round-trip
    ssl: viaHyperdrive ? false : "require", // Hyperdrive terminates origin TLS
    // One connection per request: a single SSR render fans out several
    // queries, and Hyperdrive/Supabase poolers drop sockets when a Worker
    // floods them with parallel connections. With `max_pipeline: 1` queries
    // are serialized anyway, so extra connections only add pressure.
    max: 1,
    max_pipeline: 1, // one query at a time per connection — prevents concurrent-query stalls
    queue_timeout: 10, // fail fast instead of hanging when pool is exhausted
  });
  return { db: drizzle(pool, { schema }), pool };
}

type DbClient = ReturnType<typeof createClient>;
type RequestDbScope = { client: DbClient | null };

// Per-request scope so server functions share one client without leaking
// sockets across request contexts.
const requestDbScope = new AsyncLocalStorage<RequestDbScope>();

// Long-lived client for the Node dev server and CLI scripts (seed).
let nodeCached: DbClient | null = null;

/** True inside Cloudflare's workerd runtime. */
function isWorkersRuntime(): boolean {
  return (
    typeof navigator !== "undefined" &&
    navigator.userAgent === "Cloudflare-Workers"
  );
}


/** Server-side database handle for the current request (lazy). */
export function getDb() {
  const scope = requestDbScope.getStore();
  console.log(
    `[getdb] scoped=${Boolean(scope)} hd=${Boolean(getBinding("HYPERDRIVE"))}`,
  );
  if (scope) {
    scope.client ??= createClient();
    return scope.client.db;
  }
  if (isWorkersRuntime()) {
    console.warn(
      "[db] getDb() ran outside the request scope; falling back to a process-wide client.",
    );
  }
  nodeCached ??= createClient();
  return nodeCached.db;
}

/**
 * Run a request handler with a request-scoped database client.
 *
 * When a Hyperdrive binding is present (Cloudflare), each request uses its own
 * client because Workers forbids reusing I/O objects (sockets) across request
 * contexts. The client is created lazily and released when the request ends.
 *
 * Without Hyperdrive (Netlify / local Node) the handler runs directly and
 * `getDb()` falls back to a process-wide singleton — safe because each
 * Netlify function invocation is isolated.
 */
export async function withRequestDb<T>(fn: () => Promise<T>): Promise<T> {
  if (!getBinding<HyperdriveBinding>("HYPERDRIVE")) return fn();

  const scope: RequestDbScope = { client: null };
  return requestDbScope.run(scope, fn);
}

/** Close the underlying pool — used by CLI scripts (seed) so the
 * process can exit; the web server keeps the pool open for its lifetime. */
export async function closeDb() {
  if (nodeCached) {
    await nodeCached.pool.end();
    nodeCached = null;
  }
}
