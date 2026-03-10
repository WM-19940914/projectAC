"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Calendar, Info, Plus, Trash2, Receipt } from "lucide-react"

// ─────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────
type ExpenseCategory = "장비" | "설치"

type ExpenseItem = {
  id: string
  category: ExpenseCategory
  is_unpaid: boolean          // 미지급(지급예정)
  needs_tax_invoice: boolean  // 세금계산서 수신 필요
  expense_date: string        // 지출일자
  amount: number              // 금액(VAT 제외)
  vendor: string              // 거래처
  payment_method: string      // 결제수단
  description: string         // 거래 내용
}

// 결제수단 목록
const PAYMENT_METHODS = ["DPS결제", "계좌이체", "카드", "현금", "기타"] as const

// VAT 포함 금액 계산 (공급가액 × 1.1)
function calcVatIncluded(amount: number): number {
  return Math.floor(amount * 1.1)
}

// 오늘 날짜를 YYYY-MM-DD 포맷으로
function todayString(): string {
  return new Date().toISOString().split("T")[0]
}

// Date → YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

// YYYY-MM-DD → Date
function parseDate(str: string): Date | undefined {
  if (!str) return undefined
  const d = new Date(str)
  return isNaN(d.getTime()) ? undefined : d
}

function formatCurrency(value: number): string {
  return value.toLocaleString("ko-KR")
}

// 빈 지출 폼 초기값
function createEmptyForm(): Omit<ExpenseItem, "id" | "category"> {
  return {
    is_unpaid: false,
    needs_tax_invoice: false,
    expense_date: todayString(),
    amount: 0,
    vendor: "",
    payment_method: "",
    description: "",
  }
}

// ExpenseItem → 폼 형태로 변환 (수정 시 사용)
function itemToForm(item: ExpenseItem): Omit<ExpenseItem, "id" | "category"> {
  return {
    is_unpaid: item.is_unpaid,
    needs_tax_invoice: item.needs_tax_invoice,
    expense_date: item.expense_date,
    amount: item.amount,
    vendor: item.vendor,
    payment_method: item.payment_method,
    description: item.description,
  }
}

// ─────────────────────────────────────────
// 지출 추가/수정 Dialog
// ─────────────────────────────────────────
function ExpenseDialog({
  open,
  category,
  editingItem,  // 수정 모드일 때 기존 아이템 전달
  onClose,
  onSave,       // 추가 또는 수정 모두 처리
}: {
  open: boolean
  category: ExpenseCategory
  editingItem?: ExpenseItem
  onClose: () => void
  onSave: (item: Omit<ExpenseItem, "id">, editId?: string) => void
}) {
  const [form, setForm] = useState(createEmptyForm)
  const [amountInput, setAmountInput] = useState("")
  const [calendarOpen, setCalendarOpen] = useState(false)

  // 수정 모드 진입 시 폼에 기존 데이터 채우기
  useEffect(() => {
    if (open) {
      if (editingItem) {
        setForm(itemToForm(editingItem))
        setAmountInput(editingItem.amount > 0 ? formatCurrency(editingItem.amount) : "")
      } else {
        setForm(createEmptyForm())
        setAmountInput("")
      }
    }
  }, [open, editingItem])

  // 입력된 VAT 제외 금액 (숫자)
  const rawAmount = amountInput ? Number(amountInput.replace(/,/g, "")) : 0
  // VAT 포함 금액 자동 계산
  const vatIncluded = rawAmount > 0 ? calcVatIncluded(rawAmount) : 0

  // Dialog 닫힐 때 초기화
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      onClose()
    }
  }

  const handleSubmit = () => {
    const amount = Number.isFinite(rawAmount) ? Math.max(0, Math.round(rawAmount)) : 0
    onSave({ ...form, category, amount }, editingItem?.id)
    onClose()
  }

  const isEditMode = !!editingItem

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[540px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-gray-100">
          <DialogTitle className="font-sans text-base">
            {isEditMode ? "지출내역 수정" : "지출내역 추가"} — {category} 지출
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0">
          {/* ── 좌측: 플래그 토글 ── */}
          <div className="w-32 shrink-0 border-r border-gray-100 bg-gray-50/60 px-3 py-4 space-y-2.5">
            {/* 미지급 토글 — 활성화 시 soft-blush 강조 */}
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, is_unpaid: !prev.is_unpaid }))}
              className={
                form.is_unpaid
                  ? "w-full rounded-lg border border-red-300 bg-red-100 px-2.5 py-2.5 text-left transition-all"
                  : "w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2.5 text-left hover:border-red-300 transition-all"
              }
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={
                  form.is_unpaid
                    ? "inline-block h-1.5 w-1.5 rounded-full bg-red-500 shrink-0"
                    : "inline-block h-1.5 w-1.5 rounded-full bg-gray-300 shrink-0"
                } />
                <span className={
                  form.is_unpaid
                    ? "text-[10px] font-bold text-gray-700"
                    : "text-[10px] font-medium text-gray-400"
                }>
                  미지급
                </span>
              </div>
              <p className={
                form.is_unpaid
                  ? "text-[9px] leading-snug text-gray-600"
                  : "text-[9px] leading-snug text-gray-300"
              }>
                {form.is_unpaid ? "아직 지급 전이에요" : "지급 완료 상태"}
              </p>
            </button>

            {/* 세금계산서 토글 — 활성화 시 soft-blush 강조 */}
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, needs_tax_invoice: !prev.needs_tax_invoice }))}
              className={
                form.needs_tax_invoice
                  ? "w-full rounded-lg border border-red-300 bg-red-100 px-2.5 py-2.5 text-left transition-all"
                  : "w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2.5 text-left hover:border-red-300 transition-all"
              }
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={
                  form.needs_tax_invoice
                    ? "inline-block h-1.5 w-1.5 rounded-full bg-red-500 shrink-0"
                    : "inline-block h-1.5 w-1.5 rounded-full bg-gray-300 shrink-0"
                } />
                <span className={
                  form.needs_tax_invoice
                    ? "text-[10px] font-bold text-gray-700"
                    : "text-[10px] font-medium text-gray-400"
                }>
                  세금계산서
                </span>
              </div>
              <p className={
                form.needs_tax_invoice
                  ? "text-[9px] leading-snug text-gray-600"
                  : "text-[9px] leading-snug text-gray-300"
              }>
                {form.needs_tax_invoice ? "아직 못 받았어요" : "수신 완료 상태"}
              </p>
            </button>
          </div>

          {/* ── 우측: 입력 필드 ── */}
          <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto max-h-[70vh]">

            {/* 지출일자 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500">
                지출일자 <span className="text-red-500">*</span>
              </Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 hover:border-slate-400 focus:outline-none"
                  >
                    <span>{form.expense_date || "날짜 선택"}</span>
                    <Calendar className="h-4 w-4 text-gray-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <CalendarPicker
                    mode="single"
                    selected={parseDate(form.expense_date)}
                    onSelect={(date) => {
                      setForm((prev) => ({ ...prev, expense_date: date ? formatDate(date) : todayString() }))
                      setCalendarOpen(false)
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* 금액: VAT 제외 입력 + VAT 포함 자동표시 */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label className="text-xs font-medium text-gray-500">금액</Label>
                <span className="text-red-500 text-xs">*</span>
              </div>
              <div className="flex gap-2">
                {/* VAT 제외 입력 */}
                <div className="flex-1 space-y-1">
                  <div className="relative">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={amountInput}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^0-9]/g, "")
                        setAmountInput(digits ? Number(digits).toLocaleString("ko-KR") : "")
                      }}
                      placeholder="0"
                      className="h-9 pr-8 text-right tabular-nums text-sm font-semibold text-slate-700"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">원</span>
                  </div>
                  <p className="text-[10px] text-slate-500 text-right font-medium">VAT 제외</p>
                </div>

                {/* 구분 화살표 */}
                <div className="flex flex-col items-center justify-center pt-0.5 pb-5 gap-0.5">
                  <div className="w-px h-2.5 bg-gray-200" />
                  <span className="text-[9px] text-gray-300 font-medium leading-none">+10%</span>
                  <div className="w-px h-2.5 bg-gray-200" />
                </div>

                {/* VAT 포함 자동계산 표시 — 회색 처리 */}
                <div className="flex-1 space-y-1">
                  <div className="flex h-9 items-center justify-end rounded-md bg-gray-50 border border-gray-200 px-3 gap-1">
                    <span className="tabular-nums text-sm font-semibold text-gray-500">
                      {vatIncluded > 0 ? formatCurrency(vatIncluded) : "—"}
                    </span>
                    <span className="text-xs text-gray-400">원</span>
                  </div>
                  <p className="text-[10px] text-gray-400 text-right font-medium">VAT 포함</p>
                </div>
              </div>

              {/* 결제수단 — 뱃지 토글 방식 */}
              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                <span className="text-[10px] text-gray-400 shrink-0 mr-0.5">결제수단</span>
                {PAYMENT_METHODS.map((m) => {
                  const isSelected = form.payment_method === m
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          // 이미 선택된 뱃지 다시 클릭하면 해제
                          payment_method: prev.payment_method === m ? "" : m,
                        }))
                      }
                      className={
                        isSelected
                          ? "inline-flex h-5 items-center rounded-full border border-slate-400 bg-slate-50 px-2 text-[10px] font-semibold text-slate-700 transition-colors"
                          : "inline-flex h-5 items-center rounded-full border border-gray-200 bg-white px-2 text-[10px] font-medium text-gray-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
                      }
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 거래처 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500">거래처</Label>
              <Input
                value={form.vendor}
                onChange={(e) => setForm((prev) => ({ ...prev, vendor: e.target.value }))}
                placeholder="거래처명"
                className="h-9 text-sm"
              />
            </div>

            {/* 거래 내용 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500">거래 내용</Label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={
                  category === "장비"
                    ? "삼성전자 장비 or 사매입 장비 등 장비지출 내용을 입력하세요."
                    : "설치 작업 내용 등 설치지출 내용을 입력하세요."
                }
                rows={3}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className="border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full rounded-lg bg-slate-700 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            {isEditMode ? "수정하기" : "추가하기"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────
// 지출 카드 (목록 아이템) — 클릭 시 수정 Dialog 오픈
// ─────────────────────────────────────────
function ExpenseCard({
  item,
  onEdit,
  onDelete,
}: {
  item: ExpenseItem
  onEdit: (item: ExpenseItem) => void
  onDelete: (id: string) => void
}) {
  const vatIncluded = calcVatIncluded(item.amount)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(item)}
      onKeyDown={(e) => e.key === "Enter" && onEdit(item)}
      className="rounded-lg border border-gray-200 bg-white px-3.5 pt-3 pb-3 cursor-pointer hover:border-slate-400 hover:shadow-sm transition-all"
    >
      {/* 1행: 지출일자 + 배지 + 삭제 버튼 */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="text-xs font-bold text-gray-800 shrink-0">{item.expense_date}</span>
          {item.is_unpaid && (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-red-300 bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-700">
              <span className="inline-block h-1 w-1 rounded-full bg-red-500" />
              미지급
            </span>
          )}
          {item.needs_tax_invoice && (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-red-300 bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-700">
              <span className="inline-block h-1 w-1 rounded-full bg-red-500" />
              세금계산서
            </span>
          )}
        </div>
        {/* 삭제 버튼 — 우측 상단 고정 */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(item.id)
          }}
          className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 2행: 거래처 / 거래내용 (항상 표시) */}
      <div className="space-y-0.5 mb-2.5">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="w-[42px] shrink-0 whitespace-nowrap text-gray-400">거래처</span>
          <span className="font-medium text-gray-800 truncate">{item.vendor || ""}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="w-[42px] shrink-0 whitespace-nowrap text-gray-400">거래내용</span>
          <span className="text-gray-700 truncate">{item.description || ""}</span>
        </div>
      </div>

      {/* 3행: 금액 1행 인라인 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-slate-500">VAT별도</span>
          <span className="tabular-nums text-sm font-semibold text-slate-700">{formatCurrency(item.amount)}<span className="ml-0.5 text-[10px] font-normal text-slate-400">원</span></span>
        </div>
        <div className="w-px h-3 bg-gray-200" />
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-gray-400">VAT포함</span>
          <span className="tabular-nums text-sm font-semibold text-gray-500">{formatCurrency(vatIncluded)}<span className="ml-0.5 text-[10px] font-normal text-gray-400">원</span></span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// 지출 섹션 (장비 or 설치)
// ─────────────────────────────────────────
function ExpenseSection({
  category,
  items,
  onAdd,
  onUpdate,
  onDelete,
}: {
  category: ExpenseCategory
  items: ExpenseItem[]
  onAdd: (item: Omit<ExpenseItem, "id">) => void
  onUpdate: (id: string, item: Omit<ExpenseItem, "id">) => void
  onDelete: (id: string) => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  // 수정 중인 아이템 (없으면 추가 모드)
  const [editingItem, setEditingItem] = useState<ExpenseItem | undefined>(undefined)

  // 해당 카테고리 합계
  const total = items.reduce((sum, item) => sum + item.amount, 0)

  const openAdd = () => {
    setEditingItem(undefined)
    setDialogOpen(true)
  }

  const openEdit = (item: ExpenseItem) => {
    setEditingItem(item)
    setDialogOpen(true)
  }

  const handleSave = (data: Omit<ExpenseItem, "id">, editId?: string) => {
    if (editId) {
      onUpdate(editId, data)
    } else {
      onAdd(data)
    }
  }

  return (
    <div className="space-y-2.5">
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-700">{category} 지출</p>
          {items.length > 0 && (
            <span className="text-[11px] font-semibold tabular-nums text-slate-700">
              합계 {formatCurrency(total)}원 <span className="text-[9px] font-medium text-gray-400">VAT별도</span>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-600 hover:border-slate-400 hover:text-slate-700 transition-colors"
        >
          <Plus className="h-3 w-3" />
          지출 추가
        </button>
      </div>

      {/* 지출 목록 */}
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-6 text-center">
          <Receipt className="mx-auto mb-1.5 h-5 w-5 text-gray-200" />
          <p className="text-xs text-gray-400">등록된 {category} 지출이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ExpenseCard key={item.id} item={item} onEdit={openEdit} onDelete={onDelete} />
          ))}
        </div>
      )}

      <ExpenseDialog
        open={dialogOpen}
        category={category}
        editingItem={editingItem}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
    </div>
  )
}

// DB row → ExpenseItem 변환
function rowToExpenseItem(row: Record<string, unknown>): ExpenseItem {
  return {
    id: row.id as string,
    category: row.category as ExpenseCategory,
    expense_date: row.expense_date as string,
    amount: row.amount_excl_tax as number,
    vendor: (row.vendor as string) ?? "",
    payment_method: (row.payment_method as string) ?? "",
    description: (row.description as string) ?? "",
    // is_paid=false → 미지급
    is_unpaid: !(row.is_paid as boolean),
    // tax_invoice_received='미수령' → 세금계산서 필요
    needs_tax_invoice: row.tax_invoice_received === "미수령",
  }
}

// ─────────────────────────────────────────
// 반원 게이지 차트
// ─────────────────────────────────────────
function GaugeChart({ ratio }: { ratio: number }) {
  const cx = 90, cy = 85, r = 70
  const strokeW = 18
  // 반원 arc 길이
  const arcLen = Math.PI * r  // ≈ 219.9
  // 비율 (0~1 범위 제한)
  const clamped = Math.max(0, Math.min(1, ratio))
  const filledLen = clamped * arcLen

  // 반원: 왼쪽 → 오른쪽 (위로 볼록)
  const pathD = `M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`

  return (
    <svg viewBox="0 0 180 100" className="w-full h-full">
      {/* 배경 arc (sky-aqua = 남은 금액) */}
      <path
        d={pathD}
        fill="none"
        stroke="#334155"
        strokeWidth={strokeW}
        strokeLinecap="round"
      />
      {/* 채워진 arc (회색 = 지출 금액) */}
      {clamped > 0 && (
        <path
          d={pathD}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={`${filledLen} ${arcLen}`}
        />
      )}
    </svg>
  )
}

// ─────────────────────────────────────────
// 메인: ExpenseTab
// ─────────────────────────────────────────
export default function ExpenseTab({
  requestId,
  totalSettlement = 0,
  totalContractAmount = 0,
  incentiveTotal = 0,
}: {
  requestId: string
  totalSettlement?: number
  totalContractAmount?: number
  incentiveTotal?: number
}) {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 최초 마운트 시 DB에서 지출 목록 로드
  useEffect(() => {
    if (!requestId) return
    setIsLoading(true)
    fetch(`/api/expenses?request_id=${requestId}`)
      .then((r) => r.json())
      .then(({ data }) => {
        if (Array.isArray(data)) {
          setExpenses(data.map(rowToExpenseItem))
        }
      })
      .finally(() => setIsLoading(false))
  }, [requestId])

  const handleAdd = async (item: Omit<ExpenseItem, "id">) => {
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: requestId, ...item }),
    })
    const json = await res.json()
    if (json.id) {
      setExpenses((prev) => [...prev, { ...item, id: json.id }])
    }
  }

  const handleUpdate = async (id: string, item: Omit<ExpenseItem, "id">) => {
    await fetch("/api/expenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...item }),
    })
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...item, id } : e)))
  }

  const handleDelete = async (id: string) => {
    // 낙관적 업데이트: UI 먼저 반영 후 API 호출
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    await fetch("/api/expenses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
  }

  // 지출일자 오름차순 정렬 (과거 → 현재)
  const sortByDate = (a: ExpenseItem, b: ExpenseItem) => a.expense_date.localeCompare(b.expense_date)
  const equipmentItems = expenses.filter((e) => e.category === "장비").sort(sortByDate)
  const installItems = expenses.filter((e) => e.category === "설치").sort(sortByDate)

  // 전체 합계
  const grandTotal = expenses.reduce((sum, e) => sum + e.amount, 0)

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-16 rounded-lg bg-gray-100" />
        <div className="h-16 rounded-lg bg-gray-100" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 게이지 요약 카드 */}
      {(() => {
        // 순이익 = 총 정산금액(입금액) - 총 지출
        const netProfit = totalSettlement - grandTotal
        // 이익률 = 순이익 / 계약금액(VAT포함) × 100 (계약 없으면 0)
        const profitRate = totalContractAmount > 0
          ? (netProfit / totalContractAmount) * 100
          : 0
        // 게이지 비율: 지출 / 계약금액 (계약 없으면 0)
        const gaugeRatio = totalContractAmount > 0
          ? grandTotal / totalContractAmount
          : 0

        return (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-4">
            <div className="flex items-center justify-between">
              {/* 게이지 차트 — 확대 */}
              <div className="w-[140px] h-[82px] shrink-0">
                <GaugeChart ratio={gaugeRatio} />
              </div>

              {/* 우측 정보 — 우측 정렬 */}
              <div className="flex flex-col items-end gap-2">
                {/* 총 지출금액 */}
                <div className="text-right">
                  <p className="text-[10px] font-medium text-gray-400 mb-0.5">총 지출금액 <span className="text-gray-300">(VAT별도)</span></p>
                  <p className="text-lg font-bold tabular-nums text-gray-900 leading-none">
                    {formatCurrency(grandTotal)}
                    <span className="text-xs font-normal text-gray-400 ml-0.5">원</span>
                  </p>
                </div>

                {/* 순이익 + 이익률 뱃지 (세로, 우측 정렬, 컴팩트) */}
                <div className="flex flex-col items-end gap-1">
                  {/* 순이익 뱃지 — hover 시 산출 기준 툴팁 */}
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`inline-flex items-center gap-1 rounded-md px-2 py-1 cursor-default text-right ${netProfit >= 0 ? "bg-slate-50 border border-slate-200" : "bg-red-500/20 border border-red-300"}`}>
                          <Info className="h-2.5 w-2.5 shrink-0 text-gray-400" />
                          <span className="text-[10px] text-gray-500">순이익</span>
                          <span className={`text-[11px] font-bold tabular-nums ${netProfit >= 0 ? "text-slate-700" : "text-red-500"}`}>
                            {formatCurrency(netProfit)}원
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="end" className="w-56 p-3 text-[11px] space-y-1 text-gray-600 bg-white border border-gray-200 shadow-lg">
                        <p className="font-semibold text-gray-800 text-xs">산출 기준 (VAT별도)</p>
                        <p>순이익 = 정산 입금액 − 총 지출금액</p>
                        <p className="text-gray-400 text-[10px]">
                          {formatCurrency(totalSettlement)}원 − {formatCurrency(grandTotal)}원 = {formatCurrency(netProfit)}원
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* 이익률 뱃지 */}
                  <div className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${profitRate >= 0 ? "bg-slate-50 border border-slate-200" : "bg-red-500/20 border border-red-300"}`}>
                    <span className="text-[10px] text-gray-500">이익률</span>
                    <span className={`text-[11px] font-bold tabular-nums ${profitRate >= 0 ? "text-slate-700" : "text-red-500"}`}>
                      {profitRate.toFixed(2)}%
                    </span>
                  </div>

                  {/* 장려금 뱃지 — hover 시 설명 툴팁 */}
                  {incentiveTotal > 0 && (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex items-center gap-1 rounded-md px-2 py-1 cursor-default bg-slate-50 border border-slate-200">
                            <Info className="h-2.5 w-2.5 shrink-0 text-gray-400" />
                            <span className="text-[10px] text-gray-500">장려금</span>
                            <span className="text-[11px] font-bold tabular-nums text-slate-700">
                              {formatCurrency(incentiveTotal)}원
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="end" className="w-48 p-3 text-[11px] text-gray-600 bg-white border border-gray-200 shadow-lg">
                          <p>확정 견적서의 장려금 합계입니다</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}

                  {/* 총 이익 뱃지 — hover 시 산출 기준 툴팁 */}
                  {incentiveTotal > 0 && (() => {
                    const totalProfit = netProfit + incentiveTotal
                    return (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`inline-flex items-center gap-1 rounded-md px-2 py-1 cursor-default ${totalProfit >= 0 ? "bg-slate-50 border border-slate-200" : "bg-red-500/20 border border-red-300"}`}>
                              <Info className="h-2.5 w-2.5 shrink-0 text-gray-400" />
                              <span className="text-[10px] text-gray-500">총 이익</span>
                              <span className={`text-[11px] font-bold tabular-nums ${totalProfit >= 0 ? "text-slate-700" : "text-red-500"}`}>
                                {formatCurrency(totalProfit)}원
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" align="end" className="w-56 p-3 text-[11px] space-y-1 text-gray-600 bg-white border border-gray-200 shadow-lg">
                            <p className="font-semibold text-gray-800 text-xs">산출 기준 (VAT별도)</p>
                            <p>총 이익 = 순이익 + 장려금</p>
                            <p className="text-gray-400 text-[10px]">
                              {formatCurrency(netProfit)}원 + {formatCurrency(incentiveTotal)}원 = {formatCurrency(totalProfit)}원
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 장비 지출 */}
      <ExpenseSection
        category="장비"
        items={equipmentItems}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {/* 구분선 */}
      <div className="border-t border-gray-100" />

      {/* 설치 지출 */}
      <ExpenseSection
        category="설치"
        items={installItems}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  )
}
