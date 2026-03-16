"use client"

// ----- 대시보드 클라이언트 오케스트레이터 -----
// 4개 섹션을 세로로 나열하는 레이아웃 컴포넌트

import type { SettlementAlert, ExpenseAlert, MonthlyRevenue, ActiveSite, ContributionData } from "./dashboard-types"
import { SettlementExpenseSection } from "./settlement-expense-section"
import { RevenueChartSection } from "./revenue-chart-section"
import { ActiveSitesSection } from "./active-sites-section"
import { ContributionSection } from "./contribution-section"

interface Props {
  settlementAlerts: SettlementAlert[]
  expenseAlerts: ExpenseAlert[]
  monthlyRevenue: MonthlyRevenue[]
  activeSites: ActiveSite[]
  currentMonth: string
  contribution: {
    monthly: ContributionData
    yearly: ContributionData
  }
}

export function DashboardClient({
  settlementAlerts,
  expenseAlerts,
  monthlyRevenue,
  activeSites,
  currentMonth,
  contribution,
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
      />

      {/* 섹션2: 1년간 매출 그래프 */}
      <RevenueChartSection data={monthlyRevenue} />

      {/* 섹션3: 월별 진행 현장 */}
      <ActiveSitesSection
        sites={activeSites}
        currentMonth={currentMonth}
      />

      {/* 섹션4: 월간/연간 공헌이익 */}
      <ContributionSection
        monthly={contribution.monthly}
        yearly={contribution.yearly}
        currentMonth={currentMonth}
      />
    </div>
  )
}
