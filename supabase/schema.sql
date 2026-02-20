-- ============================================
-- SAC 프로젝트 - Supabase 전체 데이터베이스 스키마
-- 영업 활동 관리 시스템 (Sales Activity Control)
-- ============================================

-- ============================================
-- 1. 확장 기능 활성화
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. 테이블 생성
-- ============================================

-- ----- 2-1. 프로필 (auth.users와 1:1 연결) -----
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'sales' CHECK (role IN ('admin', 'sales')),
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE profiles IS '사용자 프로필 - auth.users와 1:1 매핑';

-- ----- 2-2. 고객 -----
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_title TEXT,
  phone TEXT,
  email TEXT,
  customer_type TEXT NOT NULL DEFAULT '법인',
  business_number TEXT,
  representative TEXT,
  address TEXT,
  sub_business_number TEXT,
  business_item TEXT,
  business_type TEXT,
  tax_email TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  memo TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE customers IS '고객(거래처) 정보';

-- ----- 2-3. 계약 -----
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_number TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '계약 준비 중'
    CHECK (status IN ('계약 준비 중', '계약 진행 중', '계약 종료', '계약 중단', '숨김')),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  contract_amount BIGINT NOT NULL DEFAULT 0,
  settlement_type TEXT,
  start_date DATE,
  end_date DATE,
  total_settlement BIGINT NOT NULL DEFAULT 0,
  total_expense BIGINT NOT NULL DEFAULT 0,
  net_profit BIGINT NOT NULL DEFAULT 0,
  profit_rate NUMERIC(6, 2) NOT NULL DEFAULT 0,
  category TEXT,
  memo TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE contracts IS '계약 정보 - 정산/지출 합계는 트리거로 자동 계산';

-- ----- 2-4. 의뢰 -----
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  inquiry_date DATE,
  status TEXT NOT NULL DEFAULT '견적 문의'
    CHECK (status IN ('견적 문의', '영업중', '계약 성공', '수주 실패', '숨김')),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id),
  memo TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE requests IS '의뢰(영업 기회) 정보';

-- ----- 2-5. 정산 -----
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  additional_amount BIGINT NOT NULL DEFAULT 0,
  tax_amount BIGINT NOT NULL DEFAULT 0,
  total_with_tax BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '정산 예정'
    CHECK (status IN ('정산 예정', '정산 지연', '정산 완료', '정산 중단', '숨김')),
  settlement_type TEXT,
  due_date DATE,
  confirmed_date DATE,
  tax_invoice_issued BOOLEAN NOT NULL DEFAULT false,
  tax_invoice_due_date DATE,
  tax_invoice_date DATE,
  assigned_to UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE settlements IS '정산 정보 - 계약별 수금 관리';

-- ----- 2-6. 지출 -----
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  vendor TEXT,
  account_category TEXT,
  description TEXT,
  tax_rate TEXT NOT NULL DEFAULT '10%',
  cost_basis TEXT,
  cost_amount BIGINT NOT NULL DEFAULT 0,
  amount_excl_tax BIGINT NOT NULL DEFAULT 0,
  tax_amount BIGINT NOT NULL DEFAULT 0,
  amount_incl_tax BIGINT NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  payment_method TEXT,
  memo TEXT,
  tax_invoice_received TEXT NOT NULL DEFAULT '미수령',
  tax_invoice_due_date DATE,
  tax_invoice_date DATE,
  assigned_to UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE expenses IS '지출 정보 - 계약별 비용 관리';

-- ----- 2-7. 견적서 -----
CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_number TEXT NOT NULL UNIQUE,
  request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  quotation_date DATE NOT NULL,
  valid_until DATE,
  total_amount BIGINT NOT NULL DEFAULT 0,
  tax_amount BIGINT NOT NULL DEFAULT 0,
  grand_total BIGINT NOT NULL DEFAULT 0,
  notes TEXT,
  terms TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE quotations IS '견적서 정보';

-- ----- 2-8. 견적서 품목 -----
CREATE TABLE quotation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  item_order INTEGER NOT NULL DEFAULT 1,
  item_name TEXT NOT NULL,
  specification TEXT,
  unit TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price BIGINT NOT NULL DEFAULT 0,
  amount BIGINT NOT NULL DEFAULT 0,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE quotation_items IS '견적서 품목 상세';

-- ----- 2-9. 입출금내역 -----
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  settlement_id UUID REFERENCES settlements(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),
  amount BIGINT NOT NULL DEFAULT 0,
  transaction_date DATE NOT NULL,
  description TEXT,
  counterparty TEXT,
  payment_method TEXT,
  is_confirmed BOOLEAN NOT NULL DEFAULT false,
  memo TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE transactions IS '입출금 내역';

-- ----- 2-10. 첨부파일 -----
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('customer', 'request', 'contract', 'settlement', 'expense', 'quotation')),
  entity_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_type TEXT NOT NULL DEFAULT '',
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE attachments IS '첨부파일 메타데이터 - 실제 파일은 Supabase Storage';

-- ----- 2-11. 활동 로그 (선택적) -----
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE activity_logs IS '활동 로그 - 변경 이력 추적';


-- ============================================
-- 3. 트리거 함수
-- ============================================

-- ----- 3-1. updated_at 자동 갱신 -----
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 모든 테이블에 updated_at 트리거 적용
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON settlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON quotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON quotation_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----- 3-2. auth.users 가입 시 profiles 자동 생성 -----
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'sales')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ----- 3-3. 견적번호 자동 생성 (Q-YYYYMMDD-001 형식) -----
CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TRIGGER AS $$
DECLARE
  today_str TEXT;
  seq_num INTEGER;
  new_number TEXT;
BEGIN
  -- 오늘 날짜 문자열
  today_str := to_char(now(), 'YYYYMMDD');

  -- 오늘 생성된 견적서 수 카운트
  SELECT COUNT(*) + 1 INTO seq_num
  FROM quotations
  WHERE quotation_number LIKE 'Q-' || today_str || '-%';

  -- 견적번호 생성
  new_number := 'Q-' || today_str || '-' || lpad(seq_num::TEXT, 3, '0');

  NEW.quotation_number = new_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_quotation_number
  BEFORE INSERT ON quotations
  FOR EACH ROW
  WHEN (NEW.quotation_number IS NULL OR NEW.quotation_number = '')
  EXECUTE FUNCTION generate_quotation_number();

-- ----- 3-4. 정산/지출 변경 시 계약 합계 재계산 -----
CREATE OR REPLACE FUNCTION recalculate_contract_totals()
RETURNS TRIGGER AS $$
DECLARE
  target_contract_id UUID;
  calc_total_settlement BIGINT;
  calc_total_expense BIGINT;
  calc_net_profit BIGINT;
  calc_profit_rate NUMERIC(6, 2);
  calc_contract_amount BIGINT;
BEGIN
  -- 대상 계약 ID 결정 (INSERT/UPDATE는 NEW, DELETE는 OLD 사용)
  IF TG_OP = 'DELETE' THEN
    target_contract_id := OLD.contract_id;
  ELSE
    target_contract_id := NEW.contract_id;
  END IF;

  -- 정산 합계 계산 (숨김 상태 제외)
  SELECT COALESCE(SUM(amount + additional_amount), 0)
  INTO calc_total_settlement
  FROM settlements
  WHERE contract_id = target_contract_id
    AND status != '숨김';

  -- 지출 합계 계산
  SELECT COALESCE(SUM(amount_excl_tax), 0)
  INTO calc_total_expense
  FROM expenses
  WHERE contract_id = target_contract_id;

  -- 순이익 계산
  calc_net_profit := calc_total_settlement - calc_total_expense;

  -- 계약 금액 조회
  SELECT contract_amount INTO calc_contract_amount
  FROM contracts
  WHERE id = target_contract_id;

  -- 이익률 계산 (계약금액 기준, 0으로 나누기 방지)
  IF calc_contract_amount > 0 THEN
    calc_profit_rate := ROUND((calc_net_profit::NUMERIC / calc_contract_amount::NUMERIC) * 100, 2);
  ELSE
    calc_profit_rate := 0;
  END IF;

  -- 계약 테이블 업데이트
  UPDATE contracts
  SET
    total_settlement = calc_total_settlement,
    total_expense = calc_total_expense,
    net_profit = calc_net_profit,
    profit_rate = calc_profit_rate
  WHERE id = target_contract_id;

  -- DELETE의 경우 OLD, 그 외 NEW 반환
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 정산 변경 시 트리거
CREATE TRIGGER recalc_contract_on_settlement_change
  AFTER INSERT OR UPDATE OR DELETE ON settlements
  FOR EACH ROW EXECUTE FUNCTION recalculate_contract_totals();

-- 지출 변경 시 트리거
CREATE TRIGGER recalc_contract_on_expense_change
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION recalculate_contract_totals();


-- ============================================
-- 4. RLS (Row Level Security) 정책
-- ============================================

-- 모든 테이블에 RLS 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- ----- 관리자 여부 확인 함수 -----
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----- profiles 정책 -----
-- 조회: 로그인한 모든 사용자가 전체 프로필 조회 가능
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 수정: 본인만 수정 가능
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 관리자: 전체 수정 가능
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE USING (is_admin());

-- ----- customers 정책 -----
-- 조회: 로그인한 모든 사용자
CREATE POLICY "customers_select" ON customers
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 생성: 로그인한 모든 사용자
CREATE POLICY "customers_insert" ON customers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 수정: 본인이 생성한 것 또는 관리자
CREATE POLICY "customers_update" ON customers
  FOR UPDATE USING (auth.uid() = created_by OR is_admin());

-- 삭제: 관리자만
CREATE POLICY "customers_delete" ON customers
  FOR DELETE USING (is_admin());

-- ----- requests 정책 -----
CREATE POLICY "requests_select" ON requests
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "requests_insert" ON requests
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "requests_update" ON requests
  FOR UPDATE USING (
    auth.uid() = created_by
    OR auth.uid() = assigned_to
    OR is_admin()
  );

CREATE POLICY "requests_delete" ON requests
  FOR DELETE USING (auth.uid() = created_by OR is_admin());

-- ----- contracts 정책 -----
CREATE POLICY "contracts_select" ON contracts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "contracts_insert" ON contracts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "contracts_update" ON contracts
  FOR UPDATE USING (auth.uid() = created_by OR is_admin());

CREATE POLICY "contracts_delete" ON contracts
  FOR DELETE USING (is_admin());

-- ----- settlements 정책 -----
CREATE POLICY "settlements_select" ON settlements
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "settlements_insert" ON settlements
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "settlements_update" ON settlements
  FOR UPDATE USING (
    auth.uid() = created_by
    OR auth.uid() = assigned_to
    OR is_admin()
  );

CREATE POLICY "settlements_delete" ON settlements
  FOR DELETE USING (auth.uid() = created_by OR is_admin());

-- ----- expenses 정책 -----
CREATE POLICY "expenses_select" ON expenses
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "expenses_insert" ON expenses
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE USING (
    auth.uid() = created_by
    OR auth.uid() = assigned_to
    OR is_admin()
  );

CREATE POLICY "expenses_delete" ON expenses
  FOR DELETE USING (auth.uid() = created_by OR is_admin());

-- ----- quotations 정책 -----
CREATE POLICY "quotations_select" ON quotations
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "quotations_insert" ON quotations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "quotations_update" ON quotations
  FOR UPDATE USING (auth.uid() = created_by OR is_admin());

CREATE POLICY "quotations_delete" ON quotations
  FOR DELETE USING (auth.uid() = created_by OR is_admin());

-- ----- quotation_items 정책 (견적서와 동일한 접근 권한) -----
CREATE POLICY "quotation_items_select" ON quotation_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "quotation_items_insert" ON quotation_items
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "quotation_items_update" ON quotation_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM quotations
      WHERE quotations.id = quotation_items.quotation_id
        AND (quotations.created_by = auth.uid() OR is_admin())
    )
  );

CREATE POLICY "quotation_items_delete" ON quotation_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM quotations
      WHERE quotations.id = quotation_items.quotation_id
        AND (quotations.created_by = auth.uid() OR is_admin())
    )
  );

-- ----- transactions 정책 -----
CREATE POLICY "transactions_select" ON transactions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "transactions_insert" ON transactions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "transactions_update" ON transactions
  FOR UPDATE USING (auth.uid() = created_by OR is_admin());

CREATE POLICY "transactions_delete" ON transactions
  FOR DELETE USING (auth.uid() = created_by OR is_admin());

-- ----- attachments 정책 -----
CREATE POLICY "attachments_select" ON attachments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "attachments_insert" ON attachments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "attachments_delete" ON attachments
  FOR DELETE USING (auth.uid() = uploaded_by OR is_admin());

-- ----- activity_logs 정책 -----
CREATE POLICY "activity_logs_select" ON activity_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "activity_logs_insert" ON activity_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- ============================================
-- 5. 인덱스
-- ============================================

-- 고객
CREATE INDEX idx_customers_company_name ON customers(company_name);
CREATE INDEX idx_customers_created_by ON customers(created_by);
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);
CREATE INDEX idx_customers_business_number ON customers(business_number) WHERE business_number IS NOT NULL;

-- 의뢰
CREATE INDEX idx_requests_customer_id ON requests(customer_id);
CREATE INDEX idx_requests_contract_id ON requests(contract_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_assigned_to ON requests(assigned_to);
CREATE INDEX idx_requests_created_by ON requests(created_by);
CREATE INDEX idx_requests_created_at ON requests(created_at DESC);

-- 계약
CREATE INDEX idx_contracts_customer_id ON contracts(customer_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_created_by ON contracts(created_by);
CREATE INDEX idx_contracts_created_at ON contracts(created_at DESC);
CREATE INDEX idx_contracts_start_date ON contracts(start_date);
CREATE INDEX idx_contracts_end_date ON contracts(end_date);

-- 정산
CREATE INDEX idx_settlements_contract_id ON settlements(contract_id);
CREATE INDEX idx_settlements_customer_id ON settlements(customer_id);
CREATE INDEX idx_settlements_status ON settlements(status);
CREATE INDEX idx_settlements_due_date ON settlements(due_date);
CREATE INDEX idx_settlements_assigned_to ON settlements(assigned_to);
CREATE INDEX idx_settlements_created_at ON settlements(created_at DESC);

-- 지출
CREATE INDEX idx_expenses_contract_id ON expenses(contract_id);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX idx_expenses_assigned_to ON expenses(assigned_to);
CREATE INDEX idx_expenses_created_at ON expenses(created_at DESC);
CREATE INDEX idx_expenses_is_paid ON expenses(is_paid);

-- 견적서
CREATE INDEX idx_quotations_request_id ON quotations(request_id);
CREATE INDEX idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX idx_quotations_created_at ON quotations(created_at DESC);
CREATE INDEX idx_quotation_items_quotation_id ON quotation_items(quotation_id);

-- 입출금내역
CREATE INDEX idx_transactions_contract_id ON transactions(contract_id);
CREATE INDEX idx_transactions_settlement_id ON transactions(settlement_id);
CREATE INDEX idx_transactions_expense_id ON transactions(expense_id);
CREATE INDEX idx_transactions_transaction_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_transaction_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- 첨부파일
CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id);
CREATE INDEX idx_attachments_uploaded_by ON attachments(uploaded_by);

-- 활동 로그
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);


-- ============================================
-- 6. Supabase Storage 버킷 (별도 대시보드 또는 API로 생성)
-- ============================================
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('attachments', 'attachments', false);
--
-- 파일 업로드/다운로드 정책은 Supabase 대시보드에서 설정하거나
-- storage.objects에 대한 RLS 정책으로 관리
