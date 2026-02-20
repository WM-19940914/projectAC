"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { formatShortDate, formatPhone } from "@/lib/format"
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
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
  X,
  FileText,
  Save,
} from "lucide-react"
import { useRouter } from "next/navigation"
import SalesTabNav from "@/components/layout/sales-tab-nav"

// ----- 타입 -----
interface CustomerItem {
  id: string
  company_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  business_number: string | null
  representative: string | null
  address: string | null
  memo: string | null
  created_at: string
}

// 수정 폼용 타입 (id, created_at 제외)
type CustomerForm = Omit<CustomerItem, "id" | "created_at">

interface Props {
  customers: CustomerItem[]
}

// 빈 폼 초기값
const EMPTY_FORM: CustomerForm = {
  company_name: "",
  contact_name: null,
  phone: null,
  email: null,
  business_number: null,
  representative: null,
  address: null,
  memo: null,
}

// ----- 인라인 편집 컴포넌트 -----
// 값을 클릭하면 아래에 미니 입력창이 나타나는 UX
function InlineEdit({
  value,
  placeholder,
  onConfirm,
  type = "text",
  className = "",
  align = "right",
}: {
  value: string
  placeholder: string
  onConfirm: (value: string) => void
  type?: "text" | "email"
  className?: string
  align?: "left" | "right"
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
        onConfirm(tempValue)
        setIsEditing(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isEditing, tempValue, onConfirm])

  // 편집 시작할 때 최신 값으로 세팅
  const handleOpen = () => {
    setTempValue(value)
    setIsEditing(true)
  }

  // 입력완료
  const handleConfirm = () => {
    onConfirm(tempValue)
    setIsEditing(false)
  }

  return (
    <div
      ref={wrapperRef}
      onClick={handleOpen}
      className={cn(
        "relative flex-1 cursor-pointer rounded hover:bg-sky-aqua/5 transition-colors py-1 px-2 -mx-2",
        align === "right" && "text-right",
        !value && "border-b border-dashed border-gray-300"
      )}
    >
      {/* 표시되는 값 */}
      <span
        className={cn(
          value ? "text-gray-900" : "text-gray-400",
          className
        )}
      >
        {value || placeholder}
      </span>

      {/* 미니 입력 팝업 */}
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

// ----- 인라인 메모 편집 (textarea 버전) -----
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
        onConfirm(tempValue)
        setIsEditing(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isEditing, tempValue, onConfirm])

  const handleOpen = () => {
    setTempValue(value)
    setIsEditing(true)
  }

  const handleConfirm = () => {
    onConfirm(tempValue)
    setIsEditing(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div
        onClick={handleOpen}
        className={cn(
          "cursor-pointer py-1 px-1 -mx-1 rounded hover:bg-sky-aqua/10 transition-colors text-sm min-h-[60px] whitespace-pre-wrap",
          value ? "text-gray-900" : "text-gray-400 border-b border-dashed border-gray-300"
        )}
      >
        {value || placeholder}
      </div>

      {isEditing && (
        <div onClick={(e) => e.stopPropagation()} className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 min-w-[300px]">
          <textarea
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            rows={4}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-aqua/50 focus:border-sky-aqua resize-none mb-2"
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

export function CustomerList({ customers: initialCustomers }: Props) {
  const [customers, setCustomers] = useState(initialCustomers)
  const [searchQuery, setSearchQuery] = useState("")
  // 상세/수정 패널
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null)
  const [editForm, setEditForm] = useState<CustomerForm>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")
  // 신규 추가 모드
  const [isAddMode, setIsAddMode] = useState(false)
  // 삭제 다이얼로그
  const [deleteTarget, setDeleteTarget] = useState<CustomerItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const router = useRouter()

  // 검색 필터링
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers
    const q = searchQuery.toLowerCase()
    return customers.filter(
      (c) =>
        c.company_name.toLowerCase().includes(q) ||
        c.contact_name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q)
    )
  }, [customers, searchQuery])

  // 고객 클릭 → 수정 패널 열기
  const handleSelectCustomer = (customer: CustomerItem) => {
    setSelectedCustomer(customer)
    setIsAddMode(false)
    setEditForm({
      company_name: customer.company_name,
      contact_name: customer.contact_name,
      phone: customer.phone,
      email: customer.email,
      business_number: customer.business_number,
      representative: customer.representative,
      address: customer.address,
      memo: customer.memo,
    })
    setSaveMessage("")
  }

  // +고객 추가 버튼 클릭
  const handleAddNew = () => {
    setSelectedCustomer(null)
    setIsAddMode(true)
    setEditForm(EMPTY_FORM)
    setSaveMessage("")
  }

  // 패널 닫기
  const handleClosePanel = () => {
    setSelectedCustomer(null)
    setIsAddMode(false)
    setSaveMessage("")
  }

  // 폼 필드 변경 + 자동저장 (수정 모드일 때)
  const updateField = async (field: keyof CustomerForm, value: string) => {
    // company_name은 빈 문자열 유지 (null 되면 .trim() 에러)
    const newValue = field === "company_name" ? value : (value || null)
    setEditForm((prev) => ({ ...prev, [field]: newValue }))

    // 수정 모드: admin API로 바로 저장
    if (!isAddMode && selectedCustomer) {
      setSaveMessage("저장 중...")
      const res = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedCustomer.id, [field]: newValue }),
      })

      if (!res.ok) {
        setSaveMessage("저장 실패")
        setTimeout(() => setSaveMessage(""), 2000)
      } else {
        setSaveMessage("자동 저장됨")
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === selectedCustomer.id ? { ...c, [field]: newValue } : c
          )
        )
        setSelectedCustomer((prev) => prev ? { ...prev, [field]: newValue } : null)
        setTimeout(() => setSaveMessage(""), 1500)
      }
    }
  }

  // 신규 등록 (추가 모드에서만 사용)
  const handleSave = async () => {
    if (!editForm.company_name?.trim()) {
      setSaveMessage("회사명을 입력해주세요")
      return
    }
    setIsSaving(true)
    setSaveMessage("")

    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    })
    const result = await res.json()

    if (!res.ok) {
      setSaveMessage("저장 실패: " + result.error)
    } else {
      setSaveMessage("등록 완료!")
      setCustomers((prev) => [result.data, ...prev])
      setTimeout(() => {
        setIsAddMode(false)
        setSaveMessage("")
      }, 1000)
    }
    setIsSaving(false)
    router.refresh()
  }

  // 삭제 확인
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)

    const targetId = deleteTarget.id
    setCustomers((prev) => prev.filter((c) => c.id !== targetId))
    setDeleteTarget(null)

    // admin API로 삭제 + 캐시 갱신
    const res = await fetch("/api/customers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: targetId }),
    })

    if (!res.ok) {
      setCustomers(initialCustomers)
    } else {
      router.refresh()
    }
    setIsDeleting(false)
  }

  // 패널 열림 여부
  const isPanelOpen = !!selectedCustomer || isAddMode

  return (
    <div className="flex flex-col">
      {/* 페이지 헤더 + 탭 네비게이션 */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-6">
          <SalesTabNav />
          <p className="text-sm text-gray-500">총 {filteredCustomers.length}개 업체</p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-1.5 px-4 py-2 text-[15px] font-medium rounded-lg bg-sky-aqua text-white hover:bg-sky-aqua/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          고객 추가
        </button>
      </div>

      {/* 검색바 */}
      <div className="px-6 py-3 border-b">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="회사명, 담당자, 연락처, 소재지로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-[15px] border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-aqua/50 focus:border-sky-aqua"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div>
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0 z-[5]">
            <tr className="text-left text-sm text-gray-500 font-medium">
              <th className="px-6 py-3">회사명</th>
              <th className="px-6 py-3">담당자</th>
              <th className="px-6 py-3">연락처</th>
              <th className="px-6 py-3">이메일</th>
              <th className="px-6 py-3">등록일</th>
              <th className="px-6 py-3 w-[50px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredCustomers.map((customer) => (
              <tr
                key={customer.id}
                onClick={() => handleSelectCustomer(customer)}
                className="group hover:bg-sky-aqua/5 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-sky-aqua/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-sky-aqua" />
                    </div>
                    <span className="text-[15px] font-medium text-gray-900">
                      {customer.company_name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[15px] text-gray-900">
                    {customer.contact_name || <span className="text-gray-300">-</span>}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[15px] text-gray-600">
                    {customer.phone ? formatPhone(customer.phone) : <span className="text-gray-300">-</span>}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[15px] text-gray-600">
                    {customer.email || <span className="text-gray-300">-</span>}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[15px] text-gray-500">
                    {formatShortDate(customer.created_at)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteTarget(customer)
                    }}
                    className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all bg-soft-blush hover:bg-soft-blush/80 text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-16 text-sm text-gray-400">
                  {searchQuery ? "검색 결과가 없습니다" : "등록된 고객이 없습니다"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">고객 삭제</DialogTitle>
            <DialogDescription className="text-sm text-gray-500 pt-2">
              <span className="font-semibold text-gray-900">
                &ldquo;{deleteTarget?.company_name}&rdquo;
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

      {/* 고객 상세/수정/추가 패널 (오른쪽 슬라이드) */}
      <Sheet open={isPanelOpen} onOpenChange={(open) => !open && handleClosePanel()}>
        <SheetContent side="right" className="w-full sm:max-w-[900px] p-0 flex flex-col [&>button:first-child]:hidden">
          {/* 상단 헤더 */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <button
              onClick={handleClosePanel}
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              {/* 저장 메시지 */}
              {saveMessage && (
                <span className={cn(
                  "text-sm",
                  saveMessage.includes("실패") || saveMessage.includes("입력") ? "text-red-500" : "text-muted-teal"
                )}>
                  {saveMessage}
                </span>
              )}
              {/* 등록 버튼 (신규 추가 모드에서만) */}
              {isAddMode && (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md bg-sky-aqua text-white hover:bg-sky-aqua/90 transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? "저장 중..." : "등록"}
                </button>
              )}
              {/* 삭제 버튼 (수정 모드에서만) */}
              {!isAddMode && selectedCustomer && (
                <button
                  onClick={() => {
                    setDeleteTarget(selectedCustomer)
                    handleClosePanel()
                  }}
                  className="px-3 py-1.5 text-sm rounded-md text-soft-blush hover:bg-soft-blush/10 transition-colors"
                >
                  삭제하기
                </button>
              )}
              <button
                onClick={handleClosePanel}
                className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* 본문: 좌우 분리 */}
          <div className="flex-1 flex overflow-hidden">
            {/* ===== 왼쪽 영역: 고객 정보 ===== */}
            <div className="w-1/2 overflow-y-auto px-6 py-6 border-r">
              {/* 상단 배지 */}
              <div className="flex items-center gap-3 mb-4">
                <Badge className="text-xs bg-sky-aqua/20 text-sky-aqua">
                  {isAddMode ? "신규 등록" : "고객"}
                </Badge>
                {!isAddMode && selectedCustomer && (
                  <span className="text-xs text-gray-400">
                    {formatShortDate(selectedCustomer.created_at)} 등록
                  </span>
                )}
              </div>

              {/* 회사명 */}
              <SheetHeader className="mb-6">
                <SheetTitle className="sr-only">
                  {isAddMode ? "고객 추가" : "고객 수정"}
                </SheetTitle>
                <SheetDescription className="sr-only">고객 정보를 입력하세요</SheetDescription>
                <InlineEdit
                  value={editForm.company_name}
                  placeholder="회사명을 입력하세요"
                  onConfirm={(v) => updateField("company_name", v)}
                  className="font-heading text-2xl font-semibold"
                  align="left"
                />
              </SheetHeader>

              <Separator className="mb-6" />

              {/* 연락처 정보 */}
              <h3 className="text-base font-semibold text-gray-900 mb-5">연락처 정보</h3>
              <div className="space-y-5 mb-6">
                {/* 담당자 */}
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="text-[15px] text-gray-400 w-[90px] shrink-0">담당자</span>
                  <InlineEdit
                    value={editForm.contact_name || ""}
                    placeholder="담당자명"
                    onConfirm={(v) => updateField("contact_name", v)}
                    className="text-base font-medium"
                  />
                </div>
                {/* 연락처 */}
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="text-[15px] text-gray-400 w-[90px] shrink-0">연락처</span>
                  <InlineEdit
                    value={editForm.phone || ""}
                    placeholder="010-0000-0000"
                    onConfirm={(v) => updateField("phone", v)}
                    className="text-base font-medium"
                  />
                </div>
                {/* 이메일 */}
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="text-[15px] text-gray-400 w-[90px] shrink-0">이메일</span>
                  <InlineEdit
                    value={editForm.email || ""}
                    placeholder="example@email.com"
                    onConfirm={(v) => updateField("email", v)}
                    type="email"
                    className="text-base font-medium"
                  />
                </div>
              </div>

              <Separator className="mb-6" />

              {/* 사업자 정보 */}
              <h3 className="text-base font-semibold text-gray-900 mb-5">사업자 정보</h3>
              <div className="space-y-5 mb-6">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="text-[15px] text-gray-400 w-[90px] shrink-0">대표자</span>
                  <InlineEdit
                    value={editForm.representative || ""}
                    placeholder="대표자명"
                    onConfirm={(v) => updateField("representative", v)}
                    className="text-base font-medium"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="text-[15px] text-gray-400 w-[90px] shrink-0">사업자번호</span>
                  <InlineEdit
                    value={editForm.business_number || ""}
                    placeholder="123-45-67890"
                    onConfirm={(v) => updateField("business_number", v)}
                    className="text-base font-medium"
                  />
                </div>
              </div>

              <Separator className="mb-6" />

              {/* 메모 */}
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-gray-400 shrink-0 mt-1" />
                <span className="text-[15px] text-gray-400 w-[90px] shrink-0 mt-0.5">메모</span>
                <div className="flex-1">
                  <InlineMemo
                    value={editForm.memo || ""}
                    placeholder="메모를 입력하세요"
                    onConfirm={(v) => updateField("memo", v)}
                  />
                </div>
              </div>
            </div>

            {/* ===== 오른쪽 영역: 추가 기능 (5:5 비율) ===== */}
            <div className="w-1/2 overflow-y-auto px-6 py-6 bg-gray-50/50">
              <h3 className="text-sm font-semibold text-gray-400 mb-4">추가 기능</h3>
              <p className="text-xs text-gray-400">이 영역에 기능이 추가될 예정입니다.</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
