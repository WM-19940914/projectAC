// ----- 의뢰 칸반보드 공통 타입 및 상수 -----

import { Briefcase, CheckCircle2, ClipboardList, XCircle } from "lucide-react"

// ----- 타입 -----
export interface RequestItem {
  id: string
  title: string
  inquiry_date: string | null
  status: string
  contract_id: string | null
  confirmed_quote_id: string | null
  memo: string | null
  created_at: string
  customer: {
    id: string
    company_name: string
    deleted_at: string | null
  } | null
  // 정산 상태 표시용 계약 정보
  contract: {
    id: string
    contract_amount: number
    total_paid: number
    has_upcoming: boolean  // 미확인 입금내역 있는지
    all_confirmed: boolean  // 모든 입금내역이 입완 체크되었는지
    tax_invoice_all_issued: boolean  // 모든 단계 계산서 발행
    tax_invoice_some_issued: boolean  // 일부 단계만 계산서 발행
    stage_summaries: { name: string; status: "paid" | "partial" | "unpaid" }[]  // 단계별 입금완료 요약
    settlement_meta?: {  // raw 메타 데이터 (초기 stage_summaries 계산용)
      settlement_status_map: Record<string, unknown> | null
      stage_ratios: Record<string, number> | null
      middle_installments: number
    } | null
  } | null
}

export interface KanbanColumn {
  status: string
  items: RequestItem[]
  count: number
}

export interface CustomerOption {
  id: string
  company_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  representative: string | null
  business_number: string | null
  memo: string | null
}

export interface Props {
  columns: KanbanColumn[]
  totalCount: number
  customers: CustomerOption[]
  hiddenItems: RequestItem[]
  failedItems: RequestItem[]  // "수주 실패" 항목 (컬럼 대신 접힌 리스트로 표시)
}

export interface ContractSummary {
  totalWithVat: number
  paidAmount: number
  unpaidAmount: number
  progressPercent: number
  allConfirmed: boolean  // 모든 입금내역이 입완 체크되었는지
  taxInvoiceAllIssued: boolean  // 모든 단계 계산서 발행
  taxInvoiceSomeIssued: boolean  // 일부 단계만 계산서 발행
  stageSummaries: { name: string; status: "paid" | "partial" | "unpaid" }[]  // 단계별 입금완료 요약
}

// ----- 견적서 목록 항목 타입 -----
export interface QuotationListItem {
  id: string
  title: string
  quotation_number: string
  quotation_date: string
  total_amount: number
  grand_total: number
  items?: Array<{ purchase_amount?: number; incentive_rate?: number }>
}

// ----- 정산 관련 타입 -----
export type SettlementStage = "선금" | "중도금" | "잔금"

export const SETTLEMENT_STAGE_ORDER: SettlementStage[] = ["선금", "중도금", "잔금"]
export const EMPTY_STAGE_RATIOS: Record<SettlementStage, number> = { 선금: 0, 중도금: 0, 잔금: 0 }
export const EMPTY_STAGE_SCHEDULED_DATES: Record<SettlementStage, string> = { 선금: "", 중도금: "", 잔금: "" }
export const EMPTY_STAGE_CONDITIONS: Record<SettlementStage, string> = { 선금: "", 중도금: "", 잔금: "" }
export const DEFAULT_MIDDLE_INSTALLMENTS = 1

export interface ContractDraft {
  id: string | null
  title: string
  customer_id: string
  contract_amount: number
  start_date: string
  end_date: string
  settlement_type: SettlementStage[]
}

export interface PendingContractDraftSnapshot {
  draft: ContractDraft
  stageRatios: Record<SettlementStage, number>
  middleInstallments: number
  stageScheduledDates: Record<SettlementStage, string>
  stageConditions: Record<SettlementStage, string>
  settlementStatusMap: Record<string, SettlementStatusInput>
}

export interface SettlementStatusInput {
  payment_confirmed: boolean
  actual_amount: number
  received_date: string
  tax_invoice_issued: boolean
  tax_invoice_date: string  // 세금계산서 발행일
  payment_entries: SettlementPaymentEntry[]
  has_upcoming: boolean  // 미래 날짜 입금예정이 있는지
}

export interface SettlementPaymentEntry {
  id: string
  amount: number
  paid_at: string
  note: string
  confirmed: boolean  // 입금 확인 여부 — true일 때만 정산 금액에 합산
}

// ----- 컬럼별 색상 (커스텀 팔레트) -----
// 컬럼별 카드 타이틀 아이콘 (흑백, Calendar/Building2와 동일 스타일)
export const COLUMN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "견적 문의": ClipboardList,
  "영업중": Briefcase,
  "계약 성공": CheckCircle2,
  "수주 실패": XCircle,
}

export const COLUMN_STYLES: Record<string, {
  header: string
  border: string
  bg: string
  badge: string
  cardBar: string
}> = {
  "견적 문의": {
    header: "text-slate-700",
    border: "border-t-slate-300",
    bg: "bg-slate-50/50",
    badge: "bg-slate-100 text-slate-600",
    cardBar: "border-l-slate-300",
  },
  "영업중": {
    header: "text-indigo-600",
    border: "border-t-indigo-400",
    bg: "bg-indigo-50/30",
    badge: "bg-indigo-100 text-indigo-600",
    cardBar: "border-l-indigo-400",
  },
  "계약 성공": {
    header: "text-green-700",
    border: "border-t-green-400",
    bg: "bg-green-50/30",
    badge: "bg-green-100 text-green-700",
    cardBar: "border-l-green-400",
  },
  "수주 실패": {
    header: "text-red-600",
    border: "border-t-red-300",
    bg: "bg-red-50/30",
    badge: "bg-red-100 text-red-600",
    cardBar: "border-l-red-300",
  },
}
