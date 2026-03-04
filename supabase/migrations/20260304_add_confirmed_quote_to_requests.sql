-- Persist confirmed quotation selection per request
-- Safe to run multiple times

BEGIN;

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS confirmed_quote_id UUID;

DO $$
BEGIN
  IF to_regclass('public.quotations') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'requests_confirmed_quote_id_fkey'
     ) THEN
    ALTER TABLE requests
      ADD CONSTRAINT requests_confirmed_quote_id_fkey
      FOREIGN KEY (confirmed_quote_id)
      REFERENCES quotations(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_requests_confirmed_quote_id
  ON requests(confirmed_quote_id);

COMMIT;
