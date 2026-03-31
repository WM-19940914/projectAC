"use client"

// ----- 알림 현황: 4개 카드 (미수금 / 입금예정 / 세금계산서 미발행 / 미지급) -----

import { useState } from "react"
import { AlertCircle, CheckCircle2, X } from "lucide-react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { formatCurrency } from "@/lib/format"
import { RequestDetailSheet } from "./request-detail-sheet"
import type { SettlementAlert, ExpenseAlert, TaxInvoiceAlert, DashboardRequestInfo } from "./dashboard-types"

interface Props {
  settlementAlerts: SettlementAlert[]
  expenseAlerts: ExpenseAlert[]
  taxInvoiceAlerts: TaxInvoiceAlert[]
  requestInfoMap: Record<string, DashboardRequestInfo>
}

type CardType = "receivable" | "upcoming" | "taxInvoice" | "unpaid"

// 만원 단위 축약
function fmtCompact(n: number): string {
  if (n === 0) return "₩0"
  if (n >= 100000000) return `₩${(n / 100000000).toFixed(1)}억`
  if (n >= 10000) return `₩${Math.round(n / 10000).toLocaleString()}만`
  return `₩${Math.round(n).toLocaleString()}`
}

// ═══════════════════════════════════════
// 메인 알림 현황 섹션
// ═══════════════════════════════════════
export function SettlementExpenseSection({ settlementAlerts, expenseAlerts, taxInvoiceAlerts, requestInfoMap }: Props) {
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null)
  const [selectedRequestInfo, setSelectedRequestInfo] = useState<DashboardRequestInfo | null>(null)

  // ── 분류 ──
  const overdueAlerts = settlementAlerts.filter(a => a.type === "overdue")
  const partialAlerts = settlementAlerts.filter(a => a.type === "partial")
  const upcomingAlerts = settlementAlerts.filter(a => a.type === "upcoming")
  const unpaidExpenses = expenseAlerts.filter(a => a.type === "unpaid")

  // ── 카드별 집계 ──
  // 미수금 = 지연 + 부분입금 (못 받은 돈)
  const receivableCount = overdueAlerts.length + partialAlerts.length
  const receivableAmount = overdueAlerts.reduce((s, a) => s + (a.plannedAmount - a.paidAmount), 0)
    + partialAlerts.reduce((s, a) => s + (a.plannedAmount - a.paidAmount), 0)

  // 입금 예정 (미래 예정일 + 미입금 전체)
  const upcomingCount = upcomingAlerts.length
  const upcomingAmount = upcomingAlerts.reduce((s, a) => s + a.plannedAmount, 0)

  // 세금계산서 미발행
  const taxCount = taxInvoiceAlerts.length
  const taxAmount = taxInvoiceAlerts.reduce((s, a) => s + a.amount, 0)

  // 미지급
  const unpaidCount = unpaidExpenses.length
  const unpaidAmount = unpaidExpenses.reduce((s, a) => s + a.amount, 0)

  const totalAlerts = receivableCount + upcomingCount + taxCount + unpaidCount

  function handleClick(requestId: string) {
    if (!requestId) return
    const info = requestInfoMap[requestId]
    if (info) setSelectedRequestInfo(info)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">알림 현황</span>
        </div>
        {totalAlerts > 0 ? (
          <span className="text-[11px] text-gray-400">{totalAlerts}건</span>
        ) : (
          <span className="text-[11px] text-muted-teal flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> 전체 정상
          </span>
        )}
      </div>

      {/* 4카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 미수금 (지연 + 부분입금) */}
        <button
          onClick={() => receivableCount > 0 && setSelectedCard("receivable")}
          disabled={receivableCount === 0}
          className={`text-left rounded-xl p-4 transition-all border ${
            receivableCount > 0
              ? "border-gray-200 hover:shadow-sm hover:border-gray-300 cursor-pointer bg-white"
              : "border-gray-100 bg-gray-50/50 cursor-default"
          }`}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <span className={`h-2 w-2 rounded-full ${receivableCount > 0 ? "bg-soft-blush" : "bg-gray-200"}`} />
            <span className={`text-[11px] font-medium ${receivableCount > 0 ? "text-gray-600" : "text-gray-400"}`}>미수금</span>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${receivableCount > 0 ? "text-soft-blush" : "text-gray-200"}`}>
            {receivableCount}<span className="text-sm font-normal text-gray-400 ml-0.5">건</span>
          </p>
          {receivableCount > 0 ? (
            <>
              <p className="text-xs text-gray-500 tabular-nums mt-1">{fmtCompact(receivableAmount)}</p>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                <span>지연 {overdueAlerts.length}</span>
                <span>·</span>
                <span>부분 {partialAlerts.length}</span>
              </div>
            </>
          ) : (
            <p className="text-[11px] text-gray-300 mt-1">미수금 없음</p>
          )}
        </button>

        {/* 입금 예정 */}
        <button
          onClick={() => upcomingCount > 0 && setSelectedCard("upcoming")}
          disabled={upcomingCount === 0}
          className={`text-left rounded-xl p-4 transition-all border ${
            upcomingCount > 0
              ? "border-gray-200 hover:shadow-sm hover:border-gray-300 cursor-pointer bg-white"
              : "border-gray-100 bg-gray-50/50 cursor-default"
          }`}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <span className={`h-2 w-2 rounded-full ${upcomingCount > 0 ? "bg-sky-aqua" : "bg-gray-200"}`} />
            <span className={`text-[11px] font-medium ${upcomingCount > 0 ? "text-gray-600" : "text-gray-400"}`}>입금 예정</span>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${upcomingCount > 0 ? "text-sky-aqua" : "text-gray-200"}`}>
            {upcomingCount}<span className="text-sm font-normal text-gray-400 ml-0.5">건</span>
          </p>
          {upcomingCount > 0 ? (
            <p className="text-xs text-gray-500 tabular-nums mt-1">{fmtCompact(upcomingAmount)}</p>
          ) : (
            <p className="text-[11px] text-gray-300 mt-1">예정 건 없음</p>
          )}
        </button>

        {/* 세금계산서 미발행 */}
        <button
          onClick={() => taxCount > 0 && setSelectedCard("taxInvoice")}
          disabled={taxCount === 0}
          className={`text-left rounded-xl p-4 transition-all border ${
            taxCount > 0
              ? "border-gray-200 hover:shadow-sm hover:border-gray-300 cursor-pointer bg-white"
              : "border-gray-100 bg-gray-50/50 cursor-default"
          }`}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <span className={`h-2 w-2 rounded-full ${taxCount > 0 ? "bg-vanilla-custard" : "bg-gray-200"}`} />
            <span className={`text-[11px] font-medium ${taxCount > 0 ? "text-gray-600" : "text-gray-400"}`}>계산서 미발행</span>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${taxCount > 0 ? "text-vanilla-custard" : "text-gray-200"}`}>
            {taxCount}<span className="text-sm font-normal text-gray-400 ml-0.5">건</span>
          </p>
          {taxCount > 0 ? (
            <p className="text-xs text-gray-500 tabular-nums mt-1">{fmtCompact(taxAmount)}</p>
          ) : (
            <p className="text-[11px] text-gray-300 mt-1">미발행 없음</p>
          )}
        </button>

        {/* 미지급 */}
        <button
          onClick={() => unpaidCount > 0 && setSelectedCard("unpaid")}
          disabled={unpaidCount === 0}
          className={`text-left rounded-xl p-4 transition-all border ${
            unpaidCount > 0
              ? "border-gray-200 hover:shadow-sm hover:border-gray-300 cursor-pointer bg-white"
              : "border-gray-100 bg-gray-50/50 cursor-default"
          }`}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <span className={`h-2 w-2 rounded-full ${unpaidCount > 0 ? "bg-orange-400" : "bg-gray-200"}`} />
            <span className={`text-[11px] font-medium ${unpaidCount > 0 ? "text-gray-600" : "text-gray-400"}`}>미지급</span>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${unpaidCount > 0 ? "text-orange-400" : "text-gray-200"}`}>
            {unpaidCount}<span className="text-sm font-normal text-gray-400 ml-0.5">건</span>
          </p>
          {unpaidCount > 0 ? (
            <p className="text-xs text-gray-500 tabular-nums mt-1">{fmtCompact(unpaidAmount)}</p>
          ) : (
            <p className="text-[11px] text-gray-300 mt-1">미지급 없음</p>
          )}
        </button>
      </div>

      {/* ── 상세 Sheet ── */}
      <Sheet open={!!selectedCard} onOpenChange={open => !open && setSelectedCard(null)}>
        <SheetContent side="right" className="w-[400px] sm:w-[440px] p-0 border-l border-gray-100">
          {selectedCard && (
            <>
              {/* 헤더 */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${
                    selectedCard === "receivable" ? "bg-soft-blush"
                    : selectedCard === "upcoming" ? "bg-sky-aqua"
                    : selectedCard === "taxInvoice" ? "bg-vanilla-custard"
                    : "bg-orange-400"
                  }`} />
                  <p className="text-sm font-semibold text-gray-800">
                    {selectedCard === "receivable" ? "미수금"
                    : selectedCard === "upcoming" ? "입금 예정"
                    : selectedCard === "taxInvoice" ? "세금계산서 미발행"
                    : "미지급"}
                  </p>
                </div>
                <button onClick={() => setSelectedCard(null)} className="p-1 rounded-md hover:bg-gray-100 transition-colors">
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>

              <div className="px-4 py-3 overflow-y-auto" style={{ maxHeight: "calc(100vh - 80px)" }}>

                {/* ===== 미수금: 지연 + 부분입금 ===== */}
                {selectedCard === "receivable" && (
                  <div className="space-y-1">
                    {overdueAlerts.length > 0 && (
                      <>
                        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-soft-blush" />
                          <span className="text-[11px] font-semibold text-gray-500">지연 {overdueAlerts.length}건</span>
                        </div>
                        {overdueAlerts.map((a, i) => (
                          <SettlementRow key={`o-${i}`} alert={a} onClick={() => handleClick(a.requestId)}
                            badge={<span className="text-[10px] bg-soft-blush/10 text-soft-blush rounded-full px-2 py-0.5 font-medium">D+{a.overdueDays}</span>}
                          />
                        ))}
                      </>
                    )}
                    {partialAlerts.length > 0 && (
                      <>
                        <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-vanilla-custard" />
                          <span className="text-[11px] font-semibold text-gray-500">부분입금 {partialAlerts.length}건</span>
                        </div>
                        {partialAlerts.map((a, i) => (
                          <SettlementRow key={`p-${i}`} alert={a} onClick={() => handleClick(a.requestId)}
                            badge={<span className="text-[10px] bg-vanilla-custard/10 text-yellow-700 rounded-full px-2 py-0.5 font-medium">부분</span>}
                          />
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* ===== 입금 예정 ===== */}
                {selectedCard === "upcoming" && (
                  <div className="space-y-1">
                    {upcomingAlerts.map((a, i) => (
                      <SettlementRow key={`u-${i}`} alert={a} onClick={() => handleClick(a.requestId)}
                        badge={<span className="text-[10px] bg-sky-aqua/10 text-sky-aqua rounded-full px-2 py-0.5 font-medium">예정</span>}
                      />
                    ))}
                  </div>
                )}

                {/* ===== 세금계산서 미발행 ===== */}
                {selectedCard === "taxInvoice" && (
                  <div className="space-y-1">
                    {taxInvoiceAlerts.map((a, i) => (
                      <button key={`ti-${i}`} type="button" onClick={() => handleClick(a.requestId)}
                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <p className="text-xs font-medium text-gray-800 truncate mb-0.5">{a.requestTitle}</p>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-400">{a.stageName} · 입금 {formatCurrency(a.paidAmount)}</span>
                          <span className="font-semibold text-vanilla-custard tabular-nums shrink-0 ml-2">{formatCurrency(a.amount)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* ===== 미지급 ===== */}
                {selectedCard === "unpaid" && (
                  <div className="space-y-1">
                    {unpaidExpenses.map((a, i) => (
                      <button key={`up-${i}`} type="button" onClick={() => handleClick(a.requestId)}
                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <p className="text-xs font-medium text-gray-800 truncate mb-0.5">
                          {a.vendor || a.description || "거래처 미입력"}
                        </p>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-400 truncate">{a.requestTitle}</span>
                          <span className="font-semibold text-orange-400 tabular-nums shrink-0 ml-2">{formatCurrency(a.amount)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 의뢰 상세 Sheet */}
      <RequestDetailSheet
        requestInfo={selectedRequestInfo}
        onClose={() => setSelectedRequestInfo(null)}
      />
    </div>
  )
}

// ── 정산 알림 행 (공통) ──
function SettlementRow({ alert, onClick, badge }: {
  alert: SettlementAlert; onClick: () => void; badge: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick}
      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center justify-between mb-0.5">
        <p className="text-xs font-medium text-gray-800 truncate flex-1 mr-2">{alert.requestTitle}</p>
        {badge}
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-400 truncate">{alert.customerName} · {alert.stageName} · {alert.scheduledDate || "-"}</span>
        <span className="font-semibold text-gray-700 tabular-nums shrink-0 ml-2">{formatCurrency(alert.plannedAmount)}</span>
      </div>
    </button>
  )
}
