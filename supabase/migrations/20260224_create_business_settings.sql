-- 우리 회사 기본 정보 (공급자 기본값) 저장 테이블
-- 싱글톤 패턴: 1행만 유지
CREATE TABLE IF NOT EXISTS business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT DEFAULT '',
  biz_number TEXT DEFAULT '',
  ceo_name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  manager TEXT DEFAULT '',
  manager_phone TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 초기 행 삽입 (1행만 존재)
INSERT INTO business_settings (company_name) VALUES ('');

-- RLS 비활성화 (admin client로만 접근)
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

-- 서비스 역할만 접근 가능
CREATE POLICY "Service role full access" ON business_settings
  FOR ALL USING (true) WITH CHECK (true);
