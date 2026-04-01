"use client"

// ----- 알림 현황: 4개 카드 (미수금 / 입금예정 / 세금계산서 미발행 / 미지급) -----

import { useState } from "react"
import { AlertCircle, CheckCircle2, ChevronRight, Clock, Receipt, Banknote, CalendarClock, X } from "lucide-react"
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
          <span className="text-[11px] text-gray-400">{totalAlerts}건 · VAT포함</span>
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
          className={`group relative text-left rounded-xl p-4 transition-all border ${
            receivableCount > 0
              ? "border-gray-200 hover:shadow-md hover:border-soft-blush/40 hover:-translate-y-0.5 cursor-pointer bg-white"
              : "border-gray-100 bg-gray-50/50 cursor-default"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${receivableCount > 0 ? "bg-soft-blush" : "bg-gray-200"}`} />
              <span className={`text-[11px] font-medium ${receivableCount > 0 ? "text-gray-600" : "text-gray-400"}`}>미수금</span>
            </div>
            {receivableCount > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-soft-blush group-hover:translate-x-0.5 transition-all" />
            )}
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
          className={`group relative text-left rounded-xl p-4 transition-all border ${
            upcomingCount > 0
              ? "border-gray-200 hover:shadow-md hover:border-sky-aqua/40 hover:-translate-y-0.5 cursor-pointer bg-white"
              : "border-gray-100 bg-gray-50/50 cursor-default"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${upcomingCount > 0 ? "bg-sky-aqua" : "bg-gray-200"}`} />
              <span className={`text-[11px] font-medium ${upcomingCount > 0 ? "text-gray-600" : "text-gray-400"}`}>입금 예정</span>
            </div>
            {upcomingCount > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-sky-aqua group-hover:translate-x-0.5 transition-all" />
            )}
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
          className={`group relative text-left rounded-xl p-4 transition-all border ${
            taxCount > 0
              ? "border-gray-200 hover:shadow-md hover:border-vanilla-custard/40 hover:-translate-y-0.5 cursor-pointer bg-white"
              : "border-gray-100 bg-gray-50/50 cursor-default"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${taxCount > 0 ? "bg-vanilla-custard" : "bg-gray-200"}`} />
              <span className={`text-[11px] font-medium ${taxCount > 0 ? "text-gray-600" : "text-gray-400"}`}>계산서 미발행</span>
            </div>
            {taxCount > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-vanilla-custard group-hover:translate-x-0.5 transition-all" />
            )}
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
          className={`group relative text-left rounded-xl p-4 transition-all border ${
            unpaidCount > 0
              ? "border-gray-200 hover:shadow-md hover:border-orange-300/40 hover:-translate-y-0.5 cursor-pointer bg-white"
              : "border-gray-100 bg-gray-50/50 cursor-default"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${unpaidCount > 0 ? "bg-orange-400" : "bg-gray-200"}`} />
              <span className={`text-[11px] font-medium ${unpaidCount > 0 ? "text-gray-600" : "text-gray-400"}`}>미지급</span>
            </div>
            {unpaidCount > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all" />
            )}
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
        <SheetContent side="right" className="w-[420px] sm:w-[460px] p-0 border-l border-gray-100 flex flex-col">
          {selectedCard && (() => {
            // 카드별 설정
            const config = {
              receivable: { label: "미수금", icon: Banknote, color: "soft-blush", count: receivableCount, amount: receivableAmount, desc: "입금 지연 또는 부분입금된 건" },
              upcoming: { label: "입금 예정", icon: CalendarClock, color: "sky-aqua", count: upcomingCount, amount: upcomingAmount, desc: "예정일이 다가오는 미입금 건" },
              taxInvoice: { label: "계산서 미발행", icon: Receipt, color: "vanilla-custard", count: taxCount, amount: taxAmount, desc: "입금은 됐지만 계산서 미발행 건" },
              unpaid: { label: "미지급", icon: Clock, color: "orange-500", count: unpaidCount, amount: unpaidAmount, desc: "아직 지급하지 않은 지출 건" },
            }[selectedCard]
            const Icon = config.icon
            const colorText = `text-${config.color}`
            const colorBg = config.color === "orange-500" ? "bg-orange-500" : `bg-${config.color}`

            return (
              <>
                {/* 헤더 — 아이콘 + 제목 + 설명 */}
                <div className="px-5 pt-5 pb-4 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        selectedCard === "receivable" ? "bg-red-50" : selectedCard === "upcoming" ? "bg-slate-50" : selectedCard === "taxInvoice" ? "bg-amber-50" : "bg-orange-50"
                      }`}>
                        <Icon className={`h-4 w-4 ${colorText}`} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{config.label}</p>
                        <p className="text-[10px] text-gray-400">{config.desc}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedCard(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                      <X className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* 합계 요약 카드 */}
                <div className="mx-5 mt-4 mb-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-gray-400 mb-0.5">합계 (VAT포함)</p>
                      <p className={`text-xl font-bold tabular-nums ${colorText}`}>
                        {formatCurrency(config.amount)}<span className="text-sm font-normal text-gray-400">원</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 mb-0.5">건수</p>
                      <p className="text-xl font-bold tabular-nums text-gray-700">
                        {config.count}<span className="text-sm font-normal text-gray-400">건</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* 리스트 */}
                <div className="flex-1 overflow-y-auto px-4 pb-6">

                  {/* ===== 미수금: 지연 + 부분입금 ===== */}
                  {selectedCard === "receivable" && (
                    <div className="space-y-1">
                      {overdueAlerts.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 px-2 pt-1 pb-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-soft-blush" />
                            <span className="text-[11px] font-semibold text-gray-500">지연 {overdueAlerts.length}건</span>
                          </div>
                          {overdueAlerts.map((a, i) => (
                            <SettlementRow key={`o-${i}`} alert={a} onClick={() => handleClick(a.requestId)} variant="overdue" />
                          ))}
                        </>
                      )}
                      {partialAlerts.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 px-2 pt-3 pb-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-vanilla-custard" />
                            <span className="text-[11px] font-semibold text-gray-500">부분입금 {partialAlerts.length}건</span>
                          </div>
                          {partialAlerts.map((a, i) => (
                            <SettlementRow key={`p-${i}`} alert={a} onClick={() => handleClick(a.requestId)} variant="partial" />
                          ))}
                        </>
                      )}
                    </div>
                  )}

                  {/* ===== 입금 예정 ===== */}
                  {selectedCard === "upcoming" && (
                    <div className="space-y-1">
                      {upcomingAlerts.map((a, i) => (
                        <SettlementRow key={`u-${i}`} alert={a} onClick={() => handleClick(a.requestId)} variant="upcoming" />
                      ))}
                    </div>
                  )}

                  {/* ===== 세금계산서 미발행 ===== */}
                  {selectedCard === "taxInvoice" && (
                    <div className="space-y-1">
                      {taxInvoiceAlerts.map((a, i) => (
                        <button key={`ti-${i}`} type="button" onClick={() => handleClick(a.requestId)}
                          className="w-full text-left px-3 py-3 rounded-xl hover:bg-amber-50/50 border border-transparent hover:border-amber-100 transition-colors group"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs font-semibold text-gray-800 truncate flex-1 mr-2">{a.requestTitle}</p>
                            <span className="font-bold text-vanilla-custard tabular-nums text-sm shrink-0">{formatCurrency(a.amount)}원</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">{a.stageName}</span>
                            <span className="text-gray-400">입금 {formatCurrency(a.paidAmount)}원</span>
                            <ChevronRight className="h-3 w-3 text-gray-200 group-hover:text-gray-400 ml-auto shrink-0 transition-colors" />
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
                          className="w-full text-left px-3 py-3 rounded-xl hover:bg-orange-50/50 border border-transparent hover:border-orange-100 transition-colors group"
                        >
                          {/* 1행: 현장명 + 금액 */}
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs font-semibold text-gray-800 truncate flex-1 mr-2">
                              {a.requestTitle || "현장 미연결"}
                            </p>
                            <span className="font-bold text-orange-500 tabular-nums text-sm shrink-0">
                              {formatCurrency(a.amount)}원
                            </span>
                          </div>
                          {/* 2행: 업체명 + 내용 + 화살표 */}
                          <div className="flex items-center gap-1.5 text-[11px]">
                            {a.vendor && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 font-medium shrink-0">
                                {a.vendor}
                              </span>
                            )}
                            {a.description ? (
                              <span className="text-gray-400 truncate">{a.description}</span>
                            ) : !a.vendor ? (
                              <span className="text-gray-300">상세 내용 없음</span>
                            ) : null}
                            <ChevronRight className="h-3 w-3 text-gray-200 group-hover:text-gray-400 ml-auto shrink-0 transition-colors" />
                          </div>
                          {/* 3행: 고객사 */}
                          {a.customerName && (
                            <p className="text-[10px] text-gray-400 mt-1">{a.customerName}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )
          })()}
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
function SettlementRow({ alert, onClick, variant }: {
  alert: SettlementAlert
  onClick: () => void
  variant: "overdue" | "partial" | "upcoming"
}) {
  const hoverBg = variant === "overdue" ? "hover:bg-red-50/50 hover:border-red-100"
    : variant === "partial" ? "hover:bg-amber-50/50 hover:border-amber-100"
    : "hover:bg-slate-50 hover:border-slate-200"
  const badgeStyle = variant === "overdue" ? "bg-red-50 text-soft-blush"
    : variant === "partial" ? "bg-amber-50 text-amber-600"
    : "bg-slate-100 text-sky-aqua"
  const badgeText = variant === "overdue" ? `D+${alert.overdueDays}`
    : variant === "partial" ? "부분입금"
    : alert.scheduledDate || "예정"
  const amountColor = variant === "overdue" ? "text-soft-blush"
    : variant === "partial" ? "text-amber-600"
    : "text-sky-aqua"

  // 미수금: 예정 - 입금 = 미수 잔액
  const remaining = alert.plannedAmount - alert.paidAmount

  return (
    <button type="button" onClick={onClick}
      className={`w-full text-left px-3 py-3 rounded-xl border border-transparent transition-colors group ${hoverBg}`}
    >
      {/* 1행: 현장명 + 금액 */}
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold text-gray-800 truncate flex-1 mr-2">{alert.requestTitle}</p>
        <span className={`font-bold tabular-nums text-sm shrink-0 ${amountColor}`}>
          {formatCurrency(variant === "upcoming" ? alert.plannedAmount : remaining)}원
        </span>
      </div>
      {/* 2행: 뱃지 + 단계 + 고객 + 화살표 */}
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium shrink-0 ${badgeStyle}`}>
          {badgeText}
        </span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium shrink-0">
          {alert.stageName}
        </span>
        {alert.customerName && (
          <span className="text-gray-400 truncate">{alert.customerName}</span>
        )}
        <ChevronRight className="h-3 w-3 text-gray-200 group-hover:text-gray-400 ml-auto shrink-0 transition-colors" />
      </div>
      {/* 3행: 부분입금인 경우 진행률 표시 */}
      {variant === "partial" && alert.plannedAmount > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${Math.min(100, (alert.paidAmount / alert.plannedAmount) * 100)}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 tabular-nums shrink-0">
            {formatCurrency(alert.paidAmount)} / {formatCurrency(alert.plannedAmount)}
          </span>
        </div>
      )}
    </button>
  )
}
