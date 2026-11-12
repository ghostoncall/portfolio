// Server-only Supabase (Postgres) connection.
//
// The app talks to Supabase through the shared pooler in TRANSACTION mode
// (port 6543, IPv4-compatible) — the connection string Supabase's "Connect"
// button labels "Transaction pooler". Transaction pooling does not support
// prepared statements, so the driver is created with `prepare: false`:
// https://supabase.com/docs/guides/database/connecting-to-postgres
//
// Import this only from server code (server functions, seed script).

import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getEnv } from "@/lib/runtime-config";
import * as schema from "./schema";

// Load .env into process.env for local dev (Vite only injects VITE_* vars).
// Cloudflare Pages production populates these via setRuntimeConfig() in server.ts,
// and getEnv() reads runtime config first, then process.env as a fallback.
dotenv.config();

function createClient() {
  const url = getEnv("DATABASE_URL");
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and paste your Supabase transaction-pooler connection string.",
    );
  }
  const pool = postgres(url, {
    prepare: false, // required by Supabase transaction-pooler mode
    ssl: "require", // the pooled host speaks TLS only
    max: 5, // small site, small pool
    max_pipeline: 1, // one query at a time per connection — prevents concurrent-query stalls
    queue_timeout: 10, // fail fast instead of hanging when pool is exhausted
  });
  return { db: drizzle(pool, { schema }), pool };
}

let cached: ReturnType<typeof createClient> | null = null;

/** Shared server-side database handle (lazy singleton). */
export function getDb() {
  cached ??= createClient();
  return cached.db;
}

/** Close the underlying pool — used by CLI scripts (seed) so the
 * process can exit; the web server keeps the pool open for its lifetime. */
export async function closeDb() {
  if (cached) {
    await cached.pool.end();
    cached = null;
  }
}
