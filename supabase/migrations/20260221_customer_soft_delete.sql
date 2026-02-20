-- 고객 소프트 삭제 지원: deleted_at 컬럼 추가
-- NULL이면 활성 고객, 값이 있으면 삭제된 고객
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
