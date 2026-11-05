// Database schema for the /onlyme content system.
//
// Staging & publish model: every editable piece of content keeps TWO copies.
//   `published` — what the public site serves
//   `staged`    — what the admin is currently editing
//
//   Edit    → writes to `staged` only
//   Publish → copies `staged` → `published`, stamps `published_at`,
//             sets `is_public` (new rows start hidden)
//   Revert  → discards staging by copying `published` back to `staged`
//   Delete  → removes the row entirely
//
// Content is stored as JSONB docs that mirror the shapes in
// src/content/site.ts, so site.ts remains the seed source and the
// types stay in one family.

import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { Block, Post, Project } from "@/content/site";

/** Global site identity — the Settings card in /onlyme.
 * Structurally identical to `site` in src/content/site.ts. */
export type SiteIdentity = {
  name: string;
  title: string;
  edition: string;
  email: string;
  socials: { label: string; href: string }[];
};

export type SkillGroup = {
  group: string;
  items: { name: string; detail: string }[];
};

export type ExperienceEntry = {
  role: string;
  org: string;
  period: string;
  blocks: Block[];
};

/** A page body. `kind` tells the admin editor which form shape to render. */
export type PageContent =
  | { kind: "blocks"; blocks: Block[] }
  | { kind: "skills"; skills: SkillGroup[]; certificates: Block[] }
  | { kind: "experience"; entries: ExperienceEntry[] };

export type PageKind = PageContent["kind"];

export const pages = pgTable("pages", {
  slug: text("slug").primaryKey(), // "overview" | "skills" | "experience"
  title: text("title").notNull(),
  kind: text("kind", { enum: ["blocks", "skills", "experience"] })
    .$type<PageKind>()
    .notNull(),
  published: jsonb("published").$type<PageContent>().notNull(),
  staged: jsonb("staged").$type<PageContent>().notNull(),
  sort: integer("sort").notNull().default(0),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  slug: text("slug").primaryKey(),
  // Full Project document (title, dek, year, category, stack, blocks…)
  published: jsonb("published").$type<Project>().notNull(),
  staged: jsonb("staged").$type<Project>().notNull(),
  isPublic: boolean("is_public").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable("posts", {
  slug: text("slug").primaryKey(),
  // Full Post document (title, dek, date, tags, cover, blocks…)
  published: jsonb("published").$type<Post>().notNull(),
  staged: jsonb("staged").$type<Post>().notNull(),
  isPublic: boolean("is_public").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  // Single row, id is always "site".
  id: text("id").primaryKey(),
  published: jsonb("published").$type<SiteIdentity>().notNull(),
  staged: jsonb("staged").$type<SiteIdentity>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PageRow = typeof pages.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type PostRow = typeof posts.$inferSelect;
export type SettingsRow = typeof settings.$inferSelect;
