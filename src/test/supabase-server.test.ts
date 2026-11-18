import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getCookies: vi.fn(),
  setCookie: vi.fn(),
  setResponseHeader: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("@tanstack/react-start/server", () => ({
  getCookies: mocks.getCookies,
  setCookie: mocks.setCookie,
  setResponseHeader: mocks.setResponseHeader,
}));

vi.mock("@/lib/runtime-config", () => ({
  getEnv: (name: string) =>
    name === "VITE_SUPABASE_URL"
      ? "https://project.supabase.co"
      : name === "VITE_SUPABASE_ANON_KEY"
        ? "publishable-key"
        : undefined,
}));

import { getSupabaseServer } from "@/lib/supabase.server";

type CookieBridge = {
  cookies: {
    getAll: () => Array<{ name: string; value: string }>;
    setAll: (
      cookies: Array<{
        name: string;
        value: string;
        options: { path: string; sameSite?: "lax" };
      }>,
      headers: Record<string, string>,
    ) => void;
  };
};

describe("Supabase server cookie bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerClient.mockImplementation((_url, _key, options) => options);
  });

  it("reads TanStack request cookies and persists refreshed cookies and cache headers", () => {
    mocks.getCookies.mockReturnValue({ auth: "old-session", theme: "paper" });
    const client = getSupabaseServer() as unknown as CookieBridge;

    expect(client.cookies.getAll()).toEqual([
      { name: "auth", value: "old-session" },
      { name: "theme", value: "paper" },
    ]);

    client.cookies.setAll(
      [{ name: "auth", value: "refreshed-session", options: { path: "/", sameSite: "lax" } }],
      { "cache-control": "private, no-store", pragma: "no-cache" },
    );

    expect(mocks.setCookie).toHaveBeenCalledWith("auth", "refreshed-session", {
      path: "/",
      sameSite: "lax",
    });
    expect(mocks.setResponseHeader).toHaveBeenCalledWith("cache-control", "private, no-store");
    expect(mocks.setResponseHeader).toHaveBeenCalledWith("pragma", "no-cache");
  });

  it("keeps the raw-request adapter read-only for callers outside TanStack", () => {
    const request = new Request("https://example.com/onlyme", {
      headers: { cookie: "auth=old%20session; theme=paper" },
    });
    const client = getSupabaseServer(request) as unknown as CookieBridge;

    expect(client.cookies.getAll()).toEqual([
      { name: "auth", value: "old session" },
      { name: "theme", value: "paper" },
    ]);
    client.cookies.setAll([{ name: "auth", value: "ignored", options: { path: "/" } }], {
      "cache-control": "private",
    });
    expect(mocks.setCookie).not.toHaveBeenCalled();
    expect(mocks.setResponseHeader).not.toHaveBeenCalled();
  });
});
