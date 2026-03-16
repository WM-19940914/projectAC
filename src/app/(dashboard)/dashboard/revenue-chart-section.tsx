"use client"

// ----- 섹션2: 1년간 매출 막대 그래프 -----
// Recharts BarChart로 최근 12개월 계약금액 시각화
// SSR에서는 차트 렌더링하지 않음 (ResponsiveContainer 측정 문제 방지)

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { formatCurrency } from "@/lib/format"
import type { MonthlyRevenue } from "./dashboard-types"

interface Props {
  data: MonthlyRevenue[]
}

// 금액을 약식으로 표시 (예: 50,000,000 → "5,000만")
function formatAxisAmount(value: number): string {
  if (value === 0) return "0"
  if (value >= 100_000_000) {
    const billions = value / 100_000_000
    return `${billions % 1 === 0 ? billions.toFixed(0) : billions.toFixed(1)}억`
  }
  if (value >= 10_000) {
    const mans = value / 10_000
    return `${mans % 1 === 0 ? mans.toFixed(0) : mans.toFixed(0)}만`
  }
  return value.toLocaleString()
}

// Tooltip 커스텀 컴포넌트
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-gray-700">{label}</p>
      <p className="text-sky-aqua font-semibold">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export function RevenueChartSection({ data }: Props) {
  // SSR에서 Recharts의 ResponsiveContainer 측정 실패 방지
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const maxAmount = Math.max(...data.map(d => d.amount), 0)
  const hasData = maxAmount > 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-tropical-teal" />
          1년간 매출 추이
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-gray-400 py-12 text-center">아직 계약 데이터가 없습니다</p>
        ) : !mounted ? (
          // SSR / 첫 렌더 시 차트 자리 표시
          <div className="h-[300px] w-full flex items-center justify-center">
            <p className="text-sm text-gray-300">차트 로딩 중...</p>
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickFormatter={formatAxisAmount}
                  width={60}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar
                  dataKey="amount"
                  fill="#475569"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
