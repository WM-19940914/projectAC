"use client"

// ----- 대시보드 클라이언트 오케스트레이터 -----
// KPI 요약 바 + 섹션 네비게이션 + 알림/매출/공헌이익/고객 섹션

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { SmilePlus, Crown, X } from "lucide-react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { formatCurrency } from "@/lib/format"
import { useAuth } from "@/providers/auth-provider"
import type { SettlementAlert, ExpenseAlert, TaxInvoiceAlert, MonthlyRevenue, MonthlyProgressRevenue, RevenueDetail, ContractContribution, DashboardRequestInfo, DashboardKPI } from "./dashboard-types"
import { SettlementExpenseSection } from "./settlement-expense-section"
import { RevenueChartSection } from "./revenue-chart-section"
import { ProgressRevenueSection } from "./progress-revenue-section"
import { ContributionSection } from "./contribution-section"

// 시간대별 인사 메시지
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

// 만원 단위 축약 (요약 카드용)
function fmtCompact(n: number): string {
  if (n === 0) return "₩0"
  if (n >= 100000000) return `₩${(n / 100000000).toFixed(1)}억`
  if (n >= 10000) return `₩${Math.round(n / 10000).toLocaleString()}만`
  return `₩${Math.round(n).toLocaleString()}`
}

// 섹션 빠른 이동 메뉴
const NAV_ITEMS = [
  { id: "section-alerts", label: "알림" },
  { id: "section-revenue", label: "매출" },
  { id: "section-contribution", label: "공헌이익" },
  { id: "section-customers", label: "고객" },
]

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
  const [activeNav, setActiveNav] = useState("section-alerts")

  // 탭 포커스 복귀 시 서버 데이터 자동 갱신
  useEffect(() => {
    const onFocus = () => router.refresh()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [router])

  // 섹션 스크롤 이동
  const scrollTo = useCallback((id: string) => {
    setActiveNav(id)
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  return (
    <div className="space-y-6 p-6 max-w-[1150px] mx-auto">
      {/* ── 제목 + 인사 + 섹션 네비게이션 ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
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
        {/* 빠른 이동 탭 */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                activeNav === item.id
                  ? "bg-white shadow-sm font-semibold text-gray-800"
                  : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 섹션: 알림 ── */}
      <div id="section-alerts">
        <SettlementExpenseSection
          settlementAlerts={settlementAlerts}
          expenseAlerts={expenseAlerts}
          taxInvoiceAlerts={taxInvoiceAlerts}
          requestInfoMap={requestInfoMap}
        />
      </div>

      {/* ── 섹션: 매출 (추이 + 진행) ── */}
      <div id="section-revenue" className="space-y-6">
        <RevenueChartSection
          allRevenueData={allRevenueData}
          revenueDetails={revenueDetails}
          availableYears={availableYears}
          currentYear={currentYear}
          currentMonth={currentMonth}
          requestInfoMap={requestInfoMap}
        />
        <ProgressRevenueSection
          allProgressData={allProgressData}
          availableYears={progressAvailableYears}
          currentYear={currentYear}
        />
      </div>

      {/* ── 섹션: 공헌이익 ── */}
      <div id="section-contribution">
        <ContributionSection
          items={contractContributions}
          requestInfoMap={requestInfoMap}
          initialYear={initialYear}
          initialMonth={initialMonth}
        />
      </div>

      {/* ── 섹션: 고객별 거래액 ── */}
      <div id="section-customers">
        <TopCustomersCard kpi={kpi} contractContributions={contractContributions} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// 고객별 거래액 TOP 10 (클릭 → 계약 상세 Sheet)
// ═══════════════════════════════════════
function TopCustomersCard({ kpi, contractContributions }: { kpi: DashboardKPI; contractContributions: ContractContribution[] }) {
  const [selectedCustomer, setSelectedCustomer] = useState<{ name: string; id: string } | null>(null)
  const displayCustomers = kpi.topCustomers.slice(0, 10)

  // 선택된 고객의 계약 목록 (순이익 내림차순)
  const customerContracts = selectedCustomer
    ? contractContributions
        .filter(c => c.customerName === selectedCustomer.name)
        .sort((a, b) => b.netProfit - a.netProfit)
    : []
  const customerTotalPaid = customerContracts.reduce((s, c) => s + c.totalPaid, 0)
  const customerTotalExpense = customerContracts.reduce((s, c) => s + c.totalExpense, 0)
  const customerTotalProfit = customerContracts.reduce((s, c) => s + c.netProfit, 0)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
            <Crown className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">고객별 거래액</p>
            <p className="text-[11px] text-gray-400">계약 공급가액 (VAT별도) · 클릭하여 상세 보기</p>
          </div>
        </div>
        <span className="text-xs text-gray-400">TOP 10</span>
      </div>

      {kpi.topCustomers.length === 0 ? (
        <p className="text-sm text-gray-400">계약 데이터가 없습니다</p>
      ) : (
        <div>
          {/* 테이블 헤더 */}
          <div className="flex items-center py-2 border-b border-gray-100 text-[10px] font-semibold text-gray-400 tracking-wide">
            <span className="w-8 text-center">#</span>
            <span className="flex-1">고객명</span>
            <span className="w-16 text-center">계약 수</span>
            <span className="w-32 text-right">거래액 (VAT별도)</span>
          </div>
          {/* 데이터 행 (클릭 가능) */}
          {displayCustomers.map((c, idx) => (
            <button
              key={c.customerId}
              onClick={() => setSelectedCustomer({ name: c.customerName, id: c.customerId })}
              className={`w-full flex items-center py-2.5 hover:bg-gray-50 transition-colors cursor-pointer text-left ${
                idx < displayCustomers.length - 1 ? "border-b border-gray-50" : ""
              }`}
            >
              <span className={`w-8 text-center text-xs font-bold ${idx < 3 ? "text-amber-500" : "text-gray-400"}`}>
                {idx + 1}
              </span>
              <span className="flex-1 text-sm text-gray-800 truncate">{c.customerName}</span>
              <span className="w-16 text-center text-xs text-gray-500">{c.contractCount}건</span>
              <span className="w-32 text-right text-sm font-semibold tabular-nums text-gray-900">
                ₩{fmtCurrency(c.totalContractAmount)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── 고객 상세 Sheet (계약별 공헌이익) ── */}
      <Sheet open={!!selectedCustomer} onOpenChange={open => !open && setSelectedCustomer(null)}>
        <SheetContent side="right" className="w-[420px] sm:w-[460px] p-0 border-l border-gray-100">
          {selectedCustomer && (
            <>
              {/* 헤더 */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{selectedCustomer.name}</p>
                  <p className="text-[11px] text-gray-400">계약 {customerContracts.length}건</p>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="p-1 rounded-md hover:bg-gray-100 transition-colors">
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>

              {/* 요약 (입금/지출/순이익) */}
              <div className="grid grid-cols-3 gap-3 px-5 py-4 border-b border-gray-50">
                <div>
                  <p className="text-[10px] text-gray-400 mb-0.5">입금</p>
                  <p className="text-xs font-bold tabular-nums text-gray-800">{fmtCompact(customerTotalPaid)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-0.5">지출</p>
                  <p className="text-xs font-bold tabular-nums text-gray-800">{fmtCompact(customerTotalExpense)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-0.5">순이익</p>
                  <p className={`text-xs font-bold tabular-nums ${customerTotalProfit >= 0 ? "text-muted-teal" : "text-soft-blush"}`}>
                    {customerTotalProfit >= 0 ? "+" : ""}{fmtCompact(customerTotalProfit)}
                  </p>
                </div>
              </div>

              {/* 계약 목록 */}
              <div className="px-5 py-3 overflow-y-auto" style={{ maxHeight: "calc(100vh - 180px)" }}>
                {customerContracts.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">공헌이익 데이터가 없습니다</p>
                ) : (
                  <div className="space-y-2">
                    {customerContracts.map(c => (
                      <div key={c.contractId} className="rounded-lg bg-gray-50 px-4 py-3">
                        <p className="text-xs font-medium text-gray-800 mb-2 truncate">{c.title}</p>
                        <div className="grid grid-cols-2 gap-y-1.5 text-[11px]">
                          <span className="text-gray-400">계약금</span>
                          <span className="text-right tabular-nums text-gray-600">{formatCurrency(c.contractAmount)}</span>
                          <span className="text-gray-400">입금</span>
                          <span className="text-right tabular-nums text-gray-600">{formatCurrency(c.totalPaid)}</span>
                          <span className="text-gray-400">지출</span>
                          <span className="text-right tabular-nums text-gray-600">{formatCurrency(c.totalExpense)}</span>
                          <span className="text-gray-400">순이익</span>
                          <span className={`text-right tabular-nums font-semibold ${c.netProfit >= 0 ? "text-muted-teal" : "text-soft-blush"}`}>
                            {c.netProfit >= 0 ? "+" : ""}{formatCurrency(c.netProfit)}
                          </span>
                          <span className="text-gray-400">이익률</span>
                          <span className={`text-right tabular-nums font-semibold ${c.profitRate >= 0 ? "text-muted-teal" : "text-soft-blush"}`}>
                            {c.profitRate.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
