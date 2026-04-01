"use client"

// ----- 대시보드용 의뢰 상세 Sheet -----
// 칸반보드의 사이드 패널과 동일한 UI를 대시보드 위에 오버레이로 표시
// 자체적으로 견적·계약·지출 데이터를 API에서 로드하여 독립 동작

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { SalesFlowPanel } from "../requests/sales-flow-panel"
import { QuotationsTab } from "../requests/quotations-tab"
import OrderDeliveryTab from "../requests/order-delivery-tab"
import ExpenseReportTab from "../requests/expense-report-tab"
import type { QuotationListItem, ContractSummary } from "../requests/kanban-types"
import type { DashboardRequestInfo } from "./dashboard-types"
import { formatDate, formatDateTime } from "@/lib/format"
import { Send, Calendar, Building2, Briefcase, Truck, FileCheck, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  requestInfo: DashboardRequestInfo | null
  onClose: () => void
}

export function RequestDetailSheet({ requestInfo, onClose }: Props) {
  const router = useRouter()
  // 데이터 변경 여부 추적 — 패널 닫을 때 변경이 있었으면 서버 컴포넌트 갱신
  const dirtyRef = useRef(false)

  // ----- 뷰 전환 (영업 / 주문배송 / 지출결의서) — 칸반보드와 동일 -----
  const [sheetView, setSheetView] = useState<"영업" | "주문배송" | "지출결의서">("영업")

  // ----- 견적서 state -----
  const [quotations, setQuotations] = useState<QuotationListItem[]>([])

  // ----- 계약 요약 state -----
  const [contractSummary, setContractSummary] = useState<ContractSummary | null>(null)

  // ----- 의뢰 필드 로컬 state (contract_id, confirmed_quote_id 등 변경 반영) -----
  const [localContractId, setLocalContractId] = useState<string | null>(null)
  const [localConfirmedQuoteId, setLocalConfirmedQuoteId] = useState<string | null>(null)

  // ----- 수동 장려금 state -----
  const [manualIncentive, setManualIncentive] = useState<number>(0)

  // 패널 닫기 + 변경 사항 있으면 대시보드 새로고침
  const handleClose = useCallback(() => {
    onClose()
    if (dirtyRef.current) {
      dirtyRef.current = false
      router.refresh()
    }
  }, [onClose, router])

  // requestInfo 변경 시 로컬 state 초기화
  useEffect(() => {
    if (requestInfo) {
      setLocalContractId(requestInfo.contract_id)
      setLocalConfirmedQuoteId(requestInfo.confirmed_quote_id)
      setManualIncentive(requestInfo.manual_incentive || 0)
      setSheetView("영업")
      dirtyRef.current = false
    } else {
      setQuotations([])
      setContractSummary(null)
    }
  }, [requestInfo])

  // ----- 견적서 로드 -----
  const loadQuotations = useCallback(async (reqId: string) => {
    try {
      const res = await fetch(`/api/quotes?request_id=${reqId}`)
      if (res.ok) {
        const result = await res.json()
        setQuotations(result.data || [])
      }
    } catch {
      setQuotations([])
    }
  }, [])

  const requestId = requestInfo?.id
  useEffect(() => {
    if (requestId) {
      loadQuotations(requestId)
    } else {
      setQuotations([])
    }
  }, [requestId, loadQuotations])

  // ----- 계약 요약 변경 핸들러 (안정화) -----
  const handleSummaryChange = useCallback((summary: ContractSummary) => {
    setContractSummary((prev) => {
      if (
        prev &&
        prev.totalWithVat === summary.totalWithVat &&
        prev.paidAmount === summary.paidAmount &&
        prev.unpaidAmount === summary.unpaidAmount &&
        prev.progressPercent === summary.progressPercent &&
        JSON.stringify(prev.stageSummaries) === JSON.stringify(summary.stageSummaries)
      ) {
        return prev
      }
      dirtyRef.current = true
      return summary
    })
  }, [])

  // ----- 계약 연결/해제 -----
  const handleLinkContract = useCallback(async (contractId: string | null) => {
    if (!requestInfo) return
    try {
      await fetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: requestInfo.id, contract_id: contractId }),
      })
      setLocalContractId(contractId)
      dirtyRef.current = true
    } catch {
      // 실패 시 무시 (ContractFlowTab 내부에서 에러 처리)
    }
  }, [requestInfo])

  // ----- 계약 저장 후 요약 새로고침 -----
  const contractSummaryFetchSeqRef = useRef(0)
  const handleSavedContract = useCallback(async (contractId: string) => {
    setLocalContractId(contractId)
    dirtyRef.current = true
    // ContractFlowTab 내부에서 onSummaryChange를 호출하므로 별도 fetch 불필요
  }, [])

  // ----- 견적서 추가 (간이: POST 후 목록 새로고침) -----
  const handleAddQuote = useCallback(async () => {
    if (!requestInfo) return
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${requestInfo.title} 견적서`,
          quotation_date: new Date().toISOString().slice(0, 10),
          request_id: requestInfo.id,
          customer_id: requestInfo.customer?.id || null,
        }),
      })
      if (res.ok) {
        loadQuotations(requestInfo.id)
        dirtyRef.current = true
      }
    } catch { /* 실패 시 무시 */ }
  }, [requestInfo, loadQuotations])

  // ----- 수동 장려금 변경 핸들러 -----
  const handleManualIncentiveChange = useCallback(async (v: number) => {
    if (!requestInfo) return
    setManualIncentive(v)
    dirtyRef.current = true
    try {
      await fetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: requestInfo.id, manual_incentive: v }),
      })
    } catch { /* 실패 시 무시 */ }
  }, [requestInfo])

  // ----- 견적서 편집 (현재는 칸반 이동 안내 — 에디터가 칸반에 강하게 결합됨) -----
  const handleEditQuote = useCallback((_quoteId: string) => {
    // 견적서 에디터는 칸반보드에서만 열 수 있음
    // 추후 독립 에디터로 분리 가능
  }, [])

  // ----- 견적 확정 토글 -----
  const handleToggleConfirm = useCallback(async (quote: QuotationListItem) => {
    if (!requestInfo) return
    const nextConfirmedId = localConfirmedQuoteId === quote.id ? null : quote.id
    try {
      await fetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: requestInfo.id, confirmed_quote_id: nextConfirmedId }),
      })
      setLocalConfirmedQuoteId(nextConfirmedId)
      dirtyRef.current = true
    } catch { /* 실패 시 무시 */ }
  }, [requestInfo, localConfirmedQuoteId])

  if (!requestInfo) return null

  const confirmedQuoteId = localConfirmedQuoteId

  return (
    <Sheet open={!!requestInfo} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[1400px] p-0 flex flex-col [&>button:first-child]:hidden">
        {/* ----- 통합 헤더 ----- */}
        <div className="border-b border-slate-200/60 bg-gradient-to-r from-slate-50/80 to-white">
          {/* 1행: 아이콘 + 현장명 + 닫기 */}
          <div className="flex items-center gap-2.5 px-5 pt-3 pb-1.5">
            <Send className="h-4 w-4 text-slate-900 shrink-0" strokeWidth={2.5} />
            <SheetHeader className="shrink min-w-0 max-w-[60%]">
              <SheetTitle className="text-base font-heading font-bold text-slate-900 truncate">
                {requestInfo.title}
              </SheetTitle>
              <SheetDescription className="sr-only">의뢰 상세 정보</SheetDescription>
            </SheetHeader>
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              <button
                onClick={handleClose}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>
          {/* 2행: 메타 칩 */}
          <div className="flex items-center gap-1.5 px-5 pb-2.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100/80 text-[11px] text-slate-500">
              <Calendar className="h-2.5 w-2.5" />
              {requestInfo.inquiry_date ? formatDate(requestInfo.inquiry_date) : "문의일 미지정"}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100/80 text-[11px] text-slate-500">
              <Building2 className="h-2.5 w-2.5" />
              {requestInfo.customer?.company_name || "고객 미연결"}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50/80 text-[11px] text-slate-400">
              {formatDateTime(requestInfo.created_at).replace(/^\d{2}/, '')} 생성
            </span>
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
              requestInfo.status === "계약 성공" ? "bg-green-100 text-green-700"
                : requestInfo.status === "영업중" ? "bg-indigo-100 text-indigo-600"
                  : requestInfo.status === "수주 실패" ? "bg-red-100 text-red-600"
                    : "bg-slate-100 text-slate-600"
            )}>
              {requestInfo.status}
            </span>
          </div>
        </div>

        {/* ----- 뷰 전환 탭 — 칸반보드와 동일 (영업/주문배송/지출결의서) ----- */}
        <div className="flex items-center gap-1 px-5 border-b border-gray-200">
          {(["영업", "주문배송", "지출결의서"] as const).map((view) => {
            const isActive = sheetView === view
            const Icon = view === "영업" ? Briefcase : view === "주문배송" ? Truck : FileCheck
            const label = view === "영업" ? "영업 관리" : view === "주문배송" ? "주문·배송" : "지출결의서"
            return (
              <button
                key={view}
                onClick={() => setSheetView(view)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors",
                  isActive ? "text-slate-900" : "text-gray-400 hover:text-gray-600"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                <span className={cn(
                  "absolute bottom-0 left-2 right-2 h-0.5 rounded-full transition-colors",
                  isActive ? "bg-slate-900" : "bg-transparent"
                )} />
              </button>
            )
          })}
        </div>

        {/* ----- 영업 관리 뷰 ----- */}
        {sheetView === "영업" && (
          <div className="flex-1 overflow-y-auto bg-slate-50 px-5 pb-8 pt-4 scrollbar-hidden">
            <div className="space-y-4">
              <SalesFlowPanel
                quotationsSlot={
                  <QuotationsTab
                    quotations={quotations}
                    onAddQuote={handleAddQuote}
                    onEditQuote={handleEditQuote}
                    confirmedQuoteId={confirmedQuoteId}
                    onToggleConfirm={handleToggleConfirm}
                  />
                }
                quotations={quotations}
                confirmedQuoteId={confirmedQuoteId}
                requestId={requestInfo.id}
                requestTitle={requestInfo.title}
                requestCustomer={requestInfo.customer}
                requestContractId={localContractId}
                onLinkContract={handleLinkContract}
                onSavedContract={handleSavedContract}
                onSummaryChange={handleSummaryChange}
                contractSummary={contractSummary}
                manualIncentive={manualIncentive}
                onManualIncentiveChange={handleManualIncentiveChange}
              />
            </div>
          </div>
        )}

        {/* ----- 주문·배송 뷰 ----- */}
        {sheetView === "주문배송" && (
          <div className="flex-1 overflow-y-auto bg-slate-50 px-5 pb-8 pt-4 scrollbar-hidden">
            <OrderDeliveryTab
              requestId={requestInfo.id}
              defaultSiteName={requestInfo.title}
              confirmedQuoteId={confirmedQuoteId}
              onEditQuote={handleEditQuote}
            />
          </div>
        )}

        {/* ----- 지출결의서 뷰 — 칸반보드와 동일 ----- */}
        {sheetView === "지출결의서" && (
          <div className="flex-1 overflow-y-auto bg-slate-50 px-5 pb-8 pt-4 scrollbar-hidden">
            <ExpenseReportTab
              requestId={requestInfo.id}
              requestTitle={requestInfo.title}
              customerName={requestInfo.customer?.company_name || ""}
              customerContact=""
              userName=""
              userTeam="MA영업팀"
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
