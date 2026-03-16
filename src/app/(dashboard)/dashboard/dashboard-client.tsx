"use client"

// ----- 대시보드 클라이언트 오케스트레이터 -----
// 3개 섹션을 세로로 나열하는 레이아웃 컴포넌트

import type { SettlementAlert, ExpenseAlert, TaxInvoiceAlert, MonthlyRevenue, RevenueDetail, ContractContribution, DashboardRequestInfo } from "./dashboard-types"
import { SettlementExpenseSection } from "./settlement-expense-section"
import { RevenueChartSection } from "./revenue-chart-section"
import { ContributionSection } from "./contribution-section"

interface Props {
  settlementAlerts: SettlementAlert[]
  expenseAlerts: ExpenseAlert[]
  taxInvoiceAlerts: TaxInvoiceAlert[]
  allRevenueData: Record<number, MonthlyRevenue[]>
  revenueDetails: Record<string, RevenueDetail[]>
  availableYears: number[]
  currentYear: number
  currentMonth: number
  contractContributions: ContractContribution[]
  requestInfoMap: Record<string, DashboardRequestInfo>
  initialYear: number
  initialMonth: number
}

export function DashboardClient({
  settlementAlerts,
  expenseAlerts,
  taxInvoiceAlerts,
  allRevenueData,
  revenueDetails,
  availableYears,
  currentYear,
  currentMonth,
  contractContributions,
  requestInfoMap,
  initialYear,
  initialMonth,
}: Props) {
  return (
    <div className="space-y-6 p-6">
      {/* 페이지 제목 */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">한눈에 보는 현재 현황</p>
      </div>

      {/* 섹션1: 정산/지출 한눈에보기 */}
      <SettlementExpenseSection
        settlementAlerts={settlementAlerts}
        expenseAlerts={expenseAlerts}
        taxInvoiceAlerts={taxInvoiceAlerts}
        requestInfoMap={requestInfoMap}
      />

      {/* 섹션2: 매출 추이 그래프 (계산서 발행일 기준) */}
      <RevenueChartSection
        allRevenueData={allRevenueData}
        revenueDetails={revenueDetails}
        availableYears={availableYears}
        currentYear={currentYear}
        currentMonth={currentMonth}
      />

      {/* 섹션3: 계약별 공헌이익 */}
      <ContributionSection
        items={contractContributions}
        requestInfoMap={requestInfoMap}
        initialYear={initialYear}
        initialMonth={initialMonth}
      />
    </div>
  )
}
