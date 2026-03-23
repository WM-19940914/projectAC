"use client"

// ----- 섹션2: 매출 추이 그래프 (계산서 발행일 기준) -----
// 연도 선택 → 1~12월 바 차트, 미래 월은 비활성
// 막대 클릭 → 좌측 슬라이드 패널에 해당 월 현장 상세 표시

import { useState, useEffect, useMemo, useCallback } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { BarChart3, ChevronLeft, ChevronRight, Info, TrendingUp, TrendingDown, Building2, FileText, Receipt } from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import type { MonthlyRevenue, RevenueDetail } from "./dashboard-types"

interface Props {
  allRevenueData: Record<number, MonthlyRevenue[]>
  revenueDetails: Record<string, RevenueDetail[]>
  availableYears: number[]
  currentYear: number
  currentMonth: number // 1~12
}

// ----- 금액 포맷 유틸 -----
function formatAxisAmount(value: number): string {
  if (value === 0) return "0"
  if (value >= 100_000_000) {
    const billions = value / 100_000_000
    return `${billions % 1 === 0 ? billions.toFixed(0) : billions.toFixed(1)}억`
  }
  if (value >= 10_000) {
    const mans = Math.round(value / 10_000)
    return `${mans.toLocaleString()}만`
  }
  return value.toLocaleString()
}

function formatFullAmount(value: number): string {
  return `${value.toLocaleString("ko-KR")} 원`
}

// ----- 커스텀 Tooltip -----
function CustomChartTooltip({
  active,
  payload,
  selectedYear,
}: {
  active?: boolean
  payload?: Array<{ payload: MonthlyRevenue & { isFuture: boolean } }>
  label?: string
  selectedYear: number
}) {
  if (!active || !payload || payload.length === 0) return null
  const d = payload[0].payload
  if (d.isFuture) return null
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-xl px-4 py-3 text-sm min-w-[180px]">
      <p className="font-heading font-semibold text-gray-800 mb-1.5">{selectedYear}년 {d.label}</p>
      <div className="space-y-1">
        <div className="flex justify-between items-center gap-4">
          <span className="text-gray-500">발행 금액</span>
          <span className="font-heading font-bold text-gray-900">{formatFullAmount(d.amount)}</span>
        </div>
        <div className="flex justify-between items-center gap-4">
          <span className="text-gray-500">발행 건수</span>
          <span className="font-medium text-gray-700">{d.count}건</span>
        </div>
      </div>
      {d.amount > 0 && (
        <p className="text-[10px] text-gray-400 mt-2 border-t border-gray-100 pt-1.5">클릭하여 상세 보기</p>
      )}
    </div>
  )
}

// ----- 좌측 Sheet 상세 패널 -----
function DetailSheet({
  open,
  year,
  month,
  details,
  onClose,
}: {
  open: boolean
  year: number
  month: number
  details: RevenueDetail[]
  onClose: () => void
}) {
  // 현장(계약)별 그룹핑 — 같은 계약의 여러 단계를 묶어서 표시
  const grouped = useMemo(() => {
    const map = new Map<string, { title: string; customerName: string; requestId: string | null; stages: { stageName: string; amount: number; invoiceDate: string }[] }>()
    for (const d of details) {
      const existing = map.get(d.contractId)
      if (existing) {
        existing.stages.push({ stageName: d.stageName, amount: d.amount, invoiceDate: d.invoiceDate })
      } else {
        map.set(d.contractId, {
          title: d.title,
          customerName: d.customerName,
          requestId: d.requestId,
          stages: [{ stageName: d.stageName, amount: d.amount, invoiceDate: d.invoiceDate }],
        })
      }
    }
    return Array.from(map.entries())
      .map(([contractId, data]) => ({
        contractId,
        ...data,
        totalAmount: data.stages.reduce((s, st) => s + st.amount, 0),
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
  }, [details])

  const totalAmount = details.reduce((s, d) => s + d.amount, 0)

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="w-[380px] sm:w-[420px] p-0 flex flex-col [&>button:first-child]:hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-sky-aqua/10 to-transparent px-5 py-4 border-b border-gray-100">
          <SheetHeader>
            <SheetTitle className="text-base font-heading font-bold text-gray-900">
              {year}년 {month}월 매출 상세
            </SheetTitle>
            <SheetDescription className="text-xs text-gray-500 mt-0.5">
              계산서 {details.length}건 · 합계 {formatFullAmount(totalAmount)}
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* 현장 리스트 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 scrollbar-hidden">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Receipt className="h-10 w-10 mb-3" />
              <p className="text-sm">발행된 계산서가 없습니다</p>
            </div>
          ) : (
            grouped.map((item) => (
              <div
                key={item.contractId}
                className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100/80 transition-colors"
              >
                {/* 현장명 + 고객 + 금액 */}
                <div className="flex items-start gap-2.5 mb-2.5">
                  <div className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-tropical-teal/10 flex items-center justify-center">
                    <Building2 className="h-3.5 w-3.5 text-tropical-teal" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
                    {item.customerName && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{item.customerName}</p>
                    )}
                  </div>
                  <span className="text-sm font-heading font-bold text-gray-900 shrink-0">
                    {formatFullAmount(item.totalAmount)}
                  </span>
                </div>
                {/* 단계별 상세 */}
                <div className="space-y-1.5 ml-[38px]">
                  {item.stages.map((st, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-600 font-medium">{st.stageName}</span>
                        <span className="text-gray-400">{st.invoiceDate}</span>
                      </div>
                      <span className="text-gray-700 font-medium">{formatFullAmount(st.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ----- 메인 차트 섹션 -----
export function RevenueChartSection({ allRevenueData, revenueDetails, availableYears, currentYear, currentMonth }: Props) {
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [mounted, setMounted] = useState(false)
  // 클릭된 월 (좌측 패널 표시용)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)

  useEffect(() => { setMounted(true) }, [])

  // 선택된 연도의 차트 데이터
  const chartData = useMemo(() => {
    const months = allRevenueData[selectedYear] || Array.from({ length: 12 }, (_, i) => ({
      month: i + 1, label: `${i + 1}월`, amount: 0, count: 0,
    }))
    return months.map(m => ({
      ...m,
      isFuture: selectedYear === currentYear && m.month > currentMonth,
      isCurrent: selectedYear === currentYear && m.month === currentMonth,
      isSelected: m.month === selectedMonth,
    }))
  }, [allRevenueData, selectedYear, currentYear, currentMonth, selectedMonth])

  // 미래 월 제외
  const activeData = chartData.filter(d => !d.isFuture)
  const yearTotal = activeData.reduce((s, d) => s + d.amount, 0)
  const yearCount = activeData.reduce((s, d) => s + d.count, 0)
  const maxAmount = Math.max(...activeData.map(d => d.amount), 0)

  // Y축 통일: 모든 연도의 최대 월 매출을 구해서 고정 → 연도 간 비교 가능
  const globalMaxAmount = useMemo(() => {
    let max = 0
    for (const year of Object.keys(allRevenueData)) {
      const months = allRevenueData[Number(year)]
      if (months) {
        for (const m of months) {
          if (m.amount > max) max = m.amount
        }
      }
    }
    return max
  }, [allRevenueData])

  // 전년 대비 — 전년 데이터가 6개월 미만이면 비교 무의미하므로 표시 안 함
  const prevYearData = allRevenueData[selectedYear - 1]
  const prevYearMonthsWithData = prevYearData ? prevYearData.filter(d => d.amount > 0).length : 0
  const prevYearTotal = prevYearData ? prevYearData.reduce((s, d) => s + d.amount, 0) : 0
  const yoyChange = prevYearTotal > 0 && prevYearMonthsWithData >= 6
    ? ((yearTotal - prevYearTotal) / prevYearTotal) * 100
    : null

  const canNext = selectedYear < currentYear

  // 막대 클릭 핸들러 — 미래 월만 차단, 금액 0이어도 열기 허용
  const handleBarClick = useCallback((data: MonthlyRevenue & { isFuture: boolean }) => {
    if (data.isFuture) return
    setSelectedMonth(prev => prev === data.month ? null : data.month)
  }, [])

  // 연도 변경 시 패널 닫기
  useEffect(() => { setSelectedMonth(null) }, [selectedYear])

  // 선택된 월의 상세 데이터
  const selectedDetails = useMemo(() => {
    if (!selectedMonth) return []
    const ym = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`
    return revenueDetails[ym] || []
  }, [selectedYear, selectedMonth, revenueDetails])

  return (<>
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-6 pt-5 pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-heading flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-sky-aqua" />
              월별 매출 집계
              <span className="text-xs font-sans font-normal text-sky-aqua ml-1">세금계산서 발행일 기준</span>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex items-center justify-center">
                      <Info className="h-4 w-4 text-sky-aqua hover:text-sky-aqua/70 transition-colors" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[260px] text-xs leading-relaxed">
                    <p>세금계산서 발행일 기준으로 월별 매출을 집계합니다.</p>
                    <p className="mt-1 text-gray-400">금액은 VAT 포함 (공급가액 + 세액)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">모든 금액은 VAT 포함 금액입니다</p>
          </div>

          {/* 연도 선택 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedYear(y => y - 1)}
              className="p-2 rounded-lg hover:bg-gray-100 border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-gray-500" />
            </button>
            <span className="text-base font-heading font-bold text-gray-900 min-w-[64px] text-center">
              {selectedYear}년
            </span>
            <button
              onClick={() => setSelectedYear(y => y + 1)}
              disabled={!canNext}
              className="p-2 rounded-lg hover:bg-gray-100 border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 pb-5">
        {/* 요약 카드 */}
        <div className="flex items-center gap-6 mb-4 mt-1">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">연간 합계</p>
            <p className="text-2xl font-heading font-bold text-gray-900">{formatFullAmount(yearTotal)}</p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div>
            <p className="text-xs text-gray-400 mb-0.5">발행 건수</p>
            <p className="text-lg font-heading font-bold text-gray-700">{yearCount}건</p>
          </div>
          {yoyChange !== null && (
            <>
              <div className="h-8 w-px bg-gray-200" />
              <div>
                <p className="text-xs text-gray-400 mb-0.5">전년 대비</p>
                <div className="flex items-center gap-1">
                  {yoyChange >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-muted-teal" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-soft-blush" />
                  )}
                  <span className={`text-lg font-heading font-bold ${yoyChange >= 0 ? "text-muted-teal" : "text-soft-blush"}`}>
                    {yoyChange >= 0 ? "+" : ""}{yoyChange.toFixed(1)}%
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 차트 영역 */}
        <div>
          {!mounted ? (
            <div className="h-[470px] w-full flex items-center justify-center">
              <p className="text-sm text-gray-300">차트 로딩 중...</p>
            </div>
          ) : maxAmount === 0 ? (
            <div className="h-[470px] w-full flex flex-col items-center justify-center gap-2">
              <BarChart3 className="h-12 w-12 text-gray-200" />
              <p className="text-sm text-gray-400">{selectedYear}년에 발행된 계산서가 없습니다</p>
            </div>
          ) : (
            <div
              className="h-[470px] w-full cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const x = e.clientX - rect.left
                const chartLeft = 70
                const chartRight = rect.width - 10
                if (x < chartLeft || x > chartRight) return
                const colWidth = (chartRight - chartLeft) / 12
                const idx = Math.floor((x - chartLeft) / colWidth)
                if (idx >= 0 && idx < chartData.length) {
                  handleBarClick(chartData[idx])
                }
              }}
            >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#42CAFD" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#42CAFD" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#94a3b8", fontWeight: 500 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickFormatter={formatAxisAmount}
                      width={60}
                      domain={[0, globalMaxAmount > 0 ? globalMaxAmount : "auto"]}
                    />
                    <RechartsTooltip
                      content={<CustomChartTooltip selectedYear={selectedYear} />}
                      cursor={{ stroke: "#42CAFD", strokeWidth: 1, strokeDasharray: "4 4" }}
                    />
                    <ReferenceLine
                      y={yearTotal / Math.max(1, chartData.filter(d => !d.isFuture && d.amount > 0).length)}
                      stroke="#d1d5db"
                      strokeDasharray="6 4"
                      strokeWidth={1.5}
                      label={{ value: "평균", position: "insideTopLeft", fontSize: 11, fill: "#9ca3af" }}
                    />
                    <Area
                      type="linear"
                      dataKey="amount"
                      stroke="#42CAFD"
                      strokeWidth={2.5}
                      fill="url(#areaGradient)"
                      dot={(props: Record<string, unknown>) => {
                        const { cx, cy, payload } = props as { cx: number; cy: number; payload: { isFuture: boolean; isSelected: boolean; isCurrent: boolean; amount: number } }
                        if (payload.isFuture) return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={0} />
                        const isActive = payload.isSelected || payload.isCurrent
                        return (
                          <circle
                            key={`dot-${cx}`}
                            cx={cx}
                            cy={cy}
                            r={isActive ? 6 : 4}
                            fill={isActive ? "#42CAFD" : "#fff"}
                            stroke="#42CAFD"
                            strokeWidth={isActive ? 3 : 2}
                          />
                        )
                      }}
                      activeDot={{ r: 7, fill: "#42CAFD", stroke: "#fff", strokeWidth: 3 }}
                      animationDuration={600}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* 좌측 Sheet — 막대 클릭 시 해당 월의 현장 상세 */}
    <DetailSheet
      open={selectedMonth !== null}
      year={selectedYear}
      month={selectedMonth ?? 1}
      details={selectedDetails}
      onClose={() => setSelectedMonth(null)}
    />
  </>
  )
}
