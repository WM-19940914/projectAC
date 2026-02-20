-- 의뢰 테이블에서 예상견적, 통화, 폴더 컬럼 삭제
DROP INDEX IF EXISTS idx_requests_folder;
ALTER TABLE requests DROP COLUMN IF EXISTS expected_amount;
ALTER TABLE requests DROP COLUMN IF EXISTS currency;
ALTER TABLE requests DROP COLUMN IF EXISTS folder;
