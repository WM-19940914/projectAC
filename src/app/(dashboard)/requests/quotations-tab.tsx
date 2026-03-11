"use client"

// ----- 견적서 목록 (심플 플랫) -----

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
  const confirmedQuote = confirmedQuoteId
    ? quotations.find((quote) => quote.id === confirmedQuoteId) ?? null
    : null

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">견적 정보</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">확정 견적 중심으로 관리</h3>
          <p className="mt-1 text-sm text-slate-500">
            현재 현장에서 실제 기준이 되는 견적서를 먼저 확인하고, 필요하면 다른 견적서로 바로 전환합니다.
          </p>
        </div>
        <button
          onClick={onAddQuote}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          견적 추가
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        {confirmedQuote ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => onEditQuote(confirmedQuote.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onEditQuote(confirmedQuote.id)
              }
            }}
            className="block w-full cursor-pointer text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  확정 견적
                </div>
                <p className="mt-3 truncate text-base font-semibold text-slate-900">{confirmedQuote.title}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {confirmedQuote.quotation_number} · {formatShortDate(confirmedQuote.quotation_date)}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleConfirm(confirmedQuote)
                }}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
              >
                확정 해제
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-white px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">공급가액</p>
                <p className="mt-2 text-lg font-semibold tabular-nums text-slate-900">
                  {formatCurrency(confirmedQuote.total_amount)}
                </p>
              </div>
              <div className="rounded-xl bg-white px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">VAT 포함</p>
                <p className="mt-2 text-lg font-semibold tabular-nums text-slate-900">
                  {formatCurrency(confirmedQuote.grand_total)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
            <FileText className="h-7 w-7 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">확정된 견적서가 없습니다</p>
            <p className="mt-1 text-sm text-slate-400">
              여러 견적 중 실제 계약 기준이 될 견적서를 하나 확정해주세요.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">전체 견적서</p>
          <span className="text-xs font-medium text-slate-400">{quotations.length}건</span>
        </div>

        {quotations.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-slate-300">
            <FileText className="h-6 w-6" />
            <p className="mt-2 text-xs">등록된 견적서가 없습니다</p>
          </div>
        ) : (
          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {[...quotations].reverse().map((quote) => {
              const isConfirmed = confirmedQuoteId === quote.id

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
                    "flex w-full cursor-pointer items-start justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all",
                    isConfirmed
                      ? "border-emerald-200 bg-emerald-50/70"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isConfirmed ? (
                        <span className="inline-flex h-6 items-center rounded-full bg-emerald-100 px-2 text-[10px] font-semibold text-emerald-700">
                          확정
                        </span>
                      ) : (
                        <span className="inline-flex h-6 items-center rounded-full bg-slate-100 px-2 text-[10px] font-semibold text-slate-500">
                          후보
                        </span>
                      )}
                      <p className="min-w-0 truncate text-sm font-semibold text-slate-800">{quote.title}</p>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-400">
                      {quote.quotation_number} · {formatShortDate(quote.quotation_date)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">VAT 포함</p>
                      <p className={cn("mt-1 text-sm font-semibold tabular-nums", quote.grand_total > 0 ? "text-slate-900" : "text-slate-300")}>
                        {formatCurrency(quote.grand_total)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleConfirm(quote)
                      }}
                      className={cn(
                        "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
                        isConfirmed
                          ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                          : "border-slate-200 text-slate-300 hover:border-slate-300 hover:text-slate-600"
                      )}
                      title={isConfirmed ? "확정 해제" : "확정"}
                    >
                      {isConfirmed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
