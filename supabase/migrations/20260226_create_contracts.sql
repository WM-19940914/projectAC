-- 계약(contracts) 테이블 생성
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  
  -- 계약 기본 정보
  name TEXT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  vat_inclusive BOOLEAN NOT NULL DEFAULT false,
  settlement_type TEXT[] DEFAULT '{}',
  
  -- 계약 기간
  start_date DATE,
  end_date DATE,
  
  -- 상태 및 기타
  status TEXT NOT NULL DEFAULT '계약 준비 중',
  memo TEXT,
  
  -- 시스템 컬럼
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE contracts IS '계약 관리 테이블';

-- RLS 활성화
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- 정책 생성
CREATE POLICY "Enable all access to contracts for authenticated users" 
ON contracts FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 트리거 생성 (updated_at)
CREATE TRIGGER handle_updated_at_contracts
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);
