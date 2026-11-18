/** Extract a Supabase project ref from its public API URL. */
export function projectRefFromSupabaseUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Extract a Supabase project ref from a direct or pooler Postgres URL. */
export function projectRefFromDatabaseUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const directRef = url.hostname.toLowerCase().match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
    if (directRef) return directRef;

    const username = decodeURIComponent(url.username).toLowerCase();
    return username.match(/^postgres\.([a-z0-9]+)$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Fail closed when Auth and Postgres clearly target different Supabase projects.
 * Unknown/non-Supabase URLs are left alone so Hyperdrive and compatible Postgres
 * providers continue to work.
 */
export function assertMatchingSupabaseProjects(
  databaseUrl: string | undefined,
  supabaseUrl: string | undefined,
): void {
  const databaseRef = projectRefFromDatabaseUrl(databaseUrl);
  const authRef = projectRefFromSupabaseUrl(supabaseUrl);

  if (databaseRef && authRef && databaseRef !== authRef) {
    throw new Error(
      "Supabase configuration mismatch: DATABASE_URL and VITE_SUPABASE_URL target different projects.",
    );
  }
}
