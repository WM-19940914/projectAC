"use client"

// ----- 견적서/파일 탭 컴포넌트 -----

import { useState } from "react"
import { cn } from "@/lib/utils"
import { formatShortDate, formatCurrency } from "@/lib/format"
import { Calendar, CheckCircle2, Circle, FileText, Hash, Plus } from "lucide-react"
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
  const [activeTab, setActiveTab] = useState<"견적서" | "파일">("견적서")

  return (
    <>
      <div className="flex items-center gap-3 border-b border-gray-200 mb-3">
        {([
          { label: "견적서" as const, count: quotations.length },
          { label: "파일" as const, count: 0 },
        ]).map((tab) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(tab.label)}
            className={`pb-2 text-sm transition-colors ${activeTab === tab.label
              ? "font-bold text-gray-900 border-b-2 border-gray-900"
              : "font-medium text-gray-300 hover:text-gray-500 border-b-2 border-transparent"
              }`}
          >
            {tab.label} <span className="text-xs">{tab.count}</span>
          </button>
        ))}
      </div>

      {activeTab === "견적서" && (
        <div className="space-y-2">
          {/* 추가 버튼 */}
          <button
            onClick={onAddQuote}
            className="w-full flex items-center justify-center gap-1.5 py-3 border-2 border-dashed border-slate-400/30 rounded-lg text-sm text-slate-700 font-medium hover:border-slate-400 hover:bg-slate-50 transition-all"
          >
            <Plus className="h-4 w-4" />
            추가하기
          </button>

          {/* 견적서 카드 목록 */}
          {quotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-300">
              <FileText className="h-8 w-8 mb-2" />
              <p className="text-sm">아직 견적서가 없습니다</p>
            </div>
          ) : (
            [...quotations].reverse().map((q, index) => {
              const isConfirmed = confirmedQuoteId === q.id
              return (
                <div
                  key={q.id}
                  className={cn(
                    "border rounded-xl px-4 py-3.5 transition-all",
                    isConfirmed
                      ? "border-slate-400/70 bg-slate-700/10 ring-1 ring-slate-300/30"
                      : "border-gray-200 hover:border-slate-400/40 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold shrink-0">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => onToggleConfirm(q)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors border",
                        isConfirmed
                          ? "border-slate-400 text-slate-700 bg-slate-700/10 hover:bg-slate-700/20"
                          : "border-gray-300 text-gray-500 bg-white hover:bg-gray-50"
                      )}
                    >
                      {isConfirmed ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Circle className="h-3.5 w-3.5" />
                      )}
                      확정
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onEditQuote(q.id)}
                    className="w-full text-left group"
                  >
                    <p className="text-sm font-semibold text-gray-800 group-hover:text-slate-700 transition-colors leading-snug line-clamp-2 mb-1.5">
                      {q.title}
                    </p>
                    <div className="flex items-center gap-1 mb-3">
                      <Hash className="h-3 w-3 text-gray-300 shrink-0" />
                      <span className="text-[11px] text-gray-400 font-medium">{q.quotation_number}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
                      <div className="flex items-center gap-1 text-[11px] text-gray-400">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>{formatShortDate(q.quotation_date)}</span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        {q.total_amount > 0 && (
                          <>
                            <span className="text-xs font-bold tabular-nums text-gray-500">
                              {formatCurrency(q.total_amount)}
                            </span>
                            <span className="text-[9px] text-gray-300">VAT 별도</span>
                          </>
                        )}
                        <span className={`text-xs font-bold tabular-nums ${q.grand_total > 0 ? "text-slate-700" : "text-gray-300"}`}>
                          {formatCurrency(q.grand_total)}
                        </span>
                        <span className="text-[9px] text-gray-400">VAT 포함</span>
                      </div>
                    </div>
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}

      {activeTab === "파일" && (
        <div className="flex flex-col items-center justify-center py-10 text-gray-300">
          <p className="text-sm">구현 예정</p>
        </div>
      )}
    </>
  )
}
