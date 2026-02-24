-- 견적서에 납기/결제 정보 컬럼 추가
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS delivery_date TEXT,
  ADD COLUMN IF NOT EXISTS delivery_place TEXT,
  ADD COLUMN IF NOT EXISTS payment_condition TEXT;
