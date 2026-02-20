-- 의뢰 테이블에 숨김 여부 컬럼 추가
-- hidden = true이면 칸반보드에서 숨김 처리 (원래 상태는 유지)
ALTER TABLE requests ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;

-- 숨김 필터링용 인덱스
CREATE INDEX IF NOT EXISTS idx_requests_hidden ON requests(hidden);
