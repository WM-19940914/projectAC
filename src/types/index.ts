// ============================================
// SAC 프로젝트 - 전체 데이터 타입 정의
// ============================================

// ----- 프로필 -----
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'sales' | 'viewer';
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ----- 고객 -----
export interface Customer {
  id: string;
  company_name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  customer_type: string;
  business_number?: string;
  representative?: string;
  address?: string;
  sub_business_number?: string;
  business_item?: string;
  business_type?: string;
  tax_email?: string;
  latitude?: number;
  longitude?: number;
  memo?: string;
  deleted_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // 집계 (view/computed)
  request_count?: number;
  contract_count?: number;
}

// ----- 의뢰 -----
export type RequestStatus = '견적 문의' | '영업중' | '계약 성공' | '수주 실패' | '숨김';

export interface Request {
  id: string;
  title: string;
  inquiry_date?: string;
  status: RequestStatus;
  customer_id?: string;
  contract_id?: string;
  assigned_to?: string;
  memo?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // 조인
  customer?: Customer;
  contract?: Contract;
  assigned_user?: Profile;
}

// ----- 계약 -----
export type ContractStatus = '계약 준비 중' | '계약 진행 중' | '계약 종료' | '계약 중단' | '숨김';

export interface Contract {
  id: string;
  contract_number?: string;
  title: string;
  status: ContractStatus;
  customer_id?: string;
  contract_amount: number;
  settlement_type?: string;
  start_date?: string;
  end_date?: string;
  total_settlement: number;
  total_expense: number;
  net_profit: number;
  profit_rate: number;
  category?: string;
  memo?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // 조인
  customer?: Customer;
  settlements?: Settlement[];
  expenses?: Expense[];
}

// ----- 정산 -----
export type SettlementStatus = '정산 예정' | '정산 지연' | '정산 완료' | '정산 중단' | '숨김';

export interface Settlement {
  id: string;
  contract_id: string;
  title: string;
  customer_id?: string;
  amount: number;
  additional_amount: number;
  tax_amount: number;
  total_with_tax: number;
  status: SettlementStatus;
  settlement_type?: string;
  due_date?: string;
  confirmed_date?: string;
  tax_invoice_issued: boolean;
  tax_invoice_due_date?: string;
  tax_invoice_date?: string;
  assigned_to?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // 조인
  contract?: Contract;
  customer?: Customer;
}

// ----- 지출 -----
export interface Expense {
  id: string;
  contract_id: string;
  expense_date: string;
  vendor?: string;
  account_category?: string;
  description?: string;
  tax_rate: string;
  cost_basis?: string;
  cost_amount: number;
  amount_excl_tax: number;
  tax_amount: number;
  amount_incl_tax: number;
  is_paid: boolean;
  payment_method?: string;
  memo?: string;
  tax_invoice_received: string;
  tax_invoice_due_date?: string;
  tax_invoice_date?: string;
  assigned_to?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // 조인
  contract?: Contract;
}

// ----- 견적서 -----
export type QuotationType = '간이' | '상세';
export type QuotationItemCategory = '일반' | '장비' | '설치비';

export interface Quotation {
  id: string;
  quotation_number: string;
  type: QuotationType;
  request_id?: string;
  customer_id?: string;
  title: string;
  quotation_date: string;
  valid_until?: string;
  total_amount: number;
  tax_amount: number;
  grand_total: number;
  notes?: string;
  terms?: string;
  // 견적서 헤더 추가 필드
  site_name?: string;        // 현장명
  recipient?: string;        // 수신
  contact_person?: string;   // 담당자
  contact_phone?: string;    // 전화번호
  created_by?: string;
  created_at: string;
  updated_at: string;
  // 조인
  items?: QuotationItem[];
  customer?: Customer;
  request?: Request;
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  category: QuotationItemCategory;
  item_order: number;
  item_name: string;
  specification?: string;
  unit?: string;
  quantity: number;
  unit_price: number;
  amount: number;
  memo?: string;
  // 내부 단가 계산 필드 (AH~AP열)
  retrieval_price?: number;       // 반출가
  discount_rate?: number;         // DC율 (%)
  purchase_unit_price?: number;   // 매입단가
  purchase_amount?: number;       // 매입금액
  margin_rate?: number;           // MG율 (%)
  proposed_price?: number;        // 제안가
  profit?: number;                // 이윤
  incentive_rate?: number;        // 장려금률 (%)
  created_at: string;
  updated_at: string;
}

// 견적서 + 품목 조인 타입
export interface QuotationWithItems extends Quotation {
  items: QuotationItem[];
}

// ----- 입출금내역 -----
export interface Transaction {
  id: string;
  contract_id?: string;
  settlement_id?: string;
  expense_id?: string;
  transaction_type: 'income' | 'expense';
  amount: number;
  transaction_date: string;
  description?: string;
  counterparty?: string;
  payment_method?: string;
  is_confirmed: boolean;
  memo?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // 조인
  contract?: Contract;
  settlement?: Settlement;
  expense?: Expense;
}

// ----- 첨부파일 -----
export interface Attachment {
  id: string;
  entity_type: 'customer' | 'request' | 'contract' | 'settlement' | 'expense' | 'quotation';
  entity_id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  uploaded_by?: string;
  created_at: string;
}

// ----- 위치 (고객 지도용) -----
export interface Location {
  id: string;
  customer_id: string;
  company_name: string;
  address: string;
  latitude: number;
  longitude: number;
  contact_name?: string;
  phone?: string;
}

// ----- 공통 -----
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
}

// ----- 칸반 보드 타입 -----
export interface KanbanColumn<T> {
  id: string;
  title: string;
  color: string;     // 배경색/텍스트색
  items: T[];
  count: number;
  totalAmount?: number;
}
