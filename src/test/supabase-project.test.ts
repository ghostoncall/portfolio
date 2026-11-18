import { describe, expect, it } from "vitest";

import {
  assertMatchingSupabaseProjects,
  projectRefFromDatabaseUrl,
  projectRefFromSupabaseUrl,
} from "@/lib/supabase-project";

const projectRef = "rrlsukrtwgamrvajazqv";

describe("Supabase project configuration", () => {
  it("recognizes matching transaction-pooler and API project refs", () => {
    const databaseUrl = `postgresql://postgres.${projectRef}:password@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
    const supabaseUrl = `https://${projectRef}.supabase.co`;

    expect(projectRefFromDatabaseUrl(databaseUrl)).toBe(projectRef);
    expect(projectRefFromSupabaseUrl(supabaseUrl)).toBe(projectRef);
    expect(() => assertMatchingSupabaseProjects(databaseUrl, supabaseUrl)).not.toThrow();
  });

  it("recognizes direct Supabase database hosts", () => {
    expect(
      projectRefFromDatabaseUrl(
        `postgresql://postgres:password@db.${projectRef}.supabase.co:5432/postgres`,
      ),
    ).toBe(projectRef);
  });

  it("fails closed when Auth and Postgres target different projects", () => {
    expect(() =>
      assertMatchingSupabaseProjects(
        `postgresql://postgres.${projectRef}:password@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`,
        "https://differentproject.supabase.co",
      ),
    ).toThrow(/configuration mismatch/i);
  });

  it("allows non-Supabase URLs used by bindings or compatible providers", () => {
    expect(() =>
      assertMatchingSupabaseProjects(
        "postgresql://user:password@database.internal:5432/postgres",
        `https://${projectRef}.supabase.co`,
      ),
    ).not.toThrow();
  });
});
