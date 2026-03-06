// ============================================
// SAC ?꾨줈?앺듃 - ?꾩껜 ?곗씠??????뺤쓽
// ============================================

// ----- ?꾨줈??-----
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

// ----- 怨좉컼 -----
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
  // 吏묎퀎 (view/computed)
  request_count?: number;
  contract_count?: number;
}

// ----- ?섎ː -----
export type RequestStatus = '견적서 작성중' | '계약 진행' | '계약 체결' | '주문·배송 진행' | '완료';

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
  // 議곗씤
  customer?: Customer;
  contract?: Contract;
  assigned_user?: Profile;
}

export interface Contract {
  id: string;
  customer_id?: string | null;
  title: string;
  contract_amount: number;
  vat_inclusive?: boolean;
  settlement_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  memo?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  // 議곗씤
  customer?: Customer;
  settlements?: Settlement[];
  expenses?: Expense[];
}

// ----- ?뺤궛 -----
export type SettlementStatus = '정산 예정' | '정산 진행중' | '정산 완료' | '정산 보류' | '취소';

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
  // 議곗씤
  contract?: Contract;
  customer?: Customer;
}

// ----- 吏異?-----
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
  // 議곗씤
  contract?: Contract;
}

// ----- 寃ъ쟻??-----
export type QuotationType = string;
export type QuotationItemCategory = string;

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
  // 寃ъ쟻???ㅻ뜑 異붽? ?꾨뱶
  site_name?: string;        // 현장명
  recipient?: string;        // 수신
  contact_person?: string;   // 담당자
  contact_phone?: string;    // 연락처
  // 怨듦툒???뺣낫
  supplier_company_name?: string;
  supplier_biz_number?: string;
  supplier_ceo_name?: string;
  supplier_email?: string;
  supplier_address?: string;
  supplier_manager?: string;
  supplier_manager_phone?: string;
  supplier_manager_email?: string;
  // ?⑷린/寃곗젣 ?뺣낫
  delivery_date?: string;         // ?⑷린?쇱옄
  delivery_place?: string;        // ?⑷린?μ냼
  payment_condition?: string;     // 寃곗젣議곌굔
  // ?섏떊???뺤옣
  receiver_company_name?: string;
  receiver_biz_number?: string;
  receiver_email?: string;
  receiver_address?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // 議곗씤
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
  // ?대? ?④? 怨꾩궛 ?꾨뱶 (AH~AP??
  retrieval_price?: number;       // 諛섏텧媛
  discount_rate?: number;         // DC??(%)
  purchase_unit_price?: number;   // 留ㅼ엯?④?
  purchase_amount?: number;       // 留ㅼ엯湲덉븸
  margin_rate?: number;           // MG??(%)
  proposed_price?: number;        // ?쒖븞媛
  profit?: number;                // ?댁쑄
  incentive_rate?: number;        // ?λ젮湲덈쪧 (%)
  created_at: string;
  updated_at: string;
}

// 견적서 + 품목 확장 타입
export interface QuotationWithItems extends Quotation {
  items: QuotationItem[];
}

// ----- 二쇰Ц/諛곗넚 ?댁뿭 -----
export interface OrderDeliveryLine {
  id: string;
  order_delivery_id: string;
  supplier?: string | null;
  site_name?: string | null;
  order_date?: string | null;
  order_number?: string | null;
  model_name?: string | null;
  quantity?: number | null;
  order_amount?: number | null;
  delivery_request_date?: string | null;
  delivery_expected_date?: string | null;
  delivery_confirmed_date?: string | null;
  delivery_place?: string | null;
  row_order: number;
  created_at: string;
  updated_at: string;
}

export interface OrderDelivery {
  id: string;
  request_id: string;
  site_name?: string | null;
  opti_name?: string | null;
  opti_number?: string | null;
  contract_number?: string | null;
  lines?: OrderDeliveryLine[];
  created_at: string;
  updated_at: string;
}

// ----- ?낆텧湲덈궡??-----
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
  // 議곗씤
  contract?: Contract;
  settlement?: Settlement;
  expense?: Expense;
}

// ----- 泥⑤??뚯씪 -----
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

// ----- ?꾩튂 (怨좉컼 吏?꾩슜) -----
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

// ----- 怨듯넻 -----
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
}

// ----- 移몃컲 蹂대뱶 ???-----
export interface KanbanColumn<T> {
  id: string;
  title: string;
  color: string;     // 諛곌꼍???띿뒪?몄깋
  items: T[];
  count: number;
  totalAmount?: number;
}



