-- Adds "education" and "awards" to the pages.kind enum so the Education and
-- Awards sections can be stored as JSONB documents in the `pages` table
-- (staging/publish model, same as skills/certificates/experience).
--
-- The `kind` column is `text NOT NULL` without a database-level CHECK
-- constraint, so no ALTER TABLE is strictly required. This migration records
-- the intent for schema/drizzle-kit consistency.
--
-- Idempotent: safe to re-run.

DO $$
BEGIN
  -- No column change needed: pages.kind is plain text. The enum values are
-- enforced in TypeScript (src/db/schema.ts) and application code.
  NULL;
END $$;
