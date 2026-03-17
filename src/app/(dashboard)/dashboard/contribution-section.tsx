"use client"

// ----- 섹션4: 계약별 공헌이익 (월간/연간 전환, 순위 테이블) -----
// 계약 제목 클릭 → 칸반보드와 동일한 전체 패널을 대시보드 위에 Sheet으로 표시

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, ChevronLeft, ChevronRight, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { RequestDetailSheet } from "./request-detail-sheet"
import type { ContractContribution, DashboardRequestInfo } from "./dashboard-types"

interface Props {
  items: ContractContribution[]
  requestInfoMap: Record<string, DashboardRequestInfo>
  initialYear: number
  initialMonth: number
}

// ----- 금액 포맷 (콤마 + 원) -----
function fmtAmount(n: number): string {
  return `${Math.abs(n).toLocaleString("ko-KR")} 원`
}

export function ContributionSection({ items, requestInfoMap, initialYear, initialMonth }: Props) {
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly")
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  // Sheet 패널용: 선택된 의뢰 정보
  const [selectedRequestInfo, setSelectedRequestInfo] = useState<DashboardRequestInfo | null>(null)

  // 이전/다음 네비게이션
  const handlePrev = () => {
    if (viewMode === "monthly") {
      if (month === 1) { setMonth(12); setYear(y => y - 1) }
      else setMonth(m => m - 1)
    } else {
      setYear(y => y - 1)
    }
  }
  const handleNext = () => {
    if (viewMode === "monthly") {
      if (month === 12) { setMonth(1); setYear(y => y + 1) }
      else setMonth(m => m + 1)
    } else {
      setYear(y => y + 1)
    }
  }

  // 선택된 기간으로 필터링
  const filtered = useMemo(() => {
    if (viewMode === "yearly") {
      return items.filter(i => i.yearMonth.startsWith(String(year)))
    }
    const ym = `${year}-${String(month).padStart(2, "0")}`
    return items.filter(i => i.yearMonth === ym)
  }, [items, viewMode, year, month])

  // 순이익 내림차순 정렬
  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => b.netProfit - a.netProfit)
  , [filtered])

  // 집계 — 이익률 분모는 계약금액(VAT포함) 합계
  const totalContractAmountVat = sorted.reduce((s, i) => s + i.contractAmountVat, 0)
  const totalProfit = sorted.reduce((s, i) => s + i.netProfit, 0)
  const totalIncentive = sorted.reduce((s, i) => s + i.incentiveTotal, 0)
  const totalGrossProfit = totalProfit + totalIncentive
  const totalRate = totalContractAmountVat > 0 ? (totalProfit / totalContractAmountVat) * 100 : 0
  const lossCount = sorted.filter(i => i.netProfit < 0).length

  // 기간 라벨
  const periodLabel = viewMode === "monthly" ? `${month}월` : `${year}년`

  // 연도 옵션 (현재년 기준 ±2년)
  const yearOptions = Array.from({ length: 5 }, (_, i) => initialYear - 2 + i)

  // 제목 클릭 → 해당 의뢰의 전체 패널 열기
  const handleTitleClick = (item: ContractContribution) => {
    if (item.requestId && requestInfoMap[item.requestId]) {
      setSelectedRequestInfo(requestInfoMap[item.requestId])
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-tropical-teal" />
            공헌 이익
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex items-center justify-center">
                    <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px] text-xs leading-relaxed">
                  <p>계약 종료일 기준으로 월을 구분합니다.</p>
                  <p className="mt-1 text-gray-400">종료일이 없는 계약은 생성일 기준</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 손해 메시지 + 월/연 컨트롤 */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <h2 className="text-xl font-heading font-bold text-gray-900">
              {periodLabel}, 손해가 발생한 계약이{" "}
              {lossCount === 0 ? (
                <><span className="underline decoration-vanilla-custard decoration-4 underline-offset-4">없어요</span> 👏</>
              ) : (
                <span className="text-soft-blush font-bold">{lossCount}건 있어요</span>
              )}
            </h2>

            {/* 월간/연간 토글 + 날짜 선택 */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("monthly")}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    viewMode === "monthly"
                      ? "bg-white shadow-sm font-medium text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  월간
                </button>
                <button
                  onClick={() => setViewMode("yearly")}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    viewMode === "yearly"
                      ? "bg-white shadow-sm font-medium text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  연간
                </button>
              </div>

              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="border rounded-lg px-2 py-1.5 text-sm bg-white cursor-pointer"
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>

              {viewMode === "monthly" && (
                <select
                  value={month}
                  onChange={e => setMonth(Number(e.target.value))}
                  className="border rounded-lg px-2 py-1.5 text-sm bg-white cursor-pointer"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
              )}

              <button onClick={handlePrev} className="p-1.5 rounded-lg hover:bg-gray-100 border">
                <ChevronLeft className="h-4 w-4 text-gray-500" />
              </button>
              <button onClick={handleNext} className="p-1.5 rounded-lg hover:bg-gray-100 border">
                <ChevronRight className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* 집계 + 테이블 영역 */}
          <div className="bg-gray-50 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {periodLabel} 포함 계약 공헌 이익
              </p>
              <p className="text-xs text-gray-400">
                모든 금액은 VAT 포함 금액입니다
              </p>
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              {/* 순이익 */}
              <div>
                <p className="text-xs text-gray-400 mb-0.5">순이익</p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-heading font-bold ${totalProfit >= 0 ? "text-gray-900" : "text-soft-blush"}`}>
                    {totalProfit >= 0 ? "+" : "-"}{fmtAmount(totalProfit)}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    totalRate >= 0
                      ? "bg-muted-teal/10 text-muted-teal"
                      : "bg-soft-blush/10 text-soft-blush"
                  }`}>
                    {totalRate.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="h-10 w-px bg-gray-200" />
              {/* 장려금 총합계 */}
              <div>
                <p className="text-xs text-gray-400 mb-0.5">장려금</p>
                <span className="text-lg font-heading font-bold text-gray-700">
                  {totalIncentive > 0 ? fmtAmount(totalIncentive) : "-"}
                </span>
              </div>
              <div className="h-10 w-px bg-gray-200" />
              {/* 총이익 (순이익 + 장려금) */}
              <div>
                <p className="text-xs text-gray-400 mb-0.5">총이익 <span className="text-gray-300">(순이익+장려금)</span></p>
                <span className={`text-lg font-heading font-bold ${totalGrossProfit >= 0 ? "text-muted-teal" : "text-soft-blush"}`}>
                  {totalGrossProfit >= 0 ? "+" : "-"}{fmtAmount(totalGrossProfit)}
                </span>
              </div>
            </div>

            {/* 계약별 순위 테이블 */}
            {sorted.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                해당 기간에 포함된 계약이 없습니다.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs">
                      <th className="text-left py-2 pr-2 font-normal">순위</th>
                      <th className="text-left py-2 pr-4 font-normal">계약 제목</th>
                      <th className="text-right py-2 pr-4 font-normal">총 입금 금액</th>
                      <th className="text-right py-2 pr-4 font-normal">총 지출 금액</th>
                      <th className="text-right py-2 pr-4 font-normal">순이익 금액</th>
                      <th className="text-right py-2 pr-4 font-normal">이익률</th>
                      <th className="text-right py-2 pr-4 font-normal">장려금</th>
                      <th className="text-right py-2 font-normal">총이익</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((item, idx) => {
                      const rank = idx + 1
                      const isProfitable = item.netProfit >= 0
                      const hasLink = !!(item.requestId && requestInfoMap[item.requestId])
                      return (
                        <tr key={item.contractId} className="border-t border-gray-200/60">
                          <td className="py-3 pr-2">
                            <RankBadge rank={rank} />
                          </td>
                          <td className="py-3 pr-4 max-w-[300px] truncate">
                            {hasLink ? (
                              <button
                                onClick={() => handleTitleClick(item)}
                                className="text-gray-900 font-medium hover:text-tropical-teal hover:underline underline-offset-2 transition-colors text-left"
                              >
                                {item.title}
                              </button>
                            ) : (
                              <span className="text-gray-900 font-medium">{item.title}</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-right text-gray-700 whitespace-nowrap">
                            +{fmtAmount(item.totalPaid)}
                          </td>
                          <td className="py-3 pr-4 text-right text-gray-700 whitespace-nowrap">
                            +{fmtAmount(item.totalExpense)}
                          </td>
                          <td className={`py-3 pr-4 text-right font-medium whitespace-nowrap ${
                            isProfitable ? "text-muted-teal" : "text-soft-blush"
                          }`}>
                            {isProfitable ? "+" : "-"}{fmtAmount(item.netProfit)}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                              {item.profitRate.toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-right text-gray-700 whitespace-nowrap">
                            {item.incentiveTotal > 0 ? fmtAmount(item.incentiveTotal) : "-"}
                          </td>
                          <td className={`py-3 text-right font-medium whitespace-nowrap ${
                            (item.netProfit + item.incentiveTotal) >= 0 ? "text-muted-teal" : "text-soft-blush"
                          }`}>
                            {(item.netProfit + item.incentiveTotal) >= 0 ? "+" : "-"}{fmtAmount(item.netProfit + item.incentiveTotal)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ----- 의뢰 상세 Sheet (칸반보드와 동일한 전체 패널) ----- */}
      <RequestDetailSheet
        requestInfo={selectedRequestInfo}
        onClose={() => setSelectedRequestInfo(null)}
      />
    </>
  )
}

// ----- 순위 뱃지 (1~3위 메달 컬러, 4위+ 일반 번호) -----
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-vanilla-custard text-xs font-bold text-yellow-800">
        {rank}
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-xs font-bold text-gray-600">
        {rank}
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-soft-blush/60 text-xs font-bold text-gray-700">
        {rank}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 text-xs text-gray-500">
      {rank}
    </span>
  )
}
