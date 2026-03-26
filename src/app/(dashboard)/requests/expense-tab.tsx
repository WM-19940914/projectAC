"use client"

import { memo, useEffect, useRef, useState } from "react"
import { toast } from "@/hooks/use-toast"
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
import { AirVent, Calendar, ChartPie, Info, Pencil, Plus, Trash2, Receipt, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"

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

// 오늘 날짜를 YYYY-MM-DD 포맷으로 (로컬 시간 기준)
function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Date → YYYY-MM-DD (로컬 시간 기준 — toISOString()은 UTC라 날짜가 밀림!)
function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

// YYYY-MM-DD → Date (로컬 시간 기준으로 파싱)
function parseDate(str: string): Date | undefined {
  if (!str) return undefined
  // "2026-03-04" → 로컬 시간 2026년 3월 4일 00:00:00으로 생성
  const [y, m, d] = str.split("-").map(Number)
  if (!y || !m || !d) return undefined
  const date = new Date(y, m - 1, d)
  return isNaN(date.getTime()) ? undefined : date
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

  // Dialog 닫힐 때 — 저장하지 않고 닫기만 (저장은 추가하기/수정하기 버튼에서만)
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      onClose()
    }
  }

  const isEditMode = !!editingItem

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[540px] p-0 gap-0 overflow-hidden rounded-2xl">
        {/* ── 헤더 ── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
              {category === "장비" ? <AirVent className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
            </div>
            <div>
              <DialogTitle className="font-sans text-base font-bold text-slate-900">
                {isEditMode ? "지출내역 수정" : "지출내역 추가"}
              </DialogTitle>
              <p className="text-[11px] text-slate-400 mt-0.5">{category} 지출</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0">
          {/* ── 좌측: 플래그 토글 ── */}
          <div className="w-36 shrink-0 border-r border-slate-100 bg-slate-50/60 px-3 py-5 space-y-3">
            {/* 미지급 토글 */}
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, is_unpaid: !prev.is_unpaid }))}
              className={cn(
                "w-full rounded-xl border px-3 py-3 text-left transition-all",
                form.is_unpaid
                  ? "border-soft-blush bg-soft-blush/30 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={cn(
                  "inline-block h-2 w-2 rounded-full shrink-0",
                  form.is_unpaid ? "bg-red-500" : "bg-slate-300"
                )} />
                <span className={cn(
                  "text-[11px] font-bold",
                  form.is_unpaid ? "text-slate-800" : "text-slate-400"
                )}>
                  미지급
                </span>
              </div>
              <p className={cn(
                "text-[9px] leading-snug",
                form.is_unpaid ? "text-slate-600" : "text-slate-300"
              )}>
                {form.is_unpaid ? "아직 지급 전이에요" : "지급 완료 상태"}
              </p>
            </button>

            {/* 세금계산서 토글 */}
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, needs_tax_invoice: !prev.needs_tax_invoice }))}
              className={cn(
                "w-full rounded-xl border px-3 py-3 text-left transition-all",
                form.needs_tax_invoice
                  ? "border-soft-blush bg-soft-blush/30 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={cn(
                  "inline-block h-2 w-2 rounded-full shrink-0",
                  form.needs_tax_invoice ? "bg-red-500" : "bg-slate-300"
                )} />
                <span className={cn(
                  "text-[11px] font-bold",
                  form.needs_tax_invoice ? "text-slate-800" : "text-slate-400"
                )}>
                  세금계산서
                </span>
              </div>
              <p className={cn(
                "text-[9px] leading-snug",
                form.needs_tax_invoice ? "text-slate-600" : "text-slate-300"
              )}>
                {form.needs_tax_invoice ? "아직 못 받았어요" : "수신 완료 상태"}
              </p>
            </button>
          </div>

          {/* ── 우측: 입력 필드 ── */}
          <div className="flex-1 px-6 py-5 space-y-5 overflow-y-auto max-h-[70vh]">

            {/* 지출일자 */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                지출일자 <span className="text-red-500">*</span>
              </Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-10 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
                  >
                    <span>{form.expense_date || "날짜 선택"}</span>
                    <Calendar className="h-4 w-4 text-slate-400" />
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
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                금액 <span className="text-red-500">*</span>
              </Label>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex items-center gap-2">
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
                        className="h-10 pr-8 text-right tabular-nums text-sm font-semibold text-slate-700 bg-white rounded-lg"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">원</span>
                    </div>
                    <p className="text-[10px] text-slate-500 text-right font-medium">VAT 제외</p>
                  </div>

                  {/* 구분 화살표 */}
                  <div className="flex flex-col items-center justify-center pt-0.5 pb-5 gap-0.5">
                    <div className="w-px h-2 bg-slate-200" />
                    <span className="text-[9px] text-slate-300 font-bold leading-none">+10%</span>
                    <div className="w-px h-2 bg-slate-200" />
                  </div>

                  {/* VAT 포함 자동계산 표시 */}
                  <div className="flex-1 space-y-1">
                    <div className="flex h-10 items-center justify-end rounded-lg bg-slate-100 border border-slate-200 px-3 gap-1">
                      <span className="tabular-nums text-sm font-semibold text-slate-500">
                        {vatIncluded > 0 ? formatCurrency(vatIncluded) : "—"}
                      </span>
                      <span className="text-xs text-slate-400">원</span>
                    </div>
                    <p className="text-[10px] text-slate-400 text-right font-medium">VAT 포함</p>
                  </div>
                </div>

                {/* 결제수단 — 뱃지 토글 방식 */}
                <div className="flex items-center gap-1.5 pt-2.5 mt-2.5 border-t border-slate-200/70 flex-wrap">
                  <span className="text-[10px] text-slate-400 shrink-0 mr-0.5">결제수단</span>
                  {PAYMENT_METHODS.map((m) => {
                    const isSelected = form.payment_method === m
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            payment_method: prev.payment_method === m ? "" : m,
                          }))
                        }
                        className={cn(
                          "inline-flex h-6 items-center rounded-full border px-2.5 text-[10px] font-medium transition-colors",
                          isSelected
                            ? "border-slate-400 bg-slate-700 text-white"
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"
                        )}
                      >
                        {m}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* 거래처 */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">거래처</Label>
              <Input
                value={form.vendor}
                onChange={(e) => setForm((prev) => ({ ...prev, vendor: e.target.value }))}
                placeholder="거래처명"
                className="h-10 text-sm rounded-lg"
              />
            </div>

            {/* 거래 내용 */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">거래 내용</Label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={
                  category === "장비"
                    ? "삼성전자 장비 or 사매입 장비 등 장비지출 내용을 입력하세요."
                    : "설치 작업 내용 등 설치지출 내용을 입력하세요."
                }
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* ── 하단: 저장 버튼 ── */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <button
            type="button"
            disabled={rawAmount <= 0}
            onClick={() => {
              const amount = Number.isFinite(rawAmount) ? Math.max(0, Math.round(rawAmount)) : 0
              if (amount > 0) {
                onSave({ ...form, category, amount }, editingItem?.id)
              }
              onClose()
            }}
            className={cn(
              "w-full h-11 rounded-xl text-sm font-bold transition-all",
              rawAmount > 0
                ? "bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            )}
          >
            {rawAmount > 0
              ? `${formatCurrency(vatIncluded)}원 ${isEditMode ? "수정" : "추가"}하기 (VAT포함)`
              : "금액을 입력해주세요"
            }
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
      className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 transition-all hover:border-slate-300 hover:bg-white hover:shadow-sm"
    >
      {/* 1행: 날짜 + 배지 + 삭제 */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1 flex-wrap min-w-0">
          <span className="shrink-0 text-xs font-semibold text-slate-800">{item.expense_date}</span>
          {item.is_unpaid && (
            <span className="inline-flex items-center rounded-full bg-red-50 px-1.5 py-px text-[9px] font-medium text-red-600">
              미지급
            </span>
          )}
          {item.needs_tax_invoice && (
            <span className="inline-flex items-center rounded-full bg-red-50 px-1.5 py-px text-[9px] font-medium text-red-600">
              계산서
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(item.id)
          }}
          className="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-red-500/10 hover:text-red-500"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* 2행: 거래처 · 내용 — 1줄 컴팩트 */}
      <p className="mb-1.5 truncate text-[11px] text-slate-500">
        {item.vendor || "거래처 미입력"}{item.description ? ` · ${item.description}` : ""}
      </p>

      {/* 3행: 금액 (VAT별도 + VAT포함) — 숫자 위, 라벨 아래 */}
      <div className="flex items-start gap-3">
        <div className="flex flex-col">
          <span className="text-[11px] tabular-nums text-slate-400">{formatCurrency(item.amount)}원</span>
          <span className="text-[9px] text-slate-300">VAT별도</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold tabular-nums text-slate-900">{formatCurrency(vatIncluded)}원</span>
          <span className="text-[9px] text-slate-400">VAT포함</span>
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

  // 해당 카테고리 합계 (VAT포함)
  const total = items.reduce((sum, item) => sum + calcVatIncluded(item.amount), 0)

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
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm h-[310px] min-h-0 flex flex-col">
      {/* 섹션 헤더 — 고정 */}
      <div className="shrink-0 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">{category === "장비" ? <AirVent className="h-3.5 w-3.5 text-slate-400" /> : <Wrench className="h-3.5 w-3.5 text-slate-400" />}{category} 지출</p>
            {items.length > 0 && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 whitespace-nowrap">
                <span className="text-[10px] font-semibold tabular-nums text-slate-700">{formatCurrency(total)}</span>
                <span className="text-[8px] text-slate-400">VAT포함</span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-900 px-3 text-xs font-medium text-white transition-colors hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            추가
          </button>
        </div>
      </div>

      {/* 지출 목록 — 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 transparent" }}>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
            <Receipt className="mx-auto mb-2 h-5 w-5 text-slate-200" />
            <p className="text-xs text-slate-400">등록된 {category} 지출이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((item) => (
              <ExpenseCard key={item.id} item={item} onEdit={openEdit} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>

      <ExpenseDialog
        open={dialogOpen}
        category={category}
        editingItem={editingItem}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
    </section>
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
      {/* 배경 arc (연한 회색 = 전체 금액) */}
      <path
        d={pathD}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={strokeW}
        strokeLinecap="round"
      />
      {/* 채워진 arc (진한 슬레이트 = 지출 금액) */}
      {clamped > 0 && (
        <path
          d={pathD}
          fill="none"
          stroke="#475569"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={`${filledLen} ${arcLen}`}
        />
      )}
    </svg>
  )
}

// ─────────────────────────────────────────
// 수기 장려금 인라인 입력 컴포넌트
// ─────────────────────────────────────────
function InlineIncentiveInput({ value, onConfirm }: { value: number; onConfirm: (v: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // 편집 시작 시 현재 값을 텍스트로
  const startEdit = () => {
    setText(value > 0 ? String(value) : "")
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  // blur 또는 Enter 시 저장
  const handleSave = async () => {
    setEditing(false)
    const num = Math.max(0, Math.round(Number(text.replace(/,/g, "")) || 0))
    if (num !== value) {
      await onConfirm(num)
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        className="w-24 px-1.5 py-0.5 text-right text-xs border border-sky-aqua/50 rounded bg-white outline-none tabular-nums"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") inputRef.current?.blur()
          if (e.key === "Escape") setEditing(false)
        }}
        placeholder="VAT별도 금액"
      />
    )
  }

  return (
    <button
      onClick={startEdit}
      className="inline-flex items-center gap-1 text-xs font-medium tabular-nums text-slate-500 hover:text-sky-aqua transition-colors cursor-pointer"
      title="클릭하여 장려금 수기 입력 (VAT별도)"
    >
      {value > 0 ? (
        <>{formatCurrency(value + Math.floor(value * 0.1))}원</>
      ) : (
        <span className="text-slate-300">미입력</span>
      )}
      <Pencil className="h-2.5 w-2.5" />
    </button>
  )
}

// ─────────────────────────────────────────
// 메인: ExpenseTab
// ─────────────────────────────────────────
function ExpenseTab({
  requestId,
  totalSettlement = 0,
  totalContractAmount = 0,
  quoteIncentiveTotal = 0,
  manualIncentiveTotal = 0,
  manualIncentiveExclTax = 0,
  hasConfirmedQuote = false,
  onManualIncentiveChange,
  layout = "stacked",
}: {
  requestId: string
  totalSettlement?: number
  totalContractAmount?: number
  quoteIncentiveTotal?: number          // 확정견적서 장려금 (VAT포함)
  manualIncentiveTotal?: number         // 수동입력 장려금 (VAT포함)
  manualIncentiveExclTax?: number       // 수동입력 장려금 (VAT별도, 입력용)
  hasConfirmedQuote?: boolean           // 확정견적서 존재 여부
  onManualIncentiveChange?: (v: number) => Promise<void>
  layout?: "stacked" | "side-by-side"
}) {
  // 확정견적서 있으면 견적서 장려금, 없으면 수동 장려금
  const effectiveIncentive = hasConfirmedQuote ? quoteIncentiveTotal : manualIncentiveTotal
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
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId, ...item }),
      })
      const json = await res.json()
      if (json.id) {
        setExpenses((prev) => [...prev, { ...item, id: json.id }])
        toast({ title: "완료", description: "지출이 추가되었습니다" })
      } else {
        toast({ title: "오류", description: "지출 추가에 실패했습니다", variant: "destructive" })
      }
    } catch {
      toast({ title: "오류", description: "지출 추가에 실패했습니다", variant: "destructive" })
    }
  }

  const handleUpdate = async (id: string, item: Omit<ExpenseItem, "id">) => {
    try {
      const res = await fetch("/api/expenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...item }),
      })
      if (res.ok) {
        setExpenses((prev) => prev.map((e) => (e.id === id ? { ...item, id } : e)))
        toast({ title: "완료", description: "지출이 수정되었습니다" })
      } else {
        toast({ title: "오류", description: "지출 수정에 실패했습니다", variant: "destructive" })
      }
    } catch {
      toast({ title: "오류", description: "지출 수정에 실패했습니다", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    // 낙관적 업데이트: UI 먼저 반영 후 API 호출
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    try {
      const res = await fetch("/api/expenses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        toast({ title: "완료", description: "지출이 삭제되었습니다" })
      } else {
        toast({ title: "오류", description: "지출 삭제에 실패했습니다", variant: "destructive" })
      }
    } catch {
      toast({ title: "오류", description: "지출 삭제에 실패했습니다", variant: "destructive" })
    }
  }

  // 지출일자 오름차순 정렬 (과거 → 현재)
  const sortByDate = (a: ExpenseItem, b: ExpenseItem) => a.expense_date.localeCompare(b.expense_date)
  const equipmentItems = expenses.filter((e) => e.category === "장비").sort(sortByDate)
  const installItems = expenses.filter((e) => e.category === "설치").sort(sortByDate)

  // 전체 합계 (VAT포함)
  const grandTotal = expenses.reduce((sum, e) => sum + calcVatIncluded(e.amount), 0)

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-16 rounded-lg bg-gray-100" />
        <div className="h-16 rounded-lg bg-gray-100" />
      </div>
    )
  }

  // 게이지 요약 데이터 (side-by-side에서도 사용)
  const netProfit = totalSettlement - grandTotal
  const profitRate = totalContractAmount > 0
    ? (netProfit / totalContractAmount) * 100
    : 0
  const gaugeRatio = totalContractAmount > 0
    ? grandTotal / totalContractAmount
    : 0

  // side-by-side 레이아웃: 수익성 요약 | 장비 지출 | 설치 지출 — 3등분
  if (layout === "side-by-side") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* 1열: 수익성 요약 — 장비/설치 카드 3개 기준 높이 고정 */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm h-[310px] min-h-0 flex flex-col">
          <div className="shrink-0 px-4 pt-4 pb-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><ChartPie className="h-3.5 w-3.5 text-slate-400" />수익성 요약</p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 transparent" }}>
            {/* 게이지 + 총 지출 */}
            <div className="flex items-center gap-3">
              <div className="h-[72px] w-[120px] shrink-0">
                <GaugeChart ratio={gaugeRatio} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400">총 지출금액</p>
                <p className="text-lg font-bold tabular-nums text-slate-900">
                  {formatCurrency(grandTotal)}
                  <span className="ml-0.5 text-[10px] font-normal text-slate-400">원</span>
                </p>
                <p className="text-[10px] font-medium text-red-500">VAT 포함 기준</p>
              </div>
            </div>

            {/* 수익 지표 — 리스트형 + 툴팁 */}
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
              {/* 순이익 */}
              <div className="flex items-center justify-between">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 cursor-default">
                        <Info className="h-3 w-3" />
                        순이익
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start" className="w-56 p-3 text-[11px] space-y-1 text-gray-600 bg-white border border-gray-200 shadow-lg">
                      <p className="font-semibold text-gray-800 text-xs">산출 기준 (VAT포함)</p>
                      <p>순이익 = 정산 입금액 − 총 지출금액</p>
                      <p className="text-gray-400 text-[10px]">
                        {formatCurrency(totalSettlement)}원 − {formatCurrency(grandTotal)}원 = {formatCurrency(netProfit)}원
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className={`text-xs font-medium tabular-nums ${netProfit >= 0 ? "text-slate-600" : "text-red-500"}`}>
                  {formatCurrency(netProfit)}원
                </span>
              </div>

              {/* 이익률 */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 pl-4">이익률</span>
                <span className={`text-xs font-medium tabular-nums ${profitRate >= 0 ? "text-slate-600" : "text-red-500"}`}>
                  {profitRate.toFixed(2)}%
                </span>
              </div>

              {/* 장려금 — 확정견적서 있으면 자동, 없으면 수동입력 */}
              {hasConfirmedQuote ? (
                quoteIncentiveTotal > 0 && (
                  <div className="flex items-center justify-between">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500 cursor-default">
                            <Info className="h-3 w-3" />
                            장려금
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start" className="w-48 p-3 text-[11px] text-gray-600 bg-white border border-gray-200 shadow-lg">
                          <p>확정 견적서의 장려금 합계입니다</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <span className="text-xs font-medium tabular-nums text-slate-600">
                      {formatCurrency(quoteIncentiveTotal)}원
                    </span>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-between">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 cursor-default">
                          <Info className="h-3 w-3" />
                          장려금(수동)
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="start" className="w-48 p-3 text-[11px] text-gray-600 bg-white border border-gray-200 shadow-lg">
                        <p>수동 입력 장려금입니다 (VAT별도 금액 입력)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <InlineIncentiveInput
                    value={manualIncentiveExclTax}
                    onConfirm={async (v) => { if (onManualIncentiveChange) await onManualIncentiveChange(v) }}
                  />
                </div>
              )}

              {/* 총 이익 (장려금 있을 때만) */}
              {effectiveIncentive > 0 && (() => {
                const totalProfit = netProfit + effectiveIncentive
                return (
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 cursor-default">
                            <Info className="h-3 w-3 text-slate-400" />
                            총 이익
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start" className="w-56 p-3 text-[11px] space-y-1 text-gray-600 bg-white border border-gray-200 shadow-lg">
                          <p className="font-semibold text-gray-800 text-xs">산출 기준 (VAT포함)</p>
                          <p>총 이익 = 순이익 + 장려금</p>
                          <p className="text-gray-400 text-[10px]">
                            {formatCurrency(netProfit)}원 + {formatCurrency(effectiveIncentive)}원 = {formatCurrency(totalProfit)}원
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <span className={`text-sm font-bold tabular-nums ${totalProfit >= 0 ? "text-slate-800" : "text-red-500"}`}>
                      {formatCurrency(totalProfit)}원
                    </span>
                  </div>
                )
              })()}
            </div>
          </div>
        </section>

        {/* 2열: 장비 지출 */}
        <ExpenseSection
          category="장비"
          items={equipmentItems}
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />

        {/* 3열: 설치 지출 */}
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

  return (
    <div className="space-y-5">
      {/* 게이지 요약 카드 */}
      {(() => {
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
                  <p className="text-[10px] font-medium text-gray-400 mb-0.5">총 지출금액 <span className="text-gray-300">(VAT포함)</span></p>
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
                        <p className="font-semibold text-gray-800 text-xs">산출 기준 (VAT포함)</p>
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

                  {/* 장려금 뱃지 — 확정견적서 있으면 자동, 없으면 수동 */}
                  {hasConfirmedQuote ? (
                    quoteIncentiveTotal > 0 && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="inline-flex items-center gap-1 rounded-md px-2 py-1 cursor-default bg-slate-50 border border-slate-200">
                              <Info className="h-2.5 w-2.5 shrink-0 text-gray-400" />
                              <span className="text-[10px] text-gray-500">장려금</span>
                              <span className="text-[11px] font-bold tabular-nums text-slate-700">
                                {formatCurrency(quoteIncentiveTotal)}원
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" align="end" className="w-48 p-3 text-[11px] text-gray-600 bg-white border border-gray-200 shadow-lg">
                            <p>확정 견적서의 장려금 합계입니다</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )
                  ) : (
                    manualIncentiveTotal > 0 && (
                      <div className="inline-flex items-center gap-1 rounded-md px-2 py-1 bg-slate-50 border border-slate-200">
                        <span className="text-[10px] text-gray-500">장려금(수동)</span>
                        <span className="text-[11px] font-bold tabular-nums text-slate-700">
                          {formatCurrency(manualIncentiveTotal)}원
                        </span>
                      </div>
                    )
                  )}

                  {/* 총 이익 뱃지 — hover 시 산출 기준 툴팁 */}
                  {effectiveIncentive > 0 && (() => {
                    const totalProfit = netProfit + effectiveIncentive
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
                            <p className="font-semibold text-gray-800 text-xs">산출 기준 (VAT포함)</p>
                            <p>총 이익 = 순이익 + 장려금</p>
                            <p className="text-gray-400 text-[10px]">
                              {formatCurrency(netProfit)}원 + {formatCurrency(effectiveIncentive)}원 = {formatCurrency(totalProfit)}원
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

export default memo(ExpenseTab)
