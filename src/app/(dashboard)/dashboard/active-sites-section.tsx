"use client"

// ----- 섹션3: 월별 진행 현장 카드 -----
// 현재 진행 중인 현장을 카드 그리드로 표시
// 각 카드에 현장명, 고객명, 계약금액, 정산 단계 상태 점

import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2 } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import type { ActiveSite } from "./dashboard-types"

interface Props {
  sites: ActiveSite[]
  currentMonth: string
}

export function ActiveSitesSection({ sites, currentMonth }: Props) {
  const router = useRouter()

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <Building2 className="h-5 w-5 text-tropical-teal" />
          {currentMonth} 진행 현장
          <span className="text-sm font-normal text-gray-400 ml-1">({sites.length}건)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sites.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">진행 중인 현장이 없습니다</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sites.map((site) => (
              <div
                key={site.requestId}
                className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => router.push(`/requests?open=${site.requestId}`)}
              >
                {/* 현장명 */}
                <p className="font-medium text-gray-900 text-sm truncate">{site.title}</p>
                {/* 고객명 */}
                <p className="text-xs text-gray-500 mt-0.5 truncate">{site.customerName}</p>
                {/* 계약금액 */}
                <p className="text-sm font-semibold text-gray-700 mt-2">
                  {formatCurrency(site.contractAmount)}
                </p>
                {/* 정산 단계 상태 점 */}
                {site.stageSummaries.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {site.stageSummaries.map((stage, i) => (
                      <div key={i} className="flex items-center gap-1">
                        {/* 상태 점: paid=초록, partial=노랑, unpaid=회색 */}
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            stage.status === "paid"
                              ? "bg-muted-teal"
                              : stage.status === "partial"
                              ? "bg-vanilla-custard"
                              : "bg-gray-300"
                          }`}
                        />
                        <span className="text-[11px] text-gray-500">{stage.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
