"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatDate, formatDateTime, formatCurrency, formatPhone } from "@/lib/format"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Building2, Calendar, CheckCircle2, Phone, Plus, Search, User, X } from "lucide-react"
import { SETTLEMENT_TYPES } from "@/lib/constants"
import type { Contract } from "@/types"

// ----- 헬퍼: settlement_type 문자열 → 배열 파싱 -----
// DB에 "선금,잔금" 또는 '["선금","잔금"]' 형태로 저장될 수 있음
function parseSettlementType(value: unknown): string[] {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string' || !value) return []
  const trimmed = value.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
    } catch { /* 폴백 */ }
  }
  return trimmed.split(',').map(s => s.trim()).filter(Boolean)
}

// ----- 타입 -----
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

interface ContractSheetProps {
  contract: Contract | null
  customers: CustomerOption[]
  onFieldUpdate: (field: string, value: string | number | boolean | string[] | null) => void
  onClose: () => void
  onDelete: () => void
  saveMessage: string
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
        type="text"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleConfirm}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleConfirm()
          if (e.key === "Escape") { setTempValue(value); setIsEditing(false) }
        }}
        autoFocus
        className="font-sans text-2xl font-semibold text-left w-full bg-transparent border-b-2 border-slate-400 focus:outline-none py-1"
      />
    )
  }

  return (
    <h2
      onClick={() => setIsEditing(true)}
      className="font-sans text-2xl font-semibold text-left cursor-pointer rounded px-1 -mx-1 py-1 hover:bg-slate-50 transition-colors truncate"
      title={value}
    >
      {value}
    </h2>
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
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-300/50 focus:border-slate-400 mb-2"
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
              className="px-3 py-1 text-xs bg-slate-700 text-white rounded hover:bg-slate-600 transition-colors font-medium"
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
            className="w-full text-sm border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-300/50 focus:border-slate-400 resize-none"
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
              className="px-3 py-1 text-xs bg-slate-700 text-white rounded hover:bg-slate-600 transition-colors font-medium"
            >
              입력완료
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={handleOpen}
          className={cn(
            "rounded-lg border bg-gray-50 p-4 min-h-[120px] cursor-pointer hover:bg-slate-50 transition-colors",
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

// ----- 인라인 금액 편집 컴포넌트 -----
function InlineAmount({
  amount,
  vatInclusive,
  onAmountConfirm,
  onVatToggle,
}: {
  amount: number
  vatInclusive: boolean
  onAmountConfirm: (value: number) => void
  onVatToggle: (value: boolean) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempAmount, setTempAmount] = useState(String(amount || ""))
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setTempAmount(String(amount || "")) }, [amount])

  useEffect(() => {
    if (!isEditing) return
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        const num = Number(tempAmount) || 0
        if (num !== amount) onAmountConfirm(num)
        setIsEditing(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isEditing, tempAmount, amount, onAmountConfirm])

  const handleConfirm = () => {
    const num = Number(tempAmount) || 0
    if (num !== amount) onAmountConfirm(num)
    setIsEditing(false)
  }

  return (
    <div ref={wrapperRef} className="space-y-2">
      {/* 금액 표시/편집 */}
      <div className="flex items-center justify-between rounded-md px-2 -mx-2 py-1 cursor-pointer hover:bg-slate-50 transition-colors">
        <span className="text-sm text-gray-500">계약 금액</span>
        <div
          onClick={() => { setTempAmount(String(amount || "")); setIsEditing(true) }}
          className="relative flex-1 text-right px-2 -mx-2 py-1 cursor-pointer"
        >
          <span className={cn("text-sm font-semibold tabular-nums", amount ? "text-gray-900" : "text-gray-400")}>
            {amount ? formatCurrency(amount) : "금액을 입력하세요"}
          </span>

          {isEditing && (
            <div onClick={(e) => e.stopPropagation()} className="absolute top-full right-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 min-w-[260px]">
              <div className="relative mb-2">
                <input
                  type="number"
                  value={tempAmount}
                  onChange={(e) => setTempAmount(e.target.value)}
                  placeholder="금액을 입력하세요"
                  autoFocus
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 pr-8 text-right font-sans tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-300/50 focus:border-slate-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirm()
                    if (e.key === "Escape") setIsEditing(false)
                  }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
              </div>
              <div className="flex justify-end gap-1.5">
                <button onClick={() => setIsEditing(false)} className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors">취소</button>
                <button onClick={handleConfirm} className="px-3 py-1 text-xs bg-slate-700 text-white rounded hover:bg-slate-600 transition-colors font-medium">입력완료</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 부가세 포함 토글 */}
      <div className="flex items-center justify-between rounded-md px-2 -mx-2 py-1">
        <span className="text-sm text-gray-500">부가세</span>
        <button
          onClick={() => onVatToggle(!vatInclusive)}
          className={cn(
            "text-xs px-2.5 py-1 rounded-full font-medium transition-all border",
            vatInclusive
              ? "bg-green-100 text-green-600 border-green-300"
              : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
          )}
        >
          {vatInclusive ? "VAT 포함" : "VAT 별도"}
        </button>
      </div>
    </div>
  )
}

// ----- 인라인 정산형태 다중 선택 토글 -----
function InlineSettlementType({
  value,
  onToggle,
}: {
  value: string[]
  onToggle: (type: string) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-md px-2 -mx-2 py-1">
      <span className="text-sm text-gray-500 shrink-0 mr-3">정산 형태</span>
      <div className="flex flex-wrap gap-1.5 justify-end">
        {SETTLEMENT_TYPES.map((type) => {
          const isSelected = value.includes(type)
          return (
            <button
              key={type}
              onClick={() => onToggle(type)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                isSelected
                  ? "bg-slate-100 text-slate-700 border-slate-400 shadow-sm"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
              )}
            >
              {type}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ----- 고객 패널 (의뢰와 동일 패턴) -----
function CustomerPanel({
  customer,
  customers,
  onLink,
  onUnlink,
  onCreateAndLink,
}: {
  customer: { id: string; company_name: string; deleted_at?: string | null } | null
  customers: CustomerOption[]
  onLink: (id: string) => void
  onUnlink: () => void
  onCreateAndLink: (form: { company_name: string; contact_name?: string; phone?: string }) => Promise<void>
}) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateMode, setIsCreateMode] = useState(false)
  const [createForm, setCreateForm] = useState({ company_name: "", contact_name: "", phone: "" })
  const [isCreating, setIsCreating] = useState(false)

  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return c.company_name.toLowerCase().includes(q) || (c.contact_name && c.contact_name.toLowerCase().includes(q))
  })

  const customerDetail = customer ? customers.find((c) => c.id === customer.id) : null

  const closeModal = () => {
    setIsModalOpen(false)
    setSearchQuery("")
    setIsCreateMode(false)
    setCreateForm({ company_name: "", contact_name: "", phone: "" })
  }

  const handleSelectCustomer = (id: string) => {
    onLink(id)
    closeModal()
  }

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
      toast({ title: "오류", description: "고객 생성에 실패했습니다.", variant: "destructive" })
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
            <CheckCircle2 className="h-5 w-5 text-white fill-green-500" />
          )}
          {customer?.deleted_at && (
            <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">!</span>
          )}
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
            <Search className="h-4 w-4 text-gray-300 group-hover:text-slate-700 transition-colors" />
          </button>
          <div className="rounded-md bg-slate-100 px-3 py-2.5">
            <p className="text-xs text-slate-700">고객을 선택하거나 추가해주세요 :)</p>
          </div>
        </div>
      )}

      {/* 삭제된 고객 상태 */}
      {customer?.deleted_at && (
        <div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-sm font-medium text-red-500">삭제된 데이터</span>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={() => setIsModalOpen(true)} className="p-1.5 rounded-md text-gray-400 hover:text-slate-500 hover:bg-slate-100 transition-colors" title="변경">
                <Search className="h-3 w-3" />
              </button>
              <button onClick={onUnlink} className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors" title="해제">
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="rounded-md bg-red-500/10 px-3 py-2.5">
            <p className="text-xs text-red-500 font-medium">연결된 데이터가 삭제됐어요!</p>
            <p className="text-xs text-red-500/80">다른 데이터로 연결을 변경해주세요.</p>
          </div>
        </div>
      )}

      {/* 고객 연결됨 상태 */}
      {customer && !customer.deleted_at && (
        <div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <Building2 className="h-3 w-3 text-slate-500" />
              </div>
              <span className="text-sm font-medium text-slate-700 truncate">{customer.company_name}</span>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={() => setIsModalOpen(true)} className="p-1.5 rounded-md text-gray-400 hover:text-slate-500 hover:bg-slate-100 transition-colors" title="변경">
                <Search className="h-3 w-3" />
              </button>
              <button onClick={onUnlink} className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors" title="해제">
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* 고객 상세 정보 */}
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

      {/* 고객 연결 모달 */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-sans text-lg">고객 연결</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              기존 고객을 검색하거나, 새로운 고객을 등록하세요.
            </DialogDescription>
          </DialogHeader>

          {!isCreateMode && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="회사명, 담당자명으로 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300/50 focus:border-slate-400"
                />
              </div>

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
                        customer && c.id === customer.id && "bg-slate-100"
                      )}
                    >
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <Building2 className="h-3.5 w-3.5 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.company_name}</p>
                        <p className="text-xs text-gray-500 truncate">{c.contact_name || "담당자 미등록"} {c.phone && `· ${c.phone}`}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <button
                onClick={() => setIsCreateMode(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors border border-dashed border-slate-400/30"
              >
                <Plus className="h-4 w-4" /> 새 고객 등록
              </button>
            </div>
          )}

          {isCreateMode && (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="회사명 *"
                value={createForm.company_name}
                onChange={(e) => setCreateForm((p) => ({ ...p, company_name: e.target.value }))}
                autoFocus
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300/50 focus:border-slate-400"
              />
              <input
                type="text"
                placeholder="담당자명"
                value={createForm.contact_name}
                onChange={(e) => setCreateForm((p) => ({ ...p, contact_name: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300/50 focus:border-slate-400"
              />
              <input
                type="text"
                placeholder="연락처"
                value={createForm.phone}
                onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300/50 focus:border-slate-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setIsCreateMode(false)}
                  className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  뒤로
                </button>
                <button
                  onClick={handleCreateAndLink}
                  disabled={isCreating || !createForm.company_name.trim()}
                  className="flex-1 py-2 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
                >
                  {isCreating ? "생성 중..." : "등록 후 연결"}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ContractSheet({
  contract,
  customers,
  onFieldUpdate,
  onClose,
  onDelete,
  saveMessage,
}: ContractSheetProps) {
  if (!contract) return null

  // 고객 정보 구성
  const customerForPanel = contract.customer
    ? { id: contract.customer.id, company_name: contract.customer.company_name, deleted_at: contract.customer.deleted_at || null }
    : null

  return (
    <Sheet open={!!contract} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[800px] p-0 flex flex-col [&>button:first-child]:hidden">
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
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
              onClick={onDelete}
              className="px-3 py-1.5 text-sm rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
            >
              삭제하기
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* 본문: 좌우 분리 */}
        <div className="flex-1 flex overflow-hidden">
          {/* ===== 왼쪽 영역: 계약 상세 정보 ===== */}
          <div className="flex-1 overflow-y-auto px-6 py-6 border-r">
            {/* 생성일 */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] text-gray-400">
                {formatDateTime(contract.created_at).replace(/^\d{2}/, '')} 생성
              </span>
            </div>

            {/* 계약명 (인라인 편집) */}
            <SheetHeader className="mb-6">
              <SheetTitle className="sr-only">계약 상세</SheetTitle>
              <SheetDescription className="sr-only">계약 상세 정보</SheetDescription>
              <InlineTitle
                value={contract.title}
                onConfirm={(v) => {
                  if (v.trim()) onFieldUpdate("title", v.trim())
                }}
              />
            </SheetHeader>

            <Separator className="mb-6" />

            {/* 상세 정보 */}
            <div className="space-y-3">
              {/* 계약 금액 + 부가세 */}
              <InlineAmount
                amount={contract.contract_amount}
                vatInclusive={contract.vat_inclusive || false}
                onAmountConfirm={(v) => onFieldUpdate("contract_amount", v)}
                onVatToggle={(v) => onFieldUpdate("vat_inclusive", v)}
              />

              {/* 정산 형태 */}
              <InlineSettlementType
                value={parseSettlementType(contract.settlement_type)}
                onToggle={(type) => {
                  const current = parseSettlementType(contract.settlement_type)
                  const next = current.includes(type)
                    ? current.filter((t) => t !== type)
                    : [...current, type]
                  // DB가 TEXT[]가 아니면 첫 번째 값만 문자열로 저장하거나, 배열 그대로 보냄 (API에서 처리)
                  onFieldUpdate("settlement_type", next)
                }}
              />

              <Separator />

              {/* 착수일 */}
              <div className="flex items-center justify-between rounded-md px-2 -mx-2 py-1 cursor-pointer hover:bg-slate-50 transition-colors">
                <span className="text-sm text-gray-500 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> 착수일</span>
                <InlineDate
                  value={contract.start_date || ""}
                  displayValue={contract.start_date ? formatDate(contract.start_date) : ""}
                  placeholder="날짜를 선택하세요"
                  onConfirm={(v) => onFieldUpdate("start_date", v || null)}
                />
              </div>

              {/* 종료일 */}
              <div className="flex items-center justify-between rounded-md px-2 -mx-2 py-1 cursor-pointer hover:bg-slate-50 transition-colors">
                <span className="text-sm text-gray-500 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> 종료일</span>
                <InlineDate
                  value={contract.end_date || ""}
                  displayValue={contract.end_date ? formatDate(contract.end_date) : ""}
                  placeholder="날짜를 선택하세요"
                  onConfirm={(v) => onFieldUpdate("end_date", v || null)}
                />
              </div>
            </div>

            <Separator className="my-6" />

            {/* 비고 (인라인 편집) */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">비고</h3>
              <InlineMemo
                value={contract.memo || ""}
                placeholder="특이사항이나 메모를 입력하세요"
                onConfirm={(v) => onFieldUpdate("memo", v || null)}
              />
            </div>
          </div>

          {/* ===== 오른쪽 영역: 고객 정보 패널 ===== */}
          <div className="w-1/2 shrink-0 overflow-y-auto px-6 py-6 bg-gray-50/50">
            <CustomerPanel
              customer={customerForPanel}
              customers={customers}
              onLink={(id) => onFieldUpdate("customer_id", id)}
              onUnlink={() => onFieldUpdate("customer_id", null)}
              onCreateAndLink={async (form) => {
                // 고객 생성
                const res = await fetch("/api/customers", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(form),
                })
                const result = await res.json()
                if (!res.ok) throw new Error(result.error)
                // 생성 후 연결
                onFieldUpdate("customer_id", result.data.id)
              }}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
