// ----- 대시보드 공유 타입 정의 -----
// 서버 컴포넌트(page.tsx)와 클라이언트 컴포넌트 간 공유되는 타입

// 정산 알림 항목
export interface SettlementAlert {
  type: "overdue" | "partial" | "upcoming"
  requestId: string
  requestTitle: string
  customerName: string
  contractId: string
  stageName: string
  plannedAmount: number
  paidAmount: number
  scheduledDate: string
  overdueDays?: number
}

// 지출 알림 항목
export interface ExpenseAlert {
  type: "unpaid" | "tax_invoice_due"
  requestId: string
  requestTitle: string
  customerName: string
  expenseId: string
  vendor: string
  description: string
  amount: number
  dueDate?: string
}

// 세금계산서 미발행 알림 항목
export interface TaxInvoiceAlert {
  requestId: string
  requestTitle: string
  contractId: string
  stageName: string
  amount: number       // 해당 단계 금액 (VAT포함)
  paidAmount: number   // 입금된 금액
}

// 매출 월별 집계 (계산서 발행일 기준, 연도별 1~12월)
export interface MonthlyRevenue {
  month: number      // 1~12
  label: string      // "1월", "2월" 등
  amount: number     // 계산서 발행 금액 합계 (VAT포함)
  count: number      // 발행 건수
}

// 매출 상세 항목 (막대 클릭 시 좌측 패널에 표시)
export interface RevenueDetail {
  contractId: string
  requestId: string | null
  title: string          // 계약 제목 또는 의뢰 제목
  customerName: string
  stageName: string      // "선금", "중도금 1차", "잔금" 등
  amount: number         // 해당 단계 금액 (VAT포함)
  invoiceDate: string    // 계산서 발행일
}

// 대시보드용 의뢰 요약 (Sheet 패널에서 사용)
export interface DashboardRequestInfo {
  id: string
  title: string
  status: string
  contract_id: string | null
  confirmed_quote_id: string | null
  inquiry_date: string | null
  memo: string | null
  manual_incentive: number   // 수동 장려금 (VAT별도)
  created_at: string
  customer: { id: string; company_name: string; deleted_at: string | null } | null
}

// 진행 매출 월별 집계 (계약기간 안분 기준)
export interface MonthlyProgressRevenue {
  month: number       // 1~12
  label: string       // "1월", "2월" 등
  amount: number      // 안분된 진행매출 합계 (공급가액)
  contractCount: number // 해당 월에 진행 중인 계약 수
}

// 공헌이익 데이터 (레거시)
export interface ContributionData {
  revenue: number
  expense: number
  profit: number
  rate: number
}

// 고객별 누적 거래액
export interface CustomerVolume {
  customerId: string
  customerName: string
  totalContractAmount: number  // 계약금액 합계 (VAT별도, 공급가액)
  contractCount: number        // 계약 건수
}

// KPI 요약 (대시보드 상단 카드)
export interface DashboardKPI {
  overdueTotal: number         // 정산 연체 총액 (미수금, VAT포함)
  collectionRate: number       // 정산 회수율 (%) = 총입금 / 총예정 × 100
  totalExpected: number        // 총 예정 금액
  totalCollected: number       // 총 입금 금액
  topCustomers: CustomerVolume[] // 고객별 누적 거래액 (상위)
}

// 계약별 공헌이익 항목 (모든 금액 VAT별도 = 공급가액 기준)
export interface ContractContribution {
  contractId: string
  requestId: string | null // 연결된 의뢰 ID (딥링크용)
  title: string
  customerName: string     // 고객(업체)명
  contractAmount: number   // 계약금액 (VAT별도, 공급가액) — 이익률 분모
  totalPaid: number        // 총 입금 금액 (VAT별도 환산)
  totalExpense: number     // 총 지출 금액 (VAT별도)
  incentiveTotal: number   // 장려금 (VAT별도)
  netProfit: number        // 순이익 = 입금 - 지출 (VAT별도)
  profitRate: number       // 이익률 % = 순이익 / 계약금액(VAT별도)
  yearMonth: string        // "2026-01" 형태 — 계약 종료일(end_date) 기준
}
