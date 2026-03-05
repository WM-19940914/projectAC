// ============================================
// SAC 프로젝트 - Zod 유효성 검사 스키마
// ============================================

import { z } from 'zod';

// ----- 로그인 스키마 -----
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, '이메일을 입력해주세요')
    .email('올바른 이메일 형식이 아닙니다'),
  password: z
    .string()
    .min(6, '비밀번호는 6자 이상이어야 합니다'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// ----- 회원가입 스키마 -----
export const signupSchema = z.object({
  full_name: z
    .string()
    .min(1, '이름을 입력해주세요')
    .max(50, '이름은 50자 이내로 입력해주세요'),
  email: z
    .string()
    .min(1, '이메일을 입력해주세요')
    .email('올바른 이메일 형식이 아닙니다'),
  password: z
    .string()
    .min(6, '비밀번호는 6자 이상이어야 합니다'),
  confirmPassword: z
    .string()
    .min(1, '비밀번호 확인을 입력해주세요'),
}).refine((data) => data.password === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirmPassword'],
});

export type SignupFormData = z.infer<typeof signupSchema>;

// ----- 고객 스키마 -----
export const customerSchema = z.object({
  company_name: z
    .string()
    .min(1, '회사명을 입력해주세요')
    .max(100, '회사명은 100자 이내로 입력해주세요'),
  contact_name: z.string().max(50, '담당자명은 50자 이내로 입력해주세요').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z
    .string()
    .email('올바른 이메일 형식이 아닙니다')
    .optional()
    .or(z.literal('')),
  customer_type: z.string().default('법인'),
  business_number: z
    .string()
    .regex(/^(\d{3}-?\d{2}-?\d{5})?$/, '올바른 사업자등록번호 형식이 아닙니다 (예: 123-45-67890)')
    .optional()
    .or(z.literal('')),
  representative: z.string().max(50, '대표자명은 50자 이내로 입력해주세요').optional().or(z.literal('')),
  address: z.string().max(200, '주소는 200자 이내로 입력해주세요').optional().or(z.literal('')),
  sub_business_number: z.string().optional().or(z.literal('')),
  business_item: z.string().optional().or(z.literal('')),
  business_type: z.string().optional().or(z.literal('')),
  tax_email: z
    .string()
    .email('올바른 이메일 형식이 아닙니다')
    .optional()
    .or(z.literal('')),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  memo: z.string().max(1000, '메모는 1000자 이내로 입력해주세요').optional().or(z.literal('')),
});

export type CustomerFormData = z.infer<typeof customerSchema>;

// ----- 의뢰 스키마 -----
export const requestSchema = z.object({
  title: z
    .string()
    .min(1, '의뢰 제목을 입력해주세요')
    .max(200, '제목은 200자 이내로 입력해주세요'),
  inquiry_date: z.string().optional().or(z.literal('')),
  status: z.enum(['견적 문의', '영업중', '계약 성공', '수주 실패', '숨김']).default('견적 문의'),
  customer_id: z.string().uuid('올바른 고객을 선택해주세요').optional().or(z.literal('')),
  contract_id: z.string().uuid().optional().or(z.literal('')),
  assigned_to: z.string().uuid().optional().or(z.literal('')),
  memo: z.string().max(2000, '메모는 2000자 이내로 입력해주세요').optional().or(z.literal('')),
});

export type RequestFormData = z.infer<typeof requestSchema>;

// ----- 계약 스키마 -----
export const contractSchema = z.object({
  contract_number: z.string().optional().or(z.literal('')),
  title: z
    .string()
    .min(1, '계약 제목을 입력해주세요')
    .max(200, '제목은 200자 이내로 입력해주세요'),
  customer_id: z.string().uuid('올바른 고객을 선택해주세요').optional().or(z.literal('')),
  contract_amount: z
    .number()
    .min(0, '금액은 0 이상이어야 합니다')
    .default(0),
  settlement_type: z.string().optional().or(z.literal('')),
  start_date: z.string().optional().or(z.literal('')),
  end_date: z.string().optional().or(z.literal('')),
  category: z.string().optional().or(z.literal('')),
  memo: z.string().max(2000, '메모는 2000자 이내로 입력해주세요').optional().or(z.literal('')),
});

export type ContractFormData = z.infer<typeof contractSchema>;

// ----- 정산 스키마 -----
export const settlementSchema = z.object({
  contract_id: z.string().uuid('계약을 선택해주세요'),
  title: z
    .string()
    .min(1, '정산 제목을 입력해주세요')
    .max(200, '제목은 200자 이내로 입력해주세요'),
  customer_id: z.string().uuid().optional().or(z.literal('')),
  amount: z
    .number()
    .min(0, '금액은 0 이상이어야 합니다')
    .default(0),
  additional_amount: z.number().default(0),
  tax_amount: z.number().default(0),
  total_with_tax: z.number().default(0),
  status: z.enum(['정산 예정', '정산 지연', '정산 완료', '정산 중단', '숨김']).default('정산 예정'),
  settlement_type: z.string().optional().or(z.literal('')),
  due_date: z.string().optional().or(z.literal('')),
  confirmed_date: z.string().optional().or(z.literal('')),
  tax_invoice_issued: z.boolean().default(false),
  tax_invoice_due_date: z.string().optional().or(z.literal('')),
  tax_invoice_date: z.string().optional().or(z.literal('')),
  assigned_to: z.string().uuid().optional().or(z.literal('')),
});

export type SettlementFormData = z.infer<typeof settlementSchema>;

// ----- 지출 스키마 -----
export const expenseSchema = z.object({
  contract_id: z.string().uuid('계약을 선택해주세요'),
  expense_date: z
    .string()
    .min(1, '지출일자를 입력해주세요'),
  vendor: z
    .string()
    .min(1, '거래처를 입력해주세요')
    .max(100, '거래처는 100자 이내로 입력해주세요'),
  account_category: z.string().optional().or(z.literal('')),
  description: z.string().max(500, '적요는 500자 이내로 입력해주세요').optional().or(z.literal('')),
  tax_rate: z.string().default('10%'),
  cost_basis: z.string().optional().or(z.literal('')),
  cost_amount: z
    .number()
    .min(0, '금액은 0 이상이어야 합니다')
    .default(0),
  amount_excl_tax: z
    .number()
    .min(0, '금액은 0 이상이어야 합니다')
    .default(0),
  tax_amount: z.number().default(0),
  amount_incl_tax: z.number().default(0),
  is_paid: z.boolean().default(false),
  payment_method: z.string().optional().or(z.literal('')),
  memo: z.string().max(1000, '메모는 1000자 이내로 입력해주세요').optional().or(z.literal('')),
  tax_invoice_received: z.string().default('미수령'),
  tax_invoice_due_date: z.string().optional().or(z.literal('')),
  tax_invoice_date: z.string().optional().or(z.literal('')),
  assigned_to: z.string().uuid().optional().or(z.literal('')),
});

export type ExpenseFormData = z.infer<typeof expenseSchema>;

// ----- 견적서 스키마 -----
export const quotationItemSchema = z.object({
  item_name: z
    .string()
    .min(1, '품목명을 입력해주세요')
    .max(200, '품목명은 200자 이내로 입력해주세요'),
  specification: z.string().optional().or(z.literal('')),
  unit: z.string().optional().or(z.literal('')),
  quantity: z
    .number()
    .min(1, '수량은 1 이상이어야 합니다')
    .default(1),
  unit_price: z
    .number()
    .min(0, '단가는 0 이상이어야 합니다')
    .default(0),
  memo: z.string().optional().or(z.literal('')),
});

export const quotationSchema = z.object({
  request_id: z.string().uuid().optional().or(z.literal('')),
  customer_id: z.string().uuid('고객을 선택해주세요').optional().or(z.literal('')),
  title: z
    .string()
    .min(1, '견적서 제목을 입력해주세요')
    .max(200, '제목은 200자 이내로 입력해주세요'),
  quotation_date: z.string().min(1, '견적일자를 입력해주세요'),
  valid_until: z.string().optional().or(z.literal('')),
  notes: z.string().max(2000, '비고는 2000자 이내로 입력해주세요').optional().or(z.literal('')),
  terms: z.string().max(2000, '특이사항은 2000자 이내로 입력해주세요').optional().or(z.literal('')),
  items: z.array(quotationItemSchema).min(1, '최소 1개의 품목을 추가해주세요'),
});

export type QuotationFormData = z.infer<typeof quotationSchema>;
export type QuotationItemFormData = z.infer<typeof quotationItemSchema>;
