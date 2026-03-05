BEGIN;

DROP INDEX IF EXISTS idx_contracts_status;

ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS contracts_status_check;

ALTER TABLE contracts
  DROP COLUMN IF EXISTS status;

COMMIT;
