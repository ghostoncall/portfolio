/* eslint-disable @typescript-eslint/no-explicit-any */
// One-off backfill for demo content that predates the richer sample dataset.
//
// Rules (non-destructive):
//   • awards        — filled only when the published list is empty.
//   • certificates  — placeholder entries (no issuer + "placeholder" description)
//                     are upgraded in place; missing sample titles are appended.
//   • experience    — sample roles missing from the DB are appended; existing
//                     entries are never modified or removed.
//
// Run with: npx tsx src/db/backfill-demo.ts

import dotenv from "dotenv";
dotenv.config();

import { eq } from "drizzle-orm";
import {
  awards as sampleAwards,
  certificates as sampleCertificates,
  experience as sampleExperience,
} from "../content/site";
import { closeDb, getDb } from "./client";
import { pages } from "./schema";

const norm = (s: string | undefined) => (s ?? "").trim().toLowerCase();

async function main() {
  const db = getDb();
  const report: string[] = [];

  // ---- awards (fill only when empty) -------------------------------------
  {
    const row = (await db.select().from(pages).where(eq(pages.slug, "awards")).limit(1))[0];
    if (!row) {
      report.push("awards: page row missing — skipped");
    } else {
      const current = row.published as any;
      if ((current?.entries?.length ?? 0) === 0) {
        const next = { kind: "awards" as const, entries: sampleAwards.entries };
        await db
          .update(pages)
          .set({ published: next, staged: next, updatedAt: new Date() })
          .where(eq(pages.slug, "awards"));
        report.push(`awards: filled with ${sampleAwards.entries.length} sample entries`);
      } else {
        report.push(`awards: kept ${current.entries.length} existing entries`);
      }
    }
  }

  // ---- certificates (upgrade placeholders, append missing) --------------
  {
    const row = (await db.select().from(pages).where(eq(pages.slug, "certificates")).limit(1))[0];
    const current = (row?.published as any)?.certificates ?? [];
    const sampleByTitle = new Map(sampleCertificates.certificates.map((c) => [norm(c.title), c]));

    const merged = current.map((c: any) => {
      const upgrade = sampleByTitle.get(norm(c.title));
      const isPlaceholder = !c.issuer && /placeholder/i.test(c.description ?? "");
      return isPlaceholder && upgrade ? { ...upgrade, sort: c.sort ?? upgrade.sort } : c;
    });
    const present = new Set(merged.map((c: any) => norm(c.title)));
    for (const c of sampleCertificates.certificates) {
      if (!present.has(norm(c.title))) merged.push(c);
    }
    merged.forEach((c: any, i: number) => (c.sort = i));

    if (row && JSON.stringify(merged) !== JSON.stringify(current)) {
      const next = { kind: "certificates" as const, certificates: merged };
      await db
        .update(pages)
        .set({ published: next, staged: next, updatedAt: new Date() })
        .where(eq(pages.slug, "certificates"));
      report.push(`certificates: ${current.length} -> ${merged.length} entries`);
    } else {
      report.push("certificates: no change");
    }
  }

  // ---- experience (append missing roles) --------------------------------
  {
    const row = (await db.select().from(pages).where(eq(pages.slug, "experience")).limit(1))[0];
    const current = (row?.published as any)?.entries ?? [];
    const present = new Set(current.map((e: any) => norm(e.role)));
    const merged = [...current];
    for (const e of sampleExperience.entries) {
      if (!present.has(norm(e.role))) merged.push(e);
    }
    merged.forEach((e: any, i: number) => (e.sort = i));

    if (row && merged.length !== current.length) {
      const next = { kind: "experience" as const, entries: merged };
      await db
        .update(pages)
        .set({ published: next, staged: next, updatedAt: new Date() })
        .where(eq(pages.slug, "experience"));
      report.push(`experience: ${current.length} -> ${merged.length} entries`);
    } else {
      report.push(`experience: kept ${current.length} existing entries`);
    }
  }

  console.log(report.map((r) => `• ${r}`).join("\n"));
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
