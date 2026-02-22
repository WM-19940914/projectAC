-- 견적서에 공급자/수신자 확장/견적 담당 필드 추가

-- 공급자 정보
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS supplier_company_name TEXT,      -- 공급자 회사명
  ADD COLUMN IF NOT EXISTS supplier_biz_number TEXT,        -- 공급자 사업자번호
  ADD COLUMN IF NOT EXISTS supplier_ceo_name TEXT,          -- 공급자 대표자
  ADD COLUMN IF NOT EXISTS supplier_email TEXT,             -- 공급자 이메일
  ADD COLUMN IF NOT EXISTS supplier_address TEXT,           -- 공급자 소재지
  ADD COLUMN IF NOT EXISTS supplier_manager TEXT,           -- 공급자 담당자 (= 견적 담당)
  ADD COLUMN IF NOT EXISTS supplier_manager_phone TEXT;     -- 공급자 담당자 연락처

-- 수신자 확장 (기존: recipient, contact_person, contact_phone, site_name)
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS receiver_company_name TEXT,      -- 수신자 회사명
  ADD COLUMN IF NOT EXISTS receiver_biz_number TEXT,        -- 수신자 사업자번호
  ADD COLUMN IF NOT EXISTS receiver_email TEXT,             -- 수신자 이메일
  ADD COLUMN IF NOT EXISTS receiver_address TEXT;           -- 수신자 소재지
