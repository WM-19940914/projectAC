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

// 매출 월별 집계
export interface MonthlyRevenue {
  month: string      // "1월", "2월" 등
  amount: number     // 계약금액 합계
  yearMonth: string  // "2025-06" (정렬용)
}

// 진행 현장
export interface ActiveSite {
  requestId: string
  title: string
  customerName: string
  contractAmount: number
  stageSummaries: { name: string; status: "paid" | "partial" | "unpaid" }[]
}

// 공헌이익 데이터
export interface ContributionData {
  revenue: number
  expense: number
  profit: number
  rate: number
}
