"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { formatDate, formatDateTime, formatPhone, formatCurrency, formatShortDate } from "@/lib/format"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Banknote, Box, Briefcase, Building2, Calendar, CheckCircle2, Circle, ClipboardList, EyeOff, FileText, Hash, Mail, Pencil, Phone, Plus, Search, Trash2, Truck, Unlink, User, X, XCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { REQUEST_STATUSES } from "@/lib/constants"
import SalesTabNav from "@/components/layout/sales-tab-nav"
import QuoteEditorSheet from "../quotes/quote-editor-sheet"
import OrderDeliveryTab from "./order-delivery-tab"
import type { QuotationWithItems } from "@/types"

// ----- 타입 -----
interface RequestItem {
  id: string
  title: string
  inquiry_date: string | null
  status: string
  contract_id: string | null
  confirmed_quote_id: string | null
  memo: string | null
  created_at: string
  customer: {
    id: string
    company_name: string
    deleted_at: string | null
  } | null
}

interface KanbanColumn {
  status: string
  items: RequestItem[]
  count: number
}

interface CustomerOption {
  id: string
  company_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  representative: string | null
  business_number: string | null
  memo: string | null
}

interface Props {
  columns: KanbanColumn[]
  totalCount: number
  customers: CustomerOption[]
  hiddenItems: RequestItem[]
}

interface ContractSummary {
  totalWithVat: number
  paidAmount: number
  unpaidAmount: number
  progressPercent: number
}

// ----- 컬럼별 색상 (커스텀 팔레트) -----
// 컬럼별 카드 타이틀 아이콘 (흑백, Calendar/Building2와 동일 스타일)
const COLUMN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "견적 문의": ClipboardList,
  "영업중": Briefcase,
  "계약 성공": CheckCircle2,
  "수주 실패": XCircle,
}

const COLUMN_STYLES: Record<string, {
  header: string
  border: string
  bg: string        // 컬럼 배경색 (연한 투명도)
  badge: string     // 건수 배지 색상
  cardBar: string   // 카드 테두리 컬러
}> = {
  "견적 문의": {
    header: "text-sky-aqua",
    border: "border-t-sky-aqua",
    bg: "bg-gradient-to-b from-sky-aqua/10 to-transparent",
    badge: "bg-sky-aqua/20 text-sky-aqua",
    cardBar: "border-l-sky-aqua",
  },
  "영업중": {
    header: "text-tropical-teal",
    border: "border-t-tropical-teal",
    bg: "bg-gradient-to-b from-tropical-teal/10 to-transparent",
    badge: "bg-tropical-teal/20 text-tropical-teal",
    cardBar: "border-l-tropical-teal",
  },
  "계약 성공": {
    header: "text-muted-teal",
    border: "border-t-muted-teal",
    bg: "bg-gradient-to-b from-muted-teal/10 to-transparent",
    badge: "bg-muted-teal/20 text-muted-teal",
    cardBar: "border-l-muted-teal",
  },
  "수주 실패": {
    header: "text-soft-blush",
    border: "border-t-soft-blush",
    bg: "bg-gradient-to-b from-soft-blush/10 to-transparent",
    badge: "bg-soft-blush/20 text-soft-blush",
    cardBar: "border-l-soft-blush",
  },
}

// ----- 인라인 제목 편집 컴포넌트 -----
function InlineTitle({
  value,
  onConfirm,
}: {
  value: string
  onConfirm: (value: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempValue, setTempValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  // ref로 최신 값 추적 (언마운트 시 저장용)
  const tempRef = useRef(tempValue)
  const valueRef = useRef(value)
  const onConfirmRef = useRef(onConfirm)
  const isEditingRef = useRef(isEditing)
  tempRef.current = tempValue
  valueRef.current = value
  onConfirmRef.current = onConfirm
  isEditingRef.current = isEditing

  // 외부에서 value가 바뀌면 동기화
  useEffect(() => { setTempValue(value) }, [value])

  // 편집 중 언마운트되면 자동저장
  useEffect(() => {
    return () => {
      if (isEditingRef.current && tempRef.current.trim() && tempRef.current !== valueRef.current) {
        onConfirmRef.current(tempRef.current)
      }
    }
  }, [])

  const handleConfirm = () => {
    if (tempValue.trim() && tempValue !== value) {
      onConfirm(tempValue)
    } else {
      setTempValue(value)
    }
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleConfirm}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleConfirm()
          if (e.key === "Escape") { setTempValue(value); setIsEditing(false) }
        }}
        autoFocus
        className="font-sans text-2xl font-semibold text-left w-full bg-transparent border-b-2 border-sky-aqua focus:outline-none py-1"
      />
    )
  }

  return (
    <h2
      onClick={() => setIsEditing(true)}
      className="font-sans text-2xl font-semibold text-left cursor-pointer rounded px-1 -mx-1 py-1 hover:bg-sky-aqua/5 transition-colors truncate"
      title={value}
    >
      {value}
    </h2>
  )
}

// ----- 인라인 선택 편집 컴포넌트 (값 클릭 → 아래 팝업에 선택지 표시) -----
// badgeStyles: 옵션 value → badge 색상 클래스 매핑 (없으면 일반 텍스트)
function InlineSelect({
  value,
  displayValue,
  placeholder,
  options,
  onConfirm,
  badgeStyles,
  align = "right",
}: {
  value: string
  displayValue: string
  placeholder: string
  options: { value: string; label: string }[]
  onConfirm: (value: string) => void
  badgeStyles?: Record<string, string>
  align?: "left" | "right"
}) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // 바깥 클릭하면 닫기
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  return (
    <div
      ref={wrapperRef}
      onClick={() => setIsOpen(true)}
      className={cn(
        "relative flex-1 cursor-pointer py-1 px-2 -mx-2",
        align === "left" ? "text-left" : "text-right",
        !displayValue && "border-b border-dashed border-gray-300"
      )}
    >
      {/* 현재 값 표시 */}
      {badgeStyles && displayValue ? (
        <Badge className={cn("text-xs", badgeStyles[value] || "")}>
          {displayValue}
        </Badge>
      ) : (
        <span className={cn("text-sm", displayValue ? "text-gray-900" : "text-gray-400")}>
          {displayValue || placeholder}
        </span>
      )}

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 min-w-[200px] max-h-[240px] overflow-y-auto",
            align === "left" ? "left-0" : "right-0"
          )}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onConfirm(opt.value)
                setIsOpen(false)
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                opt.value === value ? "bg-gray-100" : "hover:bg-gray-50"
              )}
            >
              {badgeStyles ? (
                <Badge className={cn("text-xs", badgeStyles[opt.value] || "")}>
                  {opt.label}
                </Badge>
              ) : (
                <span className={opt.value === value ? "text-sky-aqua font-medium" : "text-gray-700"}>
                  {opt.label}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ----- 인라인 날짜 편집 컴포넌트 -----
function InlineDate({
  value,
  displayValue,
  placeholder,
  onConfirm,
}: {
  value: string
  displayValue: string
  placeholder: string
  onConfirm: (value: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempValue, setTempValue] = useState(value)
  const wrapperRef = useRef<HTMLDivElement>(null)
  // ref로 최신 값 추적 (언마운트 시 저장용)
  const tempRef = useRef(tempValue)
  const valueRef = useRef(value)
  const onConfirmRef = useRef(onConfirm)
  const isEditingRef = useRef(isEditing)
  tempRef.current = tempValue
  valueRef.current = value
  onConfirmRef.current = onConfirm
  isEditingRef.current = isEditing

  useEffect(() => { setTempValue(value) }, [value])

  // 편집 중 언마운트되면 자동저장
  useEffect(() => {
    return () => {
      if (isEditingRef.current && tempRef.current !== valueRef.current) {
        onConfirmRef.current(tempRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isEditing) return
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsEditing(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isEditing])

  const handleConfirm = () => {
    if (tempValue !== value) onConfirm(tempValue)
    setIsEditing(false)
  }

  return (
    <div
      ref={wrapperRef}
      onClick={() => { setTempValue(value); setIsEditing(true) }}
      className={cn(
        "relative inline-flex cursor-pointer items-center rounded-sm py-0.5 px-1 text-right",
        !displayValue && "border-b border-dashed border-gray-300"
      )}
    >
      <span className={cn("text-xs", displayValue ? "text-gray-900" : "text-gray-400")}>
        {displayValue || placeholder}
      </span>

      {isEditing && (
        <div onClick={(e) => e.stopPropagation()} className="absolute top-full right-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 min-w-[240px]">
          <input
            type="date"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            autoFocus
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-aqua/50 focus:border-sky-aqua mb-2"
          />
          <div className="flex justify-end gap-1.5">
            <button
              onClick={() => setIsEditing(false)}
              className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              className="px-3 py-1 text-xs bg-sky-aqua text-white rounded hover:bg-sky-aqua/90 transition-colors font-medium"
            >
              입력완료
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ----- 인라인 텍스트 편집 (고객 상세용) -----
function InlineEditField({
  value,
  placeholder,
  onConfirm,
  type = "text",
  textClass = "",
  align = "right",
}: {
  value: string
  placeholder: string
  onConfirm: (value: string) => void
  type?: "text" | "email"
  textClass?: string
  align?: "left" | "right"
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempValue, setTempValue] = useState(value)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const tempRef = useRef(tempValue)
  const valueRef = useRef(value)
  const onConfirmRef = useRef(onConfirm)
  const isEditingRef = useRef(isEditing)
  tempRef.current = tempValue
  valueRef.current = value
  onConfirmRef.current = onConfirm
  isEditingRef.current = isEditing

  useEffect(() => { setTempValue(value) }, [value])

  useEffect(() => {
    return () => {
      if (isEditingRef.current && tempRef.current !== valueRef.current) {
        onConfirmRef.current(tempRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isEditing) return
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onConfirm(tempValue)
        setIsEditing(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isEditing, tempValue, onConfirm])

  const handleConfirm = () => {
    onConfirm(tempValue)
    setIsEditing(false)
  }

  return (
    <div
      ref={wrapperRef}
      onClick={() => { setTempValue(value); setIsEditing(true) }}
      className={cn(
        "relative flex-1 cursor-pointer rounded hover:bg-sky-aqua/5 transition-colors py-1 px-2 -mx-2",
        align === "right" && "text-right",
        !value && "border-b border-dashed border-gray-300"
      )}
    >
      <span className={cn(value ? "text-gray-900" : "text-gray-400", textClass)}>
        {value || placeholder}
      </span>

      {isEditing && (
        <div onClick={(e) => e.stopPropagation()} className="absolute top-full right-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 min-w-[240px]">
          <input
            type={type}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-aqua/50 focus:border-sky-aqua mb-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm()
              if (e.key === "Escape") setIsEditing(false)
            }}
          />
          <div className="flex justify-end gap-1.5">
            <button onClick={() => setIsEditing(false)} className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors">취소</button>
            <button onClick={handleConfirm} className="px-3 py-1 text-xs bg-sky-aqua text-white rounded hover:bg-sky-aqua/90 transition-colors font-medium">입력완료</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ----- 인라인 메모 편집 (고객 상세용 textarea) -----
function InlineEditMemo({
  value,
  placeholder,
  onConfirm,
}: {
  value: string
  placeholder: string
  onConfirm: (value: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempValue, setTempValue] = useState(value)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const tempRef = useRef(tempValue)
  const valueRef = useRef(value)
  const onConfirmRef = useRef(onConfirm)
  const isEditingRef = useRef(isEditing)
  tempRef.current = tempValue
  valueRef.current = value
  onConfirmRef.current = onConfirm
  isEditingRef.current = isEditing

  useEffect(() => { setTempValue(value) }, [value])

  useEffect(() => {
    return () => {
      if (isEditingRef.current && tempRef.current !== valueRef.current) {
        onConfirmRef.current(tempRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isEditing) return
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onConfirm(tempValue)
        setIsEditing(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isEditing, tempValue, onConfirm])

  const handleConfirm = () => {
    onConfirm(tempValue)
    setIsEditing(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div
        onClick={() => { setTempValue(value); setIsEditing(true) }}
        className={cn(
          "cursor-pointer py-1 px-1 -mx-1 rounded hover:bg-sky-aqua/10 transition-colors text-sm min-h-[60px] whitespace-pre-wrap",
          value ? "text-gray-900" : "text-gray-400 border-b border-dashed border-gray-300"
        )}
      >
        {value || placeholder}
      </div>
      {isEditing && (
        <div onClick={(e) => e.stopPropagation()} className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 min-w-[300px]">
          <textarea value={tempValue} onChange={(e) => setTempValue(e.target.value)} placeholder={placeholder} autoFocus rows={4}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-aqua/50 focus:border-sky-aqua resize-none mb-2"
          />
          <div className="flex justify-end gap-1.5">
            <button onClick={() => setIsEditing(false)} className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors">취소</button>
            <button onClick={handleConfirm} className="px-3 py-1 text-xs bg-sky-aqua text-white rounded hover:bg-sky-aqua/90 transition-colors font-medium">입력완료</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ----- 고객 상세 Sheet (고객 페이지와 동일한 편집 패널) -----
function CustomerDetailSheet({
  customerId,
  customers,
  onClose,
  onUpdate,
}: {
  customerId: string | null
  customers: CustomerOption[]
  onClose: () => void
  onUpdate: (id: string, field: string, value: string | null) => void
}) {
  const customer = customerId ? customers.find((c) => c.id === customerId) : null
  const [saveMessage, setSaveMessage] = useState("")
  const router = useRouter()

  // 필드 수정 + 자동저장
  const updateField = async (field: string, value: string) => {
    if (!customer) return
    const newValue = field === "company_name" ? value : (value || null)

    // 낙관적 업데이트 (부모 state 갱신)
    onUpdate(customer.id, field, newValue)

    setSaveMessage("저장 중...")
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: customer.id, [field]: newValue }),
    })

    if (!res.ok) {
      setSaveMessage("저장 실패")
      setTimeout(() => setSaveMessage(""), 2000)
    } else {
      setSaveMessage("자동 저장됨")
      setTimeout(() => setSaveMessage(""), 1500)
      router.refresh()
    }
  }

  return (
    <Sheet open={!!customerId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[900px] p-0 flex flex-col [&>button:first-child]:hidden">
        {customer && (
          <>
            {/* 상단 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors">
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2">
                {saveMessage && (
                  <span className={cn("text-sm", saveMessage.includes("실패") ? "text-soft-blush" : "text-muted-teal")}>
                    {saveMessage}
                  </span>
                )}
                <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors">
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* 본문: 좌우 분리 */}
            <div className="flex-1 flex overflow-hidden">
              {/* 왼쪽: 고객 정보 편집 */}
              <div className="w-1/2 overflow-y-auto px-6 py-6 border-r">
                {/* 배지 */}
                <div className="flex items-center gap-3 mb-4">
                  <Badge className="text-xs bg-sky-aqua/20 text-sky-aqua">고객</Badge>
                </div>

                {/* 회사명 */}
                <SheetHeader className="mb-6">
                  <SheetTitle className="sr-only">고객 상세</SheetTitle>
                  <SheetDescription className="sr-only">고객 정보를 수정하세요</SheetDescription>
                  <InlineEditField
                    value={customer.company_name}
                    placeholder="회사명을 입력하세요"
                    onConfirm={(v) => updateField("company_name", v)}
                    textClass="font-sans text-2xl font-semibold"
                    align="left"
                  />
                </SheetHeader>

                <Separator className="mb-6" />

                {/* 연락처 정보 */}
                <h3 className="text-base font-semibold text-gray-900 mb-5">연락처 정보</h3>
                <div className="space-y-5 mb-6">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-[15px] text-gray-400 w-[90px] shrink-0">담당자</span>
                    <InlineEditField value={customer.contact_name || ""} placeholder="담당자명" onConfirm={(v) => updateField("contact_name", v)} textClass="text-base font-medium" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-[15px] text-gray-400 w-[90px] shrink-0">연락처</span>
                    <InlineEditField value={customer.phone || ""} placeholder="010-0000-0000" onConfirm={(v) => updateField("phone", v)} textClass="text-base font-medium" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-[15px] text-gray-400 w-[90px] shrink-0">이메일</span>
                    <InlineEditField value={customer.email || ""} placeholder="example@email.com" onConfirm={(v) => updateField("email", v)} textClass="text-base font-medium" />
                  </div>
                </div>

                <Separator className="mb-6" />

                {/* 사업자 정보 */}
                <h3 className="text-base font-semibold text-gray-900 mb-5">사업자 정보</h3>
                <div className="space-y-5 mb-6">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-[15px] text-gray-400 w-[90px] shrink-0">대표자</span>
                    <InlineEditField value={customer.representative || ""} placeholder="대표자명" onConfirm={(v) => updateField("representative", v)} textClass="text-base font-medium" />
                  </div>
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-[15px] text-gray-400 w-[90px] shrink-0">사업자번호</span>
                    <InlineEditField value={customer.business_number || ""} placeholder="123-45-67890" onConfirm={(v) => updateField("business_number", v)} textClass="text-base font-medium" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-[15px] text-gray-400 w-[90px] shrink-0">소재지</span>
                    <InlineEditField value={customer.address || ""} placeholder="주소를 입력하세요" onConfirm={(v) => updateField("address", v)} textClass="text-base font-medium" />
                  </div>
                </div>

                <Separator className="mb-6" />

                {/* 메모 */}
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 text-gray-400 shrink-0 mt-1" />
                  <span className="text-[15px] text-gray-400 w-[90px] shrink-0 mt-0.5">메모</span>
                  <div className="flex-1">
                    <InlineEditMemo value={customer.memo || ""} placeholder="메모를 입력하세요" onConfirm={(v) => updateField("memo", v)} />
                  </div>
                </div>
              </div>

              {/* 오른쪽: 추가 기능 */}
              <div className="w-1/2 overflow-y-auto px-6 py-6 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-400 mb-4">추가 기능</h3>
                <p className="text-xs text-gray-400">이 영역에 기능이 추가될 예정입니다.</p>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ----- 견적서/파일 탭 컴포넌트 -----
function QuotationsTab({
  quotations,
  onAddQuote,
  onEditQuote,
  confirmedQuoteId,
  onToggleConfirm,
}: {
  quotations: QuotationListItem[]
  onAddQuote: () => void
  onEditQuote: (id: string) => void
  confirmedQuoteId: string | null
  onToggleConfirm: (quote: QuotationListItem) => void
}) {
  const [activeTab, setActiveTab] = useState<"견적서" | "파일">("견적서")

  return (
    <>
      <div className="flex items-center gap-3 border-b border-gray-200 mb-3">
        {([
          { label: "견적서" as const, count: quotations.length },
          { label: "파일" as const, count: 0 },
        ]).map((tab) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(tab.label)}
            className={`pb-2 text-sm transition-colors ${activeTab === tab.label
              ? "font-bold text-gray-900 border-b-2 border-gray-900"
              : "font-medium text-gray-300 hover:text-gray-500 border-b-2 border-transparent"
              }`}
          >
            {tab.label} <span className="text-xs">{tab.count}</span>
          </button>
        ))}
      </div>

      {activeTab === "견적서" && (
        <div className="space-y-2">
          {/* 추가 버튼 */}
          <button
            onClick={onAddQuote}
            className="w-full flex items-center justify-center gap-1.5 py-3 border-2 border-dashed border-sky-aqua/30 rounded-lg text-sm text-sky-aqua font-medium hover:border-sky-aqua hover:bg-sky-aqua/5 transition-all"
          >
            <Plus className="h-4 w-4" />
            추가하기
          </button>

          {/* 견적서 카드 목록 */}
          {quotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-300">
              <FileText className="h-8 w-8 mb-2" />
              <p className="text-sm">아직 견적서가 없습니다</p>
            </div>
          ) : (
            [...quotations].reverse().map((q, index) => {
              const isConfirmed = confirmedQuoteId === q.id
              return (
                <div
                  key={q.id}
                  className={cn(
                    "border rounded-xl px-4 py-3.5 transition-all",
                    isConfirmed
                      ? "border-sky-aqua/70 bg-sky-aqua/10 ring-1 ring-sky-aqua/30"
                      : "border-gray-200 hover:border-sky-aqua/40 hover:bg-sky-aqua/5"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-aqua/15 text-sky-aqua text-[10px] font-bold shrink-0">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => onToggleConfirm(q)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors border",
                        isConfirmed
                          ? "border-sky-aqua text-sky-aqua bg-sky-aqua/10 hover:bg-sky-aqua/20"
                          : "border-gray-300 text-gray-500 bg-white hover:bg-gray-50"
                      )}
                    >
                      {isConfirmed ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Circle className="h-3.5 w-3.5" />
                      )}
                      확정
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onEditQuote(q.id)}
                    className="w-full text-left group"
                  >
                    <p className="text-sm font-semibold text-gray-800 group-hover:text-sky-aqua transition-colors leading-snug line-clamp-2 mb-1.5">
                      {q.title}
                    </p>
                    <div className="flex items-center gap-1 mb-3">
                      <Hash className="h-3 w-3 text-gray-300 shrink-0" />
                      <span className="text-[11px] text-gray-400 font-medium">{q.quotation_number}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
                      <div className="flex items-center gap-1 text-[11px] text-gray-400">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>{formatShortDate(q.quotation_date)}</span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        {q.total_amount > 0 && (
                          <>
                            <span className="text-xs font-bold tabular-nums text-gray-500">
                              {formatCurrency(q.total_amount)}
                            </span>
                            <span className="text-[9px] text-gray-300">VAT 별도</span>
                          </>
                        )}
                        <span className={`text-xs font-bold tabular-nums ${q.grand_total > 0 ? "text-sky-aqua" : "text-gray-300"}`}>
                          {formatCurrency(q.grand_total)}
                        </span>
                        <span className="text-[9px] text-gray-400">VAT 포함</span>
                      </div>
                    </div>
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}

      {activeTab === "파일" && (
        <div className="flex flex-col items-center justify-center py-10 text-gray-300">
          <p className="text-sm">구현 예정</p>
        </div>
      )}
    </>
  )
}

// ----- 견적서 목록 항목 타입 -----
interface QuotationListItem {
  id: string
  title: string
  quotation_number: string
  quotation_date: string
  total_amount: number
  grand_total: number
}

type SettlementStage = "선금" | "중도금" | "잔금"

const SETTLEMENT_STAGE_ORDER: SettlementStage[] = ["선금", "중도금", "잔금"]
const EMPTY_STAGE_RATIOS: Record<SettlementStage, number> = { 선금: 0, 중도금: 0, 잔금: 0 }
const EMPTY_STAGE_SCHEDULED_DATES: Record<SettlementStage, string> = { 선금: "", 중도금: "", 잔금: "" }
const DEFAULT_MIDDLE_INSTALLMENTS = 1

interface ContractDraft {
  id: string | null
  title: string
  customer_id: string
  contract_amount: number
  start_date: string
  end_date: string
  settlement_type: SettlementStage[]
}

interface PendingContractDraftSnapshot {
  draft: ContractDraft
  stageRatios: Record<SettlementStage, number>
  middleInstallments: number
  stageScheduledDates: Record<SettlementStage, string>
  settlementStatusMap: Record<string, SettlementStatusInput>
}

interface SettlementStatusInput {
  payment_confirmed: boolean
  actual_amount: number
  received_date: string
  tax_invoice_issued: boolean
  payment_entries: SettlementPaymentEntry[]
}

interface SettlementPaymentEntry {
  id: string
  amount: number
  paid_at: string
  note: string
}

function normalizeSettlementStatusKey(rawKey: string): string {
  const key = rawKey.trim()
  if (!key) return key
  if (key.startsWith("middle-")) return key

  const compact = key.replace(/\s+/g, "")
  const depositStage = SETTLEMENT_STAGE_ORDER[0]
  const middleStage = SETTLEMENT_STAGE_ORDER[1]
  const finalStage = SETTLEMENT_STAGE_ORDER[2]

  const depositAliases = new Set([depositStage, "선급금", "선금", "선수금", "착수금"])
  const middleAliases = new Set([middleStage, "중도금"])
  const finalAliases = new Set([finalStage, "잔금"])

  if (depositAliases.has(compact)) return depositStage
  if (middleAliases.has(compact)) return middleStage
  if (finalAliases.has(compact)) return finalStage
  return key
}

function normalizeSettlementStatusInput(raw: unknown): SettlementStatusInput {
  if (!raw || typeof raw !== "object") {
    return { payment_confirmed: false, actual_amount: 0, received_date: "", tax_invoice_issued: false, payment_entries: [] }
  }
  const obj = raw as Record<string, unknown>
  const amount = Number(obj.actual_amount ?? 0)
  const fallbackAmount = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0
  const fallbackReceivedDate = typeof obj.received_date === "string" ? obj.received_date : ""
  const paymentEntries = Array.isArray(obj.payment_entries)
    ? obj.payment_entries.reduce<SettlementPaymentEntry[]>((acc, entry, index) => {
      if (!entry || typeof entry !== "object") return acc
      const parsed = entry as Record<string, unknown>
      const parsedAmount = Number(parsed.amount ?? 0)
      const normalizedAmount = Number.isFinite(parsedAmount) ? Math.max(0, Math.round(parsedAmount)) : 0
      const id = typeof parsed.id === "string" && parsed.id.trim()
        ? parsed.id
        : `entry-${index + 1}`
      acc.push({
        id,
        amount: normalizedAmount,
        paid_at: typeof parsed.paid_at === "string" ? parsed.paid_at : "",
        note: typeof parsed.note === "string" ? parsed.note : "",
      })
      return acc
    }, [])
    : []

  // Backward compatibility: convert legacy single amount/date into one payment entry.
  if (paymentEntries.length === 0 && fallbackAmount > 0) {
    paymentEntries.push({
      id: "legacy-1",
      amount: fallbackAmount,
      paid_at: fallbackReceivedDate,
      note: "",
    })
  }

  const totalFromEntries = paymentEntries.reduce((sum, entry) => sum + entry.amount, 0)
  const latestPaidAt = paymentEntries.reduce((latest, entry) => {
    if (!entry.paid_at) return latest
    return entry.paid_at > latest ? entry.paid_at : latest
  }, "")
  const effectiveAmount = paymentEntries.length > 0 ? totalFromEntries : fallbackAmount

  return {
    payment_confirmed: obj.payment_confirmed === true || effectiveAmount > 0,
    actual_amount: effectiveAmount,
    received_date: latestPaidAt || fallbackReceivedDate,
    tax_invoice_issued: obj.tax_invoice_issued === true,
    payment_entries: paymentEntries,
  }
}

function sanitizeSettlementStatusMap(raw: unknown): Record<string, SettlementStatusInput> {
  if (!raw || typeof raw !== "object") return {}
  const parsed = raw as Record<string, unknown>
  return Object.entries(parsed).reduce<Record<string, SettlementStatusInput>>((acc, [key, value]) => {
    const normalizedKey = normalizeSettlementStatusKey(key)
    if (!normalizedKey) return acc
    acc[normalizedKey] = normalizeSettlementStatusInput(value)
    return acc
  }, {})
}

function hasMeaningfulSettlementStatus(map: Record<string, SettlementStatusInput>): boolean {
  return Object.values(map).some((row) =>
    row.payment_confirmed ||
    row.actual_amount > 0 ||
    !!row.received_date ||
    row.tax_invoice_issued ||
    row.payment_entries.some((entry) => entry.amount > 0 || !!entry.paid_at || !!entry.note)
  )
}

function normalizeSettlementTypes(raw: unknown): SettlementStage[] {
  if (Array.isArray(raw)) {
    return raw.filter((v): v is SettlementStage => SETTLEMENT_STAGE_ORDER.includes(v as SettlementStage))
  }
  if (typeof raw === "string" && raw.trim()) {
    const normalized = raw.replace(/[{}]/g, "")
    return normalized
      .split(",")
      .map((v) => v.trim())
      .filter((v): v is SettlementStage => SETTLEMENT_STAGE_ORDER.includes(v as SettlementStage))
  }
  return []
}

function createEvenRatios(selected: SettlementStage[]): Record<SettlementStage, number> {
  const next = { ...EMPTY_STAGE_RATIOS }
  if (selected.length === 0) return next
  if (selected.length === 1) {
    next[selected[0]] = 100
    return next
  }
  const base = Math.floor(100 / selected.length)
  let remain = 100
  selected.forEach((stage, idx) => {
    const value = idx === selected.length - 1 ? remain : base
    next[stage] = value
    remain -= value
  })
  return next
}

function normalizeRatios(
  raw: unknown,
  selected: SettlementStage[]
): Record<SettlementStage, number> {
  const next = { ...EMPTY_STAGE_RATIOS }
  if (!raw || typeof raw !== "object") {
    return createEvenRatios(selected)
  }
  const obj = raw as Record<string, unknown>
  selected.forEach((stage) => {
    const parsed = Number(obj[stage] ?? 0)
    next[stage] = Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0
  })
  return next
}

function normalizeMiddleInstallments(raw: unknown): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return DEFAULT_MIDDLE_INSTALLMENTS
  return Math.max(1, Math.min(5, Math.round(parsed)))
}

function normalizeStageScheduledDates(raw: unknown): Record<SettlementStage, string> {
  if (!raw || typeof raw !== "object") return { ...EMPTY_STAGE_SCHEDULED_DATES }
  const obj = raw as Record<string, unknown>
  return {
    선금: typeof obj.선금 === "string" ? obj.선금 : "",
    중도금: typeof obj.중도금 === "string" ? obj.중도금 : "",
    잔금: typeof obj.잔금 === "string" ? obj.잔금 : "",
  }
}

function formatStagePercent(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

function buildContractSnapshot(params: {
  draft: ContractDraft
  selectedStages: SettlementStage[]
  stageRatios: Record<SettlementStage, number>
  middleInstallments: number
  stageScheduledDates: Record<SettlementStage, string>
  settlementStatusMap: Record<string, SettlementStatusInput>
  customerId: string | null
}) {
  const selectedStages = SETTLEMENT_STAGE_ORDER.filter((stage) => params.selectedStages.includes(stage))
  const normalizedRatios = normalizeRatios(params.stageRatios, selectedStages)
  const normalizedDates = normalizeStageScheduledDates(params.stageScheduledDates)
  const normalizedStatus = sanitizeSettlementStatusMap(params.settlementStatusMap)
  return JSON.stringify({
    title: params.draft.title.trim(),
    customer_id: params.customerId,
    contract_amount: Math.max(0, Math.round(Number(params.draft.contract_amount || 0))),
    settlement_type: selectedStages,
    stage_ratios: selectedStages.reduce((acc, stage) => ({ ...acc, [stage]: normalizedRatios[stage] }), {}),
    middle_installments: selectedStages.includes("중도금")
      ? normalizeMiddleInstallments(params.middleInstallments)
      : DEFAULT_MIDDLE_INSTALLMENTS,
    stage_scheduled_dates: selectedStages.reduce((acc, stage) => ({
      ...acc,
      [stage]: normalizedDates[stage] || null,
    }), {}),
    settlement_status_map: normalizedStatus,
    start_date: params.draft.start_date || null,
    end_date: params.draft.end_date || null,
  })
}

function buildSettlementRows(
  supplyAmount: number,
  selected: SettlementStage[],
  ratios: Record<SettlementStage, number>,
  middleInstallments: number
) {
  if (selected.length === 0) return [] as Array<{ key: string; label: string; supply: number; total: number }>
  const safeSupply = Math.max(0, Math.round(supplyAmount || 0))
  const totalVat = Math.round(safeSupply * 0.1)
  let usedSupply = 0
  let usedVat = 0
  const rows: Array<{ key: string; label: string; supply: number; total: number }> = []

  selected.forEach((stage, idx) => {
    const ratio = Math.max(0, Math.min(100, Number(ratios[stage] || 0)))
    const isLast = idx === selected.length - 1
    const stageSupply = isLast ? safeSupply - usedSupply : Math.round((safeSupply * ratio) / 100)
    usedSupply += stageSupply
    const stageVat = isLast ? totalVat - usedVat : Math.round(stageSupply * 0.1)
    usedVat += stageVat

    if (stage === "중도금" && middleInstallments > 1) {
      let usedSplitSupply = 0
      let usedSplitVat = 0
      for (let installment = 1; installment <= middleInstallments; installment++) {
        const isLastInstallment = installment === middleInstallments
        const splitSupply = isLastInstallment
          ? stageSupply - usedSplitSupply
          : Math.round(stageSupply / middleInstallments)
        usedSplitSupply += splitSupply
        const splitVat = isLastInstallment
          ? stageVat - usedSplitVat
          : Math.round(splitSupply * 0.1)
        usedSplitVat += splitVat
        const splitRatio = ratio / middleInstallments
        rows.push({
          key: `middle-${installment}`,
          label: `중도금 ${installment}차 ${formatStagePercent(splitRatio)}%`,
          supply: splitSupply,
          total: splitSupply + splitVat,
        })
      }
      return
    }

    rows.push({
      key: stage,
      label: `${stage} ${formatStagePercent(ratio)}%`,
      supply: stageSupply,
      total: stageSupply + stageVat,
    })
  })

  return rows
}

function getTodayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getOverdueDays(dateString: string): number {
  if (!dateString) return 0
  const scheduled = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(scheduled.getTime())) return 0
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffMs = todayStart.getTime() - scheduled.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return diffDays > 0 ? diffDays : 0
}

function ContractFlowTab({
  requestId,
  requestTitle,
  requestCustomer,
  requestContractId,
  confirmedQuoteSupplyAmount,
  onLinkContract,
  onSavedContract,
  onSummaryChange,
}: {
  requestId: string
  requestTitle: string
  requestCustomer: { id: string; company_name: string; deleted_at: string | null } | null
  requestContractId: string | null
  confirmedQuoteSupplyAmount: number | null
  onLinkContract: (contractId: string | null) => Promise<void>
  onSavedContract?: (contractId: string) => void
  onSummaryChange?: (summary: ContractSummary) => void
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUnlinkingContract, setIsUnlinkingContract] = useState(false)
  const [isUnlinkDialogOpen, setIsUnlinkDialogOpen] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")
  const [isAmountModalOpen, setIsAmountModalOpen] = useState(false)
  const [amountInputValue, setAmountInputValue] = useState("")
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false)
  const [isContractFormVisible, setIsContractFormVisible] = useState(!!requestContractId)
  const [activeContractTab, setActiveContractTab] = useState<"계약서" | "정산 현황">("계약서")
  const [modalStages, setModalStages] = useState<SettlementStage[]>(["잔금"])
  const [modalRatios, setModalRatios] = useState<Record<SettlementStage, number>>({ ...EMPTY_STAGE_RATIOS, 잔금: 100 })
  const [modalScheduledDates, setModalScheduledDates] = useState<Record<SettlementStage, string>>({ ...EMPTY_STAGE_SCHEDULED_DATES })
  const [modalMiddleInstallments, setModalMiddleInstallments] = useState(DEFAULT_MIDDLE_INSTALLMENTS)
  const [stageRatios, setStageRatios] = useState<Record<SettlementStage, number>>({ ...EMPTY_STAGE_RATIOS, 잔금: 100 })
  const [stageScheduledDates, setStageScheduledDates] = useState<Record<SettlementStage, string>>({ ...EMPTY_STAGE_SCHEDULED_DATES })
  const [middleInstallments, setMiddleInstallments] = useState(DEFAULT_MIDDLE_INSTALLMENTS)
  const [settlementStatusMap, setSettlementStatusMap] = useState<Record<string, SettlementStatusInput>>({})
  const [isSettlementStatusHydrated, setIsSettlementStatusHydrated] = useState(false)
  const initialSnapshotRef = useRef("")
  const lastSavedSnapshotRef = useRef("")
  const failedSnapshotRef = useRef<string | null>(null)
  const lastSummarySignatureRef = useRef<string>("")
  const latestPendingRef = useRef<PendingContractDraftSnapshot | null>(null)
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
    scheduledDates: Record<SettlementStage, string>
  ) => {
    try {
      const raw = localStorage.getItem("requests:contractRatios:v1")
      const parsed = raw
        ? JSON.parse(raw) as Record<string, {
          ratios?: Record<SettlementStage, number>
          middle_installments?: number
          scheduled_dates?: Record<SettlementStage, string>
        } | Record<SettlementStage, number>>
        : {}
      parsed[key] = {
        ratios: ratio,
        middle_installments: normalizeMiddleInstallments(middleCount),
        scheduled_dates: normalizeStageScheduledDates(scheduledDates),
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
        }
      }
      const parsed = JSON.parse(raw) as Record<string, {
        ratios?: Record<SettlementStage, number>
        middle_installments?: number
        scheduled_dates?: Record<SettlementStage, string>
      } | Record<SettlementStage, number>>
      const entry = parsed[key]
      if (!entry) {
        return {
          ratios: null,
          middleInstallments: DEFAULT_MIDDLE_INSTALLMENTS,
          scheduledDates: { ...EMPTY_STAGE_SCHEDULED_DATES },
        }
      }
      if ("ratios" in entry) {
        return {
          ratios: entry.ratios ?? null,
          middleInstallments: normalizeMiddleInstallments(entry.middle_installments),
          scheduledDates: normalizeStageScheduledDates(entry.scheduled_dates),
        }
      }
      return {
        ratios: entry,
        middleInstallments: DEFAULT_MIDDLE_INSTALLMENTS,
        scheduledDates: { ...EMPTY_STAGE_SCHEDULED_DATES },
      }
    } catch {
      return {
        ratios: null,
        middleInstallments: DEFAULT_MIDDLE_INSTALLMENTS,
        scheduledDates: { ...EMPTY_STAGE_SCHEDULED_DATES },
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
        const resolvedSettlementStatusMap = pending
          ? sanitizeSettlementStatusMap(pending.settlementStatusMap)
          : {}

        setDraft(resolvedDraft)
        setStageRatios(resolvedRatios)
        setMiddleInstallments(resolvedMiddleInstallments)
        setStageScheduledDates(resolvedStageScheduledDates)
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
        const resolvedSettlementStatusMap = canApplyPending && pending
          ? sanitizeSettlementStatusMap(pending.settlementStatusMap)
          : nextSettlementStatusFromDb

        if (pending && pendingDraft && !pendingDraftId) {
          // id 없는 stale pending이 기존 계약 DB를 덮지 않도록 정리
          clearPendingDraftFromLocal()
        }

        setDraft(resolvedDraft)
        setStageRatios(resolvedRatios)
        setMiddleInstallments(resolvedMiddleInstallments)
        setStageScheduledDates(resolvedStageScheduledDates)
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
      } catch {
        if (cancelled) return
        setDraft(defaultDraft)
        setStageRatios({ ...EMPTY_STAGE_RATIOS, 잔금: 100 })
        setMiddleInstallments(DEFAULT_MIDDLE_INSTALLMENTS)
        setStageScheduledDates({ ...EMPTY_STAGE_SCHEDULED_DATES })
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
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadContract()
    return () => { cancelled = true }
  }, [requestContractId, requestCustomer?.id, requestId, requestTitle, createDefaultDraft, loadRatioFromLocal, loadPendingDraftFromLocal, clearPendingDraftFromLocal])

  const selectedStages = SETTLEMENT_STAGE_ORDER.filter((stage) => draft.settlement_type.includes(stage))
  const supplyAmount = Math.max(0, Math.round(Number(draft.contract_amount || 0)))
  const totalWithVat = supplyAmount + Math.round(supplyAmount * 0.1)
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
        ? "부분정산"
        : "미정산"
    let scheduledDate = ""
    if (row.key === "선금") scheduledDate = stageScheduledDates.선금
    else if (row.key === "잔금") scheduledDate = stageScheduledDates.잔금
    else if (row.key === "중도금" || row.key.startsWith("middle-")) scheduledDate = stageScheduledDates.중도금
    return {
      key: row.key,
      label: row.label,
      paymentConfirmed,
      paymentStatusLabel,
      paymentEntries: status.payment_entries,
      plannedAmount,
      actualAmount,
      shortfallAmount: Math.max(0, plannedAmount - actualAmount),
      scheduledDate,
      receivedDate: status.received_date,
      taxInvoiceIssued: status.tax_invoice_issued,
      overdueDays: !paymentConfirmed ? getOverdueDays(scheduledDate) : 0,
    }
  })

  useEffect(() => {
    if (!onSummaryChange) return

    const paidAmount = settlementStatusRows.reduce((sum, row) => {
      return sum + row.actualAmount
    }, 0)
    const clampedPaid = Math.min(Math.max(0, paidAmount), totalWithVat)
    const unpaidAmount = Math.max(0, totalWithVat - clampedPaid)
    const progressPercent = totalWithVat > 0
      ? Math.min(100, Math.round((clampedPaid / totalWithVat) * 100))
      : 0

    const signature = `${totalWithVat}|${clampedPaid}|${unpaidAmount}|${progressPercent}`
    if (lastSummarySignatureRef.current === signature) return
    lastSummarySignatureRef.current = signature

    onSummaryChange({
      totalWithVat,
      paidAmount: clampedPaid,
      unpaidAmount,
      progressPercent,
    })
  }, [onSummaryChange, requestContractId, draft.id, settlementStatusRows, totalWithVat])
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
    settlementStatusMap,
    customerId: requestCustomer?.id || draft.customer_id || null,
  })

  useEffect(() => {
    latestPendingRef.current = {
      draft,
      stageRatios,
      middleInstallments,
      stageScheduledDates,
      settlementStatusMap,
    }
  }, [draft, stageRatios, middleInstallments, stageScheduledDates, settlementStatusMap])

  useEffect(() => {
    return () => {
      if (latestPendingRef.current) {
        savePendingDraftToLocal(latestPendingRef.current)
      }
    }
  }, [savePendingDraftToLocal])

  useEffect(() => {
    if (isLoading) return
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
      settlementStatusMap,
    })
  }, [
    isLoading,
    saveSnapshot,
    draft,
    stageRatios,
    middleInstallments,
    stageScheduledDates,
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

  const openAmountModal = () => {
    const baseAmount = supplyAmount
    setAmountInputValue(baseAmount > 0 ? baseAmount.toLocaleString("ko-KR") : "")
    setIsAmountModalOpen(true)
  }

  const handleApplyAmount = () => {
    const digitsOnly = amountInputValue.replace(/[^0-9]/g, "")
    const next = digitsOnly ? Number(digitsOnly) : 0
    const nextAmount = Number.isFinite(next) ? Math.max(0, Math.round(next)) : 0
    const hasAmountChanged = nextAmount !== supplyAmount
    setDraft((prev) => (prev.contract_amount === nextAmount ? prev : { ...prev, contract_amount: nextAmount }))
    if (hasAmountChanged) {
      // Reset settlement status when total contract amount changes.
      setSettlementStatusMap({})
    }
    setIsAmountModalOpen(false)
  }

  const openSettlementModal = () => {
    const normalized: SettlementStage[] = selectedStages.length > 0 ? selectedStages : ["잔금"]
    setModalStages(normalized)
    setModalRatios(normalizeRatios(stageRatios, normalized))
    setModalScheduledDates(normalizeStageScheduledDates(stageScheduledDates))
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
      saveRatioToLocal(`request:${requestId}`, stageRatios, middleInstallments, stageScheduledDates)
      saveRatioToLocal(`contract:${saved.id}`, stageRatios, middleInstallments, stageScheduledDates)

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

  useEffect(() => {
    if (!isPersistedContract) return
    if (!canSave || isLoading) return
    if (!initialSnapshotRef.current) return
    if (saveSnapshot === lastSavedSnapshotRef.current) return
    if (failedSnapshotRef.current === saveSnapshot) return

    const timer = setTimeout(() => {
      void handleSave("auto")
    }, 700)

    return () => clearTimeout(timer)
  }, [isPersistedContract, canSave, isLoading, saveSnapshot, handleSave])

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-gray-200 mb-3">
        {(["계약서", "정산 현황"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveContractTab(tab)}
            className={`pb-2 text-sm transition-colors ${activeContractTab === tab
              ? "font-bold text-gray-900 border-b-2 border-gray-900"
              : "font-medium text-gray-300 hover:text-gray-500 border-b-2 border-transparent"
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeContractTab === "계약서" && (
        isLoading ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-10 text-center">
            <p className="text-sm font-medium text-gray-500">계약 정보를 불러오는 중입니다.</p>
          </div>
        ) : (
    <div className="space-y-3">
      {!isPersistedContract && (
        <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-gray-700">계약을 생성해주세요</p>
              <p className="text-[10px] text-gray-400">상단 버튼으로 계약 생성 후 저장이 시작됩니다.</p>
            </div>
            <button
              type="button"
              onClick={() => { void handleSave("manual") }}
              disabled={!canSave || isUnlinkingContract}
              className="inline-flex h-8 items-center justify-center rounded-md bg-sky-aqua px-3 text-xs font-semibold text-white hover:bg-sky-aqua/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? "생성 중..." : "계약 생성하기"}
            </button>
          </div>
        </div>
      )}

      <div className={cn("rounded-xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center", isContractFormVisible && "hidden")}>
        <p className="text-sm font-semibold text-gray-600">계약을 생성해주세요</p>
        <p className="mt-1 text-xs text-gray-400">`계약 생성하기`를 누르면 계약이 생성되고 입력 폼이 열립니다.</p>
      </div>

      <div className={cn("rounded-xl border border-gray-200/80 bg-white p-2.5 space-y-2 shadow-[0_1px_0_rgba(17,24,39,0.03)]", !isContractFormVisible && "hidden")}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-700">계약 정보</p>
          {isPersistedContract && (
            <button
              type="button"
              onClick={() => setIsUnlinkDialogOpen(true)}
              disabled={isUnlinkingContract}
              aria-label={isUnlinkingContract ? "연결 해제 중" : "연결 해제"}
              title={isUnlinkingContract ? "연결 해제 중" : "연결 해제"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-soft-blush/50 bg-white text-soft-blush hover:bg-soft-blush/10 disabled:opacity-40"
            >
              <Unlink className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-1.5">
          <div className="max-w-[520px] rounded-lg border border-gray-100 bg-gray-50/50 p-2 space-y-1">
            <Label htmlFor="contract-title" className="text-[10px] font-medium text-gray-500">계약 제목</Label>
            <Input
              id="contract-title"
              value={draft.title}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="계약 제목을 입력하세요"
              className="h-7 border-gray-200 bg-white text-sm focus:ring-sky-aqua/40"
            />
          </div>
        </div>

        <div className="grid max-w-[520px] grid-cols-2 gap-1.5">
          <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-2 space-y-1">
            <Label htmlFor="contract-start" className="text-[10px] font-medium text-gray-500">계약 착수일</Label>
            <Input
              id="contract-start"
              type="date"
              value={draft.start_date}
              onChange={(e) => setDraft((prev) => ({ ...prev, start_date: e.target.value }))}
              className="h-6 border-gray-200 bg-white px-2 font-sans text-[8px] font-normal text-gray-500 focus:ring-sky-aqua/40"
            />
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-2 space-y-1">
            <Label htmlFor="contract-end" className="text-[10px] font-medium text-gray-500">계약 종료일</Label>
            <Input
              id="contract-end"
              type="date"
              value={draft.end_date}
              onChange={(e) => setDraft((prev) => ({ ...prev, end_date: e.target.value }))}
              className="h-6 border-gray-200 bg-white px-2 font-sans text-[8px] font-normal text-gray-500 focus:ring-sky-aqua/40"
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="contract-amount" className="text-base font-semibold text-sky-aqua">
                <span className="inline-flex items-center gap-1">
                  <Banknote className="h-4 w-4" />
                  <span> 총 계약금액</span>
                </span>
              </Label>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5">
                <Popover open={isAmountModalOpen} onOpenChange={setIsAmountModalOpen}>
                  <PopoverTrigger asChild>
                    <Input
                      id="contract-amount"
                      type="text"
                      value={draft.contract_amount > 0 ? draft.contract_amount.toLocaleString("ko-KR") : ""}
                      readOnly
                      onClick={openAmountModal}
                      placeholder="0"
                      className="h-7 w-52 cursor-pointer border-gray-200 bg-white text-sm font-semibold text-right tabular-nums focus:ring-sky-aqua/40"
                    />
                  </PopoverTrigger>
                  <PopoverContent align="end" side="bottom" sideOffset={6} className="w-52 border-gray-200 p-2.5">
                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled={typeof confirmedQuoteSupplyAmount !== "number"}
                        onClick={() => {
                          if (typeof confirmedQuoteSupplyAmount === "number" && confirmedQuoteSupplyAmount >= 0) {
                            setAmountInputValue(Math.round(confirmedQuoteSupplyAmount).toLocaleString("ko-KR"))
                          }
                        }}
                        className="inline-flex h-8 w-full items-center justify-center rounded-md border border-gray-300 bg-gray-100 px-2 text-[10px] font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40"
                      >
                        확정 견적금액 불러오기
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
                        className="h-8 border-gray-200 bg-white text-sm font-semibold text-right tabular-nums focus:ring-sky-aqua/40"
                      />
                      <p className="text-right text-[10px] font-semibold text-soft-blush">VAT별도</p>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setIsAmountModalOpen(false)}
                          className="px-2 py-1 text-[10px] rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyAmount}
                          className="px-2 py-1 text-[10px] rounded-md bg-sky-aqua text-white hover:bg-sky-aqua/90"
                        >
                          적용
                        </button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <span className="text-[10px] text-gray-400">원</span>
              </div>
              <p className="text-[9px] text-gray-400">VAT별도</p>
            </div>
          </div>
        </div>
      </div>

      <div className={cn("rounded-xl border border-gray-200 bg-white p-3.5 space-y-3", !isContractFormVisible && "hidden")}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-700">정산 형태</p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500">{stageSummary}</p>
            <button
              type="button"
              onClick={openSettlementModal}
              className="inline-flex h-8 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 hover:border-sky-aqua/40 hover:text-sky-aqua"
            >
              설정
            </button>
          </div>
        </div>

        <p className="text-xs font-medium text-gray-500">정산 금액 자동 계산</p>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-gray-50 px-3 py-2.5">
            <p className="text-xs text-gray-400">VAT별도</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-gray-700">{formatCurrency(supplyAmount)}</p>
          </div>
          <div className="rounded-md bg-sky-aqua/5 px-3 py-2.5">
            <p className="text-xs text-gray-400">VAT 포함</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-sky-aqua">{formatCurrency(totalWithVat)}</p>
          </div>
        </div>

        {settlementRows.length === 0 ? (
          <p className="text-xs text-gray-400">설정 버튼에서 정산 형태를 선택하세요.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <div className="grid grid-cols-[120px_124px_1fr_1fr] gap-3 bg-gray-50 px-3 py-2">
              <p className="text-[11px] text-gray-500">구분</p>
              <p className="text-[11px] text-gray-500">입금예정일</p>
              <p className="text-[11px] text-right text-gray-500">VAT별도</p>
              <p className="text-[11px] text-right text-gray-500">VAT포함</p>
            </div>
            {settlementRowsWithScheduledDate.map((row) => (
              <div key={row.key} className="grid grid-cols-[120px_124px_1fr_1fr] gap-3 border-t border-gray-100 bg-white px-3 py-2.5">
                <p className="text-sm font-medium text-gray-700">{row.label}</p>
                <p className="text-sm text-gray-600">{row.scheduledDate || "-"}</p>
                <p className="text-sm text-right tabular-nums text-gray-700">{formatCurrency(row.supply)}</p>
                <p className="text-sm text-right tabular-nums font-semibold text-sky-aqua">{formatCurrency(row.total)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={cn("flex items-center justify-between gap-2 px-0.5", !isContractFormVisible && "hidden")}>
        <p className={cn("text-[10px]", saveMessage.includes("실패") ? "text-soft-blush" : "text-gray-500")}>
          {saveMessage || (isPersistedContract ? "입력값은 자동 저장됩니다." : "계약 생성 버튼을 눌러주세요.")}
        </p>
        {isPersistedContract && (
          <button
            type="button"
            onClick={() => { void handleSave("manual") }}
            disabled={!canSave}
            className="inline-flex h-8 items-center justify-center rounded-md bg-sky-aqua px-3 text-xs font-semibold text-white hover:bg-sky-aqua/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "저장 중..." : "즉시 저장"}
          </button>
        )}
      </div>

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
              className="px-3 py-1.5 text-xs rounded-md bg-soft-blush text-white hover:bg-soft-blush/90"
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
                      className="h-3.5 w-3.5 rounded border-sky-aqua accent-sky-aqua focus:ring-2 focus:ring-sky-aqua/60"
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
                            ? "border-gray-300 bg-white focus:ring-2 focus:ring-sky-aqua/50"
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
                            className="h-7 rounded-md border border-gray-300 bg-white px-1.5 text-[10px] text-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-aqua/50"
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
                            ? "border-gray-300 bg-white text-gray-600 focus:ring-2 focus:ring-sky-aqua/50"
                            : "border-gray-200 bg-gray-100 text-gray-300"
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
              className="px-3 py-1.5 text-xs rounded-md bg-sky-aqua text-white hover:bg-sky-aqua/90 disabled:opacity-40"
            >
              적용
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
        )
      )}

      {activeContractTab === "정산 현황" && (
        isLoading ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-10 text-center">
            <p className="text-sm font-medium text-gray-500">정산 현황을 불러오는 중입니다.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-700">총 계약금액</p>
                <p className="text-sm font-bold tabular-nums text-sky-aqua">
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
                    ? "border-soft-blush/60 bg-soft-blush/10 ring-1 ring-soft-blush/25"
                    : row.paymentConfirmed
                      ? "border-sky-aqua/60 bg-sky-aqua/10 ring-1 ring-sky-aqua/20"
                      : "border-gray-200"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="truncate text-[11px] font-semibold text-gray-700">{row.label}</p>
                    <span className={cn(
                      "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold",
                      row.paymentConfirmed
                        ? "border-sky-aqua/40 bg-sky-aqua/10 text-sky-aqua"
                        : row.actualAmount > 0
                          ? "border-amber-300 bg-amber-50 text-amber-700"
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

                <div className="space-y-1.5 rounded-lg border border-gray-100 bg-gray-50/60 px-2.5 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium text-gray-500">입금내역</p>
                    <button
                      type="button"
                      onClick={() => addSettlementPaymentEntry(row.key)}
                      className="inline-flex items-center gap-1 px-1 py-0.5 text-[10px] text-gray-500 hover:text-sky-aqua"
                    >
                      <Plus className="h-3 w-3" />
                      추가
                    </button>
                  </div>

                  {row.paymentEntries.length === 0 ? (
                    <p className="text-[10px] text-gray-400">입금내역을 추가하면 정산금액이 자동 계산됩니다.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {row.paymentEntries.map((entry, index) => (
                        <div key={entry.id} className="flex items-center gap-2">
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
                            placeholder="0"
                            className="h-7 min-w-0 flex-1 border-0 border-b border-gray-200 bg-transparent px-0 text-left text-[10px] font-semibold tabular-nums text-gray-700 outline-none focus:border-sky-aqua"
                          />
                          <input
                            type="date"
                            value={entry.paid_at}
                            onChange={(e) => updateSettlementPaymentEntry(row.key, entry.id, { paid_at: e.target.value })}
                            className="h-7 w-[118px] border-0 border-b border-gray-200 bg-transparent px-0 text-right text-[10px] text-gray-600 outline-none focus:border-sky-aqua"
                          />
                          <button
                            type="button"
                            onClick={() => removeSettlementPaymentEntry(row.key, entry.id)}
                            className="inline-flex h-6 w-6 items-center justify-center text-gray-400 hover:text-soft-blush"
                            aria-label={`입금내역 ${index + 1} 삭제`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-[10px] text-gray-400">정산금액</p>
                    <Input
                      type="text"
                      value={row.actualAmount > 0 ? row.actualAmount.toLocaleString("ko-KR") : ""}
                      readOnly
                      placeholder="0"
                      className="h-8 border-gray-200 bg-gray-50 px-2 text-right text-[11px] font-semibold tabular-nums text-gray-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] text-gray-400">정산 완료일</p>
                    <Input
                      type="date"
                      value={row.receivedDate}
                      readOnly
                      className="h-8 border-gray-200 bg-gray-50 px-2 text-[11px] text-gray-600"
                    />
                  </div>
                </div>

                {row.shortfallAmount > 0 && (
                  <p className="text-right text-[10px] font-medium text-soft-blush">
                    미정산 {formatCurrency(row.shortfallAmount)}
                  </p>
                )}

                <div className="flex justify-end">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-[10px] text-gray-500">
                    <input
                      type="checkbox"
                      checked={row.taxInvoiceIssued}
                      onChange={(e) => updateSettlementStatus(row.key, { tax_invoice_issued: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-sky-aqua accent-sky-aqua focus:ring-2 focus:ring-sky-aqua/60"
                    />
                    {row.taxInvoiceIssued ? "계산서 발행완료" : "계산서 미발행"}
                  </label>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

function SalesFlowPanel({
  quotations,
  onAddQuote,
  onEditQuote,
  confirmedQuoteId,
  onToggleConfirm,
  requestId,
  requestTitle,
  requestCustomer,
  requestContractId,
  onLinkContract,
  onSavedContract,
  onSummaryChange,
}: {
  quotations: QuotationListItem[]
  onAddQuote: () => void
  onEditQuote: (id: string) => void
  confirmedQuoteId: string | null
  onToggleConfirm: (quote: QuotationListItem) => void
  requestId: string
  requestTitle: string
  requestCustomer: { id: string; company_name: string; deleted_at: string | null } | null
  requestContractId: string | null
  onLinkContract: (contractId: string | null) => Promise<void>
  onSavedContract?: (contractId: string) => void
  onSummaryChange?: (summary: ContractSummary) => void
}) {
  const [activeFlow, setActiveFlow] = useState<"견적" | "계약" | "주문·배송" | "매입·매출">("견적")

  const flowTabs: Array<{ key: "견적" | "계약" | "주문·배송" | "매입·매출" }> = [
    { key: "견적" },
    { key: "계약" },
    { key: "주문·배송" },
    { key: "매입·매출" },
  ]
  const flowIcons = {
    "견적": FileText,
    "계약": Briefcase,
    "주문·배송": Truck,
    "매입·매출": ArrowUpDown,
  } as const
  const confirmedQuote = confirmedQuoteId ? quotations.find((q) => q.id === confirmedQuoteId) ?? null : null

  return (
    <div>
      <div className="flex items-center gap-5 border-b border-gray-200 mb-4 overflow-x-auto">
        {flowTabs.map((tab) => {
          const Icon = flowIcons[tab.key]
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFlow(tab.key)}
              className={cn(
                "inline-flex items-center gap-1.5 pb-2 text-sm whitespace-nowrap transition-colors border-b-2",
                activeFlow === tab.key
                  ? "font-bold text-sky-aqua border-sky-aqua"
                  : "font-medium text-gray-400 border-transparent hover:text-gray-600"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{tab.key}</span>
            </button>
          )
        })}
      </div>

      {activeFlow === "견적" && (
        <QuotationsTab
          quotations={quotations}
          onAddQuote={onAddQuote}
          onEditQuote={onEditQuote}
          confirmedQuoteId={confirmedQuoteId}
          onToggleConfirm={onToggleConfirm}
        />
      )}

      {activeFlow === "계약" && (
        <ContractFlowTab
          requestId={requestId}
          requestTitle={requestTitle}
          requestCustomer={requestCustomer}
          requestContractId={requestContractId}
          confirmedQuoteSupplyAmount={confirmedQuote?.total_amount ?? null}
          onLinkContract={onLinkContract}
          onSavedContract={onSavedContract}
          onSummaryChange={onSummaryChange}
        />
      )}

      {activeFlow === "주문·배송" && (
        <OrderDeliveryTab requestId={requestId} />
      )}

      {activeFlow !== "견적" && activeFlow !== "계약" && activeFlow !== "주문·배송" && (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-10 text-center">
          <p className="text-sm font-medium text-gray-500">{activeFlow} 흐름은 다음 단계에서 연결됩니다.</p>
        </div>
      )}
    </div>
  )
}

// ----- 고객 연결/표시 패널 컴포넌트 (컴팩트 + Dialog 모달) -----
function CustomerPanel({
  customer,
  customers,
  onLink,
  onUnlink,
  onCreateAndLink,
  onOpenDetail,
}: {
  customer: { id: string; company_name: string; deleted_at: string | null } | null
  customers: CustomerOption[]
  onLink: (id: string) => void
  onUnlink: () => void
  onCreateAndLink: (form: { company_name: string; contact_name?: string; phone?: string }) => Promise<void>
  onOpenDetail: () => void
}) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  // 즉석 고객 생성 폼
  const [isCreateMode, setIsCreateMode] = useState(false)
  const [createForm, setCreateForm] = useState({ company_name: "", contact_name: "", phone: "" })
  const [isCreating, setIsCreating] = useState(false)

  // 검색 필터링
  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      c.company_name.toLowerCase().includes(q) ||
      (c.contact_name && c.contact_name.toLowerCase().includes(q))
    )
  })

  // 연결된 고객의 상세 정보 조회
  const customerDetail = customer ? customers.find((c) => c.id === customer.id) : null

  // 모달 닫기 + 초기화
  const closeModal = () => {
    setIsModalOpen(false)
    setSearchQuery("")
    setIsCreateMode(false)
    setCreateForm({ company_name: "", contact_name: "", phone: "" })
  }

  // 기존 고객 선택
  const handleSelectCustomer = (id: string) => {
    onLink(id)
    closeModal()
  }

  // 즉석 생성 후 연결 (생성+연결을 부모에서 한번에 처리)
  const handleCreateAndLink = async () => {
    if (!createForm.company_name.trim()) return
    setIsCreating(true)
    try {
      await onCreateAndLink({
        company_name: createForm.company_name.trim(),
        ...(createForm.contact_name.trim() && { contact_name: createForm.contact_name.trim() }),
        ...(createForm.phone.trim() && { phone: createForm.phone.trim() }),
      })
      closeModal()
    } catch {
      alert("고객 생성에 실패했습니다.")
    }
    setIsCreating(false)
  }

  return (
    <div>
      <p className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 mb-2">
        <Box className="h-3.5 w-3.5 text-gray-500" />
        고객 정보
      </p>

      {!customer && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4">
          <p className="text-xs font-medium text-gray-600 mb-1">고객 연결 필요</p>
          <p className="text-[10px] text-gray-400 mb-3">의뢰에 고객을 연결해주세요.</p>
          <div className="flex justify-end">
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-aqua/10 text-sky-aqua text-xs font-semibold hover:bg-sky-aqua/20 transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
              고객 연결
            </button>
          </div>
        </div>
      )}

      {customer?.deleted_at && (
        <div className="rounded-xl border border-soft-blush/30 bg-soft-blush/5 p-4">
          <p className="text-xs font-semibold text-soft-blush mb-1">삭제된 고객이 연결되어 있습니다</p>
          <p className="text-[10px] text-soft-blush/80 mb-3">다른 고객으로 변경하거나 연결을 해제하세요.</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsModalOpen(true)}
              aria-label="고객 변경"
              title="고객 변경"
              className="inline-flex h-5 w-5 items-center justify-center text-gray-400 hover:text-gray-500 transition-colors"
            >
              <Search className="h-3 w-3" />
            </button>
            <button
              onClick={onUnlink}
              aria-label="고객 연결 해제"
              title="고객 연결 해제"
              className="inline-flex h-5 w-5 items-center justify-center text-gray-400 hover:text-gray-500 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {customer && !customer.deleted_at && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <button onClick={onOpenDetail} className="min-w-0 text-left hover:opacity-80 transition-opacity">
              <p className="text-sm font-semibold text-gray-900 truncate">{customer.company_name}</p>
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={onOpenDetail}
                aria-label="고객 상세 편집"
                title="고객 상세 편집"
                className="inline-flex h-5 w-5 items-center justify-center text-gray-400 hover:text-gray-500 transition-colors"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                aria-label="고객 변경"
                title="고객 변경"
                className="inline-flex h-5 w-5 items-center justify-center text-gray-400 hover:text-gray-500 transition-colors"
              >
                <Search className="h-3 w-3" />
              </button>
              <button
                onClick={onUnlink}
                aria-label="고객 연결 해제"
                title="고객 연결 해제"
                className="inline-flex h-5 w-5 items-center justify-center text-gray-400 hover:text-gray-500 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-gray-50 px-2.5 py-2">
              <p className="text-[9px] text-gray-400">담당자</p>
              <p className={cn("text-[10px] mt-0.5 truncate", customerDetail?.contact_name ? "text-gray-700" : "text-gray-300")}>
                {customerDetail?.contact_name || "미등록"}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 px-2.5 py-2">
              <p className="text-[9px] text-gray-400">연락처</p>
              <p className={cn("text-[10px] mt-0.5 truncate", customerDetail?.phone ? "text-gray-700" : "text-gray-300")}>
                {customerDetail?.phone ? formatPhone(customerDetail.phone) : "미등록"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 고객 연결 모달 (가운데 Dialog) */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-sans text-lg">고객 연결</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              기존 고객을 검색하거나, 새로운 고객을 등록하세요.
            </DialogDescription>
          </DialogHeader>

          {/* 검색 모드 */}
          {!isCreateMode && (
            <div className="space-y-3">
              {/* 검색 입력 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="회사명, 담당자명으로 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-aqua/50 focus:border-sky-aqua"
                />
              </div>

              {/* 고객 목록 */}
              <div className="max-h-[240px] overflow-y-auto border border-gray-200 rounded-lg">
                {filteredCustomers.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">검색 결과가 없습니다</p>
                ) : (
                  filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectCustomer(c.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0",
                        customer && c.id === customer.id && "bg-sky-aqua/5"
                      )}
                    >
                      <div className="w-7 h-7 rounded-full bg-tropical-teal/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-3.5 w-3.5 text-tropical-teal" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.company_name}</p>
                        {c.contact_name && (
                          <p className="text-xs text-gray-500 truncate">{c.contact_name}</p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* 새 고객 등록 버튼 */}
              <button
                onClick={() => {
                  // 검색어가 있으면 회사명으로 미리 채움
                  if (searchQuery.trim()) {
                    setCreateForm((prev) => ({ ...prev, company_name: searchQuery.trim() }))
                  }
                  setIsCreateMode(true)
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed border-sky-aqua/50 text-sky-aqua text-sm font-medium hover:border-sky-aqua hover:bg-sky-aqua/5 transition-all"
              >
                <Plus className="h-4 w-4" />
                새 고객 등록
              </button>
            </div>
          )}

          {/* 생성 모드 */}
          {isCreateMode && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  회사명 <span className="text-soft-blush">*</span>
                </Label>
                <Input
                  placeholder="예: (주)한국건설"
                  value={createForm.company_name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, company_name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">담당자명</Label>
                <Input
                  placeholder="예: 홍길동"
                  value={createForm.contact_name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, contact_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">연락처</Label>
                <Input
                  placeholder="예: 010-1234-5678"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <button
                  onClick={() => {
                    setIsCreateMode(false)
                    setCreateForm({ company_name: "", contact_name: "", phone: "" })
                  }}
                  className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  뒤로
                </button>
                <button
                  onClick={handleCreateAndLink}
                  disabled={isCreating || !createForm.company_name.trim()}
                  className="px-4 py-2 text-sm rounded-md bg-sky-aqua text-white hover:bg-sky-aqua/80 transition-colors disabled:opacity-50"
                >
                  {isCreating ? "등록 중..." : "등록 후 연결"}
                </button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function RequestKanbanBoard({ columns: initialColumns, totalCount, customers, hiddenItems: initialHiddenItems }: Props) {
  const router = useRouter()

  // 드래그로 카드 이동 시 화면에 바로 반영하기 위해 state로 관리
  const [columns, setColumns] = useState(initialColumns)
  // 숨긴 카드 목록
  const [hiddenItems, setHiddenItems] = useState(initialHiddenItems)
  // 숨김 패널: 상태별 펼침/접힘
  const [expandedHiddenStatus, setExpandedHiddenStatus] = useState<string | null>(null)

  // 서버에서 새 데이터가 오면 (생성/삭제 후 refresh) 화면도 바로 갱신
  // JSON 비교로 "실제 데이터"가 바뀔 때만 동기화 (드래그 중 리셋 방지)
  const prevDataRef = useRef(JSON.stringify(initialColumns))
  const prevHiddenRef = useRef(JSON.stringify(initialHiddenItems))
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
  }, [initialColumns, initialHiddenItems])
  // 삭제 확인 다이얼로그용 state
  const [deleteTarget, setDeleteTarget] = useState<RequestItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // 상세 패널용 state
  const [selectedItem, setSelectedItem] = useState<RequestItem | null>(null)
  // 자동저장 상태 메시지
  const [saveMessage, setSaveMessage] = useState("")

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

  const loadContractSummaryById = useCallback(async (contractId: string | null, requestId?: string | null) => {
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

      let effectiveSelectedStages = baseSelectedStages
      let effectiveSupplyAmount = baseSupplyAmount
      let effectiveStageRatios = baseStageRatios
      let effectiveMiddleInstallments = baseMiddleInstallments
      let effectiveSettlementStatusMap = baseSettlementStatusMap

      try {
        const pendingRaw = requestId
          ? localStorage.getItem(`requests:contractDraftPending:v1:${requestId}`)
          : null
        if (pendingRaw) {
          const pending = JSON.parse(pendingRaw) as Partial<PendingContractDraftSnapshot>
          const pendingDraft = pending?.draft && typeof pending.draft === "object"
            ? pending.draft as Partial<ContractDraft>
            : null
          const pendingDraftId = pendingDraft && typeof pendingDraft.id === "string" && pendingDraft.id.trim()
            ? pendingDraft.id
            : null
          const canApplyPending = !!pendingDraftId && pendingDraftId === contractId

          if (canApplyPending) {
            const pendingStages = normalizeSettlementTypes(pendingDraft?.settlement_type)
            effectiveSelectedStages = pendingStages.length > 0
              ? pendingStages
              : effectiveSelectedStages

            const pendingContractAmount = Number(pendingDraft?.contract_amount)
            if (Number.isFinite(pendingContractAmount)) {
              effectiveSupplyAmount = Math.max(0, Math.round(pendingContractAmount))
            }

            effectiveStageRatios = normalizeRatios(pending?.stageRatios, effectiveSelectedStages)
            effectiveMiddleInstallments = normalizeMiddleInstallments(pending?.middleInstallments)
            effectiveSettlementStatusMap = sanitizeSettlementStatusMap(pending?.settlementStatusMap)
          }
        }
      } catch {
        // Ignore pending draft parse errors and fallback to DB values.
      }

      try {
        const localContractRaw = contractId
          ? localStorage.getItem(`requests:settlementStatus:v1:contract:${contractId}`)
          : null
        const localRequestRaw = requestId
          ? localStorage.getItem(`requests:settlementStatus:v1:request:${requestId}`)
          : null
        const localContractMap = localContractRaw
          ? sanitizeSettlementStatusMap(JSON.parse(localContractRaw))
          : {}
        const localRequestMap = localRequestRaw
          ? sanitizeSettlementStatusMap(JSON.parse(localRequestRaw))
          : {}

        if (hasMeaningfulSettlementStatus(localContractMap)) {
          effectiveSettlementStatusMap = localContractMap
        } else if (hasMeaningfulSettlementStatus(localRequestMap)) {
          effectiveSettlementStatusMap = localRequestMap
        }
      } catch {
        // Ignore localStorage parse errors and fallback to DB values.
      }

      const settlementRows = buildSettlementRows(
        effectiveSupplyAmount,
        effectiveSelectedStages,
        effectiveStageRatios,
        effectiveMiddleInstallments
      )
      const totalWithVat = effectiveSupplyAmount + Math.round(effectiveSupplyAmount * 0.1)

      const paidAmount = settlementRows.reduce((sum, row) => {
        const status = normalizeSettlementStatusInput(effectiveSettlementStatusMap[row.key])
        const actualPaid = Math.max(0, Math.round(Number(status.actual_amount || 0)))
        if (actualPaid > 0) return sum + actualPaid
        return sum
      }, 0)

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
      if (!res.ok) { const err = await res.json(); alert("견적서 생성 실패: " + (err.error || res.status)); return }
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
  }, [selectedItem, loadQuotations])

  // 견적서 저장 후 콜백
  const handleQuoteSaved = useCallback(() => {
    if (selectedItem) {
      loadQuotations(selectedItem.id)
    }
    router.refresh()
  }, [selectedItem, loadQuotations, router])

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

    // 칸반보드 columns도 업데이트
    setColumns((prev) => {
      // 상태가 변경되면 카드를 다른 컬럼으로 이동
      if (field === "status" && value !== selectedItem.status) {
        return prev.map((col) => {
          if (col.status === selectedItem.status) {
            // 기존 컬럼에서 제거
            const filtered = col.items.filter((i) => i.id !== selectedItem.id)
            return { ...col, items: filtered, count: filtered.length }
          }
          if (col.status === value) {
            // 새 컬럼에 추가
            return { ...col, items: [updatedItem, ...col.items], count: col.count + 1 }
          }
          return col
        })
      }
      // 일반 필드 변경: 같은 컬럼에서 업데이트
      return prev.map((col) => ({
        ...col,
        items: col.items.map((i) => (i.id === selectedItem.id ? updatedItem : i)),
      }))
    })

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
        router.refresh()
      }
    } catch {
      setSaveMessage("저장 실패")
      setTimeout(() => setSaveMessage(""), 2000)
    }
  }, [selectedItem, localCustomers, router])

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
      } else {
        // 성공 시 서버 데이터 새로고침
        router.refresh()
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
    const newColumns = columns.map((col) => {
      const filtered = col.items.filter((item) => item.id !== targetId)
      return { ...col, items: filtered, count: filtered.length }
    })
    setColumns(newColumns)
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
      } else {
        router.refresh()
      }
    } catch {
      alert("삭제 중 오류가 발생했습니다")
      setColumns(prevColumns)
    }
    setIsDeleting(false)
  }

  // 카드 숨기기 핸들러
  const handleHide = async (item: RequestItem) => {
    // 화면에서 먼저 숨김 (낙관적 업데이트)
    const prevColumns = columns
    const prevHidden = hiddenItems
    const newColumns = columns.map((col) => {
      const filtered = col.items.filter((i) => i.id !== item.id)
      return { ...col, items: filtered, count: filtered.length }
    })
    setColumns(newColumns)
    setHiddenItems((prev) => [item, ...prev])

    try {
      const res = await fetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, hidden: true }),
      })
      if (!res.ok) {
        // 실패 시 직전 상태로 되돌리기
        setColumns(prevColumns)
        setHiddenItems(prevHidden)
      } else {
        router.refresh()
      }
    } catch {
      setColumns(prevColumns)
      setHiddenItems(prevHidden)
    }
  }

  // 카드 복원 핸들러 (숨김 해제)
  const handleUnhide = async (item: RequestItem) => {
    // 화면에서 먼저 복원 (낙관적 업데이트)
    const prevColumns = columns
    const prevHidden = hiddenItems
    setHiddenItems((prev) => prev.filter((i) => i.id !== item.id))
    const newColumns = columns.map((col) => {
      if (col.status === item.status) {
        return { ...col, items: [item, ...col.items], count: col.count + 1 }
      }
      return col
    })
    setColumns(newColumns)

    try {
      const res = await fetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, hidden: false }),
      })
      if (!res.ok) {
        setColumns(prevColumns)
        setHiddenItems(prevHidden)
      } else {
        router.refresh()
      }
    } catch {
      setColumns(prevColumns)
      setHiddenItems(prevHidden)
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
      {/* 페이지 헤더 + 탭 네비게이션 */}
      <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
        <SalesTabNav />
        <p className="text-sm text-gray-500">총 {totalCount}건</p>
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
                  className={cn("flex flex-col flex-1 min-w-0 rounded-2xl border border-gray-100/50", style.bg)}
                >
                  {/* 컬럼 헤더 */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <h2 className={cn("font-extrabold text-lg", style.header)}>
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
                                  "group relative bg-white/80 backdrop-blur-md rounded-xl border-l-[6px] border-t border-r border-b border-gray-100 p-5 min-h-[150px] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-grab",
                                  style.cardBar,
                                  snapshot.isDragging && "shadow-2xl ring-2 ring-sky-aqua/20 scale-[1.02]"
                                )}
                              >
                                {/* 숨김 버튼 (호버 시에만 표시) */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleHide(item)
                                  }}
                                  title="숨기기"
                                  className="absolute bottom-3 right-12 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all bg-gray-400 hover:bg-gray-500 text-white shadow-md hover:scale-110"
                                >
                                  <EyeOff className="h-4 w-4" />
                                </button>

                                {/* 삭제 버튼 (호버 시에만 표시) */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDeleteTarget(item)
                                  }}
                                  className="absolute bottom-3 right-3 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all bg-soft-blush hover:bg-soft-blush/80 text-white shadow-md hover:scale-110"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>

                                {/* 상태 배지 (우측 상단 모서리) */}
                                <Badge className={cn("absolute top-2 right-2 text-[9px] px-1 py-0", style.badge)}>
                                  {col.status}
                                </Badge>

                                {/* 제목 */}
                                <div className="mb-2 pr-16">
                                  <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 truncate" title={item.title}>
                                    {(() => {
                                      const Icon = COLUMN_ICONS[col.status] || ClipboardList
                                      return <Icon className="h-3 w-3 text-gray-500 shrink-0" />
                                    })()}
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
                                    <span className={item.customer?.deleted_at ? "text-soft-blush" : ""}>
                                      {item.customer ? (item.customer.deleted_at ? "삭제된 고객" : item.customer.company_name) : "없음"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <FileText className="h-3 w-3 shrink-0" />
                                    <span>없음</span>
                                  </div>
                                </div>
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
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-sky-aqua/50 bg-sky-aqua/10 text-sky-aqua text-sm font-semibold hover:border-sky-aqua hover:bg-sky-aqua/20 transition-all"
                      >
                        <Plus className="h-4 w-4 stroke-[2.5]" />
                        의뢰 생성
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            {/* ===== 숨김 패널 (칸반보드 맨 우측) ===== */}
            {(() => {
              // 상태별 숨김 건수 계산
              const hiddenByStatus = hiddenItems.reduce<Record<string, RequestItem[]>>((acc, item) => {
                if (!acc[item.status]) acc[item.status] = []
                acc[item.status].push(item)
                return acc
              }, {})
              const statuses = ["견적 문의", "영업중", "계약 성공", "수주 실패"]

              return (
                <div className="flex flex-col w-[180px] rounded-lg bg-white shrink-0">
                  {/* 패널 헤더 */}
                  <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200">
                    <EyeOff className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-bold text-gray-700">숨김</span>
                  </div>

                  {/* 상태별 뱃지 + 숫자 (세로 배치) */}
                  <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
                    {statuses.map((status) => {
                      const groupStyle = COLUMN_STYLES[status] || COLUMN_STYLES["견적 문의"]
                      const items = hiddenByStatus[status] || []
                      const isExpanded = expandedHiddenStatus === status

                      return (
                        <div key={status}>
                          {/* 뱃지 + 숫자 (클릭하면 펼침/접힘) */}
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

                          {/* 펼쳐진 현장명 목록 + 체크박스 */}
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
                </div>
              )
            })()}
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
              <span className="text-soft-blush font-semibold">삭제하면 되돌릴 수 없습니다.</span>
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
              className="px-4 py-2 text-sm rounded-md bg-soft-blush text-white hover:bg-soft-blush/80 transition-colors disabled:opacity-50"
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
                제목 <span className="text-soft-blush">*</span>
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
              <Label className="text-sm font-medium">고객 <span className="text-soft-blush">*</span></Label>
              <button
                type="button"
                onClick={() => setIsCreateCustomerModalOpen(true)}
                className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-200 rounded-lg hover:border-sky-aqua/50 transition-colors"
              >
                {createForm.customer_id ? (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-tropical-teal/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-3 w-3 text-tropical-teal" />
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
              className="px-4 py-2 text-sm rounded-md bg-sky-aqua text-white hover:bg-sky-aqua/80 transition-colors disabled:opacity-50"
            >
              {isCreating ? "생성 중..." : "생성"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 의뢰 상세 패널 (오른쪽 슬라이드) */}
      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[900px] p-0 flex flex-col [&>button:first-child]:hidden">
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
                {/* 상단 헤더 */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                  </button>
                  <div className="flex items-center gap-2">
                    {/* 자동저장 상태 메시지 */}
                    {saveMessage && (
                      <span className={cn(
                        "text-sm",
                        saveMessage.includes("실패") ? "text-soft-blush" : "text-muted-teal"
                      )}>
                        {saveMessage}
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setDeleteTarget(selectedItem)
                        setSelectedItem(null)
                      }}
                      className="px-3 py-1.5 text-sm rounded-md text-soft-blush hover:bg-soft-blush/10 transition-colors"
                    >
                      삭제하기
                    </button>
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                    >
                      <X className="h-5 w-5 text-gray-600" />
                    </button>
                  </div>
                </div>

                {/* 본문: 좌우 분리 */}
                <div className="flex-1 flex overflow-hidden">
                  {/* ===== 왼쪽 영역: 의뢰 상세 정보 ===== */}
                  <div className="w-1/2 shrink-0 overflow-y-auto px-6 py-6 border-r [&_.text-\\[10px\\]]:text-xs [&_.text-\\[9px\\]]:text-[10px] [&_.text-xs]:text-sm [&_.no-scale_.text-\\[10px\\]]:text-[10px] [&_.no-scale_.text-\\[9px\\]]:text-[9px] [&_.no-scale_.text-xs]:text-xs">
                    {/* 상태 배지(클릭 변경) + 생성일 */}
                    <div className="flex items-center gap-2.5 mb-4">
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
                      <span className="text-[10px] text-gray-400">
                        {formatDateTime(selectedItem.created_at).replace(/^\d{2}/, '')} 생성
                      </span>
                    </div>

                    {/* 제목 (인라인 편집) */}
                    <SheetHeader className="mb-6">
                      <SheetTitle className="sr-only">의뢰 상세</SheetTitle>
                      <SheetDescription className="sr-only">의뢰 상세 정보</SheetDescription>
                      <InlineTitle
                        value={selectedItem.title}
                        onConfirm={(v) => {
                          if (v.trim()) updateRequestField("title", v.trim())
                        }}
                      />
                    </SheetHeader>

                    <Separator className="mb-6" />

                    {/* 상세 정보 */}
                    <div className="space-y-5">
                      <div className="flex items-center justify-between rounded-md px-2 -mx-2 py-1 cursor-pointer hover:bg-sky-aqua/5 transition-colors">
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900">
                          <Box className="h-3.5 w-3.5 text-gray-500" />
                          문의 일시
                        </span>
                        <InlineDate
                          value={selectedItem.inquiry_date || ""}
                          displayValue={selectedItem.inquiry_date ? formatDate(selectedItem.inquiry_date) : ""}
                          placeholder="날짜 선택"
                          onConfirm={(v) => updateRequestField("inquiry_date", v || null)}
                        />
                      </div>

                      <CustomerPanel
                        customer={selectedItem.customer}
                        customers={localCustomers}
                        onLink={(id) => updateRequestField("customer_id", id)}
                        onUnlink={() => updateRequestField("customer_id", null)}
                        onOpenDetail={() => {
                          if (selectedItem.customer?.id) setCustomerDetailId(selectedItem.customer.id)
                        }}
                        onCreateAndLink={async (form) => {
                          // 1. 고객 생성
                          const res = await fetch("/api/customers", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(form),
                          })
                          const result = await res.json()
                          if (!res.ok) throw new Error(result.error)
                          const nc = result.data

                          // 2. 로컬 고객 목록에 추가
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

                          // 3. 의뢰에 고객 직접 연결 (stale closure 우회)
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
                              router.refresh()
                            }
                          } catch {
                            setSaveMessage("저장 실패")
                            setTimeout(() => setSaveMessage(""), 2000)
                          }
                        }}
                      />

                      <div className="no-scale flex items-center justify-between rounded-md px-2 -mx-2 py-1">
                        <div className="w-full space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900">
                              <Box className="h-3.5 w-3.5 text-gray-500" />
                              확정 견적서
                            </p>
                            {!confirmedQuoteId && (
                              <span className="text-[10px] text-gray-400">견적서를 확정 지어주세요</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirmedQuoteId) handleEditQuote(confirmedQuoteId)
                            }}
                            disabled={!confirmedQuoteId}
                            aria-label={confirmedQuoteId ? "확정 견적서 열기" : "확정 견적서 없음"}
                            className={cn(
                              "w-full rounded-xl border border-gray-200 bg-white p-4 space-y-3 text-left transition-colors",
                              confirmedQuoteId
                                ? "cursor-pointer hover:border-sky-aqua/40 hover:bg-sky-aqua/5"
                                : "cursor-default"
                            )}
                          >
                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-lg bg-gray-50 px-2.5 py-2">
                                <p className="text-[9px] text-gray-400">견적서명</p>
                                <p className={cn("text-[10px] mt-0.5 truncate", confirmedQuote ? "text-gray-700" : "text-gray-300")}>
                                  {confirmedQuote ? confirmedQuoteTitle : "미확정"}
                                </p>
                              </div>
                              <div className="rounded-lg bg-gray-50 px-2.5 py-2">
                                <p className="text-[9px] text-gray-400">견적번호</p>
                                <p className={cn("text-[10px] mt-0.5 truncate", confirmedQuote ? "text-gray-700" : "text-gray-300")}>
                                  {confirmedQuote ? confirmedQuotationNumber : "미확정"}
                                </p>
                              </div>
                              <div className="rounded-lg bg-gray-50 px-2.5 py-2">
                                <p className="text-[9px] text-gray-400">VAT별도</p>
                                <p className={cn(
                                  "text-[10px] mt-0.5 truncate tabular-nums",
                                  confirmedQuote && confirmedTotalAmount !== null ? "text-gray-700" : "text-gray-300"
                                )}>
                                  {confirmedQuote && confirmedTotalAmount !== null ? formatCurrency(confirmedTotalAmount) : "미확정"}
                                </p>
                              </div>
                              <div className="rounded-lg bg-sky-aqua/5 px-2.5 py-2">
                                <p className="text-[9px] text-gray-400">VAT합계</p>
                                <p className={cn(
                                  "text-[10px] mt-0.5 truncate font-semibold tabular-nums",
                                  confirmedQuote && confirmedGrandTotal !== null ? "text-sky-aqua" : "text-gray-300"
                                )}>
                                  {confirmedQuote && confirmedGrandTotal !== null ? formatCurrency(confirmedGrandTotal) : "미확정"}
                                </p>
                              </div>
                            </div>
                          </button>
                          {contractSummary && (
                            <div className="mt-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                              <div className="flex items-center justify-between">
                                <p className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900">
                                  <Box className="h-3.5 w-3.5 text-gray-500" />
                                  정산 진행률
                                </p>
                                <p className="text-sm font-semibold text-sky-aqua tabular-nums">{contractSummary.progressPercent}%</p>
                              </div>
                              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-sky-aqua to-tropical-teal transition-all duration-500"
                                  style={{ width: `${contractSummary.progressPercent}%` }}
                                />
                              </div>
                              <div className="mt-2 flex items-center justify-between text-xs tabular-nums">
                                <span className="text-muted-teal">입금 {formatCurrency(contractSummary.paidAmount)}</span>
                                <span className="text-soft-blush">미수 {formatCurrency(contractSummary.unpaidAmount)}</span>
                              </div>
                              <p className="mt-1 text-[10px] text-gray-400 tabular-nums">
                                총 계약금(VAT포함) {formatCurrency(contractSummary.totalWithVat)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ===== 오른쪽 영역: 영업 흐름 ===== */}
                  <div className="w-1/2 shrink-0 overflow-y-auto px-6 py-6 bg-gray-50/50">
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
                      onSummaryChange={(summary) => {
                        setContractSummary((prev) => {
                          if (
                            prev &&
                            prev.totalWithVat === summary.totalWithVat &&
                            prev.paidAmount === summary.paidAmount &&
                            prev.unpaidAmount === summary.unpaidAmount &&
                            prev.progressPercent === summary.progressPercent
                          ) {
                            return prev
                          }
                          // Invalidate in-flight GET results so they cannot overwrite latest UI summary.
                          contractSummaryFetchSeqRef.current += 1
                          return summary
                        })
                      }}
                    />
                  </div>
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
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-aqua/50 focus:border-sky-aqua"
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
                          createForm.customer_id === c.id && "bg-sky-aqua/5"
                        )}
                      >
                        <div className="w-7 h-7 rounded-full bg-tropical-teal/10 flex items-center justify-center shrink-0">
                          <Building2 className="h-3.5 w-3.5 text-tropical-teal" />
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
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed border-sky-aqua/50 text-sky-aqua text-sm font-medium hover:border-sky-aqua hover:bg-sky-aqua/5 transition-all"
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
                  회사명 <span className="text-soft-blush">*</span>
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
                  className="px-4 py-2 text-sm rounded-md bg-sky-aqua text-white hover:bg-sky-aqua/80 transition-colors disabled:opacity-50"
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
