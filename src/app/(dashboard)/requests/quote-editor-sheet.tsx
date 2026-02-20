"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Plus, Trash2, Save } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import type { QuotationWithItems } from "@/types"

// ----- 품목 행 타입 -----
interface ItemRow {
  item_name: string
  specification: string
  unit: string
  quantity: number
  unit_price: number
  amount: number
  memo: string
}

// ----- Props -----
interface QuoteEditorSheetProps {
  open: boolean
  onClose: () => void
  requestId: string
  customerId?: string | null
  customerName?: string
  quotation?: QuotationWithItems | null // 수정 시
  onSaved: () => void // 저장 후 목록 갱신 콜백
}

// 빈 품목 행 생성
function emptyRow(): ItemRow {
  return {
    item_name: "",
    specification: "",
    unit: "",
    quantity: 1,
    unit_price: 0,
    amount: 0,
    memo: "",
  }
}

// 셀 좌표 (행, 열)
type CellPos = { row: number; col: number }

// 편집 가능한 열 목록 (Tab 이동 순서)
const EDITABLE_COLS = [
  "item_name",
  "specification",
  "unit",
  "quantity",
  "unit_price",
  "memo",
] as const

export default function QuoteEditorSheet({
  open,
  onClose,
  requestId,
  customerId,
  customerName,
  quotation,
  onSaved,
}: QuoteEditorSheetProps) {
  // 헤더 필드
  const [title, setTitle] = useState("")
  const [quotationDate, setQuotationDate] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [notes, setNotes] = useState("")

  // 품목 목록
  const [items, setItems] = useState<ItemRow[]>([emptyRow()])

  // 포커스 셀 추적
  const [focusCell, setFocusCell] = useState<CellPos | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  // 저장 상태
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  // 삭제 상태
  const [isDeleting, setIsDeleting] = useState(false)

  // 수정 모드 초기화
  useEffect(() => {
    if (open) {
      if (quotation) {
        // 수정 모드: 기존 데이터 로드
        setTitle(quotation.title)
        setQuotationDate(quotation.quotation_date)
        setNotes(quotation.notes || "")
        setItems(
          quotation.items.map((item) => ({
            item_name: item.item_name,
            specification: item.specification || "",
            unit: item.unit || "",
            quantity: item.quantity,
            unit_price: item.unit_price,
            amount: item.amount,
            memo: item.memo || "",
          }))
        )
      } else {
        // 신규 모드: 초기화
        setTitle("")
        setQuotationDate(new Date().toISOString().split("T")[0])
        setNotes("")
        setItems([emptyRow()])
      }
      setSaveError("")
      setFocusCell(null)
    }
  }, [open, quotation])

  // 품목 수량 × 단가 = 금액 자동 계산
  const updateItem = useCallback(
    (index: number, field: keyof ItemRow, value: string | number) => {
      setItems((prev) => {
        const next = [...prev]
        const row = { ...next[index] }

        if (field === "quantity" || field === "unit_price") {
          ;(row[field] as number) = Number(value) || 0
          row.amount = row.quantity * row.unit_price
        } else {
          ;(row[field] as string) = value as string
        }

        next[index] = row
        return next
      })
    },
    []
  )

  // 행 추가
  const addRow = useCallback(() => {
    setItems((prev) => [...prev, emptyRow()])
    // 새 행의 첫 열로 포커스
    setTimeout(() => {
      setFocusCell({ row: items.length, col: 0 })
    }, 50)
  }, [items.length])

  // 행 삭제 (최소 1행 유지)
  const removeRow = useCallback(
    (index: number) => {
      if (items.length <= 1) return
      setItems((prev) => prev.filter((_, i) => i !== index))
    },
    [items.length]
  )

  // 합계 계산
  const totalAmount = items.reduce((sum, row) => sum + row.quantity * row.unit_price, 0)
  const taxAmount = Math.round(totalAmount * 0.1)
  const grandTotal = totalAmount + taxAmount

  // 키보드 네비게이션 (Tab, Enter)
  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent, row: number, col: number) => {
      if (e.key === "Tab") {
        e.preventDefault()
        if (e.shiftKey) {
          // 이전 셀
          if (col > 0) {
            setFocusCell({ row, col: col - 1 })
          } else if (row > 0) {
            setFocusCell({ row: row - 1, col: EDITABLE_COLS.length - 1 })
          }
        } else {
          // 다음 셀
          if (col < EDITABLE_COLS.length - 1) {
            setFocusCell({ row, col: col + 1 })
          } else if (row < items.length - 1) {
            setFocusCell({ row: row + 1, col: 0 })
          } else {
            // 마지막 행, 마지막 열 → 새 행 추가
            addRow()
          }
        }
      } else if (e.key === "Enter") {
        e.preventDefault()
        if (row < items.length - 1) {
          setFocusCell({ row: row + 1, col })
        } else {
          // 마지막 행 → 새 행 추가
          addRow()
        }
      }
    },
    [items.length, addRow]
  )

  // 저장 핸들러
  const handleSave = async () => {
    if (!title.trim()) {
      setSaveError("견적서 제목을 입력해주세요")
      return
    }

    // 빈 품목 필터링 (item_name이 있는 것만)
    const validItems = items.filter((item) => item.item_name.trim())
    if (validItems.length === 0) {
      setSaveError("최소 1개의 품목을 입력해주세요")
      return
    }

    setIsSaving(true)
    setSaveError("")

    try {
      const payload = {
        ...(quotation ? { id: quotation.id } : {}),
        title: title.trim(),
        quotation_date: quotationDate,
        request_id: requestId,
        customer_id: customerId || null,
        notes: notes || null,
        items: validItems.map((item) => ({
          item_name: item.item_name.trim(),
          specification: item.specification || null,
          unit: item.unit || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          memo: item.memo || null,
        })),
      }

      const res = await fetch("/api/quotes", {
        method: quotation ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const result = await res.json()
        setSaveError(result.error || "저장 실패")
        return
      }

      onSaved()
      onClose()
    } catch (e: unknown) {
      setSaveError("네트워크 오류: " + (e instanceof Error ? e.message : "알 수 없는 오류"))
    } finally {
      setIsSaving(false)
    }
  }

  // 삭제 핸들러
  const handleDelete = async () => {
    if (!quotation) return
    if (!confirm("이 견적서를 삭제하시겠습니까?")) return

    setIsDeleting(true)
    try {
      const res = await fetch("/api/quotes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quotation.id }),
      })

      if (!res.ok) {
        const result = await res.json()
        alert("삭제 실패: " + (result.error || "알 수 없는 오류"))
        return
      }

      onSaved()
      onClose()
    } catch (e: unknown) {
      alert("네트워크 오류: " + (e instanceof Error ? e.message : "알 수 없는 오류"))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="left"
        className="!max-w-[900px] w-[900px] p-0 flex flex-col"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="font-heading text-xl">
            {quotation ? "견적서 수정" : "새 견적서"}
          </SheetTitle>
          <SheetDescription className="text-sm text-gray-500">
            품목을 입력하고 저장하세요. Tab/Enter로 셀을 이동할 수 있습니다.
          </SheetDescription>
        </SheetHeader>

        {/* 스크롤 가능한 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* 헤더 필드 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 제목 */}
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                견적서 제목 <span className="text-soft-blush">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: OO 현장 견적서"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-aqua/50 focus:border-sky-aqua"
              />
            </div>

            {/* 견적일 */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                견적일
              </label>
              <input
                type="date"
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-aqua/50 focus:border-sky-aqua"
              />
            </div>

            {/* 고객 (읽기전용) */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                고객
              </label>
              <div className="px-3 py-2 text-sm border border-gray-100 rounded-lg bg-gray-50 text-gray-600">
                {customerName || "미연결"}
              </div>
            </div>

            {/* 견적번호 (수정 시 읽기전용) */}
            {quotation && (
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">
                  견적번호
                </label>
                <div className="px-3 py-2 text-sm border border-gray-100 rounded-lg bg-gray-50 text-gray-600">
                  {quotation.quotation_number}
                </div>
              </div>
            )}
          </div>

          {/* 엑셀 스타일 테이블 */}
          <div ref={tableRef}>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* 테이블 헤더 */}
              <div className="grid grid-cols-[40px_1fr_120px_60px_80px_100px_100px_1fr_40px] bg-gray-50 border-b border-gray-200">
                <div className="px-2 py-2 text-[11px] font-semibold text-gray-500 text-center">
                  #
                </div>
                <div className="px-2 py-2 text-[11px] font-semibold text-gray-500">
                  품목명 *
                </div>
                <div className="px-2 py-2 text-[11px] font-semibold text-gray-500">
                  규격
                </div>
                <div className="px-2 py-2 text-[11px] font-semibold text-gray-500">
                  단위
                </div>
                <div className="px-2 py-2 text-[11px] font-semibold text-gray-500 text-right">
                  수량
                </div>
                <div className="px-2 py-2 text-[11px] font-semibold text-gray-500 text-right">
                  단가
                </div>
                <div className="px-2 py-2 text-[11px] font-semibold text-gray-500 text-right">
                  금액
                </div>
                <div className="px-2 py-2 text-[11px] font-semibold text-gray-500">
                  비고
                </div>
                <div />
              </div>

              {/* 품목 행 */}
              {items.map((item, rowIdx) => (
                <div
                  key={rowIdx}
                  className="grid grid-cols-[40px_1fr_120px_60px_80px_100px_100px_1fr_40px] border-b border-gray-100 last:border-b-0 hover:bg-sky-aqua/5 transition-colors"
                >
                  {/* 행 번호 */}
                  <div className="px-2 py-1.5 text-[11px] text-gray-400 text-center self-center">
                    {rowIdx + 1}
                  </div>

                  {/* 품목명 */}
                  <EditableCell
                    value={item.item_name}
                    onChange={(v) => updateItem(rowIdx, "item_name", v)}
                    onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 0)}
                    autoFocus={
                      focusCell?.row === rowIdx && focusCell?.col === 0
                    }
                    placeholder="품목명"
                  />

                  {/* 규격 */}
                  <EditableCell
                    value={item.specification}
                    onChange={(v) => updateItem(rowIdx, "specification", v)}
                    onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 1)}
                    autoFocus={
                      focusCell?.row === rowIdx && focusCell?.col === 1
                    }
                    placeholder="규격"
                  />

                  {/* 단위 */}
                  <EditableCell
                    value={item.unit}
                    onChange={(v) => updateItem(rowIdx, "unit", v)}
                    onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 2)}
                    autoFocus={
                      focusCell?.row === rowIdx && focusCell?.col === 2
                    }
                    placeholder="식"
                  />

                  {/* 수량 */}
                  <EditableNumericCell
                    value={item.quantity}
                    onChange={(v) => updateItem(rowIdx, "quantity", v)}
                    onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 3)}
                    autoFocus={
                      focusCell?.row === rowIdx && focusCell?.col === 3
                    }
                  />

                  {/* 단가 */}
                  <EditableNumericCell
                    value={item.unit_price}
                    onChange={(v) => updateItem(rowIdx, "unit_price", v)}
                    onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 4)}
                    autoFocus={
                      focusCell?.row === rowIdx && focusCell?.col === 4
                    }
                  />

                  {/* 금액 (읽기전용) */}
                  <div className="px-2 py-1.5 text-sm text-right self-center text-gray-700 font-medium tabular-nums">
                    {(item.quantity * item.unit_price).toLocaleString()}
                  </div>

                  {/* 비고 */}
                  <EditableCell
                    value={item.memo}
                    onChange={(v) => updateItem(rowIdx, "memo", v)}
                    onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 5)}
                    autoFocus={
                      focusCell?.row === rowIdx && focusCell?.col === 5
                    }
                    placeholder=""
                  />

                  {/* 삭제 버튼 */}
                  <div className="flex items-center justify-center">
                    <button
                      onClick={() => removeRow(rowIdx)}
                      disabled={items.length <= 1}
                      className="p-1 rounded text-gray-300 hover:text-soft-blush hover:bg-soft-blush/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="행 삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 행 추가 버튼 */}
            <button
              onClick={addRow}
              className="w-full mt-2 py-2 flex items-center justify-center gap-1.5 text-sm text-sky-aqua border-2 border-dashed border-sky-aqua/30 rounded-lg hover:border-sky-aqua hover:bg-sky-aqua/5 transition-all"
            >
              <Plus className="h-4 w-4" />
              행 추가
            </button>
          </div>

          {/* 합계 영역 */}
          <div className="flex justify-end">
            <div className="w-[300px] space-y-2 border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">공급가액</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">부가세 (10%)</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(taxAmount)}
                </span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between text-base">
                <span className="font-semibold text-gray-900">합계</span>
                <span className="font-bold text-sky-aqua tabular-nums">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* 비고 */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              비고 / 특이사항
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="견적 관련 특이사항을 입력하세요"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-aqua/50 focus:border-sky-aqua resize-none"
            />
          </div>
        </div>

        {/* 하단 액션 바 */}
        <div className="px-6 py-4 border-t bg-white shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* 수정 모드일 때 삭제 버튼 */}
            {quotation && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm rounded-lg border border-soft-blush/50 text-soft-blush hover:bg-soft-blush/10 transition-colors disabled:opacity-50"
              >
                {isDeleting ? "삭제 중..." : "삭제"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {saveError && (
              <span className="text-sm text-soft-blush">{saveError}</span>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 text-sm rounded-lg bg-sky-aqua text-white hover:bg-sky-aqua/80 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ----- 텍스트 편집 셀 -----
function EditableCell({
  value,
  onChange,
  onKeyDown,
  autoFocus,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  autoFocus?: boolean
  placeholder?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className="w-full px-2 py-1.5 text-sm bg-transparent border-0 focus:outline-none focus:bg-sky-aqua/5 placeholder:text-gray-300"
    />
  )
}

// ----- 숫자 편집 셀 -----
function EditableNumericCell({
  value,
  onChange,
  onKeyDown,
  autoFocus,
}: {
  value: number
  onChange: (v: number) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  autoFocus?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  // 포커스 시 전체 내용을 표시, 포커스 아닐 때 포맷팅
  const [isFocused, setIsFocused] = useState(false)
  const [editValue, setEditValue] = useState(String(value))

  // 외부에서 value 변경 시 동기화
  useEffect(() => {
    if (!isFocused) {
      setEditValue(String(value))
    }
  }, [value, isFocused])

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [autoFocus])

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={isFocused ? editValue : value.toLocaleString()}
      onChange={(e) => {
        // 숫자와 소수점만 허용
        const raw = e.target.value.replace(/[^0-9.]/g, "")
        setEditValue(raw)
        onChange(Number(raw) || 0)
      }}
      onFocus={() => {
        setIsFocused(true)
        setEditValue(String(value))
        setTimeout(() => inputRef.current?.select(), 0)
      }}
      onBlur={() => {
        setIsFocused(false)
      }}
      onKeyDown={onKeyDown}
      className="w-full px-2 py-1.5 text-sm text-right bg-transparent border-0 focus:outline-none focus:bg-sky-aqua/5 tabular-nums"
    />
  )
}
