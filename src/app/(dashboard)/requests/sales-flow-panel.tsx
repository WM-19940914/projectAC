"use client"

import type { ReactNode } from "react"
import { Building2, FileCheck2, HandCoins, TrendingUp } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ContractSummary, QuotationListItem } from "./kanban-types"
import { ContractFlowTab } from "./contract-flow-tab"
import ExpenseTab from "./expense-tab"

export function SalesFlowPanel({
  quotationsSlot,
  quotations,
  confirmedQuoteId,
  requestId,
  requestTitle,
  requestCustomer,
  requestContractId,
  onLinkContract,
  onSavedContract,
  onSummaryChange,
  contractSummary,
}: {
  quotationsSlot: ReactNode
  quotations: QuotationListItem[]
  confirmedQuoteId: string | null
  requestId: string
  requestTitle: string
  requestCustomer: { id: string; company_name: string; deleted_at: string | null } | null
  requestContractId: string | null
  onLinkContract: (contractId: string | null) => Promise<void>
  onSavedContract?: (contractId: string) => void
  onSummaryChange?: (summary: ContractSummary) => void
  contractSummary?: ContractSummary | null
}) {
  const confirmedQuote = confirmedQuoteId ? quotations.find((q) => q.id === confirmedQuoteId) ?? null : null
  const confirmedIncentiveTotal = confirmedQuote?.items
    ? confirmedQuote.items.reduce((sum, item) => {
      const purchaseAmount = Number(item.purchase_amount ?? 0)
      const incentiveRate = Number(item.incentive_rate ?? 0)
      return sum + Math.round(purchaseAmount * incentiveRate / 100)
    }, 0)
    : 0

  const contractTotal = contractSummary?.totalWithVat ?? confirmedQuote?.grand_total ?? 0
  const paidAmount = contractSummary?.paidAmount ?? 0
  const progressPercent = contractSummary?.progressPercent ?? 0

  // 컴팩트 메트릭 데이터
  const metrics = [
    {
      label: "고객사",
      value: requestCustomer?.company_name || "미연결",
      icon: Building2,
      active: !!requestCustomer,
    },
    {
      label: "확정 견적",
      value: confirmedQuote ? `${formatCurrency(confirmedQuote.grand_total)}원` : "미확정",
      icon: FileCheck2,
      active: !!confirmedQuote,
    },
    {
      label: "입금",
      value: paidAmount > 0 ? `${formatCurrency(paidAmount)}원` : "0원",
      icon: HandCoins,
      active: paidAmount > 0,
    },
    {
      label: "수금률",
      value: `${progressPercent}%`,
      icon: TrendingUp,
      active: progressPercent > 0,
    },
  ]

  return (
    <div className="space-y-4">
      {/* 요약 메트릭 바 — 가로 1줄 컴팩트 */}
      <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-4 overflow-x-auto">
          {metrics.map((metric, idx) => {
            const Icon = metric.icon
            return (
              <div key={metric.label} className="flex items-center gap-2 shrink-0">
                {idx > 0 && <div className="w-px h-6 bg-slate-200 shrink-0" />}
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-400">{metric.label}</span>
                  <span className={cn(
                    "text-sm font-semibold tabular-nums",
                    metric.active ? "text-slate-900" : "text-slate-400"
                  )}>
                    {metric.value}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 견적정보 | 계약정보 | 정산현황 — 3컬럼 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        {/* 1열: 견적정보 (외부에서 주입) */}
        {quotationsSlot}

        {/* 2열: 계약정보 + 3열: 정산현황 — ContractFlowTab이 contents로 2개 div 출력 */}
        <ContractFlowTab
          requestId={requestId}
          requestTitle={requestTitle}
          requestCustomer={requestCustomer}
          requestContractId={requestContractId}
          confirmedQuoteSupplyAmount={confirmedQuote?.total_amount ?? null}
          onLinkContract={onLinkContract}
          onSavedContract={onSavedContract}
          onSummaryChange={onSummaryChange}
          activeView="통합"
        />
      </div>

      {/* 지출/수익성 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">지출 · 수익성</h3>
            {confirmedIncentiveTotal > 0 && (
              <span className="inline-flex h-6 items-center rounded-full bg-slate-100 px-2.5 text-[11px] font-medium text-slate-600">
                장려금 {formatCurrency(confirmedIncentiveTotal)}원
              </span>
            )}
          </div>
        </div>

        <ExpenseTab
          requestId={requestId}
          totalSettlement={contractSummary ? Math.floor(contractSummary.paidAmount / 1.1) : 0}
          totalContractAmount={contractSummary ? Math.floor(contractSummary.totalWithVat / 1.1) : 0}
          incentiveTotal={confirmedIncentiveTotal}
          layout="side-by-side"
        />
      </section>
    </div>
  )
}
