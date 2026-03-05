-- ============================================
-- SAC ?꾨줈?앺듃 - Supabase ?꾩껜 ?곗씠?곕쿋?댁뒪 ?ㅽ궎留?
-- ?곸뾽 ?쒕룞 愿由??쒖뒪??(Sales Activity Control)
-- ============================================

-- ============================================
-- 1. ?뺤옣 湲곕뒫 ?쒖꽦??
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. ?뚯씠釉??앹꽦
-- ============================================

-- ----- 2-1. ?꾨줈??(auth.users? 1:1 ?곌껐) -----
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

COMMENT ON TABLE profiles IS '?ъ슜???꾨줈??- auth.users? 1:1 留ㅽ븨';

-- ----- 2-2. 怨좉컼 -----
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_title TEXT,
  phone TEXT,
  email TEXT,
  customer_type TEXT NOT NULL DEFAULT '踰뺤씤',
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

COMMENT ON TABLE customers IS '怨좉컼(嫄곕옒泥? ?뺣낫';

-- ----- 2-3. 怨꾩빟 -----
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_number TEXT,
  title TEXT NOT NULL,
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

COMMENT ON TABLE contracts IS '怨꾩빟 ?뺣낫 - ?뺤궛/吏異??⑷퀎???몃━嫄곕줈 ?먮룞 怨꾩궛';

-- ----- 2-4. ?섎ː -----
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  inquiry_date DATE,
  status TEXT NOT NULL DEFAULT '寃ъ쟻 臾몄쓽'
    CHECK (status IN ('寃ъ쟻 臾몄쓽', '?곸뾽以?, '怨꾩빟 ?깃났', '?섏＜ ?ㅽ뙣', '?④?')),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id),
  memo TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE requests IS '?섎ː(?곸뾽 湲고쉶) ?뺣낫';

-- ----- 2-5. ?뺤궛 -----
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  additional_amount BIGINT NOT NULL DEFAULT 0,
  tax_amount BIGINT NOT NULL DEFAULT 0,
  total_with_tax BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '?뺤궛 ?덉젙'
    CHECK (status IN ('?뺤궛 ?덉젙', '?뺤궛 吏??, '?뺤궛 ?꾨즺', '?뺤궛 以묐떒', '?④?')),
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

COMMENT ON TABLE settlements IS '?뺤궛 ?뺣낫 - 怨꾩빟蹂??섍툑 愿由?;

-- ----- 2-6. 吏異?-----
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
  tax_invoice_received TEXT NOT NULL DEFAULT '誘몄닔??,
  tax_invoice_due_date DATE,
  tax_invoice_date DATE,
  assigned_to UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE expenses IS '吏異??뺣낫 - 怨꾩빟蹂?鍮꾩슜 愿由?;

-- ----- 2-7. 寃ъ쟻??-----
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

COMMENT ON TABLE quotations IS '寃ъ쟻???뺣낫';

-- ----- 2-8. 二쇰Ц/諛곗넚 ?댁뿭 -----
CREATE TABLE order_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  opti_name TEXT,
  opti_number TEXT,
  contract_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE order_deliveries IS 'Order delivery cards';

CREATE TABLE order_delivery_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_delivery_id UUID NOT NULL REFERENCES order_deliveries(id) ON DELETE CASCADE,
  supplier TEXT,
  site_name TEXT,
  order_date DATE,
  order_number TEXT,
  model_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  delivery_request_date DATE,
  delivery_expected_date DATE,
  delivery_confirmed_date DATE,
  delivery_place TEXT,
  delivery_address TEXT,
  row_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE order_delivery_lines IS 'Order delivery line items';
-- ----- 2-9. 寃ъ쟻???덈ぉ -----
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

COMMENT ON TABLE quotation_items IS '寃ъ쟻???덈ぉ ?곸꽭';

-- ----- 2-10. ?낆텧湲덈궡??-----
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

COMMENT ON TABLE transactions IS '?낆텧湲??댁뿭';

-- ----- 2-11. 泥⑤??뚯씪 -----
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

COMMENT ON TABLE attachments IS '泥⑤??뚯씪 硫뷀??곗씠??- ?ㅼ젣 ?뚯씪? Supabase Storage';

-- ----- 2-12. ?쒕룞 濡쒓렇 (?좏깮?? -----
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE activity_logs IS '?쒕룞 濡쒓렇 - 蹂寃??대젰 異붿쟻';


-- ============================================
-- 3. ?몃━嫄??⑥닔
-- ============================================

-- ----- 3-1. updated_at ?먮룞 媛깆떊 -----
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 紐⑤뱺 ?뚯씠釉붿뿉 updated_at ?몃━嫄??곸슜
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

CREATE TRIGGER set_updated_at BEFORE UPDATE ON order_deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON order_delivery_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON quotation_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----- 3-2. auth.users 媛????profiles ?먮룞 ?앹꽦 -----
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

-- ----- 3-3. 寃ъ쟻踰덊샇 ?먮룞 ?앹꽦 (Q-YYYYMMDD-001 ?뺤떇) -----
CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TRIGGER AS $$
DECLARE
  today_str TEXT;
  seq_num INTEGER;
  new_number TEXT;
BEGIN
  -- ?ㅻ뒛 ?좎쭨 臾몄옄??
  today_str := to_char(now(), 'YYYYMMDD');

  -- ?ㅻ뒛 ?앹꽦??寃ъ쟻????移댁슫??
  SELECT COUNT(*) + 1 INTO seq_num
  FROM quotations
  WHERE quotation_number LIKE 'Q-' || today_str || '-%';

  -- 寃ъ쟻踰덊샇 ?앹꽦
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

-- ----- 3-4. ?뺤궛/吏異?蹂寃???怨꾩빟 ?⑷퀎 ?ш퀎??-----
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
  -- ???怨꾩빟 ID 寃곗젙 (INSERT/UPDATE??NEW, DELETE??OLD ?ъ슜)
  IF TG_OP = 'DELETE' THEN
    target_contract_id := OLD.contract_id;
  ELSE
    target_contract_id := NEW.contract_id;
  END IF;

  -- ?뺤궛 ?⑷퀎 怨꾩궛 (?④? ?곹깭 ?쒖쇅)
  SELECT COALESCE(SUM(amount + additional_amount), 0)
  INTO calc_total_settlement
  FROM settlements
  WHERE contract_id = target_contract_id
    AND status != '?④?';

  -- 吏異??⑷퀎 怨꾩궛
  SELECT COALESCE(SUM(amount_excl_tax), 0)
  INTO calc_total_expense
  FROM expenses
  WHERE contract_id = target_contract_id;

  -- ?쒖씠??怨꾩궛
  calc_net_profit := calc_total_settlement - calc_total_expense;

  -- 怨꾩빟 湲덉븸 議고쉶
  SELECT contract_amount INTO calc_contract_amount
  FROM contracts
  WHERE id = target_contract_id;

  -- ?댁씡瑜?怨꾩궛 (怨꾩빟湲덉븸 湲곗?, 0?쇰줈 ?섎늻湲?諛⑹?)
  IF calc_contract_amount > 0 THEN
    calc_profit_rate := ROUND((calc_net_profit::NUMERIC / calc_contract_amount::NUMERIC) * 100, 2);
  ELSE
    calc_profit_rate := 0;
  END IF;

  -- 怨꾩빟 ?뚯씠釉??낅뜲?댄듃
  UPDATE contracts
  SET
    total_settlement = calc_total_settlement,
    total_expense = calc_total_expense,
    net_profit = calc_net_profit,
    profit_rate = calc_profit_rate
  WHERE id = target_contract_id;

  -- DELETE??寃쎌슦 OLD, 洹???NEW 諛섑솚
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ?뺤궛 蹂寃????몃━嫄?
CREATE TRIGGER recalc_contract_on_settlement_change
  AFTER INSERT OR UPDATE OR DELETE ON settlements
  FOR EACH ROW EXECUTE FUNCTION recalculate_contract_totals();

-- 吏異?蹂寃????몃━嫄?
CREATE TRIGGER recalc_contract_on_expense_change
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION recalculate_contract_totals();


-- ============================================
-- 4. RLS (Row Level Security) ?뺤콉
-- ============================================

-- 紐⑤뱺 ?뚯씠釉붿뿉 RLS ?쒖꽦??
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_delivery_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- ----- 愿由ъ옄 ?щ? ?뺤씤 ?⑥닔 -----
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

-- ----- profiles ?뺤콉 -----
-- 議고쉶: 濡쒓렇?명븳 紐⑤뱺 ?ъ슜?먭? ?꾩껜 ?꾨줈??議고쉶 媛??
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ?섏젙: 蹂몄씤留??섏젙 媛??
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 愿由ъ옄: ?꾩껜 ?섏젙 媛??
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE USING (is_admin());

-- ----- customers ?뺤콉 -----
-- 議고쉶: 濡쒓렇?명븳 紐⑤뱺 ?ъ슜??
CREATE POLICY "customers_select" ON customers
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ?앹꽦: 濡쒓렇?명븳 紐⑤뱺 ?ъ슜??
CREATE POLICY "customers_insert" ON customers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ?섏젙: 蹂몄씤???앹꽦??寃??먮뒗 愿由ъ옄
CREATE POLICY "customers_update" ON customers
  FOR UPDATE USING (auth.uid() = created_by OR is_admin());

-- ??젣: 愿由ъ옄留?
CREATE POLICY "customers_delete" ON customers
  FOR DELETE USING (is_admin());

-- ----- requests ?뺤콉 -----
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

-- ----- contracts ?뺤콉 -----
CREATE POLICY "contracts_select" ON contracts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "contracts_insert" ON contracts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "contracts_update" ON contracts
  FOR UPDATE USING (auth.uid() = created_by OR is_admin());

CREATE POLICY "contracts_delete" ON contracts
  FOR DELETE USING (is_admin());

-- ----- settlements ?뺤콉 -----
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

-- ----- expenses ?뺤콉 -----
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

-- ----- quotations ?뺤콉 -----
CREATE POLICY "quotations_select" ON quotations
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "quotations_insert" ON quotations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "quotations_update" ON quotations
  FOR UPDATE USING (auth.uid() = created_by OR is_admin());

CREATE POLICY "quotations_delete" ON quotations
  FOR DELETE USING (auth.uid() = created_by OR is_admin());

-- ----- order_deliveries ?뺤콉 -----
CREATE POLICY "order_deliveries_select" ON order_deliveries
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "order_deliveries_insert" ON order_deliveries
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "order_deliveries_update" ON order_deliveries
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "order_deliveries_delete" ON order_deliveries
  FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "order_delivery_lines_select" ON order_delivery_lines
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "order_delivery_lines_insert" ON order_delivery_lines
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "order_delivery_lines_update" ON order_delivery_lines
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "order_delivery_lines_delete" ON order_delivery_lines
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ----- quotation_items ?뺤콉 (寃ъ쟻?쒖? ?숈씪???묎렐 沅뚰븳) -----
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

-- ----- transactions ?뺤콉 -----
CREATE POLICY "transactions_select" ON transactions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "transactions_insert" ON transactions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "transactions_update" ON transactions
  FOR UPDATE USING (auth.uid() = created_by OR is_admin());

CREATE POLICY "transactions_delete" ON transactions
  FOR DELETE USING (auth.uid() = created_by OR is_admin());

-- ----- attachments ?뺤콉 -----
CREATE POLICY "attachments_select" ON attachments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "attachments_insert" ON attachments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "attachments_delete" ON attachments
  FOR DELETE USING (auth.uid() = uploaded_by OR is_admin());

-- ----- activity_logs ?뺤콉 -----
CREATE POLICY "activity_logs_select" ON activity_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "activity_logs_insert" ON activity_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- ============================================
-- 5. ?몃뜳??
-- ============================================

-- 怨좉컼
CREATE INDEX idx_customers_company_name ON customers(company_name);
CREATE INDEX idx_customers_created_by ON customers(created_by);
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);
CREATE INDEX idx_customers_business_number ON customers(business_number) WHERE business_number IS NOT NULL;

-- ?섎ː
CREATE INDEX idx_requests_customer_id ON requests(customer_id);
CREATE INDEX idx_requests_contract_id ON requests(contract_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_assigned_to ON requests(assigned_to);
CREATE INDEX idx_requests_created_by ON requests(created_by);
CREATE INDEX idx_requests_created_at ON requests(created_at DESC);

-- 怨꾩빟
CREATE INDEX idx_contracts_customer_id ON contracts(customer_id);
CREATE INDEX idx_contracts_created_by ON contracts(created_by);
CREATE INDEX idx_contracts_created_at ON contracts(created_at DESC);
CREATE INDEX idx_contracts_start_date ON contracts(start_date);
CREATE INDEX idx_contracts_end_date ON contracts(end_date);

-- ?뺤궛
CREATE INDEX idx_settlements_contract_id ON settlements(contract_id);
CREATE INDEX idx_settlements_customer_id ON settlements(customer_id);
CREATE INDEX idx_settlements_status ON settlements(status);
CREATE INDEX idx_settlements_due_date ON settlements(due_date);
CREATE INDEX idx_settlements_assigned_to ON settlements(assigned_to);
CREATE INDEX idx_settlements_created_at ON settlements(created_at DESC);

-- 吏異?
CREATE INDEX idx_expenses_contract_id ON expenses(contract_id);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX idx_expenses_assigned_to ON expenses(assigned_to);
CREATE INDEX idx_expenses_created_at ON expenses(created_at DESC);
CREATE INDEX idx_expenses_is_paid ON expenses(is_paid);

-- 寃ъ쟻??CREATE INDEX idx_quotations_request_id ON quotations(request_id);
CREATE INDEX idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX idx_quotations_created_at ON quotations(created_at DESC);
CREATE INDEX idx_order_deliveries_request_id ON order_deliveries(request_id);
CREATE INDEX idx_order_deliveries_created_at ON order_deliveries(created_at DESC);
CREATE INDEX idx_order_delivery_lines_order_delivery_id ON order_delivery_lines(order_delivery_id);
CREATE INDEX idx_order_delivery_lines_row_order ON order_delivery_lines(order_delivery_id, row_order);
CREATE INDEX idx_quotation_items_quotation_id ON quotation_items(quotation_id);

-- ?낆텧湲덈궡??
CREATE INDEX idx_transactions_contract_id ON transactions(contract_id);
CREATE INDEX idx_transactions_settlement_id ON transactions(settlement_id);
CREATE INDEX idx_transactions_expense_id ON transactions(expense_id);
CREATE INDEX idx_transactions_transaction_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_transaction_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- 泥⑤??뚯씪
CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id);
CREATE INDEX idx_attachments_uploaded_by ON attachments(uploaded_by);

-- ?쒕룞 濡쒓렇
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);


-- ============================================
-- 6. Supabase Storage 踰꾪궥 (蹂꾨룄 ??쒕낫???먮뒗 API濡??앹꽦)
-- ============================================
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('attachments', 'attachments', false);
--
-- ?뚯씪 ?낅줈???ㅼ슫濡쒕뱶 ?뺤콉? Supabase ??쒕낫?쒖뿉???ㅼ젙?섍굅??
-- storage.objects?????RLS ?뺤콉?쇰줈 愿由?








