"use client"

// ----- 섹션: 진행 매출 그래프 (계약 착수일~종료일 기간 안분) -----

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { BarChart3, ChevronLeft, ChevronRight, Info } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts"
import type { MonthlyProgressRevenue } from "./dashboard-types"
import { formatCurrency } from "@/lib/format"

interface Props {
  allProgressData: Record<number, MonthlyProgressRevenue[]>
  availableYears: number[]
  currentYear: number
}

// Y축 금액 포맷
function formatAxisAmount(value: number): string {
  if (value >= 100000000) return `${(value / 100000000).toFixed(value % 100000000 === 0 ? 0 : 1)}억`
  if (value >= 10000000) return `${Math.round(value / 10000)}만`
  if (value >= 10000) return `${Math.round(value / 10000)}만`
  return value.toLocaleString()
}

// 툴팁 커스텀
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: MonthlyProgressRevenue }> }) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-gray-600 mb-1">{data.label}</p>
      <p className="text-sm font-bold text-sky-aqua">{formatCurrency(data.amount)}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{data.contractCount}건 진행</p>
    </div>
  )
}

export function ProgressRevenueSection({ allProgressData, availableYears, currentYear }: Props) {
  const [selectedYear, setSelectedYear] = useState(currentYear)

  const yearData = allProgressData[selectedYear] || []
  const yearTotal = yearData.reduce((s, d) => s + d.amount, 0)
  const monthsWithData = yearData.filter(d => d.amount > 0).length
  const avgMonthly = monthsWithData > 0 ? yearTotal / monthsWithData : 0

  const canPrev = availableYears.includes(selectedYear - 1)
  const canNext = selectedYear < currentYear

  // 전체 연도 Y축 최대값 통일
  const globalMax = useMemo(() => {
    let max = 0
    for (const data of Object.values(allProgressData)) {
      for (const d of data) { if (d.amount > max) max = d.amount }
    }
    return max
  }, [allProgressData])

  const formatFullAmount = useCallback((v: number) => {
    if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억원`
    if (v >= 10000) return `${Math.round(v / 10000).toLocaleString()}만원`
    return `${v.toLocaleString()}원`
  }, [])

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-sky-aqua" />
              진행 매출
              <span className="text-xs font-sans font-normal text-sky-aqua ml-1">계약기간 안분 기준</span>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex items-center justify-center">
                      <Info className="h-4 w-4 text-sky-aqua hover:text-sky-aqua/70 transition-colors" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[280px] text-xs leading-relaxed">
                    <p>계약금액(VAT포함)을 착수일~종료일 기간으로 일할 계산하여 월별로 안분합니다.</p>
                    <p className="mt-1 text-gray-400">금액은 VAT 포함</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <p className="text-xs text-gray-400 mt-0.5">계약금액을 한 번에 잡지 않고, 실제 진행된 기간에 맞춰 각 월에 나누어 표시한 매출입니다.</p>
          </div>

          {/* 연도 선택 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => canPrev && setSelectedYear(y => y - 1)}
              disabled={!canPrev}
              className="p-2 rounded-lg hover:bg-gray-100 border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-gray-500" />
            </button>
            <span className="text-base font-heading font-bold text-gray-900 min-w-[64px] text-center">
              {selectedYear}년
            </span>
            <button
              onClick={() => canNext && setSelectedYear(y => y + 1)}
              disabled={!canNext}
              className="p-2 rounded-lg hover:bg-gray-100 border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* 요약 카드 */}
        <div className="flex items-center gap-6 mb-4 mt-1">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">연간 합계</p>
            <p className="text-2xl font-heading font-bold text-gray-900">{formatFullAmount(yearTotal)}</p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div>
            <p className="text-xs text-gray-400 mb-0.5">진행 계약</p>
            <p className="text-lg font-heading font-bold text-gray-700">{yearData.reduce((max, d) => Math.max(max, d.contractCount), 0)}건</p>
          </div>
        </div>
        {yearTotal === 0 ? (
          <div className="h-[470px] w-full flex flex-col items-center justify-center gap-2">
            <BarChart3 className="h-12 w-12 text-gray-200" />
            <p className="text-sm text-gray-400">{selectedYear}년 진행 매출 데이터가 없습니다</p>
          </div>
        ) : (
          <div className="h-[470px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={yearData}
                margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
                barCategoryGap="20%"
              >
                <defs>
                  <linearGradient id="progressBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#42CAFD" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#66B3BA" stopOpacity={0.7} />
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
                  domain={[0, globalMax > 0 ? globalMax : "auto"]}
                />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: "rgba(66, 202, 253, 0.08)", radius: 6 }} />
                <ReferenceLine
                  y={avgMonthly}
                  stroke="#d1d5db"
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  label={{ value: "평균", position: "insideTopLeft", fontSize: 11, fill: "#9ca3af" }}
                />
                <Bar
                  dataKey="amount"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={52}
                  animationDuration={600}
                  animationEasing="ease-out"
                >
                  {yearData.map((entry) => (
                    <Cell
                      key={entry.month}
                      fill={entry.amount > 0 ? "url(#progressBarGradient)" : "#f1f5f9"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
