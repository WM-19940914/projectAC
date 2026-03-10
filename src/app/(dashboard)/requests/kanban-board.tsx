"use client"

// ----- 의뢰 칸반보드 메인 컴포넌트 -----
// 역할별로 분리된 하위 파일들을 조립하는 파일

import { useCallback, useEffect, useRef, useState } from "react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { formatDate, formatDateTime, formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Banknote, Box, Briefcase, Building2, Calendar, CheckCircle2, EyeOff, FileText, Hash, Plus, Receipt, Search, Trash2, Truck, X, XCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { REQUEST_STATUSES } from "@/lib/constants"
import SalesTabNav from "@/components/layout/sales-tab-nav"
import QuoteEditorSheet from "../quotes/quote-editor-sheet"
import type { QuotationWithItems } from "@/types"

// ----- 분리된 하위 모듈 import -----
import type {
  RequestItem,
  KanbanColumn,
  Props,
  ContractSummary,
  QuotationListItem,
} from "./kanban-types"
import { COLUMN_STYLES } from "./kanban-types"
import {
  normalizeSettlementStatusInput,
  normalizeSettlementTypes,
  normalizeRatios,
  normalizeMiddleInstallments,
  sanitizeSettlementStatusMap,
  createEvenRatios,
  buildSettlementRows,
  buildContractSnapshot,
  computeStageSummaries,
  normalizeStageScheduledDates,
} from "./settlement-utils"
import {
  SETTLEMENT_STAGE_ORDER,
  EMPTY_STAGE_RATIOS,
  DEFAULT_MIDDLE_INSTALLMENTS,
  EMPTY_STAGE_SCHEDULED_DATES,
} from "./kanban-types"
import { InlineTitle, InlineSelect, InlineDate, InlineEditMemo } from "./inline-editors"
import { CustomerDetailSheet } from "./customer-detail-sheet"
import { SalesFlowPanel } from "./sales-flow-panel"
import { CustomerPanel } from "./customer-panel"

export function RequestKanbanBoard({ columns: initialColumns, totalCount, customers, hiddenItems: initialHiddenItems, failedItems: initialFailedItems }: Props) {
  const router = useRouter()

  // 드래그로 카드 이동 시 화면에 바로 반영하기 위해 state로 관리
  const [columns, setColumns] = useState(initialColumns)
  // 숨긴 카드 목록
  const [hiddenItems, setHiddenItems] = useState(initialHiddenItems)
  // 수주 실패 카드 목록
  const [failedItems, setFailedItems] = useState(initialFailedItems)
  // 숨김 패널: 상태별 펼침/접힘
  const [expandedHiddenStatus, setExpandedHiddenStatus] = useState<string | null>(null)
  // 수주 실패 패널 펼침/접힘
  const [isFailedExpanded, setIsFailedExpanded] = useState(false)

  // 서버에서 새 데이터가 오면 (생성/삭제 후 refresh) 화면도 바로 갱신
  // JSON 비교로 "실제 데이터"가 바뀔 때만 동기화 (드래그 중 리셋 방지)
  const prevDataRef = useRef(JSON.stringify(initialColumns))
  const prevHiddenRef = useRef(JSON.stringify(initialHiddenItems))
  const prevFailedRef = useRef(JSON.stringify(initialFailedItems))
  useEffect(() => {
    const newData = JSON.stringify(initialColumns)
    if (prevDataRef.current !== newData) {
      prevDataRef.current = newData
      setColumns(initialColumns)
    }
    const newHidden = JSON.stringify(initialHiddenItems)
    if (prevHiddenRef.current !== newHidden) {
      prevHiddenRef.current = newHidden
      setHiddenItems(initialHiddenItems)
    }
    const newFailed = JSON.stringify(initialFailedItems)
    if (prevFailedRef.current !== newFailed) {
      prevFailedRef.current = newFailed
      setFailedItems(initialFailedItems)
    }
  }, [initialColumns, initialHiddenItems, initialFailedItems])
  // 삭제 확인 다이얼로그용 state
  const [deleteTarget, setDeleteTarget] = useState<RequestItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // 상세 패널용 state
  const [selectedItem, setSelectedItem] = useState<RequestItem | null>(null)
  // 자동저장 상태 메시지
  const [saveMessage, setSaveMessage] = useState("")
  // 탭 전환 요청 (개요 카드 클릭 시 해당 탭으로 이동)
  const [requestedFlow, setRequestedFlow] = useState<"개요" | "견적" | "계약" | "정산" | "주문·배송" | "지출" | undefined>(undefined)

  // 고객 목록 로컬 state (즉석 생성 시 낙관적 업데이트용)
  const [localCustomers, setLocalCustomers] = useState(customers)
  const prevCustomersRef = useRef(JSON.stringify(customers))
  useEffect(() => {
    const newCustomers = JSON.stringify(customers)
    if (prevCustomersRef.current !== newCustomers) {
      prevCustomersRef.current = newCustomers
      setLocalCustomers(customers)
    }
  }, [customers])

  // 고객 상세 패널 열기용 state
  const [customerDetailId, setCustomerDetailId] = useState<string | null>(null)

  // 견적서 관련 state
  const [quotations, setQuotations] = useState<QuotationListItem[]>([])
  const [isQuoteSheetOpen, setIsQuoteSheetOpen] = useState(false)
  const [editingQuotation, setEditingQuotation] = useState<QuotationWithItems | null>(null)
  const [contractSummary, setContractSummary] = useState<ContractSummary | null>(null)
  const contractSummaryFetchSeqRef = useRef(0)

  // onSummaryChange 안정화 — inline 함수로 전달하면 매 렌더링마다 새 참조가 생겨 자식 useEffect 무한 루프 발생
  const handleSummaryChange = useCallback((summary: ContractSummary) => {
    setContractSummary((prev) => {
      if (
        prev &&
        prev.totalWithVat === summary.totalWithVat &&
        prev.paidAmount === summary.paidAmount &&
        prev.unpaidAmount === summary.unpaidAmount &&
        prev.progressPercent === summary.progressPercent &&
        prev.allConfirmed === summary.allConfirmed &&
        prev.taxInvoiceAllIssued === summary.taxInvoiceAllIssued &&
        prev.taxInvoiceSomeIssued === summary.taxInvoiceSomeIssued &&
        JSON.stringify(prev.stageSummaries) === JSON.stringify(summary.stageSummaries)
      ) {
        return prev
      }
      contractSummaryFetchSeqRef.current += 1
      return summary
    })
  }, [])

  // 의뢰 선택 시 견적서 목록 로드
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

  // selectedItem 변경 시 견적서 로드
  const selectedItemIdForQuotes = selectedItem?.id
  useEffect(() => {
    if (selectedItemIdForQuotes) {
      loadQuotations(selectedItemIdForQuotes)
    } else {
      setQuotations([])
    }
  }, [selectedItemIdForQuotes, loadQuotations])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const loadContractSummaryById = useCallback(async (contractId: string | null, _requestId?: string | null) => {
    const fetchSeq = ++contractSummaryFetchSeqRef.current

    if (!contractId) {
      if (fetchSeq !== contractSummaryFetchSeqRef.current) return
      setContractSummary(null)
      return
    }

    try {
      const res = await fetch(`/api/contracts?id=${contractId}`)
      if (!res.ok) {
        if (fetchSeq !== contractSummaryFetchSeqRef.current) return
        setContractSummary(null)
        return
      }

      const result = await res.json()
      const contract = (result?.data ?? null) as Record<string, unknown> | null
      if (!contract) {
        if (fetchSeq !== contractSummaryFetchSeqRef.current) return
        setContractSummary(null)
        return
      }

      const settlementTypes = normalizeSettlementTypes(contract.settlement_type)
      const baseSelectedStages = settlementTypes.length > 0
        ? settlementTypes
        : [SETTLEMENT_STAGE_ORDER[SETTLEMENT_STAGE_ORDER.length - 1]]
      const baseSupplyAmount = Math.max(0, Math.round(Number(contract.contract_amount || 0)))

      const contractMeta = (
        contract.contract_meta && typeof contract.contract_meta === "object"
          ? contract.contract_meta as Record<string, unknown>
          : null
      )
      const baseStageRatios = contractMeta
        ? normalizeRatios(contractMeta.stage_ratios, baseSelectedStages)
        : createEvenRatios(baseSelectedStages)
      const baseMiddleInstallments = contractMeta
        ? normalizeMiddleInstallments(contractMeta.middle_installments)
        : DEFAULT_MIDDLE_INSTALLMENTS
      const baseSettlementStatusMap = contractMeta
        ? sanitizeSettlementStatusMap(contractMeta.settlement_status_map)
        : {}

      // settlement_status_map은 항상 DB 데이터만 사용 — localStorage pending이 confirmed 등을 오염시키지 않도록
      const effectiveSelectedStages = baseSelectedStages
      const effectiveSupplyAmount = baseSupplyAmount
      const effectiveStageRatios = baseStageRatios
      const effectiveMiddleInstallments = baseMiddleInstallments
      const effectiveSettlementStatusMap = baseSettlementStatusMap

      const settlementRows = buildSettlementRows(
        effectiveSupplyAmount,
        effectiveSelectedStages,
        effectiveStageRatios,
        effectiveMiddleInstallments
      )
      const totalWithVat = effectiveSupplyAmount + Math.floor(effectiveSupplyAmount * 0.1)

      const paidAmount = settlementRows.reduce((sum, row) => {
        const status = normalizeSettlementStatusInput(effectiveSettlementStatusMap[row.key])
        const actualPaid = Math.max(0, Math.round(Number(status.actual_amount || 0)))
        if (actualPaid > 0) return sum + actualPaid
        return sum
      }, 0)

      // 모든 입금내역이 입완 체크되었는지 확인
      const allEntries = settlementRows.flatMap((row) => {
        const status = normalizeSettlementStatusInput(effectiveSettlementStatusMap[row.key])
        return status.payment_entries
      })
      const allConfirmed = allEntries.length > 0 && allEntries.every((e) => e.confirmed)
      // 세금계산서 발행 여부 요약
      const stageCount = settlementRows.length
      const issuedCount = settlementRows.filter((row) => {
        const status = normalizeSettlementStatusInput(effectiveSettlementStatusMap[row.key])
        return status.tax_invoice_issued
      }).length
      const taxInvoiceAllIssued = stageCount > 0 && issuedCount === stageCount
      const taxInvoiceSomeIssued = issuedCount > 0 && issuedCount < stageCount
      // 단계별 입금완료 요약
      const stageSummariesForCard = settlementRows.map((row) => {
        const status = normalizeSettlementStatusInput(effectiveSettlementStatusMap[row.key])
        const entries = status.payment_entries
        const rowPaid = entries.reduce((sum, e) => sum + (e.confirmed ? e.amount : 0), 0)
        const plannedAmount = Math.max(0, Math.round(Number(row.total || 0)))
        const stageStatus: "paid" | "partial" | "unpaid" =
          rowPaid >= plannedAmount && plannedAmount > 0 ? "paid"
          : rowPaid > 0 ? "partial"
          : "unpaid"
        return { name: row.label, status: stageStatus }
      })

      const clampedPaid = Math.min(Math.max(0, paidAmount), totalWithVat)
      const unpaidAmount = Math.max(0, totalWithVat - clampedPaid)
      const progressPercent = totalWithVat > 0
        ? Math.min(100, Math.round((clampedPaid / totalWithVat) * 100))
        : 0

      if (fetchSeq !== contractSummaryFetchSeqRef.current) return
      setContractSummary({
        totalWithVat,
        paidAmount: clampedPaid,
        unpaidAmount,
        progressPercent,
        allConfirmed,
        taxInvoiceAllIssued,
        taxInvoiceSomeIssued,
        stageSummaries: stageSummariesForCard,
      })
    } catch {
      if (fetchSeq !== contractSummaryFetchSeqRef.current) return
      setContractSummary(null)
    }
  }, [])

  const selectedContractId = selectedItem?.contract_id ?? null
  const selectedItemId = selectedItem?.id ?? null
  useEffect(() => {
    void loadContractSummaryById(selectedContractId, selectedItemId)
  }, [selectedContractId, selectedItemId, loadContractSummaryById])

  // contractSummary 변경 시 칸반 카드의 item.contract도 실시간 동기화
  // selectedItem을 ref로 참조 — dependency에 넣으면 setColumns → 리렌더 → selectedItem 새 참조 → 무한 루프
  const selectedItemRef = useRef(selectedItem)
  selectedItemRef.current = selectedItem
  useEffect(() => {
    const current = selectedItemRef.current
    if (!current || !current.contract || !contractSummary) return
    const contractId = current.contract.id
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        items: col.items.map((item) =>
          item.contract?.id === contractId
            ? {
              ...item,
              contract: {
                ...item.contract!,
                total_paid: contractSummary.paidAmount,
                has_upcoming: contractSummary.unpaidAmount > 0 && !contractSummary.allConfirmed,
                all_confirmed: contractSummary.allConfirmed,
                tax_invoice_all_issued: contractSummary.taxInvoiceAllIssued,
                tax_invoice_some_issued: contractSummary.taxInvoiceSomeIssued,
                stage_summaries: contractSummary.stageSummaries,
              },
            }
            : item
        ),
      }))
    )
  }, [contractSummary])

  // 견적서 편집 열기 (상세 데이터 fetch)
  const handleEditQuote = useCallback(async (quoteId: string) => {
    try {
      const res = await fetch(`/api/quotes?id=${quoteId}`)
      if (res.ok) {
        const result = await res.json()
        setEditingQuotation(result.data)
        setIsQuoteSheetOpen(true)
      }
    } catch {
      alert("견적서 데이터를 불러올 수 없습니다.")
    }
  }, [])

  // 견적서 즉시 생성 후 에디터 열기
  const handleAddQuote = useCallback(async () => {
    if (!selectedItem) return
    try {
      const payload = {
        title: `${selectedItem.title} 견적서`,
        quotation_date: new Date().toISOString().split("T")[0],
        request_id: selectedItem.id,
        customer_id: selectedItem.customer?.id || null,
        items: [],
      }
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }))
        const errorMessage = err?.error || String(res.status)
        alert("견적서 생성 실패: " + errorMessage)
        if (res.status === 400) {
          setSelectedItem(null)
          setIsQuoteSheetOpen(false)
          setEditingQuotation(null)
          router.refresh()
        }
        return
      }
      const result = await res.json()
      // 생성된 견적서 상세 fetch → 에디터 열기
      const detailRes = await fetch(`/api/quotes?id=${result.data.id}`)
      if (detailRes.ok) {
        const detail = await detailRes.json()
        setEditingQuotation(detail.data)
        setIsQuoteSheetOpen(true)
        loadQuotations(selectedItem.id)
      }
    } catch {
      alert("견적서 생성 중 오류가 발생했습니다.")
    }
  }, [selectedItem, loadQuotations, router])

  // 견적서 저장 후 콜백
  const handleQuoteSaved = useCallback(() => {
    if (selectedItem) {
      loadQuotations(selectedItem.id)
    }
  }, [selectedItem, loadQuotations])

  // 의뢰 필드 수정 + 자동저장
  const updateRequestField = useCallback(async (field: string, value: string | null) => {
    if (!selectedItem) return

    setSaveMessage("저장 중...")

    // 낙관적 업데이트: selectedItem + columns 동시 갱신
    const updatedItem = { ...selectedItem, [field]: value }
    // customer 객체도 갱신 (customer_id 변경 시)
    if (field === "customer_id") {
      updatedItem.customer = value
        ? (localCustomers.find((c) => c.id === value) ? { id: value, company_name: localCustomers.find((c) => c.id === value)!.company_name, deleted_at: null } : null)
        : null
    }
    // 패널이 이미 닫힌 상태면 다시 열지 않음
    setSelectedItem((prev) => prev ? updatedItem : null)

    // 칸반보드 columns + failedItems 업데이트
    if (field === "status" && value !== selectedItem.status) {
      const oldStatus = selectedItem.status
      const newStatus = value

      // "수주 실패"로 변경 → 컬럼에서 제거, failedItems에 추가
      if (newStatus === "수주 실패") {
        setColumns((prev) => prev.map((col) => {
          if (col.status === oldStatus) {
            const filtered = col.items.filter((i) => i.id !== selectedItem.id)
            return { ...col, items: filtered, count: filtered.length }
          }
          return col
        }))
        setFailedItems((prev) => [updatedItem, ...prev])
      }
      // "수주 실패"에서 다른 상태로 변경 → failedItems에서 제거, 해당 컬럼에 추가
      else if (oldStatus === "수주 실패") {
        setFailedItems((prev) => prev.filter((i) => i.id !== selectedItem.id))
        setColumns((prev) => prev.map((col) => {
          if (col.status === newStatus) {
            return { ...col, items: [updatedItem, ...col.items], count: col.count + 1 }
          }
          return col
        }))
      }
      // 일반 컬럼 간 이동
      else {
        setColumns((prev) => prev.map((col) => {
          if (col.status === oldStatus) {
            const filtered = col.items.filter((i) => i.id !== selectedItem.id)
            return { ...col, items: filtered, count: filtered.length }
          }
          if (col.status === newStatus) {
            return { ...col, items: [updatedItem, ...col.items], count: col.count + 1 }
          }
          return col
        }))
      }
    } else {
      // 일반 필드 변경: 같은 컬럼에서 업데이트
      setColumns((prev) => prev.map((col) => ({
        ...col,
        items: col.items.map((i) => (i.id === selectedItem.id ? updatedItem : i)),
      })))
      // failedItems에서도 업데이트 (수주 실패 상태의 카드 필드 변경 시)
      setFailedItems((prev) => prev.map((i) => (i.id === selectedItem.id ? updatedItem : i)))
    }

    try {
      const res = await fetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedItem.id, [field]: value }),
      })

      if (!res.ok) {
        setSaveMessage("저장 실패")
        setTimeout(() => setSaveMessage(""), 2000)
      } else {
        setSaveMessage("자동 저장됨")
        setTimeout(() => setSaveMessage(""), 1500)
        // router.refresh() 제거: 이미 클라이언트 state(columns)를 직접 업데이트하므로 불필요
        // 서버 컴포넌트 재실행 시 loadContract가 다시 트리거되어 로딩 상태에 빠지는 문제 방지
      }
    } catch {
      setSaveMessage("저장 실패")
      setTimeout(() => setSaveMessage(""), 2000)
    }
  }, [selectedItem, localCustomers])

  const handleToggleConfirmedQuote = useCallback(async (quote: QuotationListItem) => {
    if (!selectedItem) return
    const nextConfirmedQuoteId = selectedItem.confirmed_quote_id === quote.id ? null : quote.id
    await updateRequestField("confirmed_quote_id", nextConfirmedQuoteId)
  }, [selectedItem, updateRequestField])
  // 컬럼별 정렬 상태: null(기본) → "asc"(오름차순) → "desc"(내림차순) → null 순환
  const [sortOrder, setSortOrder] = useState<Record<string, "asc" | "desc" | null>>({})

  // 정렬 토글 함수
  const toggleSort = (status: string) => {
    setSortOrder((prev) => {
      const current = prev[status] || null
      // null → asc → desc → null 순환
      const next = current === null ? "asc" : current === "asc" ? "desc" : null
      return { ...prev, [status]: next }
    })
  }

  // 정렬이 적용된 컬럼 데이터 반환
  const getSortedItems = (col: KanbanColumn) => {
    const order = sortOrder[col.status]
    if (!order) return col.items

    return [...col.items].sort((a, b) => {
      // 문의 일시가 없는 항목은 맨 뒤로
      if (!a.inquiry_date && !b.inquiry_date) return 0
      if (!a.inquiry_date) return 1
      if (!b.inquiry_date) return -1

      const dateA = new Date(a.inquiry_date).getTime()
      const dateB = new Date(b.inquiry_date).getTime()
      return order === "asc" ? dateA - dateB : dateB - dateA
    })
  }

  // 의뢰 생성 다이얼로그용 state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    title: "",
    customer_id: "",
    inquiry_date: new Date().toISOString().split("T")[0],
    memo: "",
  })
  // 의뢰 생성용 고객 연결 모달
  const [isCreateCustomerModalOpen, setIsCreateCustomerModalOpen] = useState(false)
  const [createCustomerSearch, setCreateCustomerSearch] = useState("")
  const [isCreateCustomerMode, setIsCreateCustomerMode] = useState(false)
  const [createCustomerForm, setCreateCustomerForm] = useState({ company_name: "", contact_name: "", phone: "" })
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)

  // 드래그 끝났을 때 실행되는 함수
  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result

    // 드롭 영역 밖에 놓았으면 무시
    if (!destination) return
    // 같은 자리에 놓았으면 무시
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    // 현재 컬럼 복사
    const newColumns = columns.map((col) => ({
      ...col,
      items: [...col.items],
    }))

    // 출발 컬럼에서 카드 꺼내기
    const sourceCol = newColumns.find((col) => col.status === source.droppableId)!
    const [movedItem] = sourceCol.items.splice(source.index, 1)
    sourceCol.count = sourceCol.items.length

    // 도착 컬럼에 카드 넣기
    const destCol = newColumns.find((col) => col.status === destination.droppableId)!
    movedItem.status = destination.droppableId
    destCol.items.splice(destination.index, 0, movedItem)
    destCol.count = destCol.items.length

    // 화면에 바로 반영 (낙관적 업데이트)
    const prevColumns = columns
    setColumns(newColumns)

    // DB에 상태 업데이트 (API 라우트 경유)
    try {
      const res = await fetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draggableId, status: destination.droppableId }),
      })

      if (!res.ok) {
        // 실패 시 직전 상태로 되돌리기
        setColumns(prevColumns)
      }
    } catch {
      setColumns(prevColumns)
    }
  }

  // 삭제 확인 버튼 클릭
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)

    // ID를 미리 저장 (다이얼로그 닫으면 deleteTarget이 null이 되니까)
    const targetId = deleteTarget.id

    // 화면에서 먼저 제거 (낙관적 업데이트)
    const prevColumns = columns
    const prevFailed = failedItems
    const newColumns = columns.map((col) => {
      const filtered = col.items.filter((item) => item.id !== targetId)
      return { ...col, items: filtered, count: filtered.length }
    })
    setColumns(newColumns)
    // failedItems에서도 제거 (수주 실패 상태 카드 삭제 시)
    setFailedItems((prev) => prev.filter((item) => item.id !== targetId))
    setDeleteTarget(null)

    // DB에서 삭제 (admin API 사용 → RLS 우회)
    try {
      const res = await fetch("/api/requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: targetId }),
      })
      const result = await res.json()

      if (!res.ok) {
        alert("삭제 실패: " + (result.error || "알 수 없는 오류"))
        setColumns(prevColumns)
        setFailedItems(prevFailed)
      }
    } catch {
      alert("삭제 중 오류가 발생했습니다")
      setColumns(prevColumns)
      setFailedItems(prevFailed)
    }
    setIsDeleting(false)
  }

  // 카드 숨기기 핸들러
  const handleHide = async (item: RequestItem) => {
    // 화면에서 먼저 숨김 (낙관적 업데이트)
    const prevColumns = columns
    const prevHidden = hiddenItems
    const prevFailed = failedItems

    // "수주 실패" 카드는 failedItems에서 제거, 나머지는 columns에서 제거
    if (item.status === "수주 실패") {
      setFailedItems((prev) => prev.filter((i) => i.id !== item.id))
    } else {
      const newColumns = columns.map((col) => {
        const filtered = col.items.filter((i) => i.id !== item.id)
        return { ...col, items: filtered, count: filtered.length }
      })
      setColumns(newColumns)
    }
    setHiddenItems((prev) => [item, ...prev])

    try {
      const res = await fetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, hidden: true }),
      })
      if (!res.ok) {
        setColumns(prevColumns)
        setHiddenItems(prevHidden)
        setFailedItems(prevFailed)
      }
    } catch {
      setColumns(prevColumns)
      setHiddenItems(prevHidden)
      setFailedItems(prevFailed)
    }
  }

  // 카드 복원 핸들러 (숨김 해제)
  const handleUnhide = async (item: RequestItem) => {
    // 화면에서 먼저 복원 (낙관적 업데이트)
    const prevColumns = columns
    const prevHidden = hiddenItems
    const prevFailed = failedItems
    setHiddenItems((prev) => prev.filter((i) => i.id !== item.id))

    // "수주 실패" 상태 카드는 failedItems로, 나머지는 해당 컬럼으로
    if (item.status === "수주 실패") {
      setFailedItems((prev) => [item, ...prev])
    } else {
      const newColumns = columns.map((col) => {
        if (col.status === item.status) {
          return { ...col, items: [item, ...col.items], count: col.count + 1 }
        }
        return col
      })
      setColumns(newColumns)
    }

    try {
      const res = await fetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, hidden: false }),
      })
      if (!res.ok) {
        setColumns(prevColumns)
        setHiddenItems(prevHidden)
        setFailedItems(prevFailed)
      }
    } catch {
      setColumns(prevColumns)
      setHiddenItems(prevHidden)
      setFailedItems(prevFailed)
    }
  }

  // 의뢰 생성 핸들러
  const handleCreate = async () => {
    if (!createForm.title.trim()) return
    setIsCreating(true)

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      })
      const result = await res.json()

      if (!res.ok) {
        alert("생성 실패: " + (result.error || "알 수 없는 오류"))
      } else {
        // 폼 초기화 & 다이얼로그 닫기
        setCreateForm({ title: "", customer_id: "", inquiry_date: new Date().toISOString().split("T")[0], memo: "" })
        setIsCreateOpen(false)
        router.refresh()
      }
    } catch {
      alert("의뢰 생성 중 오류가 발생했습니다")
    }
    setIsCreating(false)
  }

  return (
    <div className="flex flex-col h-full overflow-auto -m-6 bg-white">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between px-6 py-3 border-b sticky top-0 bg-white z-10">
        <h1 className="text-[15px] font-semibold text-slate-800">현장관리</h1>
        <p className="text-sm text-gray-400">총 {totalCount}건</p>
      </div>

      {/* 칸반 보드 */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 bg-white">
          <div className="flex gap-4 p-4 [&_.text-\\[10px\\]]:text-xs [&_.text-\\[9px\\]]:text-[10px] [&_.text-xs]:text-sm">
            {columns.map((col) => {
              const style = COLUMN_STYLES[col.status] || COLUMN_STYLES["견적 문의"]

              return (
                <div
                  key={col.status}
                  className={cn("flex flex-col flex-1 min-w-0 rounded-lg border border-slate-200", style.bg)}
                >
                  {/* 컬럼 헤더 */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <h2 className={cn("font-semibold text-sm", style.header)}>
                      {col.status}
                    </h2>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className={cn("text-xs", style.badge)}>
                        {col.count}
                      </Badge>
                      {/* 문의 일시 기준 정렬 버튼 */}
                      <button
                        onClick={() => toggleSort(col.status)}
                        title={
                          sortOrder[col.status] === "asc" ? "오래된 순 (오름차순)"
                            : sortOrder[col.status] === "desc" ? "최신 순 (내림차순)"
                              : "정렬 없음"
                        }
                        className={cn(
                          "p-1 rounded-md transition-all",
                          sortOrder[col.status]
                            ? `${style.badge} hover:opacity-80`
                            : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        {sortOrder[col.status] === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : sortOrder[col.status] === "desc" ? (
                          <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 드롭 가능 영역 */}
                  <Droppable droppableId={col.status}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "flex flex-col gap-2 min-h-[100px] px-3 pb-3 rounded-md transition-colors",
                          snapshot.isDraggingOver && "bg-black/5"
                        )}
                      >
                        {getSortedItems(col).map((item, index) => (
                          <Draggable key={item.id} draggableId={item.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => setSelectedItem(item)}
                                className={cn(
                                  "group relative bg-white rounded-md border border-slate-200 p-3 shadow-none hover:shadow-md hover:-translate-y-0.5 transition-all cursor-grab",
                                  snapshot.isDragging && "shadow-md ring-1 ring-slate-200 scale-[1.01]"
                                )}
                              >
                                {/* 숨김 버튼 (호버 시에만 표시) */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleHide(item)
                                  }}
                                  title="숨기기"
                                  className="absolute bottom-2 right-10 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                >
                                  <EyeOff className="h-4 w-4" />
                                </button>

                                {/* 삭제 버튼 (호버 시에만 표시) */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDeleteTarget(item)
                                  }}
                                  className="absolute bottom-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all bg-white border border-slate-200 text-red-500 hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>

                                {/* 상태 배지 (우측 상단 모서리) */}
                                <Badge className={cn("absolute top-2 right-2 text-[10px] px-1.5 py-0.5", style.badge)}>
                                  {col.status}
                                </Badge>

                                {/* 제목 */}
                                <div className="mb-2 pr-16">
                                  <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 truncate" title={item.title}>
                                    <Hash className="h-3.5 w-3.5 text-gray-900 shrink-0" />
                                    <span className="truncate">{item.title}</span>
                                  </p>
                                </div>

                                {/* 문의 일시 + 고객명 (제목과 간격 두고 하단 배치) */}
                                <div className="mt-4 space-y-1">
                                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <Calendar className="h-3 w-3 shrink-0" />
                                    <span>{item.inquiry_date ? formatDate(item.inquiry_date) : "없음"}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <Building2 className="h-3 w-3 shrink-0" />
                                    <span className={item.customer?.deleted_at ? "text-red-500" : ""}>
                                      {item.customer ? (item.customer.deleted_at ? "삭제된 고객" : item.customer.company_name) : "없음"}
                                    </span>
                                  </div>
                                </div>

                                {/* 세금계산서 발행 상태 — 계약이 있을 때만 */}
                                {item.contract && (
                                  <div className={cn(
                                    "mt-2 flex items-center gap-1.5 text-xs rounded-sm px-1.5 py-0.5 -ml-1.5",
                                    item.contract.tax_invoice_all_issued
                                      ? "text-gray-500"
                                      : "text-gray-600 bg-red-50 font-medium"
                                  )}>
                                    {item.contract.tax_invoice_all_issued ? (
                                      <>
                                        <Receipt className="h-3 w-3 shrink-0" />
                                        <span>계산서 발행완료</span>
                                        <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-green-600" />
                                      </>
                                    ) : item.contract.tax_invoice_some_issued ? (
                                      <>
                                        <Receipt className="h-3 w-3 shrink-0" />
                                        <span>계산서 일부발행</span>
                                        <AlertCircle className="h-2.5 w-2.5 shrink-0 text-red-500" />
                                      </>
                                    ) : (
                                      <>
                                        <Receipt className="h-3 w-3 shrink-0" />
                                        <span>계산서 미발행</span>
                                        <AlertCircle className="h-2.5 w-2.5 shrink-0 text-red-500" />
                                      </>
                                    )}
                                  </div>
                                )}

                                {/* 정산 상태 표시 */}
                                {!item.contract && (
                                  <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-300">
                                    <Receipt className="h-3 w-3 shrink-0" />
                                    <span>계약 미생성</span>
                                  </div>
                                )}
                                {item.contract && (() => {
                                  const { contract_amount, total_paid, has_upcoming, all_confirmed } = item.contract
                                  // 상세 패널과 동일하게 VAT 포함 금액 기준으로 계산
                                  const totalWithVat = contract_amount + Math.floor(contract_amount * 0.1)
                                  // 정산완료: 금액 충족 + 모든 입금내역 입완 체크 필요
                                  if (total_paid >= totalWithVat && totalWithVat > 0 && all_confirmed) {
                                    return (
                                      <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                                        <Banknote className="h-3 w-3 shrink-0" />
                                        <span>정산완료</span>
                                        <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-green-600" />
                                      </div>
                                    )
                                  }
                                  // 입금예정 (미래 날짜 입금내역이 있고, 아직 실제 입금은 없거나 부분만 된 경우)
                                  if (has_upcoming && total_paid === 0) {
                                    return (
                                      <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-600 bg-red-50 rounded-sm px-1.5 py-0.5 -ml-1.5 font-medium">
                                        <Banknote className="h-3 w-3 shrink-0" />
                                        <span>입금예정</span>
                                        <AlertCircle className="h-2.5 w-2.5 shrink-0 text-red-500" />
                                      </div>
                                    )
                                  }
                                  // 부분정산 / 미정산 — 단계별 입금완료 요약 표시
                                  {
                                    // stage_summaries가 있으면 사용, 없으면 raw 메타에서 계산 (통일된 로직)
                                    const stages = (item.contract.stage_summaries && item.contract.stage_summaries.length > 0)
                                      ? item.contract.stage_summaries
                                      : computeStageSummaries(contract_amount, item.contract.settlement_meta)
                                    if (stages.length > 0) {
                                      return (
                                        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-600 bg-red-50 rounded-sm px-1.5 py-0.5 -ml-1.5 font-medium">
                                          <Banknote className="h-3 w-3 shrink-0" />
                                          {stages.map((s, i) => (
                                            <span key={s.name} className="flex items-center gap-0.5">
                                              {i > 0 && <span className="text-gray-300">·</span>}
                                              {s.status === "partial" ? `${s.name} (부분입금)` : s.name}
                                              {s.status === "paid" ? (
                                                <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-green-500">
                                                  <CheckCircle2 className="h-3 w-3 text-white" />
                                                </span>
                                              ) : s.status === "partial" ? (
                                                <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-amber-400">
                                                  <AlertCircle className="h-3 w-3 text-white" />
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-red-400">
                                                  <X className="h-2.5 w-2.5 text-white" />
                                                </span>
                                              )}
                                            </span>
                                          ))}
                                        </div>
                                      )
                                    }
                                  }
                                  if (total_paid > 0) {
                                    return (
                                      <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-600 bg-red-50 rounded-sm px-1.5 py-0.5 -ml-1.5 font-medium">
                                        <Banknote className="h-3 w-3 shrink-0" />
                                        <span>부분정산</span>
                                      </div>
                                    )
                                  }
                                  // 미정산
                                  return (
                                    <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-600 bg-red-50 rounded-sm px-1.5 py-0.5 -ml-1.5 font-medium">
                                      <Banknote className="h-3 w-3 shrink-0" />
                                      <span>미정산</span>
                                      <AlertCircle className="h-2.5 w-2.5 shrink-0 text-red-500" />
                                    </div>
                                  )
                                })()}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}

                        {/* 빈 컬럼 */}
                        {col.items.length === 0 && (
                          <div className="text-center py-8 text-[10px] text-gray-400">
                            없음
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>

                  {/* "견적 문의" 컬럼 하단에만 의뢰 생성 버튼 */}
                  {col.status === "견적 문의" && (
                    <div className="px-3 pb-3">
                      <button
                        onClick={() => setIsCreateOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-slate-400/50 bg-slate-100 text-slate-700 text-sm font-semibold hover:border-slate-400 hover:bg-slate-700/20 transition-all"
                      >
                        <Plus className="h-4 w-4 stroke-[2.5]" />
                        의뢰 생성
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            {/* ===== 우측 패널: 수주 실패 + 숨김 ===== */}
            <div className="flex flex-col w-[180px] rounded-lg bg-white shrink-0">
              {/* ── 수주 실패 섹션 ── */}
              <div className="border-b border-gray-200">
                <button
                  onClick={() => setIsFailedExpanded(!isFailedExpanded)}
                  className="w-full flex items-center justify-between px-3 py-3"
                >
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-400" />
                    <span className="text-sm font-bold text-gray-700">수주 실패</span>
                  </div>
                  <Badge className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0">
                    {failedItems.length}
                  </Badge>
                </button>

                {/* 수주 실패 항목 목록 (펼침 시) */}
                {isFailedExpanded && failedItems.length > 0 && (
                  <div className="space-y-1 px-2 pb-2">
                    {failedItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-gray-100 transition-colors text-left"
                      >
                        <span className="text-xs text-gray-700 truncate" title={item.title}>
                          {item.title}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {isFailedExpanded && failedItems.length === 0 && (
                  <div className="px-3 pb-3 text-[10px] text-gray-400">없음</div>
                )}
              </div>

              {/* ── 숨김 섹션 ── */}
              {(() => {
                // 상태별 숨김 건수 계산
                const hiddenByStatus = hiddenItems.reduce<Record<string, RequestItem[]>>((acc, item) => {
                  if (!acc[item.status]) acc[item.status] = []
                  acc[item.status].push(item)
                  return acc
                }, {})
                const statuses = ["견적 문의", "영업중", "계약 성공", "수주 실패"]

                return (
                  <>
                    <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200">
                      <EyeOff className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-bold text-gray-700">숨김</span>
                    </div>

                    <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
                      {statuses.map((status) => {
                        const groupStyle = COLUMN_STYLES[status] || COLUMN_STYLES["견적 문의"]
                        const items = hiddenByStatus[status] || []
                        const isExpanded = expandedHiddenStatus === status

                        return (
                          <div key={status}>
                            <button
                              onClick={() => setExpandedHiddenStatus(isExpanded ? null : status)}
                              className="w-full flex items-center justify-between px-2.5 py-2 rounded-md transition-colors hover:bg-gray-100 cursor-pointer"
                            >
                              <Badge className={cn("text-[10px] px-1.5 py-0", groupStyle.badge)}>
                                {status}
                              </Badge>
                              <span className="text-sm font-semibold text-gray-700">
                                {items.length}
                              </span>
                            </button>

                            {isExpanded && items.length > 0 && (
                              <div className="space-y-1 px-1 py-1.5">
                                {items.map((item) => (
                                  <label
                                    key={item.id}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-gray-100 transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={false}
                                      onChange={() => handleUnhide(item)}
                                      className="h-3.5 w-3.5 rounded border-gray-300 text-gray-500 shrink-0 cursor-pointer"
                                    />
                                    <span className="text-xs text-gray-700 truncate" title={item.title}>
                                      {item.title}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      </DragDropContext>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-sans text-lg">의뢰 삭제</DialogTitle>
            <DialogDescription className="text-sm text-gray-500 pt-2">
              <span className="font-semibold text-gray-900">
                &ldquo;{deleteTarget?.title}&rdquo;
              </span>
              을(를) 삭제하시겠습니까?
              <br />
              <span className="text-red-500 font-semibold">삭제하면 되돌릴 수 없습니다.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="px-4 py-2 text-sm rounded-md bg-red-500 text-white hover:bg-red-500/80 transition-colors disabled:opacity-50"
            >
              {isDeleting ? "삭제 중..." : "삭제"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 의뢰 생성 다이얼로그 */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateForm({ title: "", customer_id: "", inquiry_date: new Date().toISOString().split("T")[0], memo: "" })
          }
          setIsCreateOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-sans text-lg">새 의뢰 생성</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              새로운 의뢰를 등록합니다. 제목은 필수입니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 제목 (필수) */}
            <div className="space-y-2">
              <Label htmlFor="create-title" className="text-sm font-medium">
                제목 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="create-title"
                placeholder="예: OO빌딩 에어컨 설치 문의"
                value={createForm.title}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                autoFocus
              />
            </div>

            {/* 고객 선택 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">고객 <span className="text-red-500">*</span></Label>
              <button
                type="button"
                onClick={() => setIsCreateCustomerModalOpen(true)}
                className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-200 rounded-lg hover:border-slate-400/50 transition-colors"
              >
                {createForm.customer_id ? (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <Building2 className="h-3 w-3 text-slate-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {localCustomers.find((c) => c.id === createForm.customer_id)?.company_name || ""}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">고객을 연결해주세요</span>
                  </div>
                )}
                <Search className="h-4 w-4 text-gray-300" />
              </button>
            </div>

            {/* 문의 일시 */}
            <div className="space-y-2">
              <Label htmlFor="create-date" className="text-sm font-medium">문의 일시</Label>
              <Input
                id="create-date"
                type="date"
                value={createForm.inquiry_date}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, inquiry_date: e.target.value }))}
              />
            </div>

            {/* 메모 */}
            <div className="space-y-2">
              <Label htmlFor="create-memo" className="text-sm font-medium">메모</Label>
              <Textarea
                id="create-memo"
                placeholder="추가 내용을 입력하세요"
                rows={3}
                value={createForm.memo}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, memo: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => {
                setCreateForm({ title: "", customer_id: "", inquiry_date: new Date().toISOString().split("T")[0], memo: "" })
                setIsCreateOpen(false)
              }}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating || !createForm.title.trim()}
              className="px-4 py-2 text-sm rounded-md bg-slate-700 text-white hover:bg-slate-700/80 transition-colors disabled:opacity-50"
            >
              {isCreating ? "생성 중..." : "생성"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 의뢰 상세 패널 (오른쪽 슬라이드) — 단일 컬럼이므로 700px로 축소 */}
      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[700px] p-0 flex flex-col [&>button:first-child]:hidden">
          {selectedItem && (() => {
            const confirmedQuoteId = selectedItem.confirmed_quote_id
            const confirmedQuote = confirmedQuoteId
              ? quotations.find((q) => q.id === confirmedQuoteId) ?? null
              : null
            const confirmedQuoteTitle = confirmedQuote?.title ?? "미확정"
            const confirmedQuotationNumber = confirmedQuote?.quotation_number ?? "미확정"
            const confirmedTotalAmount = confirmedQuote?.total_amount ?? null
            const confirmedGrandTotal = confirmedQuote?.grand_total ?? null
            return (
              <>
                {/* 상단 헤더: ← 닫기 + [상태 배지] + 자동저장 + 삭제 + ✕ */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 bg-gradient-to-r from-slate-50/80 to-white">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <ArrowLeft className="h-5 w-5 text-gray-600" />
                    </button>
                    {/* 상태 배지 (클릭으로 변경 가능) */}
                    <InlineSelect
                      value={selectedItem.status}
                      displayValue={selectedItem.status}
                      placeholder="상태를 선택하세요"
                      options={REQUEST_STATUSES.filter((s) => s.value !== "숨김").map((s) => ({ value: s.value, label: s.label }))}
                      onConfirm={(v) => updateRequestField("status", v)}
                      badgeStyles={{
                        "견적 문의": COLUMN_STYLES["견적 문의"].badge,
                        "영업중": COLUMN_STYLES["영업중"].badge,
                        "계약 성공": COLUMN_STYLES["계약 성공"].badge,
                        "수주 실패": COLUMN_STYLES["수주 실패"].badge,
                      }}
                      align="left"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {saveMessage && (
                      <span className={cn(
                        "text-sm",
                        saveMessage.includes("실패") ? "text-red-500" : "text-green-600"
                      )}>
                        {saveMessage}
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setDeleteTarget(selectedItem)
                        setSelectedItem(null)
                      }}
                      className="px-3 py-1.5 text-sm rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      삭제하기
                    </button>
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <X className="h-5 w-5 text-gray-600" />
                    </button>
                  </div>
                </div>

                {/* 제목 + 메타 정보 (날짜 · 고객) */}
                <div className="px-6 pt-4 pb-3">
                  <SheetHeader className="mb-2">
                    <SheetTitle className="sr-only">의뢰 상세</SheetTitle>
                    <SheetDescription className="sr-only">의뢰 상세 정보</SheetDescription>
                    <InlineTitle
                      value={selectedItem.title}
                      onConfirm={(v) => {
                        if (v.trim()) updateRequestField("title", v.trim())
                      }}
                    />
                  </SheetHeader>
                  {/* 메타 정보 한 줄: 날짜 · 고객 · 생성일 — pill 칩 스타일 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-xs text-slate-600">
                      <Calendar className="h-3 w-3" />
                      {selectedItem.inquiry_date ? formatDate(selectedItem.inquiry_date) : "문의일 미지정"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-xs text-slate-600">
                      <Building2 className="h-3 w-3" />
                      {selectedItem.customer?.company_name || "고객 미연결"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 text-xs text-slate-400">
                      {formatDateTime(selectedItem.created_at).replace(/^\d{2}/, '')} 생성
                    </span>
                  </div>
                </div>

                {/* 단일 컬럼 본문: 탭 네비 + 탭 내용 */}
                <div className="flex-1 overflow-y-auto px-6 pt-2 pb-6 scrollbar-hidden">
                  <SalesFlowPanel
                    quotations={quotations}
                    onAddQuote={handleAddQuote}
                    onEditQuote={handleEditQuote}
                    confirmedQuoteId={confirmedQuoteId}
                    onToggleConfirm={handleToggleConfirmedQuote}
                    requestId={selectedItem.id}
                    requestTitle={selectedItem.title}
                    requestCustomer={selectedItem.customer}
                    requestContractId={selectedItem.contract_id}
                    onLinkContract={async (contractId) => {
                      await updateRequestField("contract_id", contractId)
                    }}
                    onSavedContract={(contractId) => {
                      void loadContractSummaryById(contractId, selectedItem.id)
                    }}
                    onSummaryChange={handleSummaryChange}
                    contractSummary={contractSummary}
                    requestedFlow={requestedFlow}
                    overviewContent={
                      /* ===== 개요 탭 내용: 고객 + 견적 + 계약 + 정산 요약 카드 ===== */
                      <div className="space-y-6">
                        {/* 고객 정보 */}
                        <CustomerPanel
                          customer={selectedItem.customer}
                          customers={localCustomers}
                          onLink={(id) => updateRequestField("customer_id", id)}
                          onUnlink={() => updateRequestField("customer_id", null)}
                          onOpenDetail={() => {
                            if (selectedItem.customer?.id) setCustomerDetailId(selectedItem.customer.id)
                          }}
                          onCreateAndLink={async (form) => {
                            const res = await fetch("/api/customers", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(form),
                            })
                            const result = await res.json()
                            if (!res.ok) throw new Error(result.error)
                            const nc = result.data
                            setLocalCustomers((prev) => [...prev, {
                              id: nc.id,
                              company_name: nc.company_name,
                              contact_name: nc.contact_name ?? null,
                              phone: nc.phone ?? null,
                              email: nc.email ?? null,
                              address: nc.address ?? null,
                              representative: nc.representative ?? null,
                              business_number: nc.business_number ?? null,
                              memo: nc.memo ?? null,
                            }])
                            const updatedItem = {
                              ...selectedItem,
                              customer: { id: nc.id, company_name: nc.company_name, deleted_at: null },
                            }
                            setSelectedItem((prev) => prev ? updatedItem : null)
                            setColumns((prev) => prev.map((col) => ({
                              ...col,
                              items: col.items.map((i) => i.id === selectedItem.id ? updatedItem : i),
                            })))
                            setSaveMessage("저장 중...")
                            try {
                              const linkRes = await fetch("/api/requests", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: selectedItem.id, customer_id: nc.id }),
                              })
                              if (!linkRes.ok) {
                                setSaveMessage("저장 실패")
                                setTimeout(() => setSaveMessage(""), 2000)
                              } else {
                                setSaveMessage("자동 저장됨")
                                setTimeout(() => setSaveMessage(""), 1500)
                              }
                            } catch {
                              setSaveMessage("저장 실패")
                              setTimeout(() => setSaveMessage(""), 2000)
                            }
                          }}
                        />

                        {/* 문의 일시 */}
                        <div className="flex items-center justify-between rounded-md px-2 -mx-2 py-1 cursor-pointer hover:bg-slate-50 transition-colors">
                          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                            <Calendar className="h-4 w-4" />
                            문의 일시
                          </span>
                          <InlineDate
                            value={selectedItem.inquiry_date || ""}
                            displayValue={selectedItem.inquiry_date ? formatDate(selectedItem.inquiry_date) : ""}
                            placeholder="날짜 선택"
                            onConfirm={(v) => updateRequestField("inquiry_date", v || null)}
                          />
                        </div>

                        {/* 확정 견적서 요약 — 클릭 시 견적 탭 이동 */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                              <FileText className="h-4 w-4" />
                              확정 견적서
                            </p>
                            {!confirmedQuoteId ? (
                              <span className="text-[10px] text-gray-400">견적서를 확정 지어주세요</span>
                            ) : confirmedTotalAmount !== null && contractSummary && Math.floor(contractSummary.totalWithVat / 1.1) !== confirmedTotalAmount ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-500"><AlertCircle className="h-3 w-3" />확정 견적금액과 계약금액이 다릅니다</span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirmedQuoteId) setRequestedFlow("견적")
                            }}
                            disabled={!confirmedQuoteId}
                            className={cn(
                              "w-full rounded-xl border border-gray-200 border-l-4 border-l-tropical-teal bg-white p-4 text-left transition-all",
                              confirmedQuoteId
                                ? "cursor-pointer hover:shadow-md hover:border-slate-400/40"
                                : "cursor-default"
                            )}
                          >
                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-lg bg-gray-50 px-3 py-3">
                                <p className="text-[11px] text-gray-400">견적서명</p>
                                <p className={cn("text-sm font-medium mt-0.5 truncate", confirmedQuote ? "text-gray-700" : "text-gray-300")}>
                                  {confirmedQuote ? confirmedQuoteTitle : "미확정"}
                                </p>
                              </div>
                              <div className="rounded-lg bg-gray-50 px-3 py-3">
                                <p className="text-[11px] text-gray-400">견적번호</p>
                                <p className={cn("text-sm font-medium mt-0.5 truncate", confirmedQuote ? "text-gray-700" : "text-gray-300")}>
                                  {confirmedQuote ? confirmedQuotationNumber : "미확정"}
                                </p>
                              </div>
                              <div className="rounded-lg bg-gray-50 px-3 py-3">
                                <p className="text-[11px] text-gray-400">VAT별도</p>
                                <p className={cn(
                                  "text-sm font-medium mt-0.5 truncate tabular-nums",
                                  confirmedQuote && confirmedTotalAmount !== null ? "text-gray-700" : "text-gray-300"
                                )}>
                                  {confirmedQuote && confirmedTotalAmount !== null ? formatCurrency(confirmedTotalAmount) : "미확정"}
                                </p>
                              </div>
                              <div className="rounded-lg bg-sky-aqua/5 px-3 py-3">
                                <p className="text-[11px] text-gray-400">VAT합계</p>
                                <p className={cn(
                                  "text-sm mt-0.5 truncate font-bold tabular-nums",
                                  confirmedQuote && confirmedGrandTotal !== null ? "text-sky-aqua" : "text-gray-300"
                                )}>
                                  {confirmedQuote && confirmedGrandTotal !== null ? formatCurrency(confirmedGrandTotal) : "미확정"}
                                </p>
                              </div>
                            </div>
                          </button>
                        </div>

                        {/* 계약 정보 요약 — 클릭 시 계약 탭 이동 */}
                        {contractSummary && (
                          <>
                            <div>
                              <div className="mb-1.5 flex items-center justify-between gap-2">
                                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                                  <Briefcase className="h-4 w-4" />
                                  계약 정보
                                </p>
                                {confirmedTotalAmount !== null && Math.floor(contractSummary.totalWithVat / 1.1) !== confirmedTotalAmount && (
                                  <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-soft-blush"><AlertCircle className="h-3.5 w-3.5" />금액 불일치</span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setRequestedFlow("계약")}
                                className="w-full rounded-xl border border-gray-200 border-l-4 border-l-muted-teal bg-white px-3 py-2.5 text-left transition-all hover:shadow-md hover:border-slate-400/40"
                              >
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="rounded-lg bg-gray-50 px-3 py-3">
                                    <p className="text-[11px] text-gray-400">VAT별도</p>
                                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-gray-700">
                                      {formatCurrency(Math.floor(contractSummary.totalWithVat / 1.1))}
                                    </p>
                                  </div>
                                  <div className="rounded-lg bg-slate-700/5 px-3 py-3">
                                    <p className="text-[11px] text-gray-400">VAT포함</p>
                                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-700">
                                      {formatCurrency(contractSummary.totalWithVat)}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            </div>

                            {/* 정산 진행률 — 클릭 시 정산 탭 이동 */}
                            <div>
                              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                                <Banknote className="h-4 w-4" />
                                정산 진행률
                              </p>
                              <button
                                type="button"
                                onClick={() => setRequestedFlow("정산")}
                                className="w-full rounded-xl border border-gray-200 border-l-4 border-l-vanilla-custard bg-white px-3 py-3 text-left transition-all hover:shadow-md hover:border-slate-400/40"
                              >
                                {/* 퍼센트 숫자 크게 표시 */}
                                <div className="flex items-end justify-between mb-2">
                                  <span className="text-2xl font-bold text-sky-aqua tabular-nums">{contractSummary.progressPercent}%</span>
                                  <span className="text-xs text-gray-400 tabular-nums">
                                    {formatCurrency(contractSummary.paidAmount)} / {formatCurrency(contractSummary.totalWithVat)}
                                  </span>
                                </div>
                                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-muted-teal/70 to-muted-teal transition-all duration-500"
                                    style={{ width: `${contractSummary.progressPercent}%` }}
                                  />
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs tabular-nums">
                                  <span className="text-muted-teal font-medium">입금 완료</span>
                                  <span className="text-soft-blush font-medium">잔여 {formatCurrency(contractSummary.unpaidAmount)}</span>
                                </div>
                              </button>
                            </div>
                          </>
                        )}

                        {/* 메모 */}
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4">
                          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 mb-1.5">
                            <FileText className="h-4 w-4" />
                            메모
                          </p>
                          <InlineEditMemo
                            value={selectedItem.memo || ""}
                            placeholder="메모를 입력하세요"
                            onConfirm={(v) => updateRequestField("memo", v || null)}
                          />
                        </div>
                      </div>
                    }
                  />
                </div>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>

      {/* 고객 상세 Sheet (의뢰 상세 위에 오버레이) */}
      <CustomerDetailSheet
        customerId={customerDetailId}
        customers={localCustomers}
        onClose={() => setCustomerDetailId(null)}
        onUpdate={(id, field, value) => {
          // localCustomers 낙관적 업데이트
          setLocalCustomers((prev) =>
            prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
          )
          // 의뢰 카드의 고객명도 동기화
          if (field === "company_name" && value) {
            setSelectedItem((prev) =>
              prev?.customer?.id === id
                ? { ...prev, customer: { ...prev.customer, company_name: value } }
                : prev
            )
            setColumns((prev) =>
              prev.map((col) => ({
                ...col,
                items: col.items.map((i) =>
                  i.customer?.id === id
                    ? { ...i, customer: { ...i.customer, company_name: value } }
                    : i
                ),
              }))
            )
          }
        }}
      />

      {/* 견적서 편집 Sheet */}
      {selectedItem && (
        <QuoteEditorSheet
          open={isQuoteSheetOpen}
          onClose={() => {
            setIsQuoteSheetOpen(false)
            setEditingQuotation(null)
          }}
          requestId={selectedItem.id}
          customerId={selectedItem.customer?.id}
          customerName={selectedItem.customer?.company_name}
          customerData={selectedItem.customer?.id
            ? localCustomers.find((c) => c.id === selectedItem.customer?.id) ?? null
            : null
          }
          quotation={editingQuotation}
          onSaved={handleQuoteSaved}
        />
      )}

      {/* 의뢰 생성용 고객 연결 모달 (카드 상세와 동일한 UX) */}
      <Dialog open={isCreateCustomerModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateCustomerModalOpen(false)
          setCreateCustomerSearch("")
          setIsCreateCustomerMode(false)
          setCreateCustomerForm({ company_name: "", contact_name: "", phone: "" })
        }
      }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-sans text-lg">고객 연결</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              기존 고객을 검색하거나, 새로운 고객을 등록하세요.
            </DialogDescription>
          </DialogHeader>

          {/* 검색 모드 */}
          {!isCreateCustomerMode && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="회사명, 담당자명으로 검색"
                  value={createCustomerSearch}
                  onChange={(e) => setCreateCustomerSearch(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400"
                />
              </div>

              <div className="max-h-[240px] overflow-y-auto border border-gray-200 rounded-lg">
                {(() => {
                  const filtered = localCustomers.filter((c) => {
                    if (!createCustomerSearch.trim()) return true
                    const q = createCustomerSearch.toLowerCase()
                    return c.company_name.toLowerCase().includes(q) || (c.contact_name && c.contact_name.toLowerCase().includes(q))
                  })
                  return filtered.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6">검색 결과가 없습니다</p>
                  ) : (
                    filtered.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setCreateForm((prev) => ({ ...prev, customer_id: c.id }))
                          setIsCreateCustomerModalOpen(false)
                          setCreateCustomerSearch("")
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0",
                          createForm.customer_id === c.id && "bg-slate-700/5"
                        )}
                      >
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          <Building2 className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{c.company_name}</p>
                          {c.contact_name && (
                            <p className="text-xs text-gray-500 truncate">{c.contact_name}</p>
                          )}
                        </div>
                      </button>
                    ))
                  )
                })()}
              </div>

              <button
                onClick={() => {
                  if (createCustomerSearch.trim()) {
                    setCreateCustomerForm((prev) => ({ ...prev, company_name: createCustomerSearch.trim() }))
                  }
                  setIsCreateCustomerMode(true)
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed border-slate-400/50 text-slate-700 text-sm font-medium hover:border-slate-400 hover:bg-slate-50 transition-all"
              >
                <Plus className="h-4 w-4" />
                새 고객 등록
              </button>
            </div>
          )}

          {/* 생성 모드 */}
          {isCreateCustomerMode && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  회사명 <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="예: (주)한국건설"
                  value={createCustomerForm.company_name}
                  onChange={(e) => setCreateCustomerForm((prev) => ({ ...prev, company_name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">담당자명</Label>
                <Input
                  placeholder="예: 홍길동"
                  value={createCustomerForm.contact_name}
                  onChange={(e) => setCreateCustomerForm((prev) => ({ ...prev, contact_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">연락처</Label>
                <Input
                  placeholder="예: 010-1234-5678"
                  value={createCustomerForm.phone}
                  onChange={(e) => setCreateCustomerForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <button
                  onClick={() => {
                    setIsCreateCustomerMode(false)
                    setCreateCustomerForm({ company_name: "", contact_name: "", phone: "" })
                  }}
                  className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  뒤로
                </button>
                <button
                  onClick={async () => {
                    if (!createCustomerForm.company_name.trim()) return
                    setIsCreatingCustomer(true)
                    try {
                      const payload: Record<string, string> = { company_name: createCustomerForm.company_name.trim() }
                      if (createCustomerForm.contact_name.trim()) payload.contact_name = createCustomerForm.contact_name.trim()
                      if (createCustomerForm.phone.trim()) payload.phone = createCustomerForm.phone.trim()
                      const res = await fetch("/api/customers", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      })
                      const result = await res.json()
                      if (res.ok && result.data) {
                        setLocalCustomers((prev) => [...prev, result.data])
                        setCreateForm((prev) => ({ ...prev, customer_id: result.data.id }))
                        setIsCreateCustomerModalOpen(false)
                        setCreateCustomerSearch("")
                        setIsCreateCustomerMode(false)
                        setCreateCustomerForm({ company_name: "", contact_name: "", phone: "" })
                      } else {
                        alert("고객 생성 실패: " + (result.error || ""))
                      }
                    } catch {
                      alert("고객 생성 중 오류가 발생했습니다")
                    }
                    setIsCreatingCustomer(false)
                  }}
                  disabled={isCreatingCustomer || !createCustomerForm.company_name.trim()}
                  className="px-4 py-2 text-sm rounded-md bg-slate-700 text-white hover:bg-slate-700/80 transition-colors disabled:opacity-50"
                >
                  {isCreatingCustomer ? "등록 중..." : "등록 후 연결"}
                </button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
