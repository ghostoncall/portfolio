-- Adds "education" and "awards" to the pages.kind enum so the Education and
-- Awards sections can be stored as JSONB documents in the `pages` table
-- (staging/publish model, same as skills/certificates/experience).
--
-- Idempotent: safe to re-run. The `kind` column is plain text, so no
-- ALTER TABLE is required at the database level.

DO $$
BEGIN
  NULL;
END $$;
