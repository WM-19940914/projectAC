"use client"

// ----- 대시보드 클라이언트 오케스트레이터 -----
// 3개 섹션을 세로로 나열하는 레이아웃 컴포넌트

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { SmilePlus, AlertTriangle, TrendingUp, Crown, X, Clock } from "lucide-react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { formatCurrency } from "@/lib/format"
import { useAuth } from "@/providers/auth-provider"
import type { SettlementAlert, ExpenseAlert, TaxInvoiceAlert, MonthlyRevenue, MonthlyProgressRevenue, RevenueDetail, ContractContribution, DashboardRequestInfo, DashboardKPI } from "./dashboard-types"
import { SettlementExpenseSection } from "./settlement-expense-section"
import { RevenueChartSection } from "./revenue-chart-section"
import { ProgressRevenueSection } from "./progress-revenue-section"
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

// 통화 포맷 (1234567 → "1,234,567")
function fmtCurrency(n: number): string {
  return Math.round(n).toLocaleString("ko-KR")
}

interface Props {
  settlementAlerts: SettlementAlert[]
  expenseAlerts: ExpenseAlert[]
  taxInvoiceAlerts: TaxInvoiceAlert[]
  kpi: DashboardKPI
  allRevenueData: Record<number, MonthlyRevenue[]>
  revenueDetails: Record<string, RevenueDetail[]>
  availableYears: number[]
  currentYear: number
  currentMonth: number
  contractContributions: ContractContribution[]
  requestInfoMap: Record<string, DashboardRequestInfo>
  initialYear: number
  initialMonth: number
  allProgressData: Record<number, MonthlyProgressRevenue[]>
  progressAvailableYears: number[]
}

export function DashboardClient({
  settlementAlerts,
  expenseAlerts,
  taxInvoiceAlerts,
  kpi,
  allRevenueData,
  revenueDetails,
  availableYears,
  currentYear,
  currentMonth,
  contractContributions,
  requestInfoMap,
  initialYear,
  initialMonth,
  allProgressData,
  progressAvailableYears,
}: Props) {
  const { profile } = useAuth()
  const router = useRouter()

  // 탭 포커스 복귀 시 서버 데이터 자동 갱신
  useEffect(() => {
    const onFocus = () => router.refresh()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [router])

  return (
    <div className="space-y-6 p-6 max-w-[1150px] mx-auto">
      {/* 페이지 제목 + 인사 메시지 */}
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-heading font-bold text-gray-900">DashBoard</h1>
        <div className="h-5 w-px bg-gray-200" />
        <div className="flex items-center gap-2">
          <SmilePlus className="h-4.5 w-4.5 text-sky-aqua" />
          <span className="text-[13px] text-gray-400">
            {getGreeting()}, <span className="font-medium text-gray-500">{profile?.full_name || "사용자"}</span>님
          </span>
        </div>
      </div>

      {/* 상단: 알림(좌, 넓게) + 정산현황/고객거래액(우, 세로 쌓기) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* 좌측 3/5: 알림 (크게) */}
        <div className="lg:col-span-3">
          <SettlementExpenseSection
            settlementAlerts={settlementAlerts}
            expenseAlerts={expenseAlerts}
            taxInvoiceAlerts={taxInvoiceAlerts}
            requestInfoMap={requestInfoMap}
          />
        </div>
        {/* 우측 2/5: 정산현황 + 고객거래액 세로 */}
        <div className="lg:col-span-2">
          <KPICards kpi={kpi} overdueAlerts={settlementAlerts.filter(a => a.type === "overdue")} />
        </div>
      </div>

      {/* 섹션2: 매출 추이 그래프 (계산서 발행일 기준) */}
      <RevenueChartSection
        allRevenueData={allRevenueData}
        revenueDetails={revenueDetails}
        availableYears={availableYears}
        currentYear={currentYear}
        currentMonth={currentMonth}
      />

      {/* 섹션2.5: 진행 매출 (계약기간 안분) */}
      <ProgressRevenueSection
        allProgressData={allProgressData}
        availableYears={progressAvailableYears}
        currentYear={currentYear}
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

// ----- KPI 카드 3종 -----
function KPICards({ kpi, overdueAlerts }: { kpi: DashboardKPI; overdueAlerts: SettlementAlert[] }) {
  const [showOverdue, setShowOverdue] = useState(false)
  const displayCustomers = kpi.topCustomers.slice(0, 10)

  return (
    <div className="flex flex-col gap-4">
      {/* 정산 현황 (심플) */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[11px] font-medium text-gray-400 mb-3">정산 현황</p>
        {/* 회수율 */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs text-gray-600">회수율</span>
          </div>
          {kpi.totalExpected > 0 ? (
            <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-bold tabular-nums text-green-700">
              {kpi.collectionRate.toFixed(1)}%
            </span>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-1">
          <div className="h-full rounded-full bg-green-400 transition-all" style={{ width: `${Math.min(100, kpi.collectionRate)}%` }} />
        </div>
        <div className="flex justify-between mb-3">
          <span className="text-[10px] text-gray-400">₩{fmtCurrency(kpi.totalCollected)}</span>
          <span className="text-[10px] text-gray-400">₩{fmtCurrency(kpi.totalExpected)}</span>
        </div>
        {/* 연체 — 클릭 시 상세 패널 열기 */}
        <button
          type="button"
          onClick={() => kpi.overdueTotal > 0 && setShowOverdue(true)}
          className={`flex items-center justify-between w-full rounded-lg px-2 py-1.5 -mx-2 transition-colors ${kpi.overdueTotal > 0 ? "hover:bg-gray-50 cursor-pointer" : ""}`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-3 w-3 ${kpi.overdueTotal > 0 ? "text-amber-400" : "text-gray-300"}`} />
            <span className="text-xs text-gray-500">연체 <span className="text-[10px] text-gray-400">(VAT포함)</span></span>
            {kpi.overdueTotal > 0 && <span className="text-[10px] text-gray-300">&#8250;</span>}
          </div>
          <span className={`text-xs font-semibold tabular-nums ${kpi.overdueTotal > 0 ? "text-rose-400" : "text-gray-400"}`}>
            ₩{fmtCurrency(kpi.overdueTotal)}
          </span>
        </button>
      </div>

      {/* 연체 상세 패널 (좌측에서 열림) */}
      <Sheet open={showOverdue} onOpenChange={setShowOverdue}>
        <SheetContent side="left" className="w-[360px] sm:w-[380px] p-0 border-r border-gray-100">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-sm font-semibold text-gray-700">연체 현황 <span className="text-[11px] font-normal text-gray-400">{overdueAlerts.length}건</span></p>
            <button onClick={() => setShowOverdue(false)} className="p-1 rounded-md hover:bg-gray-100 transition-colors">
              <X className="h-3.5 w-3.5 text-gray-400" />
            </button>
          </div>

          {/* 총액 요약 */}
          <div className="mx-5 mb-4 rounded-lg bg-rose-50/60 px-4 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-rose-400">총 미수금 <span className="text-[10px]">(VAT포함)</span></span>
              <span className="text-sm font-bold tabular-nums text-rose-500">₩{fmtCurrency(kpi.overdueTotal)}</span>
            </div>
          </div>

          {/* 건별 목록 */}
          <div className="px-5 pb-5 space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 130px)" }}>
            {overdueAlerts.map((alert, idx) => (
              <div key={`${alert.contractId}-${alert.stageName}-${idx}`} className="rounded-lg bg-gray-50 px-3.5 py-3">
                {/* 현장명 + D+일수 */}
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-gray-800 truncate flex-1 mr-2">{alert.requestTitle}</p>
                  <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-rose-100/70 px-1.5 py-0.5 text-[9px] font-semibold text-rose-500">
                    D+{alert.overdueDays}
                  </span>
                </div>
                {/* 고객 · 단계 · 예정일 */}
                <p className="text-[10px] text-gray-400 mb-2">
                  {alert.customerName} · {alert.stageName} · {alert.scheduledDate}
                </p>
                {/* 미수금 */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">
                    ₩{fmtCurrency(alert.paidAmount)} / ₩{fmtCurrency(alert.plannedAmount)}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-rose-400">
                    ₩{fmtCurrency(alert.plannedAmount - alert.paidAmount)}
                  </span>
                </div>
              </div>
            ))}

            {overdueAlerts.length === 0 && (
              <div className="text-center py-10">
                <p className="text-xs text-gray-400">연체 건이 없습니다</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* 고객별 거래액 TOP 10 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <Crown className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-xs font-medium text-gray-500">고객별 거래액</p>
          </div>
        </div>
        {kpi.topCustomers.length === 0 ? (
          <p className="text-sm text-gray-400">계약 데이터가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {displayCustomers.map((c, idx) => (
              <div key={c.customerId} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-[10px] font-bold w-4 text-center shrink-0 ${idx < 3 ? "text-amber-500" : "text-gray-400"}`}>
                    {idx + 1}
                  </span>
                  <span className="text-xs text-gray-700 truncate">{c.customerName}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{c.contractCount}건</span>
                </div>
                <span className="text-xs font-semibold tabular-nums text-gray-900 shrink-0 ml-2">
                  ₩{fmtCurrency(c.totalContractAmount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
