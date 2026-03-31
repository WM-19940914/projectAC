-- 지출결의서 헤더 (의뢰 1건당 N개 가능)
CREATE TABLE public.expense_reports (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  project_name text,          -- 영업건명
  customer text,              -- 수요처
  customer_contact text,      -- 수요처 담당
  team text DEFAULT 'MA영업팀', -- 멜레아 소속
  manager text,               -- 멜레아 담당
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 지출결의서 행 (헤더 1건당 N개)
CREATE TABLE public.expense_report_rows (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  report_id uuid NOT NULL REFERENCES public.expense_reports(id) ON DELETE CASCADE,
  row_order integer DEFAULT 1,        -- 행 순서
  category text,                      -- A: 구분
  supplier text,                      -- B: 매입처
  item text,                          -- C: 품목
  spec text,                          -- D: 규격
  quantity numeric DEFAULT 0,         -- E: 수량
  list_price numeric DEFAULT 0,       -- F: 반출가
  dc_rate numeric DEFAULT 0,          -- G: DC율 (%, 10 = 10%)
  option_amount numeric DEFAULT 0,    -- H: 옵션물
  proposed_unit numeric DEFAULT 0,    -- L: 제안가 단가
  grade_reb numeric DEFAULT 0,        -- P: 등급 Reb (%, 5 = 5%)
  item_reb numeric DEFAULT 0,         -- R: 품목 Reb (%, 3 = 3%)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_expense_reports_request_id ON public.expense_reports(request_id);
CREATE INDEX idx_expense_report_rows_report_id ON public.expense_report_rows(report_id);

ALTER TABLE public.expense_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_report_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_reports_select" ON public.expense_reports FOR SELECT USING (true);
CREATE POLICY "expense_reports_insert" ON public.expense_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "expense_reports_update" ON public.expense_reports FOR UPDATE USING (true);
CREATE POLICY "expense_reports_delete" ON public.expense_reports FOR DELETE USING (true);

CREATE POLICY "expense_report_rows_select" ON public.expense_report_rows FOR SELECT USING (true);
CREATE POLICY "expense_report_rows_insert" ON public.expense_report_rows FOR INSERT WITH CHECK (true);
CREATE POLICY "expense_report_rows_update" ON public.expense_report_rows FOR UPDATE USING (true);
CREATE POLICY "expense_report_rows_delete" ON public.expense_report_rows FOR DELETE USING (true);

COMMENT ON TABLE public.expense_reports IS '지출결의서 - 의뢰별 헤더 정보';
COMMENT ON TABLE public.expense_report_rows IS '지출결의서 행 - 품목별 상세';
