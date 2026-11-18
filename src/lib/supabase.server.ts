// Server-side Supabase client (Supabase Auth verification).
// Import only from server code (server functions / server entry).

import { createServerClient } from "@supabase/ssr";
import { getCookies, setCookie, setResponseHeader } from "@tanstack/react-start/server";
import { getEnv } from "@/lib/runtime-config";

function parseCookieHeader(header: string | null): { name: string; value: string }[] {
  if (!header) return [];
  return header
    .split(";")
    .map((part) => {
      const index = part.indexOf("=");
      if (index === -1) {
        const name = part.trim();
        return name ? { name, value: "" } : null;
      }
      const name = part.slice(0, index).trim();
      const raw = part.slice(index + 1).trim();
      let value = raw;
      try {
        value = decodeURIComponent(raw);
      } catch {
        // Keep the raw value when it is not percent-encoded.
      }
      return name ? { name, value } : null;
    })
    .filter((cookie): cookie is { name: string; value: string } => cookie !== null);
}

export function getSupabaseServer(request?: Request) {
  const url = getEnv("VITE_SUPABASE_URL") ?? import.meta.env["VITE_SUPABASE_URL"];
  const anonKey = getEnv("VITE_SUPABASE_ANON_KEY") ?? import.meta.env["VITE_SUPABASE_ANON_KEY"];
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.",
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () =>
        request
          ? parseCookieHeader(request.headers.get("cookie"))
          : Object.entries(getCookies()).map(([name, value]) => ({ name, value })),
      setAll: (cookies, headers) => {
        // The raw Request form is used only by non-TanStack callers. They have
        // no response-cookie context, so the route-level/server-function auth
        // checks own refreshes and persist them for the browser.
        if (request) return;
        for (const { name, value, options } of cookies) setCookie(name, value, options);
        for (const [name, value] of Object.entries(headers)) setResponseHeader(name, value);
      },
    },
  });
}

/**
 * Who may use /onlyme: every user in this project's Supabase Auth user list
 * (Supabase dashboard → Authentication → Users). Add or remove people there.
 * Keep "Allow new users to sign up" turned off in Supabase so nobody can add
 * themselves. ADMIN_EMAIL is no longer used for access.
 */
export function isAllowedAdmin(_email: string | null | undefined): boolean {
  return true;
}

/** Returns the authenticated Supabase user for this request, or null. */
export async function getAuthUser(request?: Request) {
  try {
    const supabase = getSupabaseServer(request);
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    const user = data.user;
    if (!user) return null;

    if (!isAllowedAdmin(user.email)) return null;

    return user;
  } catch {
    return null;
  }
}
