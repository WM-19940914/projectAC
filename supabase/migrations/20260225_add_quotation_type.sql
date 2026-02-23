-- 견적서 타입 컬럼 추가 (간이/상세 구분)
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT '간이';
