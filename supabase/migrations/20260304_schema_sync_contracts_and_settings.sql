-- Schema sync hotfix (idempotent)
-- Run once in Supabase SQL Editor for project: vacqhmvwkqcfpzkzadmp

BEGIN;

-- 1) contracts: optional deleted_at for backward compatibility
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2) requests: ensure hidden flag exists (used by API/list filtering)
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_requests_hidden ON requests(hidden);

-- 3) business_settings: keep singleton intent and tighten policy scope
-- policy name from existing migration
DROP POLICY IF EXISTS "Service role full access" ON business_settings;

CREATE POLICY "Service role full access" ON business_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- optional hard guard for singleton table
CREATE UNIQUE INDEX IF NOT EXISTS business_settings_singleton_idx
  ON business_settings ((true));

COMMIT;

