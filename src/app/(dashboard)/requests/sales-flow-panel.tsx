"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Banknote, Briefcase, ClipboardList, FileText, Receipt, Truck } from "lucide-react"
import type { ContractSummary, QuotationListItem } from "./kanban-types"
import { QuotationsTab } from "./quotations-tab"
import { ContractFlowTab } from "./contract-flow-tab"
import OrderDeliveryTab from "./order-delivery-tab"
import ExpenseTab from "./expense-tab"
import { formatCurrency } from "@/lib/format"

export function SalesFlowPanel({
  quotations,
  onAddQuote,
  onEditQuote,
  confirmedQuoteId,
  onToggleConfirm,
  requestId,
  requestTitle,
  requestCustomer,
  requestContractId,
  onLinkContract,
  onSavedContract,
  onSummaryChange,
  contractSummary,
  requestedFlow,
  // --- 개요 탭용 props ---
  overviewContent,
}: {
  quotations: QuotationListItem[]
  onAddQuote: () => void
  onEditQuote: (id: string) => void
  confirmedQuoteId: string | null
  onToggleConfirm: (quote: QuotationListItem) => void
  requestId: string
  requestTitle: string
  requestCustomer: { id: string; company_name: string; deleted_at: string | null } | null
  requestContractId: string | null
  onLinkContract: (contractId: string | null) => Promise<void>
  onSavedContract?: (contractId: string) => void
  onSummaryChange?: (summary: ContractSummary) => void
  contractSummary?: ContractSummary | null
  requestedFlow?: "개요" | "견적" | "계약" | "정산" | "주문·배송" | "지출"
  overviewContent?: React.ReactNode
}) {
  // 6개 탭: 개요 / 견적 / 계약 / 정산 / 주문·배송 / 지출
  type FlowTab = "개요" | "견적" | "계약" | "정산" | "주문·배송" | "지출"
  const [activeFlow, setActiveFlow] = useState<FlowTab>("개요")
  // 외부에서 탭 전환 요청 시 처리 (중복 적용 방지용 ref)
  const appliedRequestedFlowRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (requestedFlow && appliedRequestedFlowRef.current !== requestedFlow) {
      appliedRequestedFlowRef.current = requestedFlow
      setActiveFlow(requestedFlow)
    }
  }, [requestedFlow])

  const flowTabs: Array<{ key: FlowTab }> = [
    { key: "개요" },
    { key: "견적" },
    { key: "계약" },
    { key: "정산" },
    { key: "주문·배송" },
    { key: "지출" },
  ]
  const flowIcons: Record<FlowTab, React.ComponentType<{ className?: string }>> = {
    "개요": ClipboardList,
    "견적": FileText,
    "계약": Briefcase,
    "정산": Banknote,
    "주문·배송": Truck,
    "지출": Receipt,
  }
  const confirmedQuote = confirmedQuoteId ? quotations.find((q) => q.id === confirmedQuoteId) ?? null : null
  // 확정 견적서 장려금 합계 계산
  const confirmedIncentiveTotal = confirmedQuote?.items
    ? confirmedQuote.items.reduce((sum, item) => {
        const purchaseAmount = Number(item.purchase_amount ?? 0)
        const incentiveRate = Number(item.incentive_rate ?? 0)
        return sum + Math.round(purchaseAmount * incentiveRate / 100)
      }, 0)
    : 0

  // 계약/정산 탭 어느 쪽이 활성이든 ContractFlowTab에 전달할 activeView 결정
  const contractActiveView: "계약서" | "정산 현황" = activeFlow === "정산" ? "정산 현황" : "계약서"

  return (
    <div>
      {/* 6탭 네비게이션 — pill 스타일 */}
      <div className="flex items-center gap-1 rounded-lg bg-slate-100/80 p-1 mb-5 overflow-x-auto">
        {flowTabs.map((tab) => {
          const Icon = flowIcons[tab.key]
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFlow(tab.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-all",
                activeFlow === tab.key
                  ? "bg-white shadow-sm font-semibold text-sky-aqua"
                  : "font-medium text-slate-500 hover:text-slate-700 hover:bg-white/50"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{tab.key}</span>
            </button>
          )
        })}
      </div>

      {/* 개요 탭 — 고객·견적·계약·정산 요약을 한눈에 */}
      {activeFlow === "개요" && overviewContent}

      {activeFlow === "견적" && (
        <QuotationsTab
          quotations={quotations}
          onAddQuote={onAddQuote}
          onEditQuote={onEditQuote}
          confirmedQuoteId={confirmedQuoteId}
          onToggleConfirm={onToggleConfirm}
        />
      )}

      {/* 계약/정산 탭 — 언마운트 방지: display:none으로 숨김 (탭 전환 시 상태 유지, auto-save 충돌 방지) */}
      <div style={{ display: (activeFlow === "계약" || activeFlow === "정산") ? "block" : "none" }}>
        <ContractFlowTab
          requestId={requestId}
          requestTitle={requestTitle}
          requestCustomer={requestCustomer}
          requestContractId={requestContractId}
          confirmedQuoteSupplyAmount={confirmedQuote?.total_amount ?? null}
          onLinkContract={onLinkContract}
          onSavedContract={onSavedContract}
          onSummaryChange={onSummaryChange}
          activeView={contractActiveView}
        />
      </div>

      {activeFlow === "주문·배송" && (
        <OrderDeliveryTab requestId={requestId} confirmedQuoteId={confirmedQuoteId ?? null} onEditQuote={onEditQuote} />
      )}

      {activeFlow === "지출" && (
        <ExpenseTab
          requestId={requestId}
          totalSettlement={contractSummary ? Math.floor(contractSummary.paidAmount / 1.1) : 0}
          totalContractAmount={contractSummary ? Math.floor(contractSummary.totalWithVat / 1.1) : 0}
          incentiveTotal={confirmedIncentiveTotal}
        />
      )}
    </div>
  )
}
