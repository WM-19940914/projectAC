-- 공급자 정보를 DB에 저장하지 않고 business_settings에서 런타임 로드로 변경
-- 직접입력은 세션 상태만 유지 (DB 저장 X)
ALTER TABLE quotations
  DROP COLUMN IF EXISTS supplier_company_name,
  DROP COLUMN IF EXISTS supplier_biz_number,
  DROP COLUMN IF EXISTS supplier_ceo_name,
  DROP COLUMN IF EXISTS supplier_email,
  DROP COLUMN IF EXISTS supplier_address,
  DROP COLUMN IF EXISTS supplier_manager,
  DROP COLUMN IF EXISTS supplier_manager_phone;
