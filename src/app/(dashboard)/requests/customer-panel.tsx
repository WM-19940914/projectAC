"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { formatPhone } from "@/lib/format"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Box, Building2, Pencil, Plus, Search, X } from "lucide-react"
import type { CustomerOption } from "./kanban-types"

// ----- 고객 연결/표시 패널 컴포넌트 (컴팩트 + Dialog 모달) -----
export function CustomerPanel({
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
      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-2">
        <Box className="h-4 w-4" />
        고객 정보
      </p>

      {!customer && (
        <div className="rounded-xl border border-dashed border-sky-aqua/30 bg-white p-4">
          <p className="text-xs font-medium text-gray-600 mb-1">고객 연결 필요</p>
          <p className="text-[11px] text-gray-400 mb-3">의뢰에 고객을 연결해주세요.</p>
          <div className="flex justify-end">
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-aqua text-white text-xs font-semibold hover:bg-sky-aqua/80 transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
              고객 연결
            </button>
          </div>
        </div>
      )}

      {customer?.deleted_at && (
        <div className="rounded-xl border border-red-300/30 bg-red-500/5 p-4">
          <p className="text-xs font-semibold text-red-500 mb-1">삭제된 고객이 연결되어 있습니다</p>
          <p className="text-[10px] text-red-500/80 mb-3">다른 고객으로 변경하거나 연결을 해제하세요.</p>
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
        <div className="rounded-xl border border-gray-200 border-l-4 border-l-sky-aqua bg-white p-4 space-y-3">
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
              <p className="text-[11px] text-gray-400">담당자</p>
              <p className={cn("text-sm mt-0.5 truncate", customerDetail?.contact_name ? "text-gray-700" : "text-gray-300")}>
                {customerDetail?.contact_name || "미등록"}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 px-2.5 py-2">
              <p className="text-[11px] text-gray-400">연락처</p>
              <p className={cn("text-sm mt-0.5 truncate", customerDetail?.phone ? "text-gray-700" : "text-gray-300")}>
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
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400"
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
                        customer && c.id === customer.id && "bg-slate-700/5"
                      )}
                    >
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <Building2 className="h-3.5 w-3.5 text-slate-500" />
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
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed border-slate-400/50 text-slate-700 text-sm font-medium hover:border-slate-400 hover:bg-slate-50 transition-all"
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
                  회사명 <span className="text-red-500">*</span>
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
                  className="px-4 py-2 text-sm rounded-md bg-slate-700 text-white hover:bg-slate-700/80 transition-colors disabled:opacity-50"
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
