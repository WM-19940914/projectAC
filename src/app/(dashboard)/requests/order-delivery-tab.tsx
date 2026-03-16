"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar, ClipboardList, Eraser, Plus, Trash2, Truck } from "lucide-react"
import type { OrderDelivery, OrderDeliveryLine } from "@/types"

export type OrderDeliveryItem = OrderDelivery

type HeaderField = "site_name" | "opti_name" | "opti_number" | "contract_number"
type LineField =
  | "supplier"
  | "order_date"
  | "order_number"
  | "model_name"
  | "quantity"
  | "delivery_request_date"
  | "delivery_expected_date"
  | "delivery_confirmed_date"
  | "delivery_place"

type OrderDeliveryLineDraft = {
  id?: string
  supplier: string
  order_date: string
  order_number: string
  model_name: string
  quantity: number | ""
  delivery_request_date: string
  delivery_expected_date: string
  delivery_confirmed_date: string
  delivery_place: string
  row_order: number
}

type OrderDeliveryDraft = {
  id: string
  request_id: string
  site_name: string
  opti_name: string
  opti_number: string
  contract_number: string
  lines: OrderDeliveryLineDraft[]
}

const ORDER_DELIVERY_LINE_COLUMNS: Array<{
  key: LineField
  label: string
  type: "text" | "date" | "number"
  width: string
  placeholder?: string
}> = [
  { key: "supplier", label: "매입처", type: "text", width: "8%", placeholder: "매입처" },
  { key: "order_date", label: "주문일", type: "date", width: "9%", placeholder: "YYYY-MM-DD" },
  { key: "order_number", label: "주문번호", type: "text", width: "9%", placeholder: "주문번호" },
  { key: "model_name", label: "모델명", type: "text", width: "11%", placeholder: "모델명" },
  { key: "quantity", label: "수량", type: "number", width: "3.5%" },
  { key: "delivery_request_date", label: "배송요청일", type: "date", width: "12%", placeholder: "YYYY-MM-DD" },
  { key: "delivery_expected_date", label: "배송예정일", type: "date", width: "12%", placeholder: "YYYY-MM-DD" },
  { key: "delivery_confirmed_date", label: "배송확정일", type: "date", width: "12%", placeholder: "YYYY-MM-DD" },
  { key: "delivery_place", label: "인도처", type: "text", width: "12%", placeholder: "인도처" },
]

const MIN_VISIBLE_ROWS = 5
const DATE_LINE_FIELDS = new Set<LineField>([
  "order_date",
  "delivery_request_date",
  "delivery_expected_date",
  "delivery_confirmed_date",
])

function toInputValue(value: string | null | undefined): string {
  return value ?? ""
}

function toNumberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function toNullableIntegerString(value: string): number | "" {
  const normalized = value.replace(/,/g, "").trim()
  if (!normalized) return ""

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : ""
}

function parseClipboardGrid(rawText: string): string[][] {
  const rows = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((row) => row.split("\t").map((cell) => cell.trim()))

  while (rows.length > 0 && rows[rows.length - 1].every((cell) => cell === "")) {
    rows.pop()
  }

  return rows.length > 0 ? rows : [[""]]
}

function toIsoDate(year: number, month: number, day: number): string {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return ""
  if (month < 1 || month > 12 || day < 1 || day > 31) return ""

  const candidate = new Date(year, month - 1, day)
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return ""
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function formatDateFromDate(date: Date): string {
  return toIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

function parseIsoDateToDate(value: string): Date | undefined {
  const normalized = normalizeFlexibleDateInput(value)
  if (!normalized) return undefined

  const [year, month, day] = normalized.split("-").map(Number)
  if (!year || !month || !day) return undefined

  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function normalizeFlexibleDateInput(value: string, now = new Date()): string {
  const trimmed = value.trim()
  if (!trimmed) return ""

  const normalizedToken = trimmed
    .split(" ")[0]
    .replace(/년|월/g, "-")
    .replace(/일/g, "")
    .replace(/\./g, "-")
    .replace(/\//g, "-")

  if (/^\d{8}$/.test(normalizedToken)) {
    const year = Number(normalizedToken.slice(0, 4))
    const month = Number(normalizedToken.slice(4, 6))
    const day = Number(normalizedToken.slice(6, 8))
    return toIsoDate(year, month, day)
  }

  if (/^\d{6}$/.test(normalizedToken)) {
    const year = 2000 + Number(normalizedToken.slice(0, 2))
    const month = Number(normalizedToken.slice(2, 4))
    const day = Number(normalizedToken.slice(4, 6))
    return toIsoDate(year, month, day)
  }

  if (/^\d{4}$/.test(normalizedToken)) {
    const year = now.getFullYear()
    const month = Number(normalizedToken.slice(0, 2))
    const day = Number(normalizedToken.slice(2, 4))
    return toIsoDate(year, month, day)
  }

  const fullYearMatch = normalizedToken.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (fullYearMatch) {
    return toIsoDate(Number(fullYearMatch[1]), Number(fullYearMatch[2]), Number(fullYearMatch[3]))
  }

  const shortYearMatch = normalizedToken.match(/^(\d{2})-(\d{1,2})-(\d{1,2})$/)
  if (shortYearMatch) {
    return toIsoDate(2000 + Number(shortYearMatch[1]), Number(shortYearMatch[2]), Number(shortYearMatch[3]))
  }

  const monthDayMatch = normalizedToken.match(/^(\d{1,2})-(\d{1,2})$/)
  if (monthDayMatch) {
    return toIsoDate(now.getFullYear(), Number(monthDayMatch[1]), Number(monthDayMatch[2]))
  }

  return ""
}

function normalizePastedLineValue(key: LineField, value: string): string {
  if (key === "quantity") {
    const normalized = toNullableIntegerString(value)
    return typeof normalized === "number" ? String(normalized) : ""
  }

  if (DATE_LINE_FIELDS.has(key)) {
    return normalizeFlexibleDateInput(value)
  }

  return value.trim()
}

function normalizeLineDates(line: OrderDeliveryLineDraft): OrderDeliveryLineDraft {
  return {
    ...line,
    order_date: normalizeFlexibleDateInput(line.order_date),
    delivery_request_date: normalizeFlexibleDateInput(line.delivery_request_date),
    delivery_expected_date: normalizeFlexibleDateInput(line.delivery_expected_date),
    delivery_confirmed_date: normalizeFlexibleDateInput(line.delivery_confirmed_date),
  }
}

function createEmptyLine(rowOrder: number): OrderDeliveryLineDraft {
  return {
    supplier: "삼성전자",
    order_date: "",
    order_number: "",
    model_name: "",
    quantity: "",
    delivery_request_date: "",
    delivery_expected_date: "",
    delivery_confirmed_date: "",
    delivery_place: "",
    row_order: rowOrder,
  }
}

function isLineEmpty(line: OrderDeliveryLineDraft): boolean {
  const supplier = line.supplier.trim()
  const supplierIsDefault = supplier.length === 0 || supplier === "삼성전자"

  return (
    supplierIsDefault &&
    !line.order_date.trim() &&
    !line.order_number.trim() &&
    !line.model_name.trim() &&
    (Number(line.quantity) || 0) <= 0 &&
    !line.delivery_request_date.trim() &&
    !line.delivery_expected_date.trim() &&
    !line.delivery_confirmed_date.trim() &&
    !line.delivery_place.trim()
  )
}

function toLineDraft(line: OrderDeliveryLine, rowOrder: number): OrderDeliveryLineDraft {
  return {
    id: line.id,
    supplier: toInputValue(line.supplier) || "삼성전자",
    order_date: toInputValue(line.order_date),
    order_number: toInputValue(line.order_number),
    model_name: toInputValue(line.model_name),
    quantity: toNumberValue(line.quantity) > 0 ? toNumberValue(line.quantity) : "",
    delivery_request_date: toInputValue(line.delivery_request_date),
    delivery_expected_date: toInputValue(line.delivery_expected_date),
    delivery_confirmed_date: toInputValue(line.delivery_confirmed_date),
    delivery_place: toInputValue(line.delivery_place),
    row_order: rowOrder,
  }
}

function ensureMinimumRows(lines: OrderDeliveryLineDraft[], minRows = MIN_VISIBLE_ROWS) {
  const next = [...lines]
  while (next.length < minRows) {
    next.push(createEmptyLine(next.length + 1))
  }
  return next.map((line, index) => ({ ...line, row_order: index + 1 }))
}

type DeliveryCardStatus = "주문 생성" | "배송 준비중" | "부분 배송완료" | "배송 완료"

type DeliveryCardSummary = {
  status: DeliveryCardStatus
  badgeClassName: string
  progressBadgeClassName: string
  completedCount: number
  totalCount: number
}

function isMeaningfulOrderDeliveryLine(line: OrderDeliveryLine): boolean {
  return !isLineEmpty({
    supplier: toInputValue(line.supplier) || "삼성전자",
    order_date: toInputValue(line.order_date),
    order_number: toInputValue(line.order_number),
    model_name: toInputValue(line.model_name),
    quantity: toNumberValue(line.quantity) > 0 ? toNumberValue(line.quantity) : "",
    delivery_request_date: toInputValue(line.delivery_request_date),
    delivery_expected_date: toInputValue(line.delivery_expected_date),
    delivery_confirmed_date: toInputValue(line.delivery_confirmed_date),
    delivery_place: toInputValue(line.delivery_place),
    row_order: line.row_order,
  })
}

function formatCardCreatedDate(value: string): string {
  if (!value) return "-"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.replace("T", " ").slice(0, 16)
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

function getDeliveryCardSummary(item: OrderDeliveryItem): DeliveryCardSummary {
  const today = formatDateFromDate(new Date())
  const meaningfulLines = (item.lines ?? []).filter(isMeaningfulOrderDeliveryLine)

  if (meaningfulLines.length === 0) {
    return {
      status: "주문 생성",
      badgeClassName: "border-slate-300 bg-slate-100 text-slate-700",
      progressBadgeClassName: "bg-red-50 text-red-600",
      completedCount: 0,
      totalCount: 0,
    }
  }

  const completedCount = meaningfulLines.filter((line) => {
    const confirmedDate = normalizeFlexibleDateInput(toInputValue(line.delivery_confirmed_date))
    return Boolean(confirmedDate) && confirmedDate <= today
  }).length

  const hasSchedule = meaningfulLines.some((line) => {
    const expectedDate = normalizeFlexibleDateInput(toInputValue(line.delivery_expected_date))
    const requestDate = normalizeFlexibleDateInput(toInputValue(line.delivery_request_date))
    return Boolean(expectedDate || requestDate || normalizeFlexibleDateInput(toInputValue(line.delivery_confirmed_date)))
  })

  if (completedCount === meaningfulLines.length) {
    return {
      status: "배송 완료",
      badgeClassName: "border-slate-400 bg-slate-100 text-slate-700",
      progressBadgeClassName: "bg-slate-700 text-white",
      completedCount,
      totalCount: meaningfulLines.length,
    }
  }

  if (completedCount > 0) {
    return {
      status: "부분 배송완료",
      badgeClassName: "border-slate-400 bg-slate-100 text-slate-700",
      progressBadgeClassName: "bg-red-50 text-red-600",
      completedCount,
      totalCount: meaningfulLines.length,
    }
  }

  if (hasSchedule) {
    return {
      status: "배송 준비중",
      badgeClassName: "border-slate-300 bg-slate-50 text-slate-700",
      progressBadgeClassName: "bg-red-50 text-red-600",
      completedCount: 0,
      totalCount: meaningfulLines.length,
    }
  }

  return {
    status: "주문 생성",
    badgeClassName: "border-slate-300 bg-slate-100 text-slate-700",
    progressBadgeClassName: "bg-red-50 text-red-600",
    completedCount: 0,
    totalCount: meaningfulLines.length,
  }
}

function toSortableTimestamp(value: string): number {
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function toDraft(item: OrderDeliveryItem): OrderDeliveryDraft {
  const siteNameFromLine =
    item.lines?.map((line) => toInputValue(line.site_name)).find((value) => value.trim().length > 0) ?? ""
  const normalizedLines = Array.isArray(item.lines)
    ? item.lines.map((line, index) => toLineDraft(line, index + 1))
    : []

  return {
    id: item.id,
    request_id: item.request_id,
    site_name: toInputValue(item.site_name) || siteNameFromLine,
    opti_name: toInputValue(item.opti_name),
    opti_number: toInputValue(item.opti_number),
    contract_number: toInputValue(item.contract_number),
    lines: normalizedLines,
  }
}

function normalizeDraftForSave(draft: OrderDeliveryDraft): OrderDeliveryDraft {
  return {
    ...draft,
    lines: draft.lines.map((line, index) => ({
      ...normalizeLineDates(line),
      row_order: index + 1,
    })),
  }
}

function getDraftSnapshot(draft: OrderDeliveryDraft): string {
  return JSON.stringify(normalizeDraftForSave(draft))
}

interface OrderDeliveryTabProps {
  requestId: string
  defaultSiteName?: string
  confirmedQuoteId?: string | null
  onEditQuote?: (id: string) => void
}

export default function OrderDeliveryTab({ requestId, defaultSiteName = "", confirmedQuoteId = null, onEditQuote }: OrderDeliveryTabProps) {
  const [items, setItems] = useState<OrderDeliveryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [draft, setDraft] = useState<OrderDeliveryDraft | null>(null)
  const [resolvedSiteName, setResolvedSiteName] = useState("")
  const [isFieldEditing, setIsFieldEditing] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")
  // 삭제 확인 Dialog 상태
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [pendingDeleteCardId, setPendingDeleteCardId] = useState<string | null>(null)
  const deleteFromEditorRef = useRef(false)
  const lastSavedSnapshotRef = useRef("")
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 언마운트 시 최신 draft를 참조하기 위한 ref
  const draftRef = useRef<OrderDeliveryDraft | null>(null)

  const effectiveSiteName = defaultSiteName.trim() || resolvedSiteName.trim()
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => toSortableTimestamp(a.created_at) - toSortableTimestamp(b.created_at)),
    [items]
  )

  const loadItems = useCallback(async () => {
    if (!requestId) {
      setItems([])
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/order-deliveries?request_id=${requestId}`)
      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.error || "주문 내역을 불러오지 못했습니다.")
      }
      const nextItems = Array.isArray(result.data) ? result.data : []
      setItems(nextItems)
    } catch {
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  useEffect(() => {
    if (!requestId || defaultSiteName.trim()) return
    let isCancelled = false

    const loadSiteName = async () => {
      try {
        const res = await fetch(`/api/quotes?request_id=${requestId}`)
        if (!res.ok) return

        const result = await res.json()
        const quotes = Array.isArray(result?.data) ? (result.data as Array<{ site_name?: string | null }>) : []
        const nextSiteName =
          quotes
            .map((quote) => toInputValue(quote.site_name).trim())
            .find((value) => value.length > 0) ?? ""

        if (!isCancelled) {
          setResolvedSiteName(nextSiteName)
        }
      } catch {
        if (!isCancelled) {
          setResolvedSiteName("")
        }
      }
    }

    void loadSiteName()

    return () => {
      isCancelled = true
    }
  }, [requestId, defaultSiteName])

  useEffect(() => {
    if (!effectiveSiteName) return
    setDraft((prev) => {
      if (!prev || prev.site_name.trim()) return prev
      return { ...prev, site_name: effectiveSiteName }
    })
  }, [effectiveSiteName])

  const openEditor = (item: OrderDeliveryItem) => {
    const nextDraft = toDraft(item)
    const nextEditorDraft = {
      ...nextDraft,
      site_name: nextDraft.site_name || effectiveSiteName,
      // 카드를 처음 열 때만 최소 5행 보장 (빈행 정리 후 저장된 상태는 유지)
    }
    lastSavedSnapshotRef.current = getDraftSnapshot(nextEditorDraft)
    setDraft(nextEditorDraft)
    setIsEditorOpen(true)
  }

  const handleCreate = async () => {
    if (!requestId || isCreating) return

    setIsCreating(true)
    try {
      const res = await fetch("/api/order-deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          site_name: effectiveSiteName || null,
        }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.error || "주문 내역을 생성하지 못했습니다.")
      }

      const created = result.data as OrderDeliveryItem
      setItems((prev) => [...prev, created])
      const nextDraft = toDraft(created)
      const nextEditorDraft = {
        ...nextDraft,
        site_name: nextDraft.site_name || effectiveSiteName,
        // 최초 생성 시에만 5행 보장
        lines: ensureMinimumRows(nextDraft.lines),
      }
      lastSavedSnapshotRef.current = getDraftSnapshot(nextEditorDraft)
      setDraft(nextEditorDraft)
      setIsEditorOpen(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : "생성 중 오류가 발생했습니다."
      alert(message)
    } finally {
      setIsCreating(false)
    }
  }

  const performSave = useCallback(async (sourceDraft: OrderDeliveryDraft) => {
    if (!sourceDraft.id || isSaving) return false

    const normalizedDraft = normalizeDraftForSave(sourceDraft)
    const nextSnapshot = JSON.stringify(normalizedDraft)

    if (nextSnapshot === lastSavedSnapshotRef.current) {
      setDraft((prev) => (prev ? normalizeDraftForSave(prev) : prev))
      return true
    }

    setDraft(normalizedDraft)
    setIsSaving(true)
    try {
      const res = await fetch("/api/order-deliveries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedDraft),
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.error || "저장하지 못했습니다.")
      }

      const saved = result.data as OrderDeliveryItem
      setItems((prev) => prev.map((item) => (item.id === saved.id ? saved : item)))
      const nextDraft = toDraft(saved)
      const nextEditorDraft = {
        ...nextDraft,
        site_name: nextDraft.site_name || effectiveSiteName,
      }
      lastSavedSnapshotRef.current = getDraftSnapshot(nextEditorDraft)
      setDraft(nextEditorDraft)
      // 자동저장 완료 시간 표시
      const now = new Date()
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
      if (saveMessageTimerRef.current) clearTimeout(saveMessageTimerRef.current)
      setSaveMessage(`저장됨 ${timeStr}`)
      saveMessageTimerRef.current = setTimeout(() => setSaveMessage(""), 4000)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : "저장 중 오류가 발생했습니다."
      setSaveMessage("저장 실패")
      alert(message)
      return false
    } finally {
      setIsSaving(false)
    }
  }, [effectiveSiteName, isSaving])

  // draft 변경 시 ref 동기화 (언마운트 시 최신 값 참조용)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  // 컴포넌트 언마운트 또는 탭 전환 시 미저장 데이터 즉시 저장
  useEffect(() => {
    return () => {
      const currentDraft = draftRef.current
      if (!currentDraft?.id) return
      const snap = getDraftSnapshot(currentDraft)
      if (snap === lastSavedSnapshotRef.current) return
      // 언마운트 시점이므로 동기적으로 fetch (navigator.sendBeacon 대신 keepalive fetch)
      const normalized = normalizeDraftForSave(currentDraft)
      fetch("/api/order-deliveries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
        keepalive: true, // 페이지 이탈 시에도 요청 완료 보장
      }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleEditorOpenChange = async (open: boolean) => {
    if (open) {
      setIsEditorOpen(true)
      return
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }

    if (draft) {
      const saved = await performSave(draft)
      if (!saved) return
    }

    setIsEditorOpen(false)
  }

  useEffect(() => {
    if (!draft?.id || isSaving || isFieldEditing) return

    const nextSnapshot = getDraftSnapshot(draft)
    if (nextSnapshot === lastSavedSnapshotRef.current) return

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }

    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null
      void performSave(draft)
    }, 800)

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }
  }, [draft, isSaving, isFieldEditing, performSave])

  // 삭제 확인 Dialog 열기
  const openDeleteConfirm = (cardId: string, fromEditor = false) => {
    if (!cardId || isDeleting) return
    setPendingDeleteCardId(cardId)
    deleteFromEditorRef.current = fromEditor
    setIsDeleteConfirmOpen(true)
  }

  // 실제 삭제 실행 (Dialog 확인 후 호출)
  const confirmDelete = async () => {
    const cardId = pendingDeleteCardId
    if (!cardId) return
    setIsDeleteConfirmOpen(false)
    setPendingDeleteCardId(null)

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/order-deliveries?id=${cardId}`, { method: "DELETE" })
      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.error || "삭제에 실패했습니다.")
      }

      const remaining = items.filter((item) => item.id !== cardId)
      setItems(remaining)
      // 삭제된 주문이 현재 편집 중이면 → 다음 주문 자동 선택
      if (draft?.id === cardId) {
        if (remaining.length > 0) {
          const sorted = [...remaining].sort((a, b) => toSortableTimestamp(a.created_at) - toSortableTimestamp(b.created_at))
          openEditor(sorted[0])
        } else {
          setDraft(null)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "삭제에 실패했습니다."
      alert(message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDelete = () => {
    if (!draft?.id || isDeleting) return
    openDeleteConfirm(draft.id, true)
  }

  const handleHeaderChange = (key: HeaderField, value: string) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleFieldFocus = () => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current)
      blurTimerRef.current = null
    }
    setIsFieldEditing(true)
  }

  const handleFieldBlur = () => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current)
    }
    blurTimerRef.current = setTimeout(() => {
      setIsFieldEditing(false)
      blurTimerRef.current = null
    }, 120)
  }

  const handleLineChange = (rowIndex: number, key: LineField, value: string) => {
    setDraft((prev) => {
      if (!prev) return prev

      const nextLines = prev.lines.map((line, index) => {
        if (index !== rowIndex) return line

        if (key === "quantity") {
          const normalized = toNullableIntegerString(value)
          return {
            ...line,
            [key]: normalized,
          }
        }

        return { ...line, [key]: value }
      })

      return { ...prev, lines: nextLines }
    })
  }

  const handleLineBlur = (rowIndex: number, key: LineField) => {
    if (!DATE_LINE_FIELDS.has(key)) return

    setDraft((prev) => {
      if (!prev) return prev

      const nextLines = prev.lines.map((line, index) => {
        if (index !== rowIndex) return line

        return {
          ...line,
          [key]: normalizeFlexibleDateInput(String(line[key] ?? "")),
        }
      })

      return { ...prev, lines: nextLines }
    })
  }

  const handleDateSelect = (rowIndex: number, key: LineField, date?: Date) => {
    if (!DATE_LINE_FIELDS.has(key)) return

    setDraft((prev) => {
      if (!prev) return prev

      const nextLines = prev.lines.map((line, index) => {
        if (index !== rowIndex) return line

        return {
          ...line,
          [key]: date ? formatDateFromDate(date) : "",
        }
      })

      return { ...prev, lines: nextLines }
    })
  }

  const handleAddRows = (count = 1) => {
    setDraft((prev) => {
      if (!prev) return prev
      const safeCount = Math.max(1, Math.round(count))
      const appended = Array.from({ length: safeCount }, (_, index) =>
        createEmptyLine(prev.lines.length + index + 1)
      )
      return {
        ...prev,
        lines: [...prev.lines, ...appended],
      }
    })
  }

  const handleClearRow = (rowIndex: number) => {
    setDraft((prev) => {
      if (!prev) return prev

      const nextLines = prev.lines.map((line, index) =>
        index === rowIndex
          ? {
              ...createEmptyLine(index + 1),
              id: line.id,
            }
          : line
      )

      return { ...prev, lines: nextLines }
    })
  }

  const handleDeleteRow = (rowIndex: number) => {
    setDraft((prev) => {
      if (!prev) return prev

      const nextLines = prev.lines
        .filter((_, index) => index !== rowIndex)
        .map((line, index) => ({ ...line, row_order: index + 1 }))

      return {
        ...prev,
        lines: nextLines.length > 0 ? nextLines : [createEmptyLine(1)],
      }
    })
  }

  const handleLinePaste = (rowIndex: number, startKey: LineField, text: string) => {
    const grid = parseClipboardGrid(text)
    const startColumnIndex = ORDER_DELIVERY_LINE_COLUMNS.findIndex((column) => column.key === startKey)

    if (startColumnIndex < 0) return

    setDraft((prev) => {
      if (!prev) return prev

      const requiredRowCount = rowIndex + grid.length
      const nextLines = [...prev.lines]

      while (nextLines.length < requiredRowCount) {
        nextLines.push(createEmptyLine(nextLines.length + 1))
      }

      grid.forEach((row, rowOffset) => {
        const targetRowIndex = rowIndex + rowOffset
        const sourceLine = nextLines[targetRowIndex]
        if (!sourceLine) return

        let nextLine = { ...sourceLine }

        row.forEach((cellValue, columnOffset) => {
          const targetColumn = ORDER_DELIVERY_LINE_COLUMNS[startColumnIndex + columnOffset]
          if (!targetColumn) return

          const normalizedValue = normalizePastedLineValue(targetColumn.key, cellValue)

          if (targetColumn.key === "quantity") {
            if (!normalizedValue) {
              nextLine = {
                ...nextLine,
                [targetColumn.key]: "",
              }
              return
            }

            const parsed = Number(normalizedValue)
            nextLine = {
              ...nextLine,
              [targetColumn.key]: Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : "",
            }
            return
          }

          nextLine = {
            ...nextLine,
            [targetColumn.key]: normalizedValue,
          }
        })

        nextLines[targetRowIndex] = nextLine
      })

      return {
        ...prev,
        lines: nextLines.map((line, index) => ({ ...line, row_order: index + 1 })),
      }
    })
  }

  const handleTrimEmptyRows = () => {
    setDraft((prev) => {
      if (!prev) return prev

      const nextLines = prev.lines.filter((line) => !isLineEmpty(line))
      const safeLines = nextLines.length > 0 ? nextLines : [createEmptyLine(1)]

      return {
        ...prev,
        lines: safeLines.map((line, index) => ({ ...line, row_order: index + 1 })),
      }
    })
  }

  // 아이템 로드 후 첫 번째 주문 자동 선택 (draft가 없을 때만)
  const autoSelectedRef = useRef(false)
  useEffect(() => {
    if (isLoading || autoSelectedRef.current) return
    if (sortedItems.length > 0 && !draft) {
      openEditor(sortedItems[0])
      autoSelectedRef.current = true
    }
  }, [isLoading, sortedItems, draft])
  // items 변경 시 autoSelectedRef 리셋
  useEffect(() => { autoSelectedRef.current = false }, [requestId])

  // 주문 전환 — 현재 draft 저장 후 다른 주문 열기
  const switchToItem = async (item: OrderDeliveryItem) => {
    if (draft?.id === item.id) return
    if (draft) await performSave(draft)
    openEditor(item)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 상단: 주문 선택 탭 + 생성 버튼 */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between bg-slate-50 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Truck className="h-3.5 w-3.5 text-slate-500" />주문 내역
            </p>
            {saveMessage && (
              <span className={`text-[10px] ${saveMessage.includes("실패") ? "text-red-500" : "text-gray-400"}`}>
                {isSaving ? "저장 중..." : saveMessage}
              </span>
            )}
            {isSaving && !saveMessage && (
              <span className="text-[10px] text-gray-400">저장 중...</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* 현재 주문 삭제 버튼 */}
            {draft?.id && (
              <button
                type="button"
                onClick={() => openDeleteConfirm(draft.id, true)}
                disabled={isDeleting}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-red-200 px-2.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-40"
              >
                <Trash2 className="h-3 w-3" />
                삭제
              </button>
            )}
            <button
              type="button"
              onClick={() => { void handleCreate() }}
              disabled={isCreating}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-slate-700 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              {isCreating ? "생성 중..." : "+주문 생성"}
            </button>
          </div>
        </div>

        {/* 주문이 1개 이상이면 탭으로 표시 */}
        {sortedItems.length > 0 && (
          <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 overflow-x-auto">
            {sortedItems.map((item, idx) => {
              const isActive = draft?.id === item.id
              const summary = getDeliveryCardSummary(item)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { void switchToItem(item) }}
                  className={`relative shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-slate-700 text-white"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  주문 {idx + 1}
                  <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                    isActive ? "bg-white/20 text-white" : summary.progressBadgeClassName
                  }`}>
                    {summary.completedCount}/{summary.totalCount}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 인라인 에디터 영역 */}
      {isLoading ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-10 text-center">
          <p className="text-sm font-medium text-gray-500">주문 내역을 불러오는 중입니다.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-10 text-center">
          <p className="text-sm font-medium text-gray-500">등록된 주문 내역이 없습니다.</p>
          <p className="mt-1 text-xs text-gray-400">위의 +주문 생성 버튼으로 추가하세요.</p>
        </div>
      ) : draft ? (
        <div className="flex flex-col gap-2">
          {/* 헤더 필드 (현장명, 옵티명, 옵티번호, 계약번호) */}
          <section className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500">현장명</p>
                <Input
                  value={draft.site_name}
                  onChange={(event) => handleHeaderChange("site_name", event.target.value)}
                  onFocus={handleFieldFocus}
                  onBlur={handleFieldBlur}
                  placeholder="현장명을 입력하세요"
                  className="h-9 bg-white text-sm"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500">옵티명</p>
                <Input
                  value={draft.opti_name}
                  onChange={(event) => handleHeaderChange("opti_name", event.target.value)}
                  onFocus={handleFieldFocus}
                  onBlur={handleFieldBlur}
                  placeholder="옵티명을 입력하세요"
                  className="h-9 bg-white text-sm"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500">옵티번호</p>
                <Input
                  value={draft.opti_number}
                  onChange={(event) => handleHeaderChange("opti_number", event.target.value)}
                  onFocus={handleFieldFocus}
                  onBlur={handleFieldBlur}
                  placeholder="옵티번호를 입력하세요"
                  className="h-9 bg-white text-sm"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500">계약번호</p>
                <Input
                  value={draft.contract_number}
                  onChange={(event) => handleHeaderChange("contract_number", event.target.value)}
                  onFocus={handleFieldFocus}
                  onBlur={handleFieldBlur}
                  placeholder="계약번호를 입력하세요"
                  className="h-9 bg-white text-sm"
                />
              </div>
            </div>
          </section>

          {/* 테이블 + 행 액션 */}
          <section className="flex flex-col rounded-xl border border-gray-200 bg-white" style={{ maxHeight: "60vh" }}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white/95 px-3 py-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAddRows(1)}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  행 추가
                </button>
                <button
                  type="button"
                  onClick={() => handleAddRows(5)}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  +5행
                </button>
                <button
                  type="button"
                  onClick={handleTrimEmptyRows}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  빈 행 정리
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {/* 확정 견적서 보기 */}
                {confirmedQuoteId && onEditQuote && (
                  <button
                    type="button"
                    onClick={() => onEditQuote(confirmedQuoteId)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    확정 견적서 보기
                  </button>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div>
                <div className="w-full">
                  <table className="w-full table-fixed border-separate border-spacing-0">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-gray-100">
                        {ORDER_DELIVERY_LINE_COLUMNS.map((column) => (
                          <th
                            key={column.key}
                            className={`border-b border-r border-gray-200 px-1.5 py-1.5 text-[11px] font-semibold text-gray-500 ${
                              column.key === "quantity"
                                ? "text-center"
                                : "text-left"
                            }`}
                            style={{ width: column.width }}
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {draft.lines.map((line, rowIndex) => (
                        <tr
                          key={`${line.id ?? "new"}-${rowIndex}`}
                          className={`group/row relative ${rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                        >
                          {ORDER_DELIVERY_LINE_COLUMNS.map((column) => {
                            const value =
                              column.type === "number"
                                ? typeof line[column.key] === "number"
                                  ? String(line[column.key])
                                  : ""
                                : String(line[column.key] ?? "")

                            const isLastColumn = column.key === "delivery_place"
                            return (
                              <td key={column.key} className={`border-b ${isLastColumn ? "" : "border-r"} border-gray-200 p-0 align-middle ${isLastColumn ? "relative" : ""}`}>
                                <div className="relative">
                                  <Input
                                    type={column.type === "number" ? "number" : "text"}
                                    min={column.type === "number" ? 0 : undefined}
                                    inputMode={column.type === "number" ? "numeric" : undefined}
                                    value={value}
                                    onFocus={handleFieldFocus}
                                    onChange={(event) => handleLineChange(rowIndex, column.key, event.target.value)}
                                    onBlur={() => {
                                      handleLineBlur(rowIndex, column.key)
                                      handleFieldBlur()
                                    }}
                                    onPaste={(event) => {
                                      event.preventDefault()
                                      handleLinePaste(
                                        rowIndex,
                                        column.key,
                                        event.clipboardData.getData("text/plain")
                                      )
                                    }}
                                    placeholder={column.placeholder}
                                    className={`h-8 rounded-none border-0 bg-transparent px-1.5 text-[11px] placeholder:text-[10px] placeholder:font-normal placeholder:text-gray-300 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300 ${
                                      column.type === "number"
                                        ? column.key === "quantity"
                                          ? "text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                          : "text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                        : ""
                                    } ${
                                      column.type === "date"
                                        ? value
                                          ? "pr-7 text-gray-700"
                                          : "pr-7 text-gray-300"
                                        : "text-gray-700"
                                    }`}
                                  />
                                  {column.type === "date" && (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button
                                          type="button"
                                          aria-label={`${column.label} 달력 열기`}
                                          className="absolute right-1 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500"
                                          onMouseDown={(event) => event.preventDefault()}
                                        >
                                          <Calendar className="h-3.5 w-3.5" />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent align="end" className="w-auto p-0">
                                        <CalendarPicker
                                          mode="single"
                                          selected={parseIsoDateToDate(value)}
                                          onSelect={(date) => handleDateSelect(rowIndex, column.key, date)}
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                </div>
                                {/* 마지막 컬럼 오른쪽에 hover 시 떠오르는 액션 버튼 */}
                                {isLastColumn && (
                                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 z-10">
                                    <button
                                      type="button"
                                      onClick={() => handleClearRow(rowIndex)}
                                      className="inline-flex h-5 w-5 items-center justify-center rounded bg-white/90 text-gray-400 shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-vanilla-custard/40 hover:text-yellow-700 hover:ring-vanilla-custard/60"
                                      aria-label={`${rowIndex + 1}행 비우기`}
                                      title="행 비우기"
                                    >
                                      <Eraser className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRow(rowIndex)}
                                      className="inline-flex h-5 w-5 items-center justify-center rounded bg-white/90 text-gray-400 shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-soft-blush/40 hover:text-red-400 hover:ring-soft-blush/60"
                                      aria-label={`${rowIndex + 1}행 삭제`}
                                      title="행 삭제"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                      {/* 행 추가 버튼 행 */}
                      <tr>
                        <td colSpan={9} className="p-0">
                          <button
                            type="button"
                            onClick={() => handleAddRows(1)}
                            className="flex w-full items-center justify-center gap-1 bg-gray-50 py-1.5 text-[11px] text-gray-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                          >
                            <Plus className="h-3 w-3" />
                            행 추가
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {/* 카드 삭제 확인 Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader>
            <DialogTitle className="text-sm">주문 카드 삭제</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              카드와 연결된 주문/배송 데이터를 모두 삭제합니다. 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="px-3 py-1.5 text-xs rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => { void confirmDelete() }}
              className="px-3 py-1.5 text-xs rounded-md bg-red-500 text-white hover:bg-red-600"
            >
              삭제
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
