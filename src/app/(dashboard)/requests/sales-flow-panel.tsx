"use client"

// ----- 계약·정산 + 지출 패널 (심플 플랫) -----

import type { ContractSummary, QuotationListItem } from "./kanban-types"
import { ContractFlowTab } from "./contract-flow-tab"
import ExpenseTab from "./expense-tab"

export function SalesFlowPanel({
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

  return (
    <div className="space-y-4">
      {/* 정산 현황 + 지출 — 2컬럼 */}
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

      {/* 지출 */}
      <ExpenseTab
        requestId={requestId}
        totalSettlement={contractSummary ? Math.floor(contractSummary.paidAmount / 1.1) : 0}
        totalContractAmount={contractSummary ? Math.floor(contractSummary.totalWithVat / 1.1) : 0}
        incentiveTotal={confirmedIncentiveTotal}
        layout="side-by-side"
      />
    </div>
  )
}
