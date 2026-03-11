"use client"

import { Building2, FileCheck2, HandCoins, Receipt, TrendingUp } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
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

  const contractTotal = contractSummary?.totalWithVat ?? confirmedQuote?.grand_total ?? 0
  const paidAmount = contractSummary?.paidAmount ?? 0
  const unpaidAmount = contractSummary?.unpaidAmount ?? Math.max(0, contractTotal - paidAmount)
  const progressPercent = contractSummary?.progressPercent ?? 0
  const contractStatusLabel = requestContractId ? "계약 연동 완료" : "계약 미생성"
  const taxInvoiceLabel = contractSummary?.taxInvoiceAllIssued
    ? "계산서 발행 완료"
    : contractSummary?.taxInvoiceSomeIssued
      ? "계산서 일부 발행"
      : "계산서 확인 필요"
  const stagePills = contractSummary?.stageSummaries ?? []
  const metrics = [
    {
      label: "고객사",
      value: requestCustomer?.company_name || "미연결",
      subtext: requestCustomer ? "현재 현장 연결 고객" : "고객 연결 필요",
      icon: Building2,
      tone: requestCustomer ? "text-slate-900" : "text-slate-400",
    },
    {
      label: "확정 견적",
      value: confirmedQuote ? `${formatCurrency(confirmedQuote.grand_total)}원` : "미확정",
      subtext: confirmedQuote ? confirmedQuote.quotation_number : "확정 견적 필요",
      icon: FileCheck2,
      tone: confirmedQuote ? "text-slate-900" : "text-slate-400",
    },
    {
      label: "입금 완료",
      value: paidAmount > 0 ? `${formatCurrency(paidAmount)}원` : "0원",
      subtext: unpaidAmount > 0 ? `미수금 ${formatCurrency(unpaidAmount)}원` : "미수금 없음",
      icon: HandCoins,
      tone: "text-slate-900",
    },
    {
      label: "수금 진행률",
      value: `${progressPercent}%`,
      subtext: taxInvoiceLabel,
      icon: TrendingUp,
      tone: "text-slate-900",
    },
  ]

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100/80 p-5 shadow-sm">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">영업 운영판</p>
              <h3 className="mt-2 truncate text-2xl font-semibold text-slate-950">{requestTitle}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex h-8 items-center rounded-full bg-white px-3 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                  {contractStatusLabel}
                </span>
                <span className="inline-flex h-8 items-center rounded-full bg-white px-3 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                  {confirmedQuote ? "확정 견적 반영중" : "견적 확정 필요"}
                </span>
                <span className="inline-flex h-8 items-center rounded-full bg-white px-3 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                  {contractTotal > 0 ? `계약 규모 ${formatCurrency(contractTotal)}원` : "금액 입력 필요"}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[520px] xl:max-w-[640px] xl:flex-1">
              {metrics.map((metric) => {
                const Icon = metric.icon

                return (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)] ring-1 ring-slate-200/70"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{metric.label}</p>
                        <p className={cn("mt-2 text-lg font-semibold", metric.tone)}>{metric.value}</p>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{metric.subtext}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white">
              <Receipt className="h-3.5 w-3.5" />
              단계별 진행
            </span>
            {stagePills.length > 0 ? stagePills.map((stage) => (
              <span
                key={`${stage.name}-${stage.status}`}
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ring-1",
                  stage.status === "paid"
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : stage.status === "partial"
                      ? "bg-amber-50 text-amber-700 ring-amber-200"
                      : "bg-white text-slate-500 ring-slate-200"
                )}
              >
                {stage.name}
              </span>
            )) : (
              <span className="text-xs text-slate-400">계약과 정산 단계를 설정하면 진행 배지가 표시됩니다.</span>
            )}
          </div>
        </div>
      </section>

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

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">지출 및 수익성</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">현장 지출 흐름과 수익 구조</h3>
            <p className="mt-1 text-sm text-slate-500">
              장비/설치 지출과 정산 수금 현황을 같은 화면에서 비교하면서 현장 수익성을 판단합니다.
            </p>
          </div>
          {confirmedIncentiveTotal > 0 && (
            <span className="inline-flex h-9 items-center rounded-full bg-slate-100 px-3 text-xs font-medium text-slate-600">
              장려금 {formatCurrency(confirmedIncentiveTotal)}원
            </span>
          )}
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
