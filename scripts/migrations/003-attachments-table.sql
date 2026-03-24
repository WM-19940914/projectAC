-- ============================================
-- 첨부파일 테이블 생성
-- 의뢰(request) 단위로 파일 관리
-- Supabase SQL 에디터에서 실행
-- ============================================

-- 1. attachments 테이블 생성
CREATE TABLE IF NOT EXISTS attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('customer', 'request', 'contract', 'settlement', 'expense', 'quotation')),
  entity_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. 인덱스 (엔티티별 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_attachments_entity
  ON attachments (entity_type, entity_id);

-- 3. RLS 활성화
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책: 인증된 사용자만 접근
CREATE POLICY "인증된 사용자 전체 접근" ON attachments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Storage 버킷 생성 (이미 있으면 무시)
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage RLS 정책
CREATE POLICY "인증된 사용자 업로드" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "인증된 사용자 조회" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'attachments');

CREATE POLICY "인증된 사용자 삭제" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'attachments');
