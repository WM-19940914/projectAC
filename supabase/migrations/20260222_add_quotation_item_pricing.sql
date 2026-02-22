-- 누락된 category 컬럼 추가 (기존 마이그레이션에서 누락되었을 수 있음)
ALTER TABLE quotation_items
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '장비';

-- 견적서 품목에 내부 단가 계산 필드 추가 (AH~AP열)
ALTER TABLE quotation_items
  ADD COLUMN IF NOT EXISTS retrieval_price NUMERIC DEFAULT 0,       -- 반출가
  ADD COLUMN IF NOT EXISTS discount_rate NUMERIC DEFAULT 0,         -- DC율 (%)
  ADD COLUMN IF NOT EXISTS purchase_unit_price NUMERIC DEFAULT 0,   -- 매입단가
  ADD COLUMN IF NOT EXISTS purchase_amount NUMERIC DEFAULT 0,       -- 매입금액
  ADD COLUMN IF NOT EXISTS margin_rate NUMERIC DEFAULT 0,           -- MG율 (%)
  ADD COLUMN IF NOT EXISTS proposed_price NUMERIC DEFAULT 0,        -- 제안가
  ADD COLUMN IF NOT EXISTS profit NUMERIC DEFAULT 0,                -- 이윤
  ADD COLUMN IF NOT EXISTS incentive_rate NUMERIC DEFAULT 0;        -- 장려금률 (%)

-- 견적서 헤더에 현장명/수신자 필드 추가
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS site_name TEXT,            -- 현장명
  ADD COLUMN IF NOT EXISTS recipient TEXT,            -- 수신
  ADD COLUMN IF NOT EXISTS contact_person TEXT,       -- 담당자
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;        -- 전화번호
