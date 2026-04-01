-- =============================================
-- 006: 칸반보드 + 대시보드 성능 최적화 인덱스
-- Supabase SQL 에디터에서 실행
-- =============================================

-- 의뢰(requests) 테이블: 칸반보드 메인 조회 최적화
-- status + hidden 필터링이 핵심 쿼리
CREATE INDEX IF NOT EXISTS idx_requests_status_hidden
  ON requests (status, hidden);

-- 의뢰 → 계약 연결: contract_id로 자주 조회
CREATE INDEX IF NOT EXISTS idx_requests_contract_id
  ON requests (contract_id);

-- 계약(contracts) 테이블: 삭제되지 않은 계약 조회
CREATE INDEX IF NOT EXISTS idx_contracts_deleted_at
  ON contracts (deleted_at);

-- 계약 → 의뢰 역매핑
CREATE INDEX IF NOT EXISTS idx_contracts_request_id
  ON contracts (request_id);

-- 정산 메타: contract_id로 조회
CREATE INDEX IF NOT EXISTS idx_settlement_meta_contract_id
  ON contract_settlement_meta (contract_id);

-- 지출(expenses): contract_id + request_id로 조회
CREATE INDEX IF NOT EXISTS idx_expenses_contract_id
  ON expenses (contract_id);

CREATE INDEX IF NOT EXISTS idx_expenses_request_id
  ON expenses (request_id);

-- 고객(customers): 삭제 필터 + 이름 정렬
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at
  ON customers (deleted_at);

-- 견적서 아이템: quotation_id로 조회 (장려금 계산)
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id
  ON quotation_items (quotation_id);

-- 프로필: 이름 검색 (아이디 찾기)
CREATE INDEX IF NOT EXISTS idx_profiles_full_name
  ON profiles (full_name);
