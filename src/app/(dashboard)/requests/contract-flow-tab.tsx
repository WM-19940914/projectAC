"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import { AlertCircle, Banknote, CheckCircle2, Circle, CircleDollarSign, FileSignature, Plus, Unlink, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type {
  ContractSummary,
  ContractDraft,
  PendingContractDraftSnapshot,
  SettlementStage,
  SettlementStatusInput,
  SettlementPaymentEntry,
} from "./kanban-types"
import {
  SETTLEMENT_STAGE_ORDER,
  EMPTY_STAGE_RATIOS,
  EMPTY_STAGE_SCHEDULED_DATES,
  EMPTY_STAGE_CONDITIONS,
  DEFAULT_MIDDLE_INSTALLMENTS,
} from "./kanban-types"
import {
  normalizeSettlementStatusKey,
  normalizeSettlementStatusInput,
  sanitizeSettlementStatusMap,
  hasMeaningfulSettlementStatus,
  normalizeSettlementTypes,
  createEvenRatios,
  normalizeRatios,
  normalizeMiddleInstallments,
  normalizeStageScheduledDates,
  normalizeStageConditions,
  formatStagePercent,
  buildContractSnapshot,
  buildSettlementRows,
  getTodayDateString,
  getOverdueDays,
} from "./settlement-utils"

export function ContractFlowTab({
  requestId,
  requestTitle,
  requestCustomer,
  requestContractId,
  confirmedQuoteSupplyAmount,
  onLinkContract,
  onSavedContract,
  onSummaryChange,
  activeView,
}: {
  requestId: string
  requestTitle: string
  requestCustomer: { id: string; company_name: string; deleted_at: string | null } | null
  requestContractId: string | null
  confirmedQuoteSupplyAmount: number | null
  onLinkContract: (contractId: string | null) => Promise<void>
  onSavedContract?: (contractId: string) => void
  onSummaryChange?: (summary: ContractSummary) => void
  activeView: "계약서" | "정산 현황" | "전체" | "통합"
}) {
  // 계약이 있으면 로딩 완료 전까지 진행률이 0%로 잘못 표시되는 것을 방지
  const [isLoading, setIsLoading] = useState(!!requestContractId)
  const [isSaving, setIsSaving] = useState(false)
  const [isUnlinkingContract, setIsUnlinkingContract] = useState(false)
  const [isUnlinkDialogOpen, setIsUnlinkDialogOpen] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")
  const [isAmountModalOpen, setIsAmountModalOpen] = useState(false)
  const [amountInputValue, setAmountInputValue] = useState("")
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false)
  const [isContractFormVisible, setIsContractFormVisible] = useState(!!requestContractId)
  // activeView는 외부(SalesFlowPanel)에서 제어됨 — 계약서/정산 현황 독립 탭
  const [modalStages, setModalStages] = useState<SettlementStage[]>(["잔금"])
  const [modalRatios, setModalRatios] = useState<Record<SettlementStage, number>>({ ...EMPTY_STAGE_RATIOS, 잔금: 100 })
  const [modalScheduledDates, setModalScheduledDates] = useState<Record<SettlementStage, string>>({ ...EMPTY_STAGE_SCHEDULED_DATES })
  const [modalConditions, setModalConditions] = useState<Record<SettlementStage, string>>({ ...EMPTY_STAGE_CONDITIONS })
  const [modalMiddleInstallments, setModalMiddleInstallments] = useState(DEFAULT_MIDDLE_INSTALLMENTS)
  const [stageRatios, setStageRatios] = useState<Record<SettlementStage, number>>({ ...EMPTY_STAGE_RATIOS, 잔금: 100 })
  const [stageScheduledDates, setStageScheduledDates] = useState<Record<SettlementStage, string>>({ ...EMPTY_STAGE_SCHEDULED_DATES })
  const [stageConditions, setStageConditions] = useState<Record<SettlementStage, string>>({ ...EMPTY_STAGE_CONDITIONS })
  const [middleInstallments, setMiddleInstallments] = useState(DEFAULT_MIDDLE_INSTALLMENTS)
  const [settlementStatusMap, setSettlementStatusMap] = useState<Record<string, SettlementStatusInput>>({})
  const [isSettlementStatusHydrated, setIsSettlementStatusHydrated] = useState(false)
  const initialSnapshotRef = useRef("")
  const lastSavedSnapshotRef = useRef("")
  const failedSnapshotRef = useRef<string | null>(null)
  const lastSummarySignatureRef = useRef<string>("")
  const latestPendingRef = useRef<PendingContractDraftSnapshot | null>(null)
  // 초기화 완료 여부 추적 - false 상태에서 언마운트 시 기본값으로 pending draft 덮어쓰기 방지
  const isInitializedRef = useRef(false)
  const createDefaultDraft = useCallback((): ContractDraft => ({
    id: null,
    title: `${requestTitle} 계약`,
    customer_id: requestCustomer?.id || "",
    contract_amount: 0,
    settlement_type: [SETTLEMENT_STAGE_ORDER[SETTLEMENT_STAGE_ORDER.length - 1]],
    start_date: "",
    end_date: "",
  }), [requestTitle, requestCustomer?.id])
  const [draft, setDraft] = useState<ContractDraft>(() => createDefaultDraft())

  const saveRatioToLocal = useCallback((
    key: string,
    ratio: Record<SettlementStage, number>,
    middleCount: number,
    scheduledDates: Record<SettlementStage, string>,
    conditions?: Record<SettlementStage, string>
  ) => {
    try {
      const raw = localStorage.getItem("requests:contractRatios:v1")
      const parsed = raw
        ? JSON.parse(raw) as Record<string, {
          ratios?: Record<SettlementStage, number>
          middle_installments?: number
          scheduled_dates?: Record<SettlementStage, string>
          conditions?: Record<SettlementStage, string>
        } | Record<SettlementStage, number>>
        : {}
      parsed[key] = {
        ratios: ratio,
        middle_installments: normalizeMiddleInstallments(middleCount),
        scheduled_dates: normalizeStageScheduledDates(scheduledDates),
        conditions: normalizeStageConditions(conditions),
      }
      localStorage.setItem("requests:contractRatios:v1", JSON.stringify(parsed))
    } catch {
      // localStorage 미지원 환경 무시
    }
  }, [])

  const pendingDraftKey = `requests:contractDraftPending:v1:${requestId}`
  const requestSettlementStatusKey = `requests:settlementStatus:v1:request:${requestId}`
  const contractSettlementStatusKey = draft.id
    ? `requests:settlementStatus:v1:contract:${draft.id}`
    : (requestContractId ? `requests:settlementStatus:v1:contract:${requestContractId}` : null)
  const settlementStatusStorageKey = contractSettlementStatusKey || requestSettlementStatusKey

  const loadPendingDraftFromLocal = useCallback((): PendingContractDraftSnapshot | null => {
    try {
      const raw = localStorage.getItem(pendingDraftKey)
      if (!raw) return null
      const parsed = JSON.parse(raw) as PendingContractDraftSnapshot
      if (!parsed || typeof parsed !== "object") return null
      return parsed
    } catch {
      return null
    }
  }, [pendingDraftKey])

  const savePendingDraftToLocal = useCallback((snapshot: PendingContractDraftSnapshot) => {
    try {
      localStorage.setItem(pendingDraftKey, JSON.stringify(snapshot))
    } catch {
      // localStorage 미지원 환경 무시
    }
  }, [pendingDraftKey])

  const clearPendingDraftFromLocal = useCallback(() => {
    try {
      localStorage.removeItem(pendingDraftKey)
    } catch {
      // localStorage 미지원 환경 무시
    }
  }, [pendingDraftKey])

  const loadRatioFromLocal = useCallback((key: string) => {
    try {
      const raw = localStorage.getItem("requests:contractRatios:v1")
      if (!raw) {
        return {
          ratios: null,
          middleInstallments: DEFAULT_MIDDLE_INSTALLMENTS,
          scheduledDates: { ...EMPTY_STAGE_SCHEDULED_DATES },
          conditions: { ...EMPTY_STAGE_CONDITIONS },
        }
      }
      const parsed = JSON.parse(raw) as Record<string, {
        ratios?: Record<SettlementStage, number>
        middle_installments?: number
        scheduled_dates?: Record<SettlementStage, string>
        conditions?: Record<SettlementStage, string>
      } | Record<SettlementStage, number>>
      const entry = parsed[key]
      if (!entry) {
        return {
          ratios: null,
          middleInstallments: DEFAULT_MIDDLE_INSTALLMENTS,
          scheduledDates: { ...EMPTY_STAGE_SCHEDULED_DATES },
          conditions: { ...EMPTY_STAGE_CONDITIONS },
        }
      }
      if ("ratios" in entry) {
        return {
          ratios: entry.ratios ?? null,
          middleInstallments: normalizeMiddleInstallments(entry.middle_installments),
          scheduledDates: normalizeStageScheduledDates(entry.scheduled_dates),
          conditions: normalizeStageConditions(entry.conditions),
        }
      }
      return {
        ratios: entry,
        middleInstallments: DEFAULT_MIDDLE_INSTALLMENTS,
        scheduledDates: { ...EMPTY_STAGE_SCHEDULED_DATES },
        conditions: { ...EMPTY_STAGE_CONDITIONS },
      }
    } catch {
      return {
        ratios: null,
        middleInstallments: DEFAULT_MIDDLE_INSTALLMENTS,
        scheduledDates: { ...EMPTY_STAGE_SCHEDULED_DATES },
        conditions: { ...EMPTY_STAGE_CONDITIONS },
      }
    }
  }, [])

  useEffect(() => {
    setIsContractFormVisible(!!requestContractId)
  }, [requestContractId])

  useEffect(() => {
    let cancelled = false

    const loadContract = async () => {
      const defaultDraft = createDefaultDraft()

      if (!requestContractId) {
        if (cancelled) return
        const storedConfig = loadRatioFromLocal(`request:${requestId}`)
        const nextRatios = storedConfig.ratios
          ? normalizeRatios(storedConfig.ratios, defaultDraft.settlement_type)
          : { ...EMPTY_STAGE_RATIOS, 잔금: 100 }
        const nextMiddleInstallments = normalizeMiddleInstallments(storedConfig.middleInstallments)
        const nextStageScheduledDates = normalizeStageScheduledDates(storedConfig.scheduledDates)
        const nextStageConditions = normalizeStageConditions(storedConfig.conditions)
        const pending = loadPendingDraftFromLocal()
        const pendingDraft = pending?.draft ?? null
        const pendingStages = pendingDraft
          ? SETTLEMENT_STAGE_ORDER.filter((stage) => pendingDraft.settlement_type.includes(stage))
          : []
        const resolvedDraft = pendingDraft ? {
          ...defaultDraft,
          ...pendingDraft,
          settlement_type: pendingStages.length > 0 ? pendingStages : defaultDraft.settlement_type,
        } : defaultDraft
        const resolvedRatios = pending
          ? normalizeRatios(pending.stageRatios, resolvedDraft.settlement_type)
          : nextRatios
        const resolvedMiddleInstallments = pending
          ? normalizeMiddleInstallments(pending.middleInstallments)
          : nextMiddleInstallments
        const resolvedStageScheduledDates = pending
          ? normalizeStageScheduledDates(pending.stageScheduledDates)
          : nextStageScheduledDates
        const resolvedStageConditions = pending
          ? normalizeStageConditions(pending.stageConditions)
          : nextStageConditions
        const resolvedSettlementStatusMap = pending
          ? sanitizeSettlementStatusMap(pending.settlementStatusMap)
          : {}

        setDraft(resolvedDraft)
        setStageRatios(resolvedRatios)
        setMiddleInstallments(resolvedMiddleInstallments)
        setStageScheduledDates(resolvedStageScheduledDates)
        setStageConditions(resolvedStageConditions)
        setSettlementStatusMap(resolvedSettlementStatusMap)

        const initialSnapshot = buildContractSnapshot({
          draft: defaultDraft,
          selectedStages: defaultDraft.settlement_type,
          stageRatios: nextRatios,
          middleInstallments: nextMiddleInstallments,
          stageScheduledDates: nextStageScheduledDates,
          settlementStatusMap: {},
          customerId: requestCustomer?.id || defaultDraft.customer_id || null,
        })
        initialSnapshotRef.current = initialSnapshot
        lastSavedSnapshotRef.current = initialSnapshot
        failedSnapshotRef.current = null
        isInitializedRef.current = true
        setSaveMessage("")
        return
      }

      setIsLoading(true)
      setSaveMessage("")
      try {
        const res = await fetch(`/api/contracts?id=${requestContractId}`)
        const result = await res.json()
        if (!res.ok || !result.success) throw new Error(result.error || "계약 조회 실패")

        const contract = result.data as Record<string, unknown>
        const settlementTypes = normalizeSettlementTypes(contract.settlement_type)
        const nextDraft: ContractDraft = {
          id: String(contract.id || requestContractId),
          title: typeof contract.title === "string" && contract.title.trim() ? contract.title : `${requestTitle} 계약`,
          customer_id: typeof contract.customer_id === "string" ? contract.customer_id : (requestCustomer?.id || ""),
          contract_amount: Math.max(0, Math.round(Number(contract.contract_amount || 0))),
          settlement_type: settlementTypes.length > 0 ? settlementTypes : ["잔금"],
          start_date: typeof contract.start_date === "string" ? contract.start_date : "",
          end_date: typeof contract.end_date === "string" ? contract.end_date : "",
        }

        if (cancelled) return
        const storedByContract = loadRatioFromLocal(`contract:${requestContractId}`)
        const storedByRequest = loadRatioFromLocal(`request:${requestId}`)
        const storedConfig = storedByContract.ratios ? storedByContract : storedByRequest
        const contractMeta = (
          contract.contract_meta && typeof contract.contract_meta === "object"
            ? contract.contract_meta as Record<string, unknown>
            : null
        )
        const hasMetaRatios = !!(contractMeta && contractMeta.stage_ratios && typeof contractMeta.stage_ratios === "object")
        const nextRatios = hasMetaRatios
          ? normalizeRatios(contractMeta?.stage_ratios, nextDraft.settlement_type)
          : (
            storedConfig.ratios
              ? normalizeRatios(storedConfig.ratios, nextDraft.settlement_type)
              : createEvenRatios(nextDraft.settlement_type)
          )
        const nextMiddleInstallments = hasMetaRatios
          ? normalizeMiddleInstallments(contractMeta?.middle_installments)
          : normalizeMiddleInstallments(storedConfig.middleInstallments)
        const nextStageScheduledDates = contractMeta
          ? normalizeStageScheduledDates(contractMeta.stage_scheduled_dates)
          : normalizeStageScheduledDates(storedConfig.scheduledDates)
        const nextStageConditions = contractMeta
          ? normalizeStageConditions(contractMeta.stage_conditions)
          : normalizeStageConditions(storedConfig.conditions)
        const nextSettlementStatusFromDb = contractMeta
          ? sanitizeSettlementStatusMap(contractMeta.settlement_status_map)
          : {}
        const pending = loadPendingDraftFromLocal()
        const pendingDraft = pending?.draft ?? null
        const pendingDraftId = pendingDraft && typeof pendingDraft.id === "string" && pendingDraft.id.trim()
          ? pendingDraft.id
          : null
        const pendingStages = pendingDraft
          ? SETTLEMENT_STAGE_ORDER.filter((stage) => pendingDraft.settlement_type.includes(stage))
          : []
        const canApplyPending = !!pendingDraft && !!pendingDraftId && pendingDraftId === nextDraft.id
        const resolvedDraft = canApplyPending ? {
          ...nextDraft,
          ...pendingDraft,
          settlement_type: pendingStages.length > 0 ? pendingStages : nextDraft.settlement_type,
        } : nextDraft
        const resolvedRatios = canApplyPending && pending
          ? normalizeRatios(pending.stageRatios, resolvedDraft.settlement_type)
          : nextRatios
        const resolvedMiddleInstallments = canApplyPending && pending
          ? normalizeMiddleInstallments(pending.middleInstallments)
          : nextMiddleInstallments
        const resolvedStageScheduledDates = canApplyPending && pending
          ? normalizeStageScheduledDates(pending.stageScheduledDates)
          : nextStageScheduledDates
        const resolvedStageConditions = canApplyPending && pending
          ? normalizeStageConditions(pending.stageConditions)
          : nextStageConditions
        // settlement_status_map은 항상 DB 데이터를 우선 — pending draft가 confirmed 등을 오염시키지 않도록
        const resolvedSettlementStatusMap = Object.keys(nextSettlementStatusFromDb).length > 0
          ? nextSettlementStatusFromDb
          : (canApplyPending && pending ? sanitizeSettlementStatusMap(pending.settlementStatusMap) : {})

        if (pending && pendingDraft && !pendingDraftId) {
          // id 없는 stale pending이 기존 계약 DB를 덮지 않도록 정리
          clearPendingDraftFromLocal()
        }

        setDraft(resolvedDraft)
        setStageRatios(resolvedRatios)
        setMiddleInstallments(resolvedMiddleInstallments)
        setStageScheduledDates(resolvedStageScheduledDates)
        setStageConditions(resolvedStageConditions)
        setSettlementStatusMap(resolvedSettlementStatusMap)

        if (nextDraft.id && Object.keys(nextSettlementStatusFromDb).length > 0) {
          try {
            localStorage.setItem(
              `requests:settlementStatus:v1:contract:${nextDraft.id}`,
              JSON.stringify(nextSettlementStatusFromDb)
            )
          } catch {
            // localStorage 미지원 환경 무시
          }
        }

        const initialSnapshot = buildContractSnapshot({
          draft: nextDraft,
          selectedStages: nextDraft.settlement_type,
          stageRatios: nextRatios,
          middleInstallments: nextMiddleInstallments,
          stageScheduledDates: nextStageScheduledDates,
          settlementStatusMap: nextSettlementStatusFromDb,
          customerId: requestCustomer?.id || nextDraft.customer_id || null,
        })
        initialSnapshotRef.current = initialSnapshot
        lastSavedSnapshotRef.current = initialSnapshot
        failedSnapshotRef.current = null
        isInitializedRef.current = true
      } catch {
        if (cancelled) return
        setDraft(defaultDraft)
        setStageRatios({ ...EMPTY_STAGE_RATIOS, 잔금: 100 })
        setMiddleInstallments(DEFAULT_MIDDLE_INSTALLMENTS)
        setStageScheduledDates({ ...EMPTY_STAGE_SCHEDULED_DATES })
        setStageConditions({ ...EMPTY_STAGE_CONDITIONS })
        setSettlementStatusMap({})
        const initialSnapshot = buildContractSnapshot({
          draft: defaultDraft,
          selectedStages: defaultDraft.settlement_type,
          stageRatios: { ...EMPTY_STAGE_RATIOS, 잔금: 100 },
          middleInstallments: DEFAULT_MIDDLE_INSTALLMENTS,
          stageScheduledDates: { ...EMPTY_STAGE_SCHEDULED_DATES },
          settlementStatusMap: {},
          customerId: requestCustomer?.id || defaultDraft.customer_id || null,
        })
        initialSnapshotRef.current = initialSnapshot
        lastSavedSnapshotRef.current = initialSnapshot
        failedSnapshotRef.current = null
        isInitializedRef.current = true
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    // 새로운 init 시작 시 초기화 완료 플래그 리셋
    isInitializedRef.current = false
    loadContract()
    return () => { cancelled = true }
  }, [requestContractId, requestCustomer?.id, requestId, requestTitle, createDefaultDraft, loadRatioFromLocal, loadPendingDraftFromLocal, clearPendingDraftFromLocal])

  const selectedStages = SETTLEMENT_STAGE_ORDER.filter((stage) => draft.settlement_type.includes(stage))
  const supplyAmount = Math.max(0, Math.round(Number(draft.contract_amount || 0)))
  const totalWithVat = supplyAmount + Math.floor(supplyAmount * 0.1)
  const settlementRows = buildSettlementRows(supplyAmount, selectedStages, stageRatios, middleInstallments)
  const settlementRowsWithScheduledDate = settlementRows.map((row) => {
    let scheduledDate = ""
    if (row.key === "선금") scheduledDate = stageScheduledDates.선금
    else if (row.key === "잔금") scheduledDate = stageScheduledDates.잔금
    else if (row.key === "중도금" || row.key.startsWith("middle-")) scheduledDate = stageScheduledDates.중도금
    return {
      ...row,
      scheduledDate,
    }
  })
  const settlementStatusRows = settlementRows.map((row) => {
    const status = normalizeSettlementStatusInput(settlementStatusMap[row.key])
    const plannedAmount = Math.max(0, Math.round(Number(row.total || 0)))
    const actualAmount = Math.max(0, Math.round(Number(status.actual_amount || 0)))
    const paymentConfirmed = plannedAmount > 0
      ? actualAmount >= plannedAmount
      : (actualAmount > 0 || status.payment_confirmed)
    const paymentStatusLabel = paymentConfirmed
      ? "정산완료"
      : actualAmount > 0
        ? (status.has_upcoming ? "부분정산 (입금예정)" : "부분정산")
        : (status.has_upcoming ? "입금예정" : "미정산")
    let scheduledDate = ""
    if (row.key === "선금") scheduledDate = stageScheduledDates.선금
    else if (row.key === "잔금") scheduledDate = stageScheduledDates.잔금
    else if (row.key === "중도금" || row.key.startsWith("middle-")) scheduledDate = stageScheduledDates.중도금
    return {
      key: row.key,
      label: row.label,
      ratio: row.ratio,
      paymentConfirmed,
      paymentStatusLabel,
      paymentEntries: status.payment_entries,
      plannedAmount,
      actualAmount,
      shortfallAmount: Math.max(0, plannedAmount - actualAmount),
      scheduledDate,
      receivedDate: status.received_date,
      taxInvoiceIssued: status.tax_invoice_issued,
      taxInvoiceDate: status.tax_invoice_date,
      overdueDays: !paymentConfirmed ? getOverdueDays(scheduledDate) : 0,
    }
  })

  const paidAmount = settlementStatusRows.reduce((sum, row) => sum + row.actualAmount, 0)
  const clampedPaid = Math.min(Math.max(0, paidAmount), totalWithVat)
  const unpaidAmount = Math.max(0, totalWithVat - clampedPaid)
  const progressPercent = totalWithVat > 0
    ? Math.min(100, Math.round((clampedPaid / totalWithVat) * 100))
    : 0
  const allEntries = settlementStatusRows.flatMap((row) => row.paymentEntries)
  const confirmedEntryCount = allEntries.length
  const allConfirmed = allEntries.length > 0
  const stageCount = settlementStatusRows.length
  const issuedCount = settlementStatusRows.filter((row) => row.taxInvoiceIssued).length
  const taxInvoiceAllIssued = stageCount > 0 && issuedCount === stageCount
  const taxInvoiceSomeIssued = issuedCount > 0 && issuedCount < stageCount
  const overdueCount = settlementStatusRows.filter((row) => row.overdueDays > 0).length
  const nextPendingStage = settlementStatusRows.find((row) => !row.paymentConfirmed) ?? null

  // 통합 입금내역 플랫 리스트 (모든 단계 합산)
  const allPaymentEntriesFlat = settlementStatusRows.flatMap((row) =>
    row.paymentEntries.map((entry) => ({
      ...entry,
      stageKey: row.key,
      stageLabel: row.label,
      stagePlannedAmount: row.plannedAmount,
    }))
  )

  useEffect(() => {
    if (!onSummaryChange) return
    // 데이터 로딩 중에는 기본값(0%)으로 덮어쓰지 않음
    if (isLoading) return

    // 단계별 입금완료 요약
    const stageSummariesForCard = settlementStatusRows.map((row) => {
      const rowPaid = row.paymentEntries.reduce((sum, e) => sum + e.amount, 0)
      const plannedAmount = row.plannedAmount
      const stageStatus: "paid" | "partial" | "unpaid" =
        rowPaid >= plannedAmount && plannedAmount > 0 ? "paid"
        : rowPaid > 0 ? "partial"
        : "unpaid"
      return { name: row.label, status: stageStatus }
    })
    const stagesKey = stageSummariesForCard.map((s) => `${s.name}:${s.status}`).join(",")

    const signature = `${totalWithVat}|${clampedPaid}|${unpaidAmount}|${progressPercent}|${allConfirmed}|${taxInvoiceAllIssued}|${taxInvoiceSomeIssued}|${stagesKey}`
    if (lastSummarySignatureRef.current === signature) return
    lastSummarySignatureRef.current = signature

    onSummaryChange({
      totalWithVat,
      paidAmount: clampedPaid,
      unpaidAmount,
      progressPercent,
      allConfirmed,
      taxInvoiceAllIssued,
      taxInvoiceSomeIssued,
      stageSummaries: stageSummariesForCard,
    })
  }, [
    allConfirmed,
    clampedPaid,
    draft.id,
    isLoading,
    onSummaryChange,
    requestContractId,
    settlementStatusRows,
    taxInvoiceAllIssued,
    taxInvoiceSomeIssued,
    totalWithVat,
    unpaidAmount,
    progressPercent,
  ])
  const stageSummary = selectedStages.length > 0
    ? selectedStages.map((stage) => (
      stage === "중도금"
        ? `${stage} ${formatStagePercent(stageRatios[stage])}% (${middleInstallments}회)`
        : `${stage} ${formatStagePercent(stageRatios[stage])}%`
    )).join(" · ")
    : "정산 형태를 설정해주세요."
  const modalSelectedRatioSum = modalStages.reduce((sum, stage) => {
    const value = Number(modalRatios[stage] ?? 0)
    return sum + (Number.isFinite(value) ? value : 0)
  }, 0)

  const canSave = draft.title.trim().length > 0 && !isSaving && !isUnlinkingContract
  const isPersistedContract = !!draft.id
  const saveSnapshot = buildContractSnapshot({
    draft,
    selectedStages,
    stageRatios,
    middleInstallments,
    stageScheduledDates,
    stageConditions,
    settlementStatusMap,
    customerId: requestCustomer?.id || draft.customer_id || null,
  })

  useEffect(() => {
    latestPendingRef.current = {
      draft,
      stageRatios,
      middleInstallments,
      stageScheduledDates,
      stageConditions,
      settlementStatusMap,
    }
  }, [draft, stageRatios, middleInstallments, stageScheduledDates, stageConditions, settlementStatusMap])

  useEffect(() => {
    return () => {
      // 초기화 완료된 상태에서만 저장 - 초기화 중 언마운트 시 기본값으로 덮어쓰기 방지
      if (latestPendingRef.current && isInitializedRef.current) {
        savePendingDraftToLocal(latestPendingRef.current)
      }
    }
  }, [savePendingDraftToLocal])

  useEffect(() => {
    if (isLoading) return
    // 초기화 완료 전에는 pending draft도 저장하지 않음
    if (!isInitializedRef.current) return
    if (!initialSnapshotRef.current) return

    if (saveSnapshot === lastSavedSnapshotRef.current) {
      clearPendingDraftFromLocal()
      return
    }

    savePendingDraftToLocal({
      draft,
      stageRatios,
      middleInstallments,
      stageScheduledDates,
      stageConditions,
      settlementStatusMap,
    })
  }, [
    isLoading,
    saveSnapshot,
    draft,
    stageRatios,
    middleInstallments,
    stageScheduledDates,
    stageConditions,
    settlementStatusMap,
    clearPendingDraftFromLocal,
    savePendingDraftToLocal,
  ])

  useEffect(() => {
    setIsSettlementStatusHydrated(false)
    try {
      const raw = localStorage.getItem(settlementStatusStorageKey)
      const parsed = raw ? sanitizeSettlementStatusMap(JSON.parse(raw)) : {}
      setSettlementStatusMap((prev) => {
        if (hasMeaningfulSettlementStatus(prev) && !hasMeaningfulSettlementStatus(parsed)) {
          return prev
        }
        return parsed
      })
    } catch {
      setSettlementStatusMap((prev) => (hasMeaningfulSettlementStatus(prev) ? prev : {}))
    } finally {
      setIsSettlementStatusHydrated(true)
    }
  }, [settlementStatusStorageKey])

  useEffect(() => {
    if (!contractSettlementStatusKey) return
    if (requestContractId) return
    try {
      const existingContractData = localStorage.getItem(contractSettlementStatusKey)
      if (existingContractData) return
      const requestData = localStorage.getItem(requestSettlementStatusKey)
      if (!requestData) return
      localStorage.setItem(contractSettlementStatusKey, requestData)
      const copied = sanitizeSettlementStatusMap(JSON.parse(requestData))
      setSettlementStatusMap((prev) => {
        if (hasMeaningfulSettlementStatus(prev) && !hasMeaningfulSettlementStatus(copied)) {
          return prev
        }
        return copied
      })
    } catch {
      // localStorage 미지원 환경 무시
    }
  }, [contractSettlementStatusKey, requestSettlementStatusKey, requestContractId])

  useEffect(() => {
    setSettlementStatusMap((prev) => {
      const next: Record<string, SettlementStatusInput> = {}
      let changed = Object.keys(prev).length !== settlementStatusRows.length

      settlementStatusRows.forEach((row) => {
        const prevValue = prev[row.key]
        const normalized = normalizeSettlementStatusInput(prevValue)
        if (
          !prevValue ||
          prevValue.payment_confirmed !== normalized.payment_confirmed ||
          prevValue.actual_amount !== normalized.actual_amount ||
          prevValue.received_date !== normalized.received_date ||
          prevValue.tax_invoice_issued !== normalized.tax_invoice_issued ||
          prevValue.tax_invoice_date !== normalized.tax_invoice_date ||
          JSON.stringify(prevValue.payment_entries ?? []) !== JSON.stringify(normalized.payment_entries)
        ) {
          changed = true
        }
        next[row.key] = normalized
      })

      return changed ? next : prev
    })
  }, [settlementStatusRows])

  useEffect(() => {
    if (!isSettlementStatusHydrated) return
    try {
      localStorage.setItem(settlementStatusStorageKey, JSON.stringify(settlementStatusMap))
    } catch {
      // localStorage 미지원 환경 무시
    }
  }, [isSettlementStatusHydrated, settlementStatusStorageKey, settlementStatusMap])

  const updateSettlementStatus = useCallback((rowKey: string, patch: Partial<SettlementStatusInput>) => {
    const normalizedRowKey = normalizeSettlementStatusKey(rowKey)
    setSettlementStatusMap((prev) => {
      const current = normalizeSettlementStatusInput(prev[normalizedRowKey])
      const merged = {
        ...current,
        ...patch,
      }
      const normalizedMerged = normalizeSettlementStatusInput(merged)
      return {
        ...prev,
        [normalizedRowKey]: normalizedMerged,
      }
    })
  }, [])

  const addSettlementPaymentEntry = useCallback((rowKey: string) => {
    const normalizedRowKey = normalizeSettlementStatusKey(rowKey)
    const nextEntry: SettlementPaymentEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      amount: 0,
      paid_at: getTodayDateString(),
      note: "",
      confirmed: true,
    }
    setSettlementStatusMap((prev) => {
      const current = normalizeSettlementStatusInput(prev[normalizedRowKey])
      if (current.payment_entries.some((entry) => entry.id === nextEntry.id)) {
        return prev
      }
      const nextEntries = [
        ...current.payment_entries,
        nextEntry,
      ]
      const normalized = normalizeSettlementStatusInput({
        ...current,
        payment_entries: nextEntries,
      })
      return {
        ...prev,
        [normalizedRowKey]: normalized,
      }
    })
  }, [])

  const updateSettlementPaymentEntry = useCallback((
    rowKey: string,
    entryId: string,
    patch: Partial<SettlementPaymentEntry>
  ) => {
    const normalizedRowKey = normalizeSettlementStatusKey(rowKey)
    setSettlementStatusMap((prev) => {
      const current = normalizeSettlementStatusInput(prev[normalizedRowKey])
      const nextEntries = current.payment_entries.map((entry) =>
        entry.id === entryId
          ? {
            ...entry,
            ...patch,
            amount: Number.isFinite(Number((patch.amount ?? entry.amount)))
              ? Math.max(0, Math.round(Number((patch.amount ?? entry.amount))))
              : 0,
            paid_at: typeof (patch.paid_at ?? entry.paid_at) === "string"
              ? String(patch.paid_at ?? entry.paid_at)
              : "",
            note: typeof (patch.note ?? entry.note) === "string"
              ? String(patch.note ?? entry.note)
              : "",
            confirmed: patch.confirmed ?? entry.confirmed ?? false,
          }
          : entry
      )
      const normalized = normalizeSettlementStatusInput({
        ...current,
        payment_entries: nextEntries,
      })
      return {
        ...prev,
        [normalizedRowKey]: normalized,
      }
    })
  }, [])

  const removeSettlementPaymentEntry = useCallback((rowKey: string, entryId: string) => {
    const normalizedRowKey = normalizeSettlementStatusKey(rowKey)
    setSettlementStatusMap((prev) => {
      const current = normalizeSettlementStatusInput(prev[normalizedRowKey])
      const nextEntries = current.payment_entries.filter((entry) => entry.id !== entryId)
      // 엔트리가 모두 삭제되면 actual_amount/received_date도 리셋 (레거시 복원 방지)
      const normalized = normalizeSettlementStatusInput({
        ...current,
        payment_entries: nextEntries,
        actual_amount: nextEntries.length > 0 ? current.actual_amount : 0,
        received_date: nextEntries.length > 0 ? current.received_date : "",
      })
      return {
        ...prev,
        [normalizedRowKey]: normalized,
      }
    })
  }, [])

  const openAmountModal = () => {
    // VAT포함 금액으로 표시
    setAmountInputValue(totalWithVat > 0 ? totalWithVat.toLocaleString("ko-KR") : "")
    setIsAmountModalOpen(true)
  }

  const handleApplyAmount = () => {
    const digitsOnly = amountInputValue.replace(/[^0-9]/g, "")
    const next = digitsOnly ? Number(digitsOnly) : 0
    // 입력값은 VAT포함 → 공급가(VAT제외)로 변환하여 저장
    const vatIncluded = Number.isFinite(next) ? Math.max(0, Math.round(next)) : 0
    const nextAmount = Math.round(vatIncluded / 1.1)
    setDraft((prev) => (prev.contract_amount === nextAmount ? prev : { ...prev, contract_amount: nextAmount }))
    // 계약금액 변경 시 입금내역은 유지 (이미 입력된 정산 데이터 보존)
    setIsAmountModalOpen(false)
  }

  const openSettlementModal = () => {
    const normalized: SettlementStage[] = selectedStages.length > 0 ? selectedStages : ["잔금"]
    setModalStages(normalized)
    setModalRatios(normalizeRatios(stageRatios, normalized))
    setModalScheduledDates(normalizeStageScheduledDates(stageScheduledDates))
    setModalConditions(normalizeStageConditions(stageConditions))
    setModalMiddleInstallments(middleInstallments)
    setIsSettlementModalOpen(true)
  }

  const handleToggleModalStage = (stage: SettlementStage) => {
    setModalStages((prev) => {
      const next = prev.includes(stage)
        ? prev.filter((s) => s !== stage)
        : [...prev, stage]
      const normalized = SETTLEMENT_STAGE_ORDER.filter((s) => next.includes(s))
      if (!normalized.includes("중도금")) {
        setModalMiddleInstallments(DEFAULT_MIDDLE_INSTALLMENTS)
      }
      setModalScheduledDates((prevDates) => {
        const nextDates = { ...prevDates }
        if (!normalized.includes(stage)) {
          nextDates[stage] = ""
        }
        return nextDates
      })
      setModalConditions((prevConds) => {
        const nextConds = { ...prevConds }
        if (!normalized.includes(stage)) {
          nextConds[stage] = ""
        }
        return nextConds
      })
      setModalRatios((prevRatios) => {
        if (normalized.length === 0) return { ...EMPTY_STAGE_RATIOS }
        const nextRatios = { ...EMPTY_STAGE_RATIOS }
        normalized.forEach((key) => {
          const parsed = Number(prevRatios[key] ?? 0)
          nextRatios[key] = Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : 0
        })
        if (normalized.length === 1) {
          nextRatios[normalized[0]] = 100
        }
        return nextRatios
      })
      return normalized
    })
  }

  const handleApplySettlement = () => {
    if (modalStages.length === 0 || modalSelectedRatioSum > 100) return
    const normalized = SETTLEMENT_STAGE_ORDER.filter((stage) => modalStages.includes(stage))
    const hasSettlementTypeChanged =
      normalized.length !== selectedStages.length ||
      normalized.some((stage, idx) => stage !== selectedStages[idx])
    setDraft((prev) => ({ ...prev, settlement_type: normalized }))
    setStageRatios(normalizeRatios(modalRatios, normalized))
    setStageScheduledDates(() => {
      const base = { ...EMPTY_STAGE_SCHEDULED_DATES }
      normalized.forEach((stage) => {
        base[stage] = modalScheduledDates[stage] || ""
      })
      return base
    })
    setStageConditions(() => {
      const base = { ...EMPTY_STAGE_CONDITIONS }
      normalized.forEach((stage) => {
        base[stage] = modalConditions[stage] || ""
      })
      return base
    })
    setMiddleInstallments(
      normalized.includes("중도금")
        ? normalizeMiddleInstallments(modalMiddleInstallments)
        : DEFAULT_MIDDLE_INSTALLMENTS
    )
    if (hasSettlementTypeChanged) {
      // Reset settlement status when settlement type composition changes.
      setSettlementStatusMap({})
    }
    setIsSettlementModalOpen(false)
  }

  const handleSave = useCallback(async (mode: "manual" | "auto" = "manual") => {
    if (!canSave || isLoading || isSaving) return
    // 초기화 완료 전 자동저장 차단 — HMR/탭 전환 시 기본값으로 덮어쓰기 방지
    if (mode === "auto" && !isInitializedRef.current) return
    const isUpdate = !!draft.id
    if (mode === "auto" && !isUpdate) return
    if (mode === "auto" && failedSnapshotRef.current === saveSnapshot) return
    if (isUpdate && saveSnapshot === lastSavedSnapshotRef.current) {
      if (mode === "manual") {
        setSaveMessage("변경사항 없음")
        setTimeout(() => setSaveMessage(""), 1200)
      }
      return
    }

    setIsSaving(true)
    setSaveMessage(mode === "manual" ? "즉시 저장 중..." : "자동 저장 중...")
    try {
      const selectedStageRatios = normalizeRatios(stageRatios, selectedStages)
      const selectedStageScheduledDates = selectedStages.reduce((acc, stage) => ({
        ...acc,
        [stage]: stageScheduledDates[stage] || "",
      }), {} as Record<SettlementStage, string>)
      const settlementStatusForSave = settlementRows.reduce((acc, row) => ({
        ...acc,
        [row.key]: normalizeSettlementStatusInput(settlementStatusMap[row.key]),
      }), {} as Record<string, SettlementStatusInput>)

      const payload = {
        title: draft.title.trim(),
        request_id: requestId,
        customer_id: requestCustomer?.id || draft.customer_id || null,
        contract_amount: supplyAmount,
        settlement_type: selectedStages,
        start_date: draft.start_date || null,
        end_date: draft.end_date || null,
        contract_meta: {
          stage_ratios: selectedStageRatios,
          middle_installments: normalizeMiddleInstallments(middleInstallments),
          stage_scheduled_dates: selectedStageScheduledDates,
          stage_conditions: selectedStages.reduce((acc, stage) => ({
            ...acc,
            [stage]: stageConditions[stage] || "",
          }), {} as Record<SettlementStage, string>),
          settlement_status_map: settlementStatusForSave,
        },
      }

      const res = await fetch("/api/contracts", {
        method: isUpdate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isUpdate ? { id: draft.id, ...payload } : payload),
      })
      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.error || "계약 저장 실패")

      const saved = result.data as { id: string }
      setDraft((prev) => ({ ...prev, id: saved.id }))
      saveRatioToLocal(`request:${requestId}`, stageRatios, middleInstallments, stageScheduledDates, stageConditions)
      saveRatioToLocal(`contract:${saved.id}`, stageRatios, middleInstallments, stageScheduledDates, stageConditions)

      if (!requestContractId || requestContractId !== saved.id) {
        await onLinkContract(saved.id)
      }
      // Avoid stale overwrite during frequent autosaves.
      // For update saves, keep using in-memory realtime summary; only refetch on new link/create.
      if (!isUpdate || !requestContractId || requestContractId !== saved.id) {
        onSavedContract?.(saved.id)
      }

      setIsContractFormVisible(true)
      lastSavedSnapshotRef.current = saveSnapshot
      clearPendingDraftFromLocal()
      failedSnapshotRef.current = null
      setSaveMessage(mode === "manual" ? "즉시 저장됨" : "자동 저장됨")
      setTimeout(() => setSaveMessage(""), 1500)
    } catch (error) {
      const message = error instanceof Error ? error.message : "저장 실패"
      failedSnapshotRef.current = saveSnapshot
      setSaveMessage(`저장 실패: ${message}`)
      setTimeout(() => {
        setSaveMessage((prev) => (prev.startsWith("저장 실패") ? prev : ""))
      }, 2500)
    } finally {
      setIsSaving(false)
    }
  }, [
    canSave,
    isLoading,
    isSaving,
    saveSnapshot,
    draft,
    requestCustomer?.id,
    supplyAmount,
    selectedStages,
    requestId,
    stageRatios,
    middleInstallments,
    stageScheduledDates,
    settlementStatusMap,
    settlementRows,
    requestContractId,
    onLinkContract,
    onSavedContract,
    saveRatioToLocal,
    clearPendingDraftFromLocal,
  ])

  const handleUnlinkContract = useCallback(async () => {
    if (!draft.id || isUnlinkingContract) return
    const targetId = draft.id
    setIsUnlinkingContract(true)
    setSaveMessage("연결 해제 및 삭제 중...")
    try {
      const res = await fetch(`/api/contracts?id=${targetId}`, { method: "DELETE" })
      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.error || "계약 삭제 실패")
      }

      try {
        localStorage.removeItem(`requests:settlementStatus:v1:contract:${targetId}`)
        const ratioRaw = localStorage.getItem("requests:contractRatios:v1")
        if (ratioRaw) {
          const ratioMap = JSON.parse(ratioRaw) as Record<string, unknown>
          delete ratioMap[`contract:${targetId}`]
          localStorage.setItem("requests:contractRatios:v1", JSON.stringify(ratioMap))
        }
      } catch {
        // localStorage 미지원 환경 무시
      }

      await onLinkContract(null)
      clearPendingDraftFromLocal()

      const defaultDraft = createDefaultDraft()
      const defaultStage = SETTLEMENT_STAGE_ORDER[SETTLEMENT_STAGE_ORDER.length - 1]
      const defaultRatios = { ...EMPTY_STAGE_RATIOS, [defaultStage]: 100 } as Record<SettlementStage, number>
      const defaultDates = { ...EMPTY_STAGE_SCHEDULED_DATES }

      setDraft(defaultDraft)
      setStageRatios(defaultRatios)
      setMiddleInstallments(DEFAULT_MIDDLE_INSTALLMENTS)
      setStageScheduledDates(defaultDates)
      setStageConditions({ ...EMPTY_STAGE_CONDITIONS })
      setSettlementStatusMap({})
      setIsContractFormVisible(false)

      const initialSnapshot = buildContractSnapshot({
        draft: defaultDraft,
        selectedStages: defaultDraft.settlement_type,
        stageRatios: defaultRatios,
        middleInstallments: DEFAULT_MIDDLE_INSTALLMENTS,
        stageScheduledDates: defaultDates,
        settlementStatusMap: {},
        customerId: requestCustomer?.id || defaultDraft.customer_id || null,
      })
      initialSnapshotRef.current = initialSnapshot
      lastSavedSnapshotRef.current = initialSnapshot
      failedSnapshotRef.current = null

      setSaveMessage("연결 해제 및 삭제됨")
      setTimeout(() => setSaveMessage(""), 1500)
    } catch (error) {
      const message = error instanceof Error ? error.message : "연결 해제/삭제 실패"
      setSaveMessage(`해제 실패: ${message}`)
      setTimeout(() => {
        setSaveMessage((prev) => (prev.startsWith("해제 실패") ? prev : ""))
      }, 2500)
    } finally {
      setIsUnlinkingContract(false)
    }
  }, [
    draft.id,
    isUnlinkingContract,
    onLinkContract,
    clearPendingDraftFromLocal,
    createDefaultDraft,
    requestCustomer?.id,
  ])

  // 최신 handleSave를 ref로 유지 — 언마운트 시 클로저 문제 방지
  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave
  const saveSnapshotRef = useRef(saveSnapshot)
  saveSnapshotRef.current = saveSnapshot

  useEffect(() => {
    if (!isPersistedContract) return
    if (!canSave || isLoading) return
    // 초기화 완료 전 자동저장 스케줄링 차단
    if (!isInitializedRef.current) return
    if (!initialSnapshotRef.current) return
    if (saveSnapshot === lastSavedSnapshotRef.current) return
    if (failedSnapshotRef.current === saveSnapshot) return

    const timer = setTimeout(() => {
      void handleSave("auto")
    }, 700)

    return () => clearTimeout(timer)
  }, [isPersistedContract, canSave, isLoading, saveSnapshot, handleSave])

  // 컴포넌트 언마운트 시 미저장 변경사항 즉시 저장 (패널 닫힘 등)
  useEffect(() => {
    return () => {
      if (!isInitializedRef.current) return
      if (!initialSnapshotRef.current) return
      if (saveSnapshotRef.current === lastSavedSnapshotRef.current) return
      if (failedSnapshotRef.current === saveSnapshotRef.current) return
      void handleSaveRef.current("auto")
    }
  }, [])

  // "전체" 모드: 계약서 + 정산 현황을 2컬럼 그리드로 동시 표시
  const showContract = activeView === "계약서" || activeView === "전체"
  const showSettlement = activeView === "정산 현황" || activeView === "전체"
  const showIntegrated = activeView === "통합"

  return (
    <div className={cn(activeView === "전체" && "grid grid-cols-2 gap-6 items-start", activeView === "통합" && "contents")}>
      {showContract && (
        isLoading ? (
          <div className="py-8 text-center">
            <p className="text-xs text-gray-400">계약 정보를 불러오는 중...</p>
          </div>
        ) : (
    <div className="space-y-3">
      {/* 계약 미생성 → 생성 버튼 */}
      {!isContractFormVisible && (
        <div className="py-6 text-center">
          <p className="text-xs text-gray-400 mb-2">계약 정보 없음</p>
          <button
            type="button"
            onClick={() => { void handleSave("manual") }}
            disabled={!canSave || isUnlinkingContract}
            className="inline-flex h-7 items-center justify-center rounded bg-slate-700 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {isSaving ? "생성 중..." : "계약 생성"}
          </button>
        </div>
      )}

      {/* 계약 폼 — 플랫 레이아웃 */}
      <div className={cn("space-y-2", !isContractFormVisible && "hidden")}>
        {/* 계약 제목 + 삭제 — 보더리스 인라인 */}
        <div className="flex items-center gap-1">
          <input
            id="contract-title"
            value={draft.title}
            onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="계약 제목"
            className="flex-1 min-w-0 text-xs font-medium text-gray-800 bg-transparent border-0 border-b border-transparent focus:border-gray-300 focus:outline-none py-0.5 px-0 placeholder:text-gray-300 truncate"
          />
          {isPersistedContract && (
            <button
              type="button"
              onClick={() => setIsUnlinkDialogOpen(true)}
              disabled={isUnlinkingContract}
              title="계약 삭제"
              className="inline-flex h-5 w-5 items-center justify-center rounded text-gray-300 hover:text-red-400 transition-colors shrink-0"
            >
              <Unlink className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* 날짜 + 금액 — 1행, 보더리스 */}
        <div className="flex items-center">
          <div className="flex items-center gap-1 shrink-0">
            <label className="text-[10px] text-gray-400 shrink-0">착수</label>
            <input
              id="contract-start"
              type="date"
              value={draft.start_date}
              onChange={(e) => setDraft((prev) => ({ ...prev, start_date: e.target.value }))}
              className="h-6 w-[105px] bg-transparent border-0 border-b border-transparent focus:border-gray-300 focus:outline-none px-0 text-right text-xs text-gray-600 [&::-webkit-calendar-picker-indicator]:ml-1.5 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-80"
            />
          </div>
          <span className="text-sm text-gray-300 shrink-0 mx-3">~</span>
          <div className="flex items-center gap-1 shrink-0">
            <label className="text-[10px] text-gray-400 shrink-0">종료</label>
            <input
              id="contract-end"
              type="date"
              value={draft.end_date}
              onChange={(e) => setDraft((prev) => ({ ...prev, end_date: e.target.value }))}
              className="h-6 w-[105px] bg-transparent border-0 border-b border-transparent focus:border-gray-300 focus:outline-none px-0 text-right text-xs text-gray-600 [&::-webkit-calendar-picker-indicator]:ml-1.5 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-80"
            />
          </div>
          <div className="w-px h-5 bg-gray-200 shrink-0" />
          <Popover open={isAmountModalOpen} onOpenChange={setIsAmountModalOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={openAmountModal}
                title="계약금액 (VAT포함)"
                className="text-sm font-semibold tabular-nums text-gray-800 hover:text-slate-600 transition-colors shrink-0 whitespace-nowrap"
              >
                {totalWithVat > 0 ? formatCurrency(totalWithVat) : "금액 입력"}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" side="bottom" sideOffset={4} className="w-52 border-gray-200 p-2.5">
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={typeof confirmedQuoteSupplyAmount !== "number"}
                  onClick={() => {
                    if (typeof confirmedQuoteSupplyAmount === "number" && confirmedQuoteSupplyAmount >= 0) {
                      const vatIncluded = Math.round(confirmedQuoteSupplyAmount) + Math.floor(Math.round(confirmedQuoteSupplyAmount) * 0.1)
                      setAmountInputValue(vatIncluded.toLocaleString("ko-KR"))
                    }
                  }}
                  className="inline-flex h-7 w-full items-center justify-center rounded border border-gray-200 text-[10px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  금액 불러오기(VAT포함)
                </button>
                <Input
                  id="contract-amount-editor"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9,]*"
                  value={amountInputValue}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/[^0-9]/g, "")
                    setAmountInputValue(digitsOnly ? Number(digitsOnly).toLocaleString("ko-KR") : "")
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleApplyAmount()
                    }
                  }}
                  placeholder="0"
                  className="h-7 border-gray-200 text-sm font-semibold text-right tabular-nums focus:ring-slate-300"
                />
                <p className="text-right text-[10px] text-gray-400">VAT 포함 금액</p>
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsAmountModalOpen(false)}
                    className="px-2 py-1 text-[10px] rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyAmount}
                    className="px-2 py-1 text-[10px] rounded bg-slate-700 text-white hover:bg-slate-700/90"
                  >
                    적용
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* 정산 형태 + VAT포함 — 1행 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">정산</span>
            <span className="text-[11px] text-gray-600">{stageSummary}</span>
            <button
              type="button"
              onClick={openSettlementModal}
              className="text-[10px] text-slate-600 font-medium hover:text-slate-800 underline underline-offset-2"
            >
              변경
            </button>
          </div>
          {supplyAmount > 0 && (
            <span className="text-[11px] font-medium text-gray-600 shrink-0">
              VAT포함 {formatCurrency(totalWithVat)}
            </span>
          )}
        </div>

        {/* 정산 테이블 — 미니멀 */}
        {settlementRows.length > 0 && (
          <div className="text-[11px]">
            {settlementRowsWithScheduledDate.map((row) => {
              // 단계별 비율 표시: "선금" → "선금30%", "중도금 1차" → "중도금 1차 (40%)"
              const stageKey = row.key === "선금" ? "선금" : row.key === "잔금" ? "잔금" : "중도금"
              const ratio = stageRatios[stageKey as keyof typeof stageRatios] ?? 0
              const labelWithRatio = row.key.startsWith("middle-")
                ? `${row.label} (${formatStagePercent(ratio)}%)`
                : `${row.label} ${formatStagePercent(ratio)}%`
              return (
              <div key={row.key} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-b-0">
                <span className="text-gray-600">{labelWithRatio}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">{row.scheduledDate || ""}</span>
                  <span className="font-medium tabular-nums text-gray-700">{formatCurrency(row.total)}</span>
                </div>
              </div>
              )
            })}
          </div>
        )}

        {/* 저장 상태 */}
        <div className="flex items-center justify-between gap-2">
          <p className={cn("text-[10px]", saveMessage.includes("실패") ? "text-red-500" : "text-gray-400")}>
            {saveMessage || (isPersistedContract ? "자동 저장" : "")}
          </p>
          {isPersistedContract && (
            <button
              type="button"
              onClick={() => { void handleSave("manual") }}
              disabled={!canSave}
              className="text-[10px] text-slate-600 font-medium hover:text-slate-800 underline underline-offset-2 disabled:opacity-40 disabled:no-underline"
            >
              {isSaving ? "저장 중..." : "즉시 저장"}
            </button>
          )}
          {!isPersistedContract && (
            <button
              type="button"
              onClick={() => { void handleSave("manual") }}
              disabled={!canSave || isUnlinkingContract}
              className="inline-flex h-7 items-center justify-center rounded bg-slate-700 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              {isSaving ? "생성 중..." : "계약 생성"}
            </button>
          )}
        </div>
      </div>

    </div>
        )
      )}

      {showSettlement && (
        isLoading ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-10 text-center">
            <p className="text-sm font-medium text-gray-500">정산 현황을 불러오는 중입니다.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-700">총 계약금액</p>
                <p className="text-sm font-bold tabular-nums text-slate-700">
                  {formatCurrency(totalWithVat)} <span className="text-[10px] font-semibold align-middle">VAT포함</span>
                </p>
              </div>
            </div>

            {settlementStatusRows.map((row) => (
              <div
                key={row.key}
                className={cn(
                  "rounded-xl border bg-white px-3 py-2.5 space-y-2 transition-colors",
                  row.overdueDays > 0
                    ? "border-red-300/60 bg-red-500/10 ring-1 ring-red-300/25"
                    : row.paymentConfirmed
                      ? "border-slate-400/60 bg-slate-700/10 ring-1 ring-slate-300/20"
                      : "border-gray-200"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="truncate text-[11px] font-semibold text-gray-700">{row.label} <span className="font-normal text-slate-400">{row.ratio}%</span></p>
                    <span className={cn(
                      "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold",
                      row.paymentConfirmed
                        ? "border-slate-400/40 bg-slate-100 text-slate-700"
                        : row.actualAmount > 0
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : row.paymentStatusLabel === "입금예정"
                            ? "border-amber-400 bg-amber-100/20 text-amber-600"
                            : "border-gray-200 bg-gray-50 text-gray-500"
                    )}>
                      {row.paymentStatusLabel}
                    </span>
                    <span className="shrink-0 text-[9px] text-gray-400">정산예정일 {row.scheduledDate || "-"}</span>
                    {row.overdueDays > 0 && (
                      <span className="inline-flex shrink-0 items-center rounded-full border border-red-300 bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
                        D+{row.overdueDays}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-bold tabular-nums text-gray-700">{formatCurrency(row.plannedAmount)}</p>
                    <p className="text-[9px] text-gray-400">VAT포함</p>
                  </div>
                </div>

                {/* 계산서 발행 여부 + 발행일 (입금내역 위에 배치) */}
                <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50/80 px-2.5 py-1.5">
                  <div className="inline-flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const nextIssued = !row.taxInvoiceIssued
                        const updates: Partial<SettlementStatusInput> = { tax_invoice_issued: nextIssued }
                        if (nextIssued && !row.taxInvoiceDate) {
                          updates.tax_invoice_date = new Date().toISOString().split("T")[0]
                        }
                        if (!nextIssued) updates.tax_invoice_date = ""
                        updateSettlementStatus(row.key, updates)
                      }}
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-lg border transition-colors",
                        row.taxInvoiceIssued
                          ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                          : "border-slate-200 text-slate-300 hover:border-slate-300 hover:text-slate-600"
                      )}
                    >
                      {row.taxInvoiceIssued ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    </button>
                    <span className="text-[10px] text-gray-500">계산서 {row.taxInvoiceIssued ? "발행완료" : "미발행"}</span>
                  </div>
                  {row.taxInvoiceIssued && (
                    <input
                      type="date"
                      value={row.taxInvoiceDate || ""}
                      onChange={(e) => updateSettlementStatus(row.key, { tax_invoice_date: e.target.value })}
                      className="h-6 rounded border border-gray-200 bg-white px-1.5 text-[10px] tabular-nums text-gray-600 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
                    />
                  )}
                </div>

                {/* 정산금액 / 정산완료일 — 입금내역에서 자동 계산 (읽기전용 요약) */}
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400">정산금액</span>
                      <span className={cn(
                        "text-[11px] font-bold tabular-nums",
                        row.actualAmount > 0 ? "text-gray-800" : "text-gray-300"
                      )}>
                        {row.actualAmount > 0 ? formatCurrency(row.actualAmount) : "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400">완료일</span>
                      <span className={cn(
                        "text-[10px]",
                        row.receivedDate ? "text-gray-600" : "text-gray-300"
                      )}>
                        {row.receivedDate || "—"}
                      </span>
                    </div>
                  </div>
                  {row.shortfallAmount > 0 && (
                    <span className="text-[10px] font-medium text-red-500">
                      미정산 {formatCurrency(row.shortfallAmount)}
                    </span>
                  )}
                </div>

                {/* 입금내역 — 메인 입력 영역 */}
                <div className="space-y-1.5 rounded-lg border border-gray-100 bg-gray-50/60 px-2.5 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium text-gray-500">입금내역 <span className="text-gray-400 font-normal">(VAT포함)</span></p>
                    <button
                      type="button"
                      onClick={() => addSettlementPaymentEntry(row.key)}
                      className="inline-flex items-center gap-0.5 rounded-md border border-slate-400/30 bg-slate-700/5 px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-700/15 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      추가
                    </button>
                  </div>

                  {row.paymentEntries.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => addSettlementPaymentEntry(row.key)}
                      className="w-full rounded-md border border-dashed border-gray-200 bg-white py-3 text-center text-[10px] text-gray-400 hover:border-slate-400/40 hover:text-slate-700 transition-colors"
                    >
                      <Plus className="inline h-3 w-3 mr-0.5 -mt-0.5" />
                      입금내역을 추가하면 정산금액이 자동 계산됩니다
                    </button>
                  ) : (
                    <div className="space-y-1.5">
                      {row.paymentEntries.map((entry, index) => (
                        <div key={entry.id} className="flex items-center gap-2">
                          {/* 입금 아이콘 */}
                          <span className="shrink-0 text-[11px] font-bold text-slate-400">￦</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9,]*"
                            value={entry.amount > 0 ? entry.amount.toLocaleString("ko-KR") : ""}
                            onChange={(e) => {
                              const digitsOnly = e.target.value.replace(/[^0-9]/g, "")
                              const nextAmount = digitsOnly ? Number(digitsOnly) : 0
                              updateSettlementPaymentEntry(row.key, entry.id, {
                                amount: Number.isFinite(nextAmount) ? Math.max(0, Math.round(nextAmount)) : 0,
                              })
                            }}
                            placeholder="금액 입력"
                            className="h-7 min-w-0 flex-1 border-0 border-b border-gray-200 bg-transparent px-0 text-left text-[10px] font-semibold tabular-nums text-gray-700 outline-none focus:border-slate-400"
                          />
                          {/* 계획금액 자동입력 버튼: 누르면 해당 단계 VAT포함 금액이 채워짐 */}
                          <button
                            type="button"
                            onClick={() => updateSettlementPaymentEntry(row.key, entry.id, { amount: row.plannedAmount })}
                            className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-slate-700 ring-1 ring-slate-300/40 hover:bg-slate-50"
                            title="클릭하면 이 금액이 자동 입력됩니다"
                          >
                            자동입력
                          </button>
                          <input
                            type="date"
                            value={entry.paid_at}
                            onChange={(e) => updateSettlementPaymentEntry(row.key, entry.id, { paid_at: e.target.value })}
                            className="h-7 w-[118px] border-0 border-b border-gray-200 bg-transparent px-0 text-right text-[10px] text-gray-600 outline-none focus:border-slate-400"
                          />
                          <button
                            type="button"
                            onClick={() => removeSettlementPaymentEntry(row.key, entry.id)}
                            className="inline-flex h-6 w-6 items-center justify-center text-gray-400 hover:text-red-500"
                            aria-label={`입금내역 ${index + 1} 삭제`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>
        )
      )}

      {/* ===== 통합 뷰: 계약정보 | 정산 현황 (부모 grid에 직접 배치) ===== */}
      {showIntegrated && isLoading && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-center py-12">
            <p className="text-xs text-gray-400">불러오는 중...</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-center py-12">
            <p className="text-xs text-gray-400">불러오는 중...</p>
          </div>
        </>
      )}
      {showIntegrated && !isLoading && (
        <>
            {/* ── 계약 정보 ── */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm min-h-0 flex flex-col">
              <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><FileSignature className="h-3.5 w-3.5 text-slate-400" />계약 정보</p>
                {isPersistedContract && (
                  <button
                    type="button"
                    onClick={() => setIsUnlinkDialogOpen(true)}
                    disabled={isUnlinkingContract}
                    title="계약 삭제"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-300 transition-colors hover:border-red-200 hover:text-red-500"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 transparent" }}>
              {!isContractFormVisible ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
                  <p className="text-sm text-slate-500">계약 정보 없음</p>
                  <button
                    type="button"
                    onClick={() => { void handleSave("manual") }}
                    disabled={!canSave || isUnlinkingContract}
                    className="mt-3 inline-flex h-9 items-center justify-center rounded-xl bg-slate-900 px-4 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
                  >
                    {isSaving ? "생성 중..." : "계약 생성"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* 계약 제목 */}
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="계약 제목"
                    className="w-full border-0 border-b border-slate-200 bg-transparent px-0 py-1.5 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-300 focus:border-slate-400"
                  />

                  {/* 착수/종료 + 계약금액 — 가로 한줄 */}
                  <div className="flex items-center">
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] text-slate-400">착수</span>
                      <input
                        type="date"
                        value={draft.start_date}
                        onChange={(e) => setDraft((prev) => ({ ...prev, start_date: e.target.value }))}
                        className="h-7 w-[105px] border-0 border-b border-slate-200 bg-transparent px-0 text-right text-xs text-slate-600 outline-none focus:border-slate-400 [&::-webkit-calendar-picker-indicator]:ml-1.5 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-80"
                      />
                    </div>
                    <span className="text-sm text-slate-300 shrink-0 mx-3">~</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] text-slate-400">종료</span>
                      <input
                        type="date"
                        value={draft.end_date}
                        onChange={(e) => setDraft((prev) => ({ ...prev, end_date: e.target.value }))}
                        className="h-7 w-[105px] border-0 border-b border-slate-200 bg-transparent px-0 text-right text-xs text-slate-600 outline-none focus:border-slate-400 [&::-webkit-calendar-picker-indicator]:ml-1.5 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-80"
                      />
                    </div>
                  </div>

                  {/* 계약금액 + 정산구조 — 2컬럼 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-400">계약금액 (VAT포함)</p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900 truncate">
                          {totalWithVat > 0 ? `${formatCurrency(totalWithVat)}원` : "미입력"}
                        </p>
                      </div>
                      <Popover open={isAmountModalOpen} onOpenChange={setIsAmountModalOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            onClick={openAmountModal}
                            className="inline-flex h-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 px-2 text-[11px] font-medium text-slate-500 hover:border-slate-300 hover:bg-white"
                          >
                            수정
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" side="bottom" sideOffset={4} className="w-56 border-slate-200 p-3">
                          <div className="space-y-2.5">
                            <button
                              type="button"
                              disabled={typeof confirmedQuoteSupplyAmount !== "number"}
                              onClick={() => {
                                if (typeof confirmedQuoteSupplyAmount === "number" && confirmedQuoteSupplyAmount >= 0) {
                                  // 확정 견적 공급가 → VAT포함 금액으로 변환
                                  const vatIncluded = Math.round(confirmedQuoteSupplyAmount) + Math.floor(Math.round(confirmedQuoteSupplyAmount) * 0.1)
                                  setAmountInputValue(vatIncluded.toLocaleString("ko-KR"))
                                }
                              }}
                              className="inline-flex h-8 w-full items-center justify-center rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            >
                              금액 불러오기(VAT포함)
                            </button>
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9,]*"
                              value={amountInputValue}
                              onChange={(e) => {
                                const digitsOnly = e.target.value.replace(/[^0-9]/g, "")
                                setAmountInputValue(digitsOnly ? Number(digitsOnly).toLocaleString("ko-KR") : "")
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  handleApplyAmount()
                                }
                              }}
                              placeholder="0"
                              className="h-9 border-slate-200 text-right text-sm font-semibold tabular-nums focus:ring-slate-300"
                            />
                            <p className="text-right text-[10px] text-slate-400">VAT 포함 금액</p>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setIsAmountModalOpen(false)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-500 hover:bg-slate-50"
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                onClick={handleApplyAmount}
                                className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] text-white hover:bg-slate-800"
                              >
                                적용
                              </button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-400">정산 구조</p>
                        <p className="mt-0.5 truncate text-xs text-slate-700">{stageSummary}</p>
                      </div>
                      <button
                        type="button"
                        onClick={openSettlementModal}
                        className="inline-flex h-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 px-2 text-[11px] font-medium text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                      >
                        변경
                      </button>
                    </div>
                  </div>

                  {/* 정산 구조별 금액 테이블 */}
                  {settlementRowsWithScheduledDate.length > 0 && supplyAmount > 0 && (
                    <div className="rounded-lg border border-slate-100 overflow-hidden">
                      {/* 테이블 헤더 */}
                      <div className="grid grid-cols-[1fr_90px_24px_120px] items-center bg-slate-50 px-3 py-1.5 text-[10px] font-medium text-slate-400">
                        <span>단계</span>
                        <span className="text-right pr-1">금액(VAT포함)</span>
                        <span />
                        <span className="text-center">입금예정일</span>
                      </div>
                      {/* 테이블 본문 */}
                      {settlementRowsWithScheduledDate.map((row) => {
                        const stageKey = row.key === "선금" ? "선금" : row.key === "잔금" ? "잔금" : "중도금"
                        const conditionKey = stageKey as SettlementStage
                        const ratio = stageRatios[stageKey as keyof typeof stageRatios] ?? 0
                        // row.total = supply + vat (이미 VAT 포함)
                        const labelWithRatio = row.key.startsWith("middle-")
                          ? `${row.label} (${formatStagePercent(ratio)}%)`
                          : `${row.label} ${formatStagePercent(ratio)}%`
                        const conditionText = stageConditions[conditionKey] || ""
                        const hasDate = !!row.scheduledDate
                        return (
                          <div key={row.key} className="grid grid-cols-[1fr_90px_24px_120px] items-center px-3 py-1.5 border-t border-slate-100 text-[11px]">
                            <span className="text-slate-600">{labelWithRatio}</span>
                            <span className="font-medium tabular-nums text-slate-700 text-right pr-1">{formatCurrency(row.total)}원</span>
                            <span className="flex justify-center"><span className="h-4 w-px bg-slate-200" /></span>
                            {/* 입금예정일 — 미입력 시 연한 핑크, 조건 hover 시 툴팁 */}
                            <div className="relative group flex justify-center">
                              <input
                                type="date"
                                value={row.scheduledDate || ""}
                                onChange={(e) => {
                                  const dateStageKey = row.key === "선금" ? "선금" : row.key === "잔금" ? "잔금" : "중도금"
                                  setStageScheduledDates((prev) => ({ ...prev, [dateStageKey]: e.target.value }))
                                }}
                                className={cn(
                                  "h-6 w-[110px] rounded border px-1.5 text-center text-[11px] tabular-nums outline-none focus:bg-white",
                                  hasDate
                                    ? "border-transparent bg-slate-50/80 text-slate-600 hover:border-slate-300 focus:border-slate-400"
                                    : "border-red-100 bg-red-50/40 text-slate-400 hover:border-red-200 focus:border-red-300"
                                )}
                              />
                              {conditionText && (
                                <div className="pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 px-2.5 py-1 text-[10px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                                  {conditionText}
                                  <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {/* 합계 */}
                      <div className="grid grid-cols-[1fr_90px_24px_120px] items-center px-3 py-1.5 border-t border-slate-300/50 bg-slate-50/50 text-[11px]">
                        <span className="text-slate-500 font-medium">합계</span>
                        <span className="font-semibold tabular-nums text-slate-900 text-right pr-1">{formatCurrency(totalWithVat)}원</span>
                        <span />
                        <span />
                      </div>
                    </div>
                  )}

                  {/* 계약 미생성 시 생성 버튼 */}
                  {!isPersistedContract && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => { void handleSave("manual") }}
                        disabled={!canSave || isUnlinkingContract}
                        className="inline-flex h-8 w-full items-center justify-center rounded-lg bg-slate-900 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
                      >
                        {isSaving ? "생성 중..." : "계약 생성"}
                      </button>
                    </div>
                  )}
                  {saveMessage.includes("실패") && (
                    <p className="text-[11px] text-red-500">{saveMessage}</p>
                  )}
                </div>
              )}
              </div>
            </div>

            {/* ── 정산 현황 ── */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm min-h-0 flex flex-col">
              <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3 shrink-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><CircleDollarSign className="h-3.5 w-3.5 text-slate-400" />정산 현황</p>
                {overdueCount > 0 && (
                  <span className="inline-flex h-6 items-center rounded-full bg-red-100 px-2 text-[10px] font-medium text-red-700">
                    지연 {overdueCount}건
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 transparent" }}>
              {!isContractFormVisible ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
                  <p className="text-xs text-slate-400">계약 생성 후 표시됩니다</p>
                </div>
              ) : settlementStatusRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
                  <p className="text-xs text-slate-400">정산 단계가 설정되지 않았습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* 수금 프로그레스 */}
                  <div>
                    <div className="flex items-center justify-between mb-1 text-[11px]">
                      <span className="font-semibold text-slate-900">{progressPercent}%</span>
                      <span className="text-slate-400 tabular-nums">{formatCurrency(clampedPaid)} / {formatCurrency(totalWithVat)}원 <span className="text-[9px]">(VAT포함)</span></span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${progressPercent}%` }} />
                    </div>
                    {unpaidAmount > 0 && (
                      <p className="mt-1 text-right text-[10px] text-slate-400">미수금 <span className="tabular-nums font-medium text-slate-600">{formatCurrency(unpaidAmount)}원</span></p>
                    )}
                  </div>

                  {/* 단계별 정산 카드 */}
                  {settlementStatusRows.map((row) => {
                    const issued = row.taxInvoiceIssued
                    return (
                      <div
                        key={row.key}
                        className={cn(
                          "rounded-lg border overflow-hidden transition-colors",
                          row.overdueDays > 0
                            ? "border-soft-blush/40 bg-soft-blush/5"
                            : row.paymentConfirmed
                              ? "border-muted-teal/30 bg-muted-teal/5"
                              : "border-slate-200"
                        )}
                      >
                        {/* 헤더: 단계명 비율% + 금액(VAT포함) + 상태 */}
                        <div className={cn(
                          "flex items-center justify-between gap-2 px-3 py-2",
                          row.paymentConfirmed ? "bg-muted-teal/5" : "bg-slate-50/70"
                        )}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[11px] font-bold text-slate-800">{row.label} <span className="font-normal text-slate-400">{row.ratio}%</span></span>
                            <span className={cn(
                              "inline-flex h-[18px] shrink-0 items-center rounded-full px-1.5 text-[9px] font-semibold",
                              row.paymentConfirmed
                                ? "bg-muted-teal/15 text-muted-teal"
                                : row.actualAmount > 0
                                  ? "bg-vanilla-custard/20 text-vanilla-custard"
                                  : "bg-slate-100 text-slate-400"
                            )}>
                              {row.paymentStatusLabel}
                            </span>
                            {row.overdueDays > 0 && (
                              <span className="text-[9px] font-bold text-soft-blush">D+{row.overdueDays}</span>
                            )}
                          </div>
                          <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-700">
                            {formatCurrency(row.plannedAmount)}
                          </span>
                        </div>

                        <div className="px-3 py-2 space-y-2">
                          {/* 계산서 발행 여부 + 발행일 */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="inline-flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextIssued = !issued
                                  const updates: Partial<SettlementStatusInput> = { tax_invoice_issued: nextIssued }
                                  if (nextIssued && !row.taxInvoiceDate) {
                                    updates.tax_invoice_date = new Date().toISOString().split("T")[0]
                                  }
                                  if (!nextIssued) updates.tax_invoice_date = ""
                                  updateSettlementStatus(row.key, updates)
                                }}
                                className={cn(
                                  "inline-flex h-6 w-6 items-center justify-center rounded-lg border transition-colors",
                                  issued
                                    ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                                    : "border-slate-200 text-slate-300 hover:border-slate-300 hover:text-slate-600"
                                )}
                              >
                                {issued ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                              </button>
                              <span className="text-[10px] text-slate-500">계산서 {issued ? "발행완료" : "미발행"}</span>
                            </div>
                            {issued && (
                              <input
                                type="date"
                                value={row.taxInvoiceDate || ""}
                                onChange={(e) => updateSettlementStatus(row.key, { tax_invoice_date: e.target.value })}
                                className="h-6 rounded border border-slate-200 bg-white px-1.5 text-[10px] tabular-nums text-slate-600 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
                              />
                            )}
                          </div>

                          {/* 구분선 */}
                          <div className="border-t border-dashed border-slate-100" />

                          {/* 입금내역 (VAT포함) */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-medium text-slate-500">입금내역 <span className="text-slate-400 font-normal">(VAT포함)</span></span>
                              <button
                                type="button"
                                onClick={() => addSettlementPaymentEntry(row.key)}
                                className="inline-flex h-5 items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 text-[9px] font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-colors"
                              >
                                <Plus className="h-2.5 w-2.5" />
                                추가
                              </button>
                            </div>
                            {row.paymentEntries.length === 0 ? (
                              <button
                                type="button"
                                onClick={() => addSettlementPaymentEntry(row.key)}
                                className="w-full rounded-md border border-dashed border-slate-200 bg-slate-50/50 py-2.5 text-center text-[10px] text-slate-400 hover:border-slate-300 hover:text-slate-600 transition-colors"
                              >
                                입금내역을 추가하세요
                              </button>
                            ) : (
                              <div className="space-y-1">
                                {row.paymentEntries.map((entry, index) => (
                                  <div key={entry.id} className="flex items-center gap-1.5">
                                    {/* 입금 아이콘 */}
                                    <span className="shrink-0 text-[11px] font-bold text-slate-400">￦</span>
                                    {/* 금액 입력 */}
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={entry.amount > 0 ? entry.amount.toLocaleString("ko-KR") : ""}
                                      onChange={(e) => {
                                        const digitsOnly = e.target.value.replace(/[^0-9]/g, "")
                                        updateSettlementPaymentEntry(row.key, entry.id, {
                                          amount: digitsOnly ? Math.max(0, Math.round(Number(digitsOnly))) : 0,
                                        })
                                      }}
                                      placeholder="금액"
                                      className={cn(
                                        "min-w-0 flex-1 border-0 bg-transparent px-0 text-[11px] font-semibold tabular-nums text-slate-900 outline-none placeholder:text-slate-300"
                                      )}
                                    />
                                    {/* 자동입력 버튼 */}
                                    <button
                                      type="button"
                                      onClick={() => updateSettlementPaymentEntry(row.key, entry.id, { amount: row.plannedAmount })}
                                      className="shrink-0 rounded px-1 py-0.5 text-[8px] font-bold text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-700"
                                      title={`${formatCurrency(row.plannedAmount)}원 자동입력`}
                                    >
                                      자동
                                    </button>
                                    {/* 입금일 */}
                                    <input
                                      type="date"
                                      value={entry.paid_at}
                                      onChange={(e) => updateSettlementPaymentEntry(row.key, entry.id, { paid_at: e.target.value })}
                                      className="h-5 w-[100px] shrink-0 border-0 bg-transparent px-0 text-right text-[10px] tabular-nums text-slate-500 outline-none"
                                    />
                                    {/* 삭제 */}
                                    <button
                                      type="button"
                                      onClick={() => removeSettlementPaymentEntry(row.key, entry.id)}
                                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-slate-300 hover:bg-soft-blush/10 hover:text-soft-blush transition-colors"
                                      aria-label={`입금내역 ${index + 1} 삭제`}
                                    >
                                      <X className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* 정산 요약 */}
                            {row.paymentEntries.length > 0 && (
                              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-100 text-[10px]">
                                <span className="text-slate-400">
                                  정산 <span className="font-medium tabular-nums text-slate-600">{formatCurrency(row.actualAmount)}원</span>
                                </span>
                                {row.shortfallAmount > 0 && (
                                  <span className="font-medium text-soft-blush">
                                    미수금 {formatCurrency(row.shortfallAmount)}원
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              </div>
            </div>
        </>
      )}

      {/* ===== 공용 Dialog — 모든 activeView에서 접근 가능 ===== */}
      <Dialog open={isUnlinkDialogOpen} onOpenChange={setIsUnlinkDialogOpen}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader>
            <DialogTitle className="text-sm">연결 해제 및 계약 삭제</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              현재 카드의 연결을 해제하고 계약 정보도 함께 삭제합니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setIsUnlinkDialogOpen(false)}
              className="px-3 py-1.5 text-xs rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                setIsUnlinkDialogOpen(false)
                void handleUnlinkContract()
              }}
              className="px-3 py-1.5 text-xs rounded-md bg-red-500 text-white hover:bg-red-500/90"
            >
              확인
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSettlementModalOpen} onOpenChange={setIsSettlementModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-sans text-base">정산 형태 설정</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              체크박스로 단계를 선택하고 비율(%)과 정산예정일을 설정하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5">
            {SETTLEMENT_STAGE_ORDER.map((stage) => {
              const checked = modalStages.includes(stage)
              return (
                <div key={stage} className="flex items-start justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleModalStage(stage)}
                      className="h-3.5 w-3.5 rounded border-slate-400 accent-slate-700 focus:ring-2 focus:ring-slate-300/60"
                    />
                    <span className={cn("text-sm", checked ? "text-gray-700" : "text-gray-400")}>{stage}</span>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={checked ? (modalRatios[stage] === 0 ? "" : String(modalRatios[stage])) : ""}
                        placeholder="0"
                        disabled={!checked}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                          if (!checked) return
                          const digitsOnly = e.target.value.replace(/[^0-9]/g, "")
                          const nextValue = digitsOnly ? Number(digitsOnly) : 0
                          setModalRatios((prev) => ({
                            ...prev,
                            [stage]: Number.isFinite(nextValue) ? Math.max(0, Math.min(100, Math.round(nextValue))) : 0,
                          }))
                        }}
                        className={cn(
                          "h-7 w-16 rounded-md border px-2 text-right text-xs tabular-nums focus:outline-none",
                          checked
                            ? "border-gray-300 bg-white focus:ring-2 focus:ring-slate-300/50"
                            : "border-gray-200 bg-gray-100 text-gray-300"
                        )}
                      />
                      <span className={cn("text-[10px]", checked ? "text-gray-500" : "text-gray-300")}>%</span>
                      {stage === "중도금" && checked && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500">회차</span>
                          <select
                            value={modalMiddleInstallments}
                            onChange={(e) => setModalMiddleInstallments(normalizeMiddleInstallments(e.target.value))}
                            className="h-7 rounded-md border border-gray-300 bg-white px-1.5 text-[10px] text-gray-600 focus:outline-none focus:ring-2 focus:ring-slate-300/50"
                          >
                            {[1, 2, 3, 4, 5].map((count) => (
                              <option key={count} value={count}>{count}회</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <span className={cn("text-[10px]", checked ? "text-gray-500" : "text-gray-300")}>예정일</span>
                      <input
                        type="date"
                        value={checked ? modalScheduledDates[stage] : ""}
                        disabled={!checked}
                        onChange={(e) => {
                          if (!checked) return
                          setModalScheduledDates((prev) => ({
                            ...prev,
                            [stage]: e.target.value,
                          }))
                        }}
                        className={cn(
                          "h-7 rounded-md border px-2 text-[10px] focus:outline-none",
                          checked
                            ? "border-gray-300 bg-white text-gray-600 focus:ring-2 focus:ring-slate-300/50"
                            : "border-gray-200 bg-gray-100 text-gray-300"
                        )}
                      />
                    </div>
                    {/* 입금 조건 (예: "계약후 7일이내") */}
                    <div className="flex items-center gap-1.5">
                      <span className={cn("shrink-0 text-[10px]", checked ? "text-gray-500" : "text-gray-300")}>입금조건</span>
                      <input
                        type="text"
                        value={checked ? modalConditions[stage] : ""}
                        disabled={!checked}
                        placeholder={stage === "선금" ? "계약후 7일이내" : stage === "중도금" ? "선배관 완료후 7일이내" : "시운전 완료후 7일이내"}
                        onChange={(e) => {
                          if (!checked) return
                          setModalConditions((prev) => ({
                            ...prev,
                            [stage]: e.target.value,
                          }))
                        }}
                        className={cn(
                          "h-7 min-w-0 flex-1 rounded-md border px-2 text-[10px] focus:outline-none",
                          checked
                            ? "border-gray-300 bg-white text-gray-600 placeholder:text-gray-300 focus:ring-2 focus:ring-slate-300/50"
                            : "border-gray-200 bg-gray-100 text-gray-300 placeholder:text-gray-200"
                        )}
                      />
                    </div>
                  </div>
                </div>
              )
            })}

          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setIsSettlementModalOpen(false)}
              className="px-3 py-1.5 text-xs rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleApplySettlement}
              disabled={modalStages.length === 0 || modalSelectedRatioSum > 100}
              className="px-3 py-1.5 text-xs rounded-md bg-slate-700 text-white hover:bg-slate-700/90 disabled:opacity-40"
            >
              적용
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
