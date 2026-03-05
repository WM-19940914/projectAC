"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"
import type { OrderDelivery, OrderDeliveryLine } from "@/types"

export type OrderDeliveryItem = OrderDelivery

type HeaderField = "opti_name" | "opti_number" | "contract_number"
type LineField =
  | "supplier"
  | "site_name"
  | "order_date"
  | "order_number"
  | "model_name"
  | "quantity"
  | "delivery_request_date"
  | "delivery_expected_date"
  | "delivery_confirmed_date"
  | "delivery_place"
  | "delivery_address"

type OrderDeliveryLineDraft = {
  id?: string
  supplier: string
  site_name: string
  order_date: string
  order_number: string
  model_name: string
  quantity: number
  delivery_request_date: string
  delivery_expected_date: string
  delivery_confirmed_date: string
  delivery_place: string
  delivery_address: string
  row_order: number
}

type OrderDeliveryDraft = {
  id: string
  request_id: string
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
  { key: "supplier", label: "매입처", type: "text", width: "7.5%", placeholder: "매입처" },
  { key: "site_name", label: "현장명", type: "text", width: "8%", placeholder: "현장명" },
  { key: "order_date", label: "주문일", type: "date", width: "7.5%" },
  { key: "order_number", label: "주문번호", type: "text", width: "8.5%", placeholder: "주문번호" },
  { key: "model_name", label: "모델명", type: "text", width: "11%", placeholder: "모델명" },
  { key: "quantity", label: "수량", type: "number", width: "4.5%" },
  { key: "delivery_request_date", label: "배송요청일", type: "date", width: "7%" },
  { key: "delivery_expected_date", label: "배송예정일", type: "date", width: "7%" },
  { key: "delivery_confirmed_date", label: "배송확정일", type: "date", width: "7%" },
  { key: "delivery_place", label: "인도처", type: "text", width: "8%", placeholder: "인도처" },
  { key: "delivery_address", label: "인도처 주소", type: "text", width: "12%", placeholder: "인도처 주소" },
]

const MIN_VISIBLE_ROWS = 5

function toInputValue(value: string | null | undefined): string {
  return value ?? ""
}

function toNumberValue(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function createEmptyLine(rowOrder: number): OrderDeliveryLineDraft {
  return {
    supplier: "",
    site_name: "",
    order_date: "",
    order_number: "",
    model_name: "",
    quantity: 0,
    delivery_request_date: "",
    delivery_expected_date: "",
    delivery_confirmed_date: "",
    delivery_place: "",
    delivery_address: "",
    row_order: rowOrder,
  }
}

function isLineEmpty(line: OrderDeliveryLineDraft): boolean {
  return (
    !line.supplier.trim() &&
    !line.site_name.trim() &&
    !line.order_date.trim() &&
    !line.order_number.trim() &&
    !line.model_name.trim() &&
    (Number(line.quantity) || 0) <= 0 &&
    !line.delivery_request_date.trim() &&
    !line.delivery_expected_date.trim() &&
    !line.delivery_confirmed_date.trim() &&
    !line.delivery_place.trim() &&
    !line.delivery_address.trim()
  )
}

function toLineDraft(line: OrderDeliveryLine, rowOrder: number): OrderDeliveryLineDraft {
  return {
    id: line.id,
    supplier: toInputValue(line.supplier),
    site_name: toInputValue(line.site_name),
    order_date: toInputValue(line.order_date),
    order_number: toInputValue(line.order_number),
    model_name: toInputValue(line.model_name),
    quantity: toNumberValue(line.quantity),
    delivery_request_date: toInputValue(line.delivery_request_date),
    delivery_expected_date: toInputValue(line.delivery_expected_date),
    delivery_confirmed_date: toInputValue(line.delivery_confirmed_date),
    delivery_place: toInputValue(line.delivery_place),
    delivery_address: toInputValue(line.delivery_address),
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

function toDraft(item: OrderDeliveryItem): OrderDeliveryDraft {
  const normalizedLines = Array.isArray(item.lines)
    ? item.lines.map((line, index) => toLineDraft(line, index + 1))
    : []

  return {
    id: item.id,
    request_id: item.request_id,
    opti_name: toInputValue(item.opti_name),
    opti_number: toInputValue(item.opti_number),
    contract_number: toInputValue(item.contract_number),
    lines: ensureMinimumRows(normalizedLines),
  }
}

interface OrderDeliveryTabProps {
  requestId: string
}

export default function OrderDeliveryTab({ requestId }: OrderDeliveryTabProps) {
  const [items, setItems] = useState<OrderDeliveryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [draft, setDraft] = useState<OrderDeliveryDraft | null>(null)

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
      setItems(Array.isArray(result.data) ? result.data : [])
    } catch {
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  const openEditor = (item: OrderDeliveryItem) => {
    setDraft(toDraft(item))
    setIsEditorOpen(true)
  }

  const handleCreate = async () => {
    if (!requestId || isCreating) return

    setIsCreating(true)
    try {
      const res = await fetch("/api/order-deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.error || "주문 내역을 생성하지 못했습니다.")
      }

      const created = result.data as OrderDeliveryItem
      setItems((prev) => [created, ...prev])
      setDraft(toDraft(created))
      setIsEditorOpen(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : "생성 중 오류가 발생했습니다."
      alert(message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleSave = async () => {
    if (!draft?.id || isSaving) return

    setIsSaving(true)
    try {
      const res = await fetch("/api/order-deliveries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.error || "저장하지 못했습니다.")
      }

      const saved = result.data as OrderDeliveryItem
      setItems((prev) => prev.map((item) => (item.id === saved.id ? saved : item)))
      setIsEditorOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "저장 중 오류가 발생했습니다."
      alert(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteById = async (cardId: string, fromEditor = false) => {
    if (!cardId || isDeleting) return
    if (!confirm("\uCE74\uB4DC\uC640 \uC5F0\uACB0\uB41C \uC8FC\uBB38/\uBC30\uC1A1 \uB370\uC774\uD130\uB97C \uBAA8\uB450 \uC0AD\uC81C\uD569\uB2C8\uB2E4. \uC9C4\uD589\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/order-deliveries?id=${cardId}`, { method: "DELETE" })
      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to delete card.")
      }

      setItems((prev) => prev.filter((item) => item.id !== cardId))
      if (fromEditor || draft?.id === cardId) {
        setIsEditorOpen(false)
        setDraft(null)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete card."
      alert(message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDelete = async () => {
    if (!draft?.id || isDeleting) return
    void handleDeleteById(draft.id, true)
  }

  const handleHeaderChange = (key: HeaderField, value: string) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleLineChange = (rowIndex: number, key: LineField, value: string) => {
    setDraft((prev) => {
      if (!prev) return prev

      const nextLines = prev.lines.map((line, index) => {
        if (index !== rowIndex) return line

        if (key === "quantity") {
          const parsed = Number(value)
          return { ...line, quantity: Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0 }
        }

        return { ...line, [key]: value }
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

  const handleDuplicateRow = (rowIndex: number) => {
    setDraft((prev) => {
      if (!prev) return prev
      const source = prev.lines[rowIndex]
      if (!source) return prev

      const duplicated: OrderDeliveryLineDraft = {
        ...source,
        id: undefined,
        row_order: 0,
      }
      const nextLines = [...prev.lines]
      nextLines.splice(rowIndex + 1, 0, duplicated)

      return {
        ...prev,
        lines: nextLines.map((line, index) => ({ ...line, row_order: index + 1 })),
      }
    })
  }

  const handleDeleteRow = (rowIndex: number) => {
    setDraft((prev) => {
      if (!prev) return prev
      if (prev.lines.length <= 1) return prev

      const nextLines = prev.lines
        .filter((_, index) => index !== rowIndex)
        .map((line, index) => ({ ...line, row_order: index + 1 }))

      return { ...prev, lines: nextLines }
    })
  }

  const cardCount = useMemo(() => items.length, [items.length])
  const rowCount = draft?.lines.length ?? 0
  const filledRowCount = useMemo(
    () => (draft ? draft.lines.filter((line) => !isLineEmpty(line)).length : 0),
    [draft]
  )
  const totalQuantity = useMemo(
    () => (draft ? draft.lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0), 0) : 0),
    [draft]
  )

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">주문 내역</p>
            <p className="mt-0.5 text-xs text-gray-400">총 {cardCount}개</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void handleCreate()
            }}
            disabled={isCreating}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-sky-aqua px-3 text-xs font-semibold text-white hover:bg-sky-aqua/90 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            {isCreating ? "생성 중..." : "+주문 생성"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-10 text-center">
          <p className="text-sm font-medium text-gray-500">주문 내역을 불러오는 중입니다.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-10 text-center">
          <p className="text-sm font-medium text-gray-500">등록된 주문 내역 카드가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div key={item.id} className="relative">
              <button
                type="button"
                onClick={() => openEditor(item)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-sky-aqua/40 hover:bg-sky-aqua/5"
              >
                <div className="space-y-2 pr-9">
                  <div className="rounded-md bg-gray-50 px-2.5 py-2">
                    <p className="text-[10px] text-gray-400">{"\uC635\uD2F0\uBA85"}</p>
                    <p className="mt-0.5 min-h-[2.5rem] break-all text-sm font-medium leading-5 text-gray-700">
                      {item.opti_name?.trim() || ""}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-md bg-gray-50 px-2.5 py-2">
                      <p className="text-[10px] text-gray-400">{"\uC635\uD2F0\uBC88\uD638"}</p>
                      <p className="mt-0.5 text-sm font-medium text-gray-700">
                        {item.opti_number?.trim() || ""}
                      </p>
                    </div>
                    <div className="rounded-md bg-gray-50 px-2.5 py-2">
                      <p className="text-[10px] text-gray-400">{"\uACC4\uC57D\uBC88\uD638"}</p>
                      <p className="mt-0.5 text-sm font-medium text-gray-700">
                        {item.contract_number?.trim() || ""}
                      </p>
                    </div>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleDeleteById(item.id)
                }}
                disabled={isDeleting}
                aria-label="\uC8FC\uBB38 \uCE74\uB4DC \uC0AD\uC81C"
                title="\uC8FC\uBB38 \uCE74\uB4DC \uC0AD\uC81C"
                className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-soft-blush transition-colors hover:bg-soft-blush/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="w-[97vw] max-w-[1620px] overflow-hidden p-0">
          {draft && (
            <div className="flex h-[88vh] min-h-0 flex-col bg-white">
              <DialogHeader className="border-b border-gray-200 bg-gradient-to-r from-white via-sky-aqua/5 to-white px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <DialogTitle className="font-sans text-base">주문/배송 관리</DialogTitle>
                    <DialogDescription className="mt-1 text-xs text-gray-500">
                      상단 기본정보와 하단 행 편집 테이블을 한 화면에서 관리합니다.
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="rounded-md border border-gray-200 bg-white px-2 py-1 text-gray-600">
                      총 {rowCount}행
                    </span>
                    <span className="rounded-md border border-sky-aqua/20 bg-sky-aqua/10 px-2 py-1 text-sky-aqua">
                      입력완료 {filledRowCount}행
                    </span>
                    <span className="rounded-md border border-tropical-teal/20 bg-tropical-teal/10 px-2 py-1 text-tropical-teal">
                      총 수량 {totalQuantity.toLocaleString("ko-KR")}
                    </span>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 py-3">
                <section className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-500">옵티명</p>
                      <Input
                        value={draft.opti_name}
                        onChange={(event) => handleHeaderChange("opti_name", event.target.value)}
                        placeholder="옵티명을 입력하세요"
                        className="h-9 bg-white text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-500">옵티번호</p>
                      <Input
                        value={draft.opti_number}
                        onChange={(event) => handleHeaderChange("opti_number", event.target.value)}
                        placeholder="옵티번호를 입력하세요"
                        className="h-9 bg-white text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-500">계약번호</p>
                      <Input
                        value={draft.contract_number}
                        onChange={(event) => handleHeaderChange("contract_number", event.target.value)}
                        placeholder="계약번호를 입력하세요"
                        className="h-9 bg-white text-sm"
                      />
                    </div>
                  </div>
                </section>

                <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-gray-200 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white/95 px-3 py-2">
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
                    <p className="text-xs text-gray-500">
                      입력 완료율 {rowCount > 0 ? Math.round((filledRowCount / rowCount) * 100) : 0}%
                    </p>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <div className="w-full">
                      <table className="w-full table-fixed border-separate border-spacing-0">
                      <thead className="sticky top-0 z-20">
                        <tr className="bg-gray-100">
                          <th
                            className="border-b border-r border-gray-200 px-1.5 py-1.5 text-center text-[11px] font-semibold text-gray-500"
                            style={{ width: "42px" }}
                          >
                            #
                          </th>
                          {ORDER_DELIVERY_LINE_COLUMNS.map((column) => (
                            <th
                              key={column.key}
                              className="border-b border-r border-gray-200 px-1.5 py-1.5 text-left text-[11px] font-semibold text-gray-500"
                              style={{ width: column.width }}
                            >
                              {column.label}
                            </th>
                          ))}
                          <th
                            className="border-b border-gray-200 px-1.5 py-1.5 text-center text-[11px] font-semibold text-gray-500"
                            style={{ width: "80px" }}
                          >
                            행작업
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.lines.map((line, rowIndex) => (
                          <tr
                            key={`${line.id ?? "new"}-${rowIndex}`}
                            className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50/40"}
                          >
                            <td className="border-b border-r border-gray-200 px-1.5 py-0 text-center text-[11px] font-semibold text-gray-500">
                              {rowIndex + 1}
                            </td>
                            {ORDER_DELIVERY_LINE_COLUMNS.map((column) => {
                              const value =
                                column.type === "number"
                                  ? String(typeof line[column.key] === "number" ? line[column.key] : 0)
                                  : String(line[column.key] ?? "")

                              return (
                                <td key={column.key} className="border-b border-r border-gray-200 p-0 align-middle">
                                  <Input
                                    type={column.type}
                                    min={column.type === "number" ? 0 : undefined}
                                    value={value}
                                    onChange={(event) => handleLineChange(rowIndex, column.key, event.target.value)}
                                    placeholder={column.placeholder}
                                    className={`h-8 rounded-none border-0 bg-transparent px-1.5 text-[11px] text-gray-700 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-aqua/50 ${column.type === "number" ? "text-right tabular-nums" : ""}`}
                                  />
                                </td>
                              )
                            })}
                            <td className="border-b border-gray-200 px-0.5 py-0 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateRow(rowIndex)}
                                  className="inline-flex h-6 items-center justify-center rounded-md border border-gray-200 px-1.5 text-[10px] font-medium text-gray-600 transition-colors hover:bg-gray-100"
                                  aria-label={`${rowIndex + 1}행 복제`}
                                  title="행 복제"
                                >
                                  복제
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRow(rowIndex)}
                                  disabled={draft.lines.length <= 1}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-soft-blush transition-colors hover:bg-soft-blush/10 disabled:cursor-not-allowed disabled:opacity-30"
                                  aria-label={`${rowIndex + 1}행 삭제`}
                                  title={draft.lines.length <= 1 ? "최소 1행은 유지됩니다." : "행 삭제"}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </div>
                </section>
              </div>

              <DialogFooter className="border-t border-gray-200 bg-white px-5 py-3 sm:justify-between">
                <button
                  type="button"
                  onClick={() => {
                    void handleDelete()
                  }}
                  disabled={!draft.id || isDeleting}
                  className="rounded-md border border-soft-blush/50 px-3 py-1.5 text-xs text-soft-blush hover:bg-soft-blush/10 disabled:opacity-40"
                >
                  {isDeleting ? "삭제 중..." : "카드 삭제"}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleSave()
                    }}
                    disabled={!draft.id || isSaving}
                    className="rounded-md bg-sky-aqua px-3 py-1.5 text-xs text-white hover:bg-sky-aqua/90 disabled:opacity-40"
                  >
                    {isSaving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
