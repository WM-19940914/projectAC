"use client"

// ----- 견적서 목록 (통합 리스트) -----

import { cn } from "@/lib/utils"
import { formatShortDate, formatCurrency } from "@/lib/format"
import { CheckCircle2, Circle, FileText, Plus } from "lucide-react"
import type { QuotationListItem } from "./kanban-types"

interface QuotationsTabProps {
  quotations: QuotationListItem[]
  onAddQuote: () => void
  onEditQuote: (id: string) => void
  confirmedQuoteId: string | null
  onToggleConfirm: (quote: QuotationListItem) => void
}

export function QuotationsTab({
  quotations,
  onAddQuote,
  onEditQuote,
  confirmedQuoteId,
  onToggleConfirm,
}: QuotationsTabProps) {
  // 확정 견적 맨 위, 나머지는 오래된순 (최근 만든 게 아래로)
  const sorted = [...quotations].sort((a, b) => {
    if (a.id === confirmedQuoteId) return -1
    if (b.id === confirmedQuoteId) return 1
    return a.quotation_date.localeCompare(b.quotation_date)
  })

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-sm font-semibold text-slate-900">견적 정보</p>
        <button
          onClick={onAddQuote}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-900 px-3 text-xs font-medium text-white transition-colors hover:bg-slate-800"
        >
          <Plus className="h-3.5 w-3.5" />
          추가
        </button>
      </div>

      {/* 확정 견적 없으면 안내 */}
      {quotations.length > 0 && !confirmedQuoteId && (
        <p className="mb-2 text-[11px] text-slate-400">견적을 확정하면 계약·정산에 반영됩니다</p>
      )}

      {/* 통합 리스트 — 고정 영역, 4개 이하면 빈 슬롯 표시 */}
      <div className="min-h-[200px] max-h-[400px] flex-1 space-y-1.5 overflow-y-auto scrollbar-thin pr-0.5" style={{ scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 transparent" }}>
        {sorted.length > 0 ? (
          <>
          {sorted.map((quote, idx) => {
            const isConfirmed = confirmedQuoteId === quote.id
            const displayNum = isConfirmed ? null : (confirmedQuoteId ? idx : idx + 1)

            return (
              <div
                key={quote.id}
                role="button"
                tabIndex={0}
                onClick={() => onEditQuote(quote.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onEditQuote(quote.id)
                  }
                }}
                className={cn(
                  "w-full cursor-pointer rounded-xl border px-3 text-left transition-all",
                  isConfirmed
                    ? "border-emerald-200 bg-emerald-50/70 py-3"
                    : "border-slate-200 bg-white py-2.5 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {isConfirmed ? (
                        <span className="inline-flex h-5 items-center rounded-full bg-emerald-100 px-1.5 text-[9px] font-semibold text-emerald-700">
                          확정
                        </span>
                      ) : (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[9px] font-semibold text-slate-500">
                          {displayNum}
                        </span>
                      )}
                      <p className="min-w-0 truncate text-xs font-semibold text-slate-800">{quote.title}</p>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">
                      {formatShortDate(quote.quotation_date)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {!isConfirmed && (
                      <div className="text-right">
                        <span className={cn("text-xs font-semibold tabular-nums", quote.grand_total > 0 ? "text-slate-900" : "text-slate-300")}>
                          {formatCurrency(quote.grand_total)}
                        </span>
                        <p className="text-[9px] text-slate-400">VAT포함</p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleConfirm(quote)
                      }}
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-colors",
                        isConfirmed
                          ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                          : "border-slate-200 text-slate-300 hover:border-slate-300 hover:text-slate-600"
                      )}
                      title={isConfirmed ? "확정 해제" : "확정"}
                    >
                      {isConfirmed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* 확정 견적만 금액 상세 표시 */}
                {isConfirmed && (
                  <div className="mt-2 flex items-center gap-3 text-[11px]">
                    <span className="inline-flex items-center gap-1">
                      <span className="text-slate-400">공급가</span>
                      <span className="font-semibold tabular-nums text-slate-700">{formatCurrency(quote.total_amount)}</span>
                    </span>
                    <div className="w-px h-3 bg-emerald-200" />
                    <span className="inline-flex items-center gap-1">
                      <span className="text-slate-400">VAT포함</span>
                      <span className="font-semibold tabular-nums text-slate-700">{formatCurrency(quote.grand_total)}</span>
                    </span>
                  </div>
                )}
              </div>
            )
          })}
          {/* 4개 이하일 때 빈 슬롯으로 영역 채우기 */}
          {sorted.length < 4 && Array.from({ length: 4 - sorted.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="rounded-xl border border-dashed border-slate-100 bg-slate-50/30 py-2.5 px-3"
            >
              <div className="h-[18px]" />
            </div>
          ))}
          </>
        ) : (
          <>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="rounded-xl border border-dashed border-slate-100 bg-slate-50/30 py-2.5 px-3"
            >
              <div className="h-[18px]" />
            </div>
          ))}
          </>
        )}
      </div>
    </section>
  )
}
