"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, Search, Plus, Building2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { formatCurrency, formatShortDate } from "@/lib/format"
import SalesTabNav from "@/components/layout/sales-tab-nav"
import QuoteEditorSheet from "./quote-editor-sheet"
import type { QuotationWithItems } from "@/types"

// 서버에서 넘어오는 견적서 목록 타입
interface QuotationRow {
  id: string
  title: string
  quotation_number: string
  quotation_date: string
  total_amount: number
  tax_amount: number
  grand_total: number
  notes: string | null
  site_name?: string | null
  customer: { id: string; company_name: string } | { id: string; company_name: string }[] | null
  request: { id: string; title: string } | { id: string; title: string }[] | null
}

// 의뢰 타입
interface RequestRow {
  id: string
  title: string
  customer: { id: string; company_name: string } | null
}

// 고객 타입
interface CustomerRow {
  id: string
  company_name: string
  contact_name: string | null
}

// 조인 결과에서 단건 추출 헬퍼
function unwrap<T>(val: T | T[] | null): T | null {
  if (!val) return null
  if (Array.isArray(val)) return val[0] ?? null
  return val
}

interface Props {
  quotations: QuotationRow[]
  customers: CustomerRow[]
}

export default function QuotesList({ quotations, customers }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")

  // 견적서 편집 Sheet state
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingQuotation, setEditingQuotation] = useState<QuotationWithItems | null>(null)

  // 신규 견적서 생성 시 연결 정보
  const [newRequestId, setNewRequestId] = useState("")
  const [newCustomerId, setNewCustomerId] = useState<string | null>(null)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newInitialTitle, setNewInitialTitle] = useState("")

  // 의뢰 선택 Dialog
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [requestSearch, setRequestSearch] = useState("")
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [loadingRequests, setLoadingRequests] = useState(false)

  // 의뢰 생성 Dialog (칸반보드와 동일)
  const [isCreateRequestOpen, setIsCreateRequestOpen] = useState(false)
  const [isCreatingRequest, setIsCreatingRequest] = useState(false)
  const [createRequestForm, setCreateRequestForm] = useState({
    title: "", customer_id: "", inquiry_date: new Date().toISOString().split("T")[0], memo: "",
  })
  // 의뢰 생성용 고객 연결 모달
  const [localCustomers, setLocalCustomers] = useState<CustomerRow[]>(customers)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState("")
  const [isCustomerCreateMode, setIsCustomerCreateMode] = useState(false)
  const [customerCreateForm, setCustomerCreateForm] = useState({ company_name: "", contact_name: "", phone: "" })
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)

  // 검색 필터
  const filtered = quotations.filter((q) => {
    if (!search.trim()) return true
    const s = search.toLowerCase()
    const cust = unwrap(q.customer)
    const req = unwrap(q.request)
    return (
      q.title.toLowerCase().includes(s) ||
      q.quotation_number.toLowerCase().includes(s) ||
      (cust?.company_name || "").toLowerCase().includes(s) ||
      (req?.title || "").toLowerCase().includes(s)
    )
  })

  // 의뢰 목록 불러오기
  const fetchRequests = useCallback(async () => {
    setLoadingRequests(true)
    try {
      const res = await fetch("/api/requests/list")
      if (res.ok) {
        const result = await res.json()
        setRequests(result.data || [])
      }
    } catch {
      // 무시
    } finally {
      setLoadingRequests(false)
    }
  }, [])

  // Dialog 열릴 때 의뢰 목록 fetch
  useEffect(() => {
    if (requestDialogOpen) {
      fetchRequests()
      setRequestSearch("")
      setSelectedRequestId(null)
    }
  }, [requestDialogOpen, fetchRequests])

  // 의뢰 검색 필터
  const filteredRequests = requests.filter((r) => {
    if (!requestSearch.trim()) return true
    const s = requestSearch.toLowerCase()
    return (
      r.title.toLowerCase().includes(s) ||
      (r.customer?.company_name || "").toLowerCase().includes(s)
    )
  })

  // 견적서 클릭 → 상세 데이터 fetch 후 Sheet 열기
  const handleRowClick = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/quotes?id=${id}`)
      if (res.ok) {
        const result = await res.json()
        setEditingQuotation(result.data)
        setNewRequestId("")
        setNewCustomerId(null)
        setNewCustomerName("")
        setNewInitialTitle("")
        setIsSheetOpen(true)
      }
    } catch {
      alert("견적서 데이터를 불러올 수 없습니다.")
    }
  }, [])

  // "+견적서 추가" 클릭 → 의뢰 선택 Dialog 열기
  const handleCreate = useCallback(() => {
    setRequestDialogOpen(true)
  }, [])

  // "다음으로" → 바로 견적서 생성(POST) → 에디터 열기
  const handleConfirmRequest = useCallback(async () => {
    const selected = requests.find((r) => r.id === selectedRequestId)
    if (!selected) return
    try {
      const payload = {
        title: `${selected.title} 견적서`,
        quotation_date: new Date().toISOString().split("T")[0],
        request_id: selected.id,
        customer_id: selected.customer?.id || null,
        items: [],
      }
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { alert("견적서 생성 실패"); return }
      const result = await res.json()
      // 생성된 견적서 상세 fetch → 에디터 열기
      const detailRes = await fetch(`/api/quotes?id=${result.data.id}`)
      if (detailRes.ok) {
        const detail = await detailRes.json()
        setEditingQuotation(detail.data)
        setNewRequestId("")
        setNewCustomerId(null)
        setNewCustomerName("")
        setNewInitialTitle("")
        setRequestDialogOpen(false)
        setIsSheetOpen(true)
        router.refresh()
      }
    } catch {
      alert("견적서 생성 중 오류가 발생했습니다.")
    }
  }, [requests, selectedRequestId, router])

  // 의뢰 생성 후 → 견적서 즉시 생성 → 에디터 열기
  const handleCreateRequest = useCallback(async () => {
    if (!createRequestForm.title.trim()) return
    setIsCreatingRequest(true)
    try {
      // 1. 의뢰 생성
      const reqRes = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createRequestForm),
      })
      const reqResult = await reqRes.json()
      if (!reqRes.ok) { alert("의뢰 생성 실패: " + (reqResult.error || "")); return }

      // 2. 견적서 즉시 생성 (의뢰에 연결)
      const quotePayload = {
        title: `${createRequestForm.title.trim()} 견적서`,
        quotation_date: new Date().toISOString().split("T")[0],
        request_id: reqResult.data.id,
        customer_id: createRequestForm.customer_id || null,
        items: [],
      }
      const quoteRes = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quotePayload),
      })
      if (!quoteRes.ok) { alert("견적서 생성 실패"); return }
      const quoteResult = await quoteRes.json()

      // 3. 생성된 견적서 상세 fetch → 에디터 열기
      const detailRes = await fetch(`/api/quotes?id=${quoteResult.data.id}`)
      if (detailRes.ok) {
        const detail = await detailRes.json()
        setEditingQuotation(detail.data)
        setNewRequestId("")
        setNewCustomerId(null)
        setNewCustomerName("")
        setNewInitialTitle("")
        setCreateRequestForm({ title: "", customer_id: "", inquiry_date: new Date().toISOString().split("T")[0], memo: "" })
        setIsCreateRequestOpen(false)
        setRequestDialogOpen(false)
        setIsSheetOpen(true)
        router.refresh()
      }
    } catch {
      alert("의뢰 생성 중 오류가 발생했습니다")
    } finally {
      setIsCreatingRequest(false)
    }
  }, [createRequestForm, router])

  // 저장 후 콜백 (자동저장에서도 호출되므로 시트를 닫지 않음)
  const handleSaved = useCallback(() => {
    router.refresh()
  }, [router])

  return (
    <div className="flex flex-col h-full -m-6 bg-white">
      {/* 페이지 헤더 + 탭 네비게이션 */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <SalesTabNav />
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">총 {quotations.length}건</p>
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-sky-aqua text-white hover:bg-sky-aqua/80 transition-colors"
          >
            <Plus className="h-4 w-4" />
            견적서 추가
          </button>
        </div>
      </div>

      {/* 검색 바 */}
      <div className="px-6 py-3 border-b">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="제목, 견적번호, 고객명, 의뢰명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-aqua/50 focus:border-sky-aqua"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FileText className="h-10 w-10 mb-3" />
            <p className="text-sm">
              {quotations.length === 0
                ? "아직 견적서가 없습니다"
                : "검색 결과가 없습니다"}
            </p>
            {quotations.length === 0 && (
              <button
                onClick={handleCreate}
                className="mt-3 text-sm text-sky-aqua hover:underline"
              >
                첫 견적서를 작성해보세요
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="border-b border-gray-200">
                <th className="px-6 py-3 text-left font-semibold text-gray-500 text-xs">
                  견적번호
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-500 text-xs">
                  제목
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-500 text-xs">
                  고객
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-500 text-xs">
                  의뢰
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-500 text-xs">
                  견적일
                </th>
                <th className="px-6 py-3 text-right font-semibold text-gray-500 text-xs">
                  합계금액
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => {
                const cust = unwrap(q.customer)
                const req = unwrap(q.request)
                return (
                  <tr
                    key={q.id}
                    onClick={() => handleRowClick(q.id)}
                    className="border-b border-gray-100 hover:bg-sky-aqua/5 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3">
                      <Badge
                        variant="secondary"
                        className="text-[11px] bg-sky-aqua/10 text-sky-aqua"
                      >
                        {q.quotation_number}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {q.title}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {cust?.company_name || "-"}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {req?.title || "-"}
                    </td>
                    <td className="px-6 py-3 text-gray-500">
                      {formatShortDate(q.quotation_date)}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-gray-900 tabular-nums">
                      {formatCurrency(q.grand_total)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 의뢰 선택 Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="sm:max-w-[440px] p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogDescription className="text-[11px] text-gray-400">견적서 생성</DialogDescription>
            <DialogTitle className="font-sans text-base font-semibold">어떤 의뢰의 견적서인가요?</DialogTitle>
          </DialogHeader>

          {/* 검색 */}
          <div className="px-5 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="검색어를 입력하세요.."
                value={requestSearch}
                onChange={(e) => setRequestSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-aqua/50 focus:border-sky-aqua"
              />
            </div>
          </div>

          {/* 의뢰 목록 */}
          <div className="max-h-[320px] overflow-y-auto px-5">
            {loadingRequests ? (
              <p className="text-xs text-gray-400 text-center py-8">불러오는 중...</p>
            ) : filteredRequests.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">의뢰가 없습니다</p>
            ) : (
              <div className="space-y-1.5">
                {filteredRequests.map((r) => (
                  <label
                    key={r.id}
                    className={`flex items-start gap-3 px-3 py-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedRequestId === r.id
                        ? "border-sky-aqua bg-sky-aqua/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="request"
                      checked={selectedRequestId === r.id}
                      onChange={() => setSelectedRequestId(r.id)}
                      className="mt-0.5 accent-sky-aqua"
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 leading-snug">{r.title}</p>
                      {r.customer?.company_name && (
                        <p className="text-[11px] text-gray-400 mt-0.5">{r.customer.company_name}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 하단 버튼 */}
          <div className="flex gap-2.5 px-5 py-4 border-t mt-3">
            <button
              onClick={() => {
                setRequestDialogOpen(false)
                setIsCreateRequestOpen(true)
              }}
              className="flex-1 py-2.5 text-sm font-medium rounded-lg border border-sky-aqua text-sky-aqua hover:bg-sky-aqua/5 transition-colors"
            >
              새 의뢰 만들기
            </button>
            <button
              onClick={handleConfirmRequest}
              disabled={!selectedRequestId}
              className="flex-1 py-2.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              다음으로
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 의뢰 생성 Dialog (칸반보드와 동일) */}
      <Dialog
        open={isCreateRequestOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateRequestForm({ title: "", customer_id: "", inquiry_date: new Date().toISOString().split("T")[0], memo: "" })
          }
          setIsCreateRequestOpen(open)
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
              <Label htmlFor="req-title" className="text-sm font-medium">
                제목 <span className="text-soft-blush">*</span>
              </Label>
              <Input
                id="req-title"
                placeholder="예: OO빌딩 에어컨 설치 문의"
                value={createRequestForm.title}
                onChange={(e) => setCreateRequestForm((prev) => ({ ...prev, title: e.target.value }))}
                autoFocus
              />
            </div>

            {/* 고객 선택 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">고객 <span className="text-soft-blush">*</span></Label>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(true)}
                className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-200 rounded-lg hover:border-sky-aqua/50 transition-colors"
              >
                {createRequestForm.customer_id ? (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-tropical-teal/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-3 w-3 text-tropical-teal" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {localCustomers.find((c) => c.id === createRequestForm.customer_id)?.company_name || ""}
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
              <Label htmlFor="req-date" className="text-sm font-medium">문의 일시</Label>
              <Input
                id="req-date"
                type="date"
                value={createRequestForm.inquiry_date}
                onChange={(e) => setCreateRequestForm((prev) => ({ ...prev, inquiry_date: e.target.value }))}
              />
            </div>

            {/* 메모 */}
            <div className="space-y-2">
              <Label htmlFor="req-memo" className="text-sm font-medium">메모</Label>
              <Textarea
                id="req-memo"
                placeholder="추가 내용을 입력하세요"
                rows={3}
                value={createRequestForm.memo}
                onChange={(e) => setCreateRequestForm((prev) => ({ ...prev, memo: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => {
                setCreateRequestForm({ title: "", customer_id: "", inquiry_date: new Date().toISOString().split("T")[0], memo: "" })
                setIsCreateRequestOpen(false)
              }}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleCreateRequest}
              disabled={isCreatingRequest || !createRequestForm.title.trim()}
              className="px-4 py-2 text-sm rounded-md bg-sky-aqua text-white hover:bg-sky-aqua/80 transition-colors disabled:opacity-50"
            >
              {isCreatingRequest ? "생성 중..." : "생성"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 고객 연결 모달 (칸반보드와 동일) */}
      <Dialog open={isCustomerModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCustomerModalOpen(false)
          setCustomerSearch("")
          setIsCustomerCreateMode(false)
          setCustomerCreateForm({ company_name: "", contact_name: "", phone: "" })
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
          {!isCustomerCreateMode && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="회사명, 담당자명으로 검색"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-aqua/50 focus:border-sky-aqua"
                />
              </div>

              <div className="max-h-[240px] overflow-y-auto border border-gray-200 rounded-lg">
                {(() => {
                  const filtered = localCustomers.filter((c) => {
                    if (!customerSearch.trim()) return true
                    const q = customerSearch.toLowerCase()
                    return c.company_name.toLowerCase().includes(q) || (c.contact_name && c.contact_name.toLowerCase().includes(q))
                  })
                  return filtered.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6">검색 결과가 없습니다</p>
                  ) : (
                    filtered.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setCreateRequestForm((prev) => ({ ...prev, customer_id: c.id }))
                          setIsCustomerModalOpen(false)
                          setCustomerSearch("")
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0",
                          createRequestForm.customer_id === c.id && "bg-sky-aqua/5"
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
                  if (customerSearch.trim()) {
                    setCustomerCreateForm((prev) => ({ ...prev, company_name: customerSearch.trim() }))
                  }
                  setIsCustomerCreateMode(true)
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed border-sky-aqua/50 text-sky-aqua text-sm font-medium hover:border-sky-aqua hover:bg-sky-aqua/5 transition-all"
              >
                <Plus className="h-4 w-4" />
                새 고객 등록
              </button>
            </div>
          )}

          {/* 생성 모드 */}
          {isCustomerCreateMode && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  회사명 <span className="text-soft-blush">*</span>
                </Label>
                <Input
                  placeholder="예: (주)한국건설"
                  value={customerCreateForm.company_name}
                  onChange={(e) => setCustomerCreateForm((prev) => ({ ...prev, company_name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">담당자명</Label>
                <Input
                  placeholder="예: 홍길동"
                  value={customerCreateForm.contact_name}
                  onChange={(e) => setCustomerCreateForm((prev) => ({ ...prev, contact_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">연락처</Label>
                <Input
                  placeholder="예: 010-1234-5678"
                  value={customerCreateForm.phone}
                  onChange={(e) => setCustomerCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <button
                  onClick={() => {
                    setIsCustomerCreateMode(false)
                    setCustomerCreateForm({ company_name: "", contact_name: "", phone: "" })
                  }}
                  className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  뒤로
                </button>
                <button
                  onClick={async () => {
                    if (!customerCreateForm.company_name.trim()) return
                    setIsCreatingCustomer(true)
                    try {
                      const payload: Record<string, string> = { company_name: customerCreateForm.company_name.trim() }
                      if (customerCreateForm.contact_name.trim()) payload.contact_name = customerCreateForm.contact_name.trim()
                      if (customerCreateForm.phone.trim()) payload.phone = customerCreateForm.phone.trim()
                      const res = await fetch("/api/customers", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      })
                      const result = await res.json()
                      if (res.ok && result.data) {
                        setLocalCustomers((prev) => [...prev, result.data])
                        setCreateRequestForm((prev) => ({ ...prev, customer_id: result.data.id }))
                        setIsCustomerModalOpen(false)
                        setCustomerSearch("")
                        setIsCustomerCreateMode(false)
                        setCustomerCreateForm({ company_name: "", contact_name: "", phone: "" })
                      } else {
                        alert("고객 생성 실패: " + (result.error || ""))
                      }
                    } catch {
                      alert("고객 생성 중 오류가 발생했습니다")
                    }
                    setIsCreatingCustomer(false)
                  }}
                  disabled={isCreatingCustomer || !customerCreateForm.company_name.trim()}
                  className="px-4 py-2 text-sm rounded-md bg-sky-aqua text-white hover:bg-sky-aqua/80 transition-colors disabled:opacity-50"
                >
                  {isCreatingCustomer ? "등록 중..." : "등록 후 연결"}
                </button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 견적서 편집 Sheet */}
      <QuoteEditorSheet
        open={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false)
          setEditingQuotation(null)
        }}
        requestId={editingQuotation?.request_id || newRequestId}
        customerId={editingQuotation?.customer_id || newCustomerId}
        customerName={
          editingQuotation?.customer
            ? Array.isArray(editingQuotation.customer)
              ? editingQuotation.customer[0]?.company_name
              : editingQuotation.customer.company_name
            : newCustomerName || undefined
        }
        initialTitle={newInitialTitle}
        quotation={editingQuotation}
        onSaved={handleSaved}
      />
    </div>
  )
}
