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
  return (
    <div className="space-y-1.5">
      {/* 추가 버튼 */}
      <button
        onClick={onAddQuote}
        className="w-full flex items-center justify-center gap-1 py-1.5 border border-dashed border-gray-300 rounded text-xs text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-all"
      >
        <Plus className="h-3 w-3" />
        추가
      </button>

      {/* 견적서 목록 */}
      {quotations.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-gray-300">
          <FileText className="h-6 w-6 mb-1" />
          <p className="text-xs">견적서 없음</p>
        </div>
      ) : (
        [...quotations].reverse().map((q) => {
          const isConfirmed = confirmedQuoteId === q.id
          return (
            <div
              key={q.id}
              className={cn(
                "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded transition-all cursor-pointer group",
                isConfirmed
                  ? "bg-slate-100/80"
                  : "hover:bg-gray-50"
              )}
              onClick={() => onEditQuote(q.id)}
            >
              {/* 왼쪽: 제목 + 번호·날짜 */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-800 truncate">
                  {q.title}
                </p>
                <p className="text-[10px] text-gray-400 truncate">
                  {q.quotation_number} · {formatShortDate(q.quotation_date)}
                </p>
              </div>

              {/* 오른쪽: 금액 + 확정 */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn(
                  "text-xs font-semibold tabular-nums",
                  q.grand_total > 0 ? "text-gray-700" : "text-gray-300"
                )}>
                  {formatCurrency(q.grand_total)}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleConfirm(q)
                  }}
                  className={cn(
                    "p-0.5 rounded transition-colors",
                    isConfirmed
                      ? "text-slate-700"
                      : "text-gray-300 hover:text-gray-500"
                  )}
                  title={isConfirmed ? "확정 해제" : "확정"}
                >
                  {isConfirmed ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
