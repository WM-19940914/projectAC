"use client"

import { memo, useMemo, type ReactNode } from "react"
import type { ContractSummary, QuotationListItem } from "./kanban-types"
import { ContractFlowTab } from "./contract-flow-tab"
import ExpenseTab from "./expense-tab"
import AttachmentPanel from "./attachment-panel"

export const SalesFlowPanel = memo(function SalesFlowPanel({
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
  manualIncentive = 0,
  onManualIncentiveChange,
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
  manualIncentive?: number            // 수기 입력 장려금 (VAT별도)
  onManualIncentiveChange?: (v: number) => Promise<void>  // 수기 장려금 저장 콜백
}) {
  const confirmedQuote = useMemo(
    () => confirmedQuoteId ? quotations.find((q) => q.id === confirmedQuoteId) ?? null : null,
    [confirmedQuoteId, quotations]
  )
  // 장려금 (VAT별도): 견적서의 매입단가 × 장려율
  const confirmedIncentiveExclTax = useMemo(() => confirmedQuote?.items
    ? confirmedQuote.items.reduce((sum, item) => {
      const purchaseAmount = Number(item.purchase_amount ?? 0)
      const incentiveRate = Number(item.incentive_rate ?? 0)
      return sum + Math.round(purchaseAmount * incentiveRate / 100)
    }, 0)
    : 0, [confirmedQuote])

  return (
    <div className="space-y-4">
      {/* 견적정보 | 계약정보 | 정산현황 — 3컬럼 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
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

      {/* 지출/수익성 — 상단 행과 동일한 3컬럼 그리드 (좌측 2컬럼 사용) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
        <div className="xl:col-span-2">
          <ExpenseTab
            requestId={requestId}
            totalSettlement={contractSummary ? contractSummary.supplyAmount : 0}
            totalContractAmount={contractSummary ? contractSummary.supplyAmount : 0}
            quoteIncentiveTotal={confirmedIncentiveExclTax}
            manualIncentiveTotal={manualIncentive}
            manualIncentiveExclTax={manualIncentive}
            hasConfirmedQuote={!!confirmedQuote}
            onManualIncentiveChange={onManualIncentiveChange}
            layout="side-by-side"
          />
        </div>
        {/* 우측 1열: 첨부파일 관리 */}
        <AttachmentPanel requestId={requestId} />
      </div>
    </div>
  )
})
