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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Briefcase, Building2, Calendar, CheckCircle2, CheckSquare, ClipboardList, EyeOff, FileText, Phone, Plus, Search, Trash2, User, Users, X, XCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { REQUEST_STATUSES } from "@/lib/constants"
import QuoteEditorSheet from "./quote-editor-sheet"
import type { QuotationWithItems } from "@/types"

// ----- 타입 -----
interface RequestItem {
  id: string
  title: string
  inquiry_date: string | null
  status: string
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
    bg: "bg-sky-aqua/10",
    badge: "bg-sky-aqua/20 text-sky-aqua",
    cardBar: "border-sky-aqua",
  },
  "영업중": {
    header: "text-tropical-teal",
    border: "border-t-tropical-teal",
    bg: "bg-tropical-teal/10",
    badge: "bg-tropical-teal/20 text-tropical-teal",
    cardBar: "border-tropical-teal",
  },
  "계약 성공": {
    header: "text-muted-teal",
    border: "border-t-muted-teal",
    bg: "bg-muted-teal/10",
    badge: "bg-muted-teal/20 text-muted-teal",
    cardBar: "border-muted-teal",
  },
  "수주 실패": {
    header: "text-soft-blush",
    border: "border-t-soft-blush",
    bg: "bg-soft-blush/10",
    badge: "bg-soft-blush/20 text-soft-blush",
    cardBar: "border-soft-blush",
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
        className="font-heading text-2xl font-semibold text-left w-full bg-transparent border-b-2 border-sky-aqua focus:outline-none py-1"
      />
    )
  }

  return (
    <h2
      onClick={() => setIsEditing(true)}
      className="font-heading text-2xl font-semibold text-left cursor-pointer rounded px-1 -mx-1 py-1 hover:bg-sky-aqua/5 transition-colors truncate"
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
}: {
  value: string
  displayValue: string
  placeholder: string
  options: { value: string; label: string }[]
  onConfirm: (value: string) => void
  badgeStyles?: Record<string, string>
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
        "relative flex-1 cursor-pointer py-1 px-2 -mx-2 text-right",
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
          className="absolute top-full right-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 min-w-[200px] max-h-[240px] overflow-y-auto"
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
        "relative flex-1 cursor-pointer py-1 px-2 -mx-2 text-right",
        !displayValue && "border-b border-dashed border-gray-300"
      )}
    >
      <span className={cn("text-sm", displayValue ? "text-gray-900" : "text-gray-400")}>
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

// ----- 인라인 메모 편집 컴포넌트 -----
function InlineMemo({
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
      if (isEditingRef.current && tempRef.current !== valueRef.current) {
        onConfirmRef.current(tempRef.current)
      }
    }
  }, [])

  // 바깥 클릭하면 저장 후 닫기
  useEffect(() => {
    if (!isEditing) return
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        if (tempValue !== value) onConfirm(tempValue)
        setIsEditing(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isEditing, tempValue, value, onConfirm])

  const handleOpen = () => {
    setTempValue(value)
    setIsEditing(true)
  }

  const handleConfirm = () => {
    if (tempValue !== value) onConfirm(tempValue)
    setIsEditing(false)
  }

  return (
    <div ref={wrapperRef}>
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            rows={5}
            className="w-full text-sm border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-aqua/50 focus:border-sky-aqua resize-none"
          />
          <div className="flex justify-end gap-1.5">
            <button
              onClick={() => { setTempValue(value); setIsEditing(false) }}
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
      ) : (
        <div
          onClick={handleOpen}
          className={cn(
            "rounded-lg border bg-gray-50 p-4 min-h-[120px] cursor-pointer hover:bg-sky-aqua/5 transition-colors",
            !value && "border-dashed border-gray-300"
          )}
          title="클릭하여 수정"
        >
          <p className={cn("text-sm whitespace-pre-wrap", value ? "text-gray-600" : "text-gray-400")}>
            {value || placeholder}
          </p>
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
                    textClass="font-heading text-2xl font-semibold"
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
}: {
  quotations: QuotationListItem[]
  onAddQuote: () => void
  onEditQuote: (id: string) => void
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
            className={`pb-2 text-sm transition-colors ${
              activeTab === tab.label
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
            quotations.map((q) => (
              <button
                key={q.id}
                onClick={() => onEditQuote(q.id)}
                className="w-full text-left border border-gray-200 rounded-lg p-3 hover:border-sky-aqua/50 hover:bg-sky-aqua/5 transition-all group"
              >
                <div className="flex items-start justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-900 truncate pr-2 group-hover:text-sky-aqua transition-colors">
                    {q.title}
                  </p>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-sky-aqua/10 text-sky-aqua shrink-0">
                    {q.quotation_number}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{formatShortDate(q.quotation_date)}</span>
                  <span className="font-medium text-gray-700">{formatCurrency(q.grand_total)}</span>
                </div>
              </button>
            ))
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

// ----- 고객 연결/표시 패널 컴포넌트 (컴팩트 + Dialog 모달) -----
function CustomerPanel({
  customer,
  customers,
  onLink,
  onUnlink,
  onCreateAndLink,
  onOpenDetail,
  quotations,
  onAddQuote,
  onEditQuote,
}: {
  customer: { id: string; company_name: string; deleted_at: string | null } | null
  customers: CustomerOption[]
  onLink: (id: string) => void
  onUnlink: () => void
  onCreateAndLink: (form: { company_name: string; contact_name?: string; phone?: string }) => Promise<void>
  onOpenDetail: () => void
  quotations: QuotationListItem[]
  onAddQuote: () => void
  onEditQuote: (id: string) => void
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
      {/* 탭 헤더 */}
      <div className="flex items-center gap-4 border-b border-gray-200 mb-0">
        <div className="flex items-center gap-1.5 pb-2 border-b-2 border-gray-900">
          <span className="text-base font-bold text-gray-900">고객</span>
          {customer && !customer.deleted_at && (
            <CheckCircle2 className="h-5 w-5 text-white fill-muted-teal" />
          )}
          {customer?.deleted_at && (
            <span className="w-4 h-4 rounded-full bg-soft-blush text-white text-[10px] font-bold flex items-center justify-center">!</span>
          )}
        </div>
        {/* 계약 탭 (구현 예정) */}
        <div className="flex items-center gap-1.5 pb-2 border-b-2 border-transparent cursor-not-allowed">
          <span className="text-base font-bold text-gray-300">계약</span>
        </div>
      </div>

      {/* 고객 미연결 상태 */}
      {!customer && (
        <div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full flex items-center justify-between py-3 group"
          >
            <div className="flex items-center gap-2.5">
              <Building2 className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500">고객을 연결해주세요.</span>
            </div>
            <Search className="h-4 w-4 text-gray-300 group-hover:text-sky-aqua transition-colors" />
          </button>
          <div className="rounded-md bg-sky-aqua/5 px-3 py-2.5">
            <p className="text-xs text-sky-aqua">고객을 선택하거나 추가해주세요 :)</p>
          </div>
        </div>
      )}

      {/* 삭제된 고객 상태 */}
      {customer?.deleted_at && (
        <div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 text-soft-blush shrink-0" />
              <span className="text-sm font-medium text-soft-blush">삭제된 데이터</span>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => setIsModalOpen(true)}
                className="p-1.5 rounded-md text-gray-400 hover:text-tropical-teal hover:bg-tropical-teal/10 transition-colors"
                title="변경"
              >
                <Search className="h-3 w-3" />
              </button>
              <button
                onClick={onUnlink}
                className="p-1.5 rounded-md text-gray-400 hover:text-soft-blush hover:bg-soft-blush/10 transition-colors"
                title="해제"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="rounded-md bg-soft-blush/10 px-3 py-2.5">
            <p className="text-xs text-soft-blush font-medium">연결된 데이터가 삭제됐어요!</p>
            <p className="text-xs text-soft-blush/80">다른 데이터로 연결을 변경해주세요.</p>
          </div>
        </div>
      )}

      {/* 고객 연결됨 상태 (삭제되지 않은 고객) */}
      {customer && !customer.deleted_at && (
        <div>
          {/* 연결된 고객 행 */}
          <div className="flex items-center justify-between py-2">
            <button
              onClick={onOpenDetail}
              className="flex items-center gap-2 min-w-0 hover:opacity-70 transition-opacity"
              title="고객 상세 보기"
            >
              <div className="w-6 h-6 rounded-full bg-tropical-teal/10 flex items-center justify-center shrink-0">
                <Building2 className="h-3 w-3 text-tropical-teal" />
              </div>
              <span className="text-sm font-medium text-sky-aqua truncate underline underline-offset-2 decoration-sky-aqua/30">{customer.company_name}</span>
            </button>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => setIsModalOpen(true)}
                className="p-1.5 rounded-md text-gray-400 hover:text-tropical-teal hover:bg-tropical-teal/10 transition-colors"
                title="변경"
              >
                <Search className="h-3 w-3" />
              </button>
              <button
                onClick={onUnlink}
                className="p-1.5 rounded-md text-gray-400 hover:text-soft-blush hover:bg-soft-blush/10 transition-colors"
                title="해제"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* 고객 상세 정보 (컴팩트) */}
          {customerDetail && (
            <div className="rounded-md border border-gray-200 bg-white px-3 py-2 space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3 text-gray-400 shrink-0" />
                <span className="text-gray-400 w-10 shrink-0">담당자</span>
                <span className={customerDetail.contact_name ? "text-gray-700" : "text-gray-300"}>
                  {customerDetail.contact_name || "미등록"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3 text-gray-400 shrink-0" />
                <span className="text-gray-400 w-10 shrink-0">연락처</span>
                <span className={customerDetail.phone ? "text-gray-700" : "text-gray-300"}>
                  {customerDetail.phone ? formatPhone(customerDetail.phone) : "미등록"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="my-5" />

      {/* 하단 탭: 견적서 / 파일 */}
      <QuotationsTab
        quotations={quotations}
        onAddQuote={onAddQuote}
        onEditQuote={onEditQuote}
      />

      {/* 고객 연결 모달 (가운데 Dialog) */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">고객 연결</DialogTitle>
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
  const supabase = createClient()

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
  const selectedItemId = selectedItem?.id
  useEffect(() => {
    if (selectedItemId) {
      loadQuotations(selectedItemId)
    } else {
      setQuotations([])
    }
  }, [selectedItemId, loadQuotations])

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

  // 견적서 저장 후 콜백
  const handleQuoteSaved = useCallback(() => {
    if (selectedItem) {
      loadQuotations(selectedItem.id)
    }
    router.refresh()
  }, [selectedItem, loadQuotations, router])

  // 의뢰 필드 수정 + 자동저장
  const updateRequestField = useCallback(async (field: string, value: any) => {
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
    inquiry_date: "",
    memo: "",
  })

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
    setColumns(newColumns)

    // DB에 상태 업데이트
    const { error } = await supabase
      .from("requests")
      .update({ status: destination.droppableId })
      .eq("id", draggableId)

    if (error) {
      // 실패 시 원래대로 되돌리기
      setColumns(initialColumns)
    } else {
      // 성공 시 서버 데이터 새로고침
      router.refresh()
    }
  }

  // 삭제 확인 버튼 클릭
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)

    // ID를 미리 저장 (다이얼로그 닫으면 deleteTarget이 null이 되니까)
    const targetId = deleteTarget.id

    // 화면에서 먼저 제거 (낙관적 업데이트)
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
        setColumns(initialColumns)
      } else {
        router.refresh()
      }
    } catch (e: any) {
      alert("네트워크 오류: " + e.message)
      setColumns(initialColumns)
    }
    setIsDeleting(false)
  }

  // 카드 숨기기 핸들러
  const handleHide = async (item: RequestItem) => {
    // 화면에서 먼저 숨김 (낙관적 업데이트)
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
        // 실패 시 되돌리기
        setColumns(initialColumns)
        setHiddenItems(initialHiddenItems)
      } else {
        router.refresh()
      }
    } catch {
      setColumns(initialColumns)
      setHiddenItems(initialHiddenItems)
    }
  }

  // 카드 복원 핸들러 (숨김 해제)
  const handleUnhide = async (item: RequestItem) => {
    // 화면에서 먼저 복원 (낙관적 업데이트)
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
        setColumns(initialColumns)
        setHiddenItems(initialHiddenItems)
      } else {
        router.refresh()
      }
    } catch {
      setColumns(initialColumns)
      setHiddenItems(initialHiddenItems)
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
        setCreateForm({ title: "", customer_id: "", inquiry_date: "", memo: "" })
        setIsCreateOpen(false)
        router.refresh()
      }
    } catch (e: any) {
      alert("네트워크 오류: " + e.message)
    }
    setIsCreating(false)
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* 페이지 헤더 + 탭 네비게이션 */}
      <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
        <nav className="flex items-center gap-6">
          {[
            { label: "의뢰", href: "/requests", icon: CheckSquare },
            { label: "고객", href: "/clients", icon: Users },
            { label: "견적서", href: "/quotes", icon: FileText },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-1.5 text-lg font-bold transition-colors",
                tab.href === "/requests"
                  ? "text-gray-900"
                  : "text-gray-300 hover:text-gray-500"
              )}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-gray-500">총 {totalCount}건</p>
      </div>

      {/* 칸반 보드 */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 bg-white">
          <div className="flex gap-4 p-4">
            {columns.map((col) => {
              const style = COLUMN_STYLES[col.status] || COLUMN_STYLES["견적 문의"]

              return (
                <div
                  key={col.status}
                  className="flex flex-col flex-1 min-w-0 rounded-lg bg-gray-50"
                >
                  {/* 컬럼 헤더 */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <h2 className={cn("font-extrabold text-2xl", style.header)}>
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
                                    "group relative bg-white rounded-lg border-2 p-4 min-h-[150px] shadow-sm hover:shadow-md transition-shadow cursor-grab",
                                    style.cardBar,
                                    snapshot.isDragging && "shadow-lg ring-2 ring-black/10"
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
                                  <Badge className={cn("absolute top-2 right-2 text-[10px] px-1 py-0", style.badge)}>
                                    {col.status}
                                  </Badge>

                                  {/* 제목 */}
                                  <div className="mb-2 pr-16">
                                    <p className="flex items-center gap-1.5 text-base font-semibold text-gray-900 truncate" title={item.title}>
                                      {(() => {
                                        const Icon = COLUMN_ICONS[col.status] || ClipboardList
                                        return <Icon className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                                      })()}
                                      <span className="truncate">{item.title}</span>
                                    </p>
                                  </div>

                                  {/* 문의 일시 + 고객명 (제목과 간격 두고 하단 배치) */}
                                  <div className="mt-4 space-y-1">
                                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                                      <span>{item.inquiry_date ? formatDate(item.inquiry_date) : "없음"}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                                      <span className={item.customer?.deleted_at ? "text-soft-blush" : ""}>
                                        {item.customer ? (item.customer.deleted_at ? "삭제된 고객" : item.customer.company_name) : "없음"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                                      <FileText className="h-3.5 w-3.5 shrink-0" />
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
                            <div className="text-center py-8 text-xs text-gray-400">
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
            <DialogTitle className="font-heading text-lg">의뢰 삭제</DialogTitle>
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
            setCreateForm({ title: "", customer_id: "", inquiry_date: "", memo: "" })
          }
          setIsCreateOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">새 의뢰 생성</DialogTitle>
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
              <Label className="text-sm font-medium">고객</Label>
              <Select
                value={createForm.customer_id}
                onValueChange={(v) => setCreateForm((prev) => ({ ...prev, customer_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="고객을 선택하세요 (선택사항)" />
                </SelectTrigger>
                <SelectContent>
                  {localCustomers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                setCreateForm({ title: "", customer_id: "", inquiry_date: "", memo: "" })
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
        <SheetContent side="right" className="w-full sm:max-w-[800px] p-0 flex flex-col [&>button:first-child]:hidden">
          {selectedItem && (() => {
            const itemStyle = COLUMN_STYLES[selectedItem.status] || COLUMN_STYLES["견적 문의"]
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
                  <div className="flex-1 overflow-y-auto px-6 py-6 border-r">
                    {/* 상태 배지 + 생성일 */}
                    <div className="flex items-center gap-3 mb-4">
                      <Badge className={cn("text-xs", itemStyle.badge)}>
                        {selectedItem.status}
                      </Badge>
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
                      {/* 단계 (인라인 선택 - 배지 스타일) */}
                      <div className="flex items-center justify-between rounded-md px-2 -mx-2 py-1 cursor-pointer hover:bg-sky-aqua/5 transition-colors">
                        <span className="text-sm text-gray-500">단계</span>
                        <InlineSelect
                          value={selectedItem.status}
                          displayValue={selectedItem.status}
                          placeholder="단계를 선택하세요"
                          options={REQUEST_STATUSES.filter((s) => s.value !== "숨김").map((s) => ({ value: s.value, label: s.label }))}
                          onConfirm={(v) => updateRequestField("status", v)}
                          badgeStyles={{
                            "견적 문의": COLUMN_STYLES["견적 문의"].badge,
                            "영업중": COLUMN_STYLES["영업중"].badge,
                            "계약 성공": COLUMN_STYLES["계약 성공"].badge,
                            "수주 실패": COLUMN_STYLES["수주 실패"].badge,
                          }}
                        />
                      </div>

                      {/* 문의 일시 (인라인 날짜) */}
                      <div className="flex items-center justify-between rounded-md px-2 -mx-2 py-1 cursor-pointer hover:bg-sky-aqua/5 transition-colors">
                        <span className="text-sm text-gray-500">문의 일시</span>
                        <InlineDate
                          value={selectedItem.inquiry_date || ""}
                          displayValue={selectedItem.inquiry_date ? formatDate(selectedItem.inquiry_date) : ""}
                          placeholder="날짜를 선택하세요"
                          onConfirm={(v) => updateRequestField("inquiry_date", v || null)}
                        />
                      </div>
                    </div>

                    <Separator className="my-6" />

                    {/* 메모 (인라인 편집) */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">내용</h3>
                      <InlineMemo
                        value={selectedItem.memo || ""}
                        placeholder="내용을 입력하세요"
                        onConfirm={(v) => updateRequestField("memo", v || null)}
                      />
                    </div>
                  </div>

                  {/* ===== 오른쪽 영역: 고객 정보 패널 ===== */}
                  <div className="w-1/2 shrink-0 overflow-y-auto px-6 py-6 bg-gray-50/50">
                    <CustomerPanel
                      customer={selectedItem.customer}
                      customers={localCustomers}
                      onLink={(id) => updateRequestField("customer_id", id)}
                      onUnlink={() => updateRequestField("customer_id", null)}
                      onOpenDetail={() => {
                        if (selectedItem.customer?.id) setCustomerDetailId(selectedItem.customer.id)
                      }}
                      quotations={quotations}
                      onAddQuote={() => {
                        setEditingQuotation(null)
                        setIsQuoteSheetOpen(true)
                      }}
                      onEditQuote={handleEditQuote}
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
          quotation={editingQuotation}
          onSaved={handleQuoteSaved}
        />
      )}
    </div>
  )
}
