"use client"

// ----- 대시보드 클라이언트 오케스트레이터 -----
// 3개 섹션을 세로로 나열하는 레이아웃 컴포넌트

import { SmilePlus } from "lucide-react"
import { useAuth } from "@/providers/auth-provider"
import type { SettlementAlert, ExpenseAlert, TaxInvoiceAlert, MonthlyRevenue, RevenueDetail, ContractContribution, DashboardRequestInfo } from "./dashboard-types"
import { SettlementExpenseSection } from "./settlement-expense-section"
import { RevenueChartSection } from "./revenue-chart-section"
import { ContributionSection } from "./contribution-section"

// 시간대별 인사 메시지 (의뢰 칸반보드와 동일)
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return "새벽에도 수고하세요"
  if (hour < 12) return "좋은 아침이에요"
  if (hour < 14) return "점심 맛있게 드세요"
  if (hour < 18) return "좋은 오후에요"
  return "오늘도 수고했어요"
}

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
  const { profile } = useAuth()

  return (
    <div className="space-y-6 p-6">
      {/* 페이지 제목 + 인사 메시지 */}
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-heading font-bold text-gray-900">DashBoard</h1>
        <div className="h-5 w-px bg-gray-200" />
        <div className="flex items-center gap-2">
          <SmilePlus className="h-4.5 w-4.5 text-sky-aqua" />
          <span className="text-[13px] text-gray-400">
            {getGreeting()}, <span className="font-medium text-gray-500">{profile?.name || "사용자"}</span>님
          </span>
        </div>
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
