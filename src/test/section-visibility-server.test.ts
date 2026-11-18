import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import {
  getPublishedSectionVisibility,
  getSectionVisibilityAdmin,
  setSectionVisibility,
  setResumeVisibility,
} from "@/lib/server-fns";

const state = vi.hoisted(() => ({
  admin: true,
  rows: [] as { id: string; published: unknown }[],
  writes: [] as {
    id: string;
    staged: unknown;
    published: unknown;
    set: { staged: unknown; published: unknown };
  }[],
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@/lib/supabase.server", () => ({
  getAuthUser: vi.fn(async () => (state.admin ? { id: "admin" } : null)),
  getSupabaseServer: vi.fn(),
  isAllowedAdmin: vi.fn(),
}));
vi.mock("@/db/client", () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: async () => state.rows }) }),
    insert: () => ({
      values: (value: { id: string; staged: unknown; published: unknown }) => ({
        onConflictDoUpdate: async (conflict: { set: { staged: unknown; published: unknown } }) => {
          state.writes.push({ ...value, set: conflict.set });
        },
      }),
    }),
    update: () => {
      throw new Error("Visibility must not replace content records.");
    },
    delete: () => {
      throw new Error("Visibility must never delete content records.");
    },
  }),
}));
const call = (fn: unknown, data?: unknown) =>
  (fn as (args: { data: unknown; context: { request: Request } }) => Promise<unknown>)({
    data,
    context: { request: new Request("https://example.com/onlyme/settings") },
  });

beforeEach(() => {
  state.admin = true;
  state.rows = [];
  state.writes = [];
});

describe("shared résumé/section visibility persistence", () => {
  it("authorizes admin writes and rejects invalid sections or non-boolean flags", async () => {
    state.admin = false;
    await expect(
      call(setSectionVisibility, { section: "awards", visible: false }),
    ).rejects.toMatchObject({ statusCode: 401 });
    await expect(call(getSectionVisibilityAdmin)).rejects.toMatchObject({ statusCode: 401 });
    state.admin = true;
    await expect(
      call(setSectionVisibility, { section: "../site", visible: false }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      call(setSectionVisibility, { section: "awards", visible: "false" }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(state.writes).toHaveLength(0);
  });

  it("writes independent flags atomically without replacing labels, records, drafts or media", async () => {
    await Promise.all([
      call(setSectionVisibility, { section: "awards", visible: false }),
      call(setSectionVisibility, { section: "education", visible: true }),
    ]);
    expect(state.writes.map((row) => row.id).sort()).toEqual([
      "section:awards",
      "section:education",
    ]);
    const dialect = new PgDialect();
    for (const row of state.writes) {
      expect(Object.keys(row.staged as object)).toEqual(["visible"]);
      for (const column of [row.set.staged, row.set.published]) {
        const query = dialect.sqlToQuery(column as SQL);
        expect(query.sql).toContain("jsonb_set(coalesce(");
        expect(query.sql).toContain("'{visible}'");
        expect(query.params).toEqual([row.id === "section:awards" ? "false" : "true"]);
        expect(query.sql).not.toMatch(/current|content|navLabel|storagePath/);
      }
    }
  });

  it("uses the same résumé row and flag-only write from either control", async () => {
    await call(setResumeVisibility, { visible: false });
    await call(setSectionVisibility, { section: "resume", visible: true });
    expect(state.writes.map((row) => row.id)).toEqual(["resume", "resume"]);
    expect(state.writes[0]!.staged).toEqual({ current: null, visible: false });
    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(state.writes[0]!.set.published as SQL).sql).not.toContain(
      "'{current}'",
    );
  });

  it("returns visibility only, retaining the existing résumé PDF and section records privately", async () => {
    state.rows = [
      {
        id: "resume",
        published: { current: { storagePath: "resume/private.pdf" }, visible: false },
      },
      {
        id: "section:awards",
        published: { visible: false, preserved: { image: "/media/award.webp" } },
      },
    ];
    const before = structuredClone(state.rows);
    const result = await call(getPublishedSectionVisibility);
    expect(result).toMatchObject({ awards: false, resume: false, skills: true });
    expect(JSON.stringify(result)).not.toMatch(/storagePath|private.pdf|award.webp/);
    expect(state.rows).toEqual(before);
    expect(state.writes).toHaveLength(0);
  });
});
