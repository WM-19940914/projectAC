"use client"

// ----- 섹션4: 월간/연간 공헌이익 -----
// shadcn Tabs로 월간/연간 전환
// 총매출, 총지출, 공헌이익, 공헌이익률(%) 4개 카드

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import type { ContributionData } from "./dashboard-types"

interface Props {
  monthly: ContributionData
  yearly: ContributionData
  currentMonth: string
}

export function ContributionSection({ monthly, yearly, currentMonth }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-tropical-teal" />
          공헌이익
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="monthly">
          <TabsList>
            <TabsTrigger value="monthly">월간 ({currentMonth})</TabsTrigger>
            <TabsTrigger value="yearly">연간 ({new Date().getFullYear()}년)</TabsTrigger>
          </TabsList>

          <TabsContent value="monthly">
            <ContributionCards data={monthly} />
          </TabsContent>

          <TabsContent value="yearly">
            <ContributionCards data={yearly} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

// ----- 4개 카드 렌더링 (공통) -----
function ContributionCards({ data }: { data: ContributionData }) {
  const isProfitable = data.profit >= 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
      {/* 총매출 */}
      <div className="border rounded-lg p-4">
        <p className="text-xs text-gray-500">총매출</p>
        <p className="text-lg font-semibold text-gray-900 mt-1">
          {formatCurrency(data.revenue)}
        </p>
      </div>

      {/* 총지출 */}
      <div className="border rounded-lg p-4">
        <p className="text-xs text-gray-500">총지출</p>
        <p className="text-lg font-semibold text-gray-900 mt-1">
          {formatCurrency(data.expense)}
        </p>
      </div>

      {/* 공헌이익 */}
      <div className={`border rounded-lg p-4 ${isProfitable ? "bg-muted-teal/5" : "bg-soft-blush/5"}`}>
        <p className="text-xs text-gray-500">공헌이익</p>
        <p className={`text-lg font-semibold mt-1 ${isProfitable ? "text-muted-teal" : "text-soft-blush"}`}>
          {formatCurrency(data.profit)}
        </p>
      </div>

      {/* 공헌이익률 */}
      <div className={`border rounded-lg p-4 ${isProfitable ? "bg-muted-teal/5" : "bg-soft-blush/5"}`}>
        <p className="text-xs text-gray-500">공헌이익률</p>
        <p className={`text-lg font-semibold mt-1 ${isProfitable ? "text-muted-teal" : "text-soft-blush"}`}>
          {data.rate.toFixed(1)}%
        </p>
      </div>
    </div>
  )
}
