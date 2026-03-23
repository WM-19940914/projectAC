-- 견적서 내보내기 내역 테이블
-- Supabase SQL 에디터에서 실행

CREATE TABLE IF NOT EXISTS quote_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'excel', 'png')),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  confirmed BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_quote_exports_quotation ON quote_exports(quotation_id);

-- Storage 버킷 생성 (이미 있으면 무시)
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-exports', 'quote-exports', true)
ON CONFLICT (id) DO NOTHING;
