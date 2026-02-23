-- 견적 담당자 이메일 컬럼 추가
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS supplier_manager_email TEXT DEFAULT NULL;

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS manager_email TEXT DEFAULT '';
