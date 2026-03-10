"use client"

// ----- 고객 상세 Sheet (고객 페이지와 동일한 편집 패널) -----

import { useState } from "react"
import { formatPhone } from "@/lib/format"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Building2, Hash, Mail, Pencil, Phone, User } from "lucide-react"
import type { CustomerOption } from "./kanban-types"
import { InlineEditField, InlineEditMemo } from "./inline-editors"

interface CustomerDetailSheetProps {
  customerId: string | null
  customers: CustomerOption[]
  onClose: () => void
  onUpdate: (id: string, field: string, value: string) => void
}

export function CustomerDetailSheet({
  customerId,
  customers,
  onClose,
  onUpdate,
}: CustomerDetailSheetProps) {
  const customer = customerId ? customers.find((c) => c.id === customerId) ?? null : null
  const [saving, setSaving] = useState(false)

  const handleFieldSave = async (field: string, value: string) => {
    if (!customer) return
    onUpdate(customer.id, field, value)
    setSaving(true)
    try {
      const res = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: customer.id, [field]: value }),
      })
      if (!res.ok) {
        alert("저장 실패")
      }
    } catch {
      alert("저장 중 오류 발생")
    }
    setSaving(false)
  }

  return (
    <Sheet open={!!customerId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[1200px] p-0 flex flex-col [&>button:first-child]:hidden">
        {customer && (
          <>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-600" />
                </button>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{customer.company_name}</p>
                  <p className="text-xs text-gray-400">고객 상세</p>
                </div>
              </div>
              {saving && <span className="text-xs text-green-600">저장 중...</span>}
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto p-6">
              <SheetHeader className="mb-6">
                <SheetTitle className="sr-only">고객 상세</SheetTitle>
                <SheetDescription className="sr-only">고객 정보를 수정하세요</SheetDescription>
              </SheetHeader>

              <div className="space-y-4 max-w-[520px]">
                {/* 회사명 */}
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 shrink-0">
                    <Building2 className="h-4 w-4" /> 회사명
                  </span>
                  <InlineEditField
                    value={customer.company_name}
                    placeholder="회사명 입력"
                    onConfirm={(v) => handleFieldSave("company_name", v)}
                    textClass="text-sm font-medium"
                  />
                </div>
                <Separator />

                {/* 담당자 */}
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 shrink-0">
                    <User className="h-4 w-4" /> 담당자
                  </span>
                  <InlineEditField
                    value={customer.contact_name || ""}
                    placeholder="담당자명"
                    onConfirm={(v) => handleFieldSave("contact_name", v)}
                    textClass="text-sm"
                  />
                </div>
                <Separator />

                {/* 연락처 */}
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 shrink-0">
                    <Phone className="h-4 w-4" /> 연락처
                  </span>
                  <InlineEditField
                    value={customer.phone ? formatPhone(customer.phone) : ""}
                    placeholder="연락처"
                    onConfirm={(v) => handleFieldSave("phone", v)}
                    textClass="text-sm"
                  />
                </div>
                <Separator />

                {/* 이메일 */}
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 shrink-0">
                    <Mail className="h-4 w-4" /> 이메일
                  </span>
                  <InlineEditField
                    value={customer.email || ""}
                    placeholder="이메일"
                    type="email"
                    onConfirm={(v) => handleFieldSave("email", v)}
                    textClass="text-sm"
                  />
                </div>
                <Separator />

                {/* 대표자 */}
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 shrink-0">
                    <Pencil className="h-4 w-4" /> 대표자
                  </span>
                  <InlineEditField
                    value={customer.representative || ""}
                    placeholder="대표자명"
                    onConfirm={(v) => handleFieldSave("representative", v)}
                    textClass="text-sm"
                  />
                </div>
                <Separator />

                {/* 사업자번호 */}
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 shrink-0">
                    <Hash className="h-4 w-4" /> 사업자번호
                  </span>
                  <InlineEditField
                    value={customer.business_number || ""}
                    placeholder="사업자번호"
                    onConfirm={(v) => handleFieldSave("business_number", v)}
                    textClass="text-sm"
                  />
                </div>
                <Separator />

                {/* 주소 */}
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 shrink-0">
                    <Building2 className="h-4 w-4" /> 주소
                  </span>
                  <InlineEditField
                    value={customer.address || ""}
                    placeholder="주소"
                    onConfirm={(v) => handleFieldSave("address", v)}
                    textClass="text-sm"
                  />
                </div>
                <Separator />

                {/* 메모 */}
                <div>
                  <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-2">
                    <Pencil className="h-4 w-4" /> 메모
                  </p>
                  <InlineEditMemo
                    value={customer.memo || ""}
                    placeholder="메모를 입력하세요"
                    onConfirm={(v) => handleFieldSave("memo", v)}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
