-- 의뢰(requests) 테이블에 수기 장려금 컬럼 추가 (VAT별도 금액 저장)
-- Supabase SQL 에디터에서 실행하세요

ALTER TABLE requests
ADD COLUMN IF NOT EXISTS manual_incentive numeric DEFAULT 0;

COMMENT ON COLUMN requests.manual_incentive IS '수기 입력 장려금 (VAT별도)';
