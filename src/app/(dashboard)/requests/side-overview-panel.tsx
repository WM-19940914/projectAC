"use client"

// ----- 고객 정보 패널 (컴팩트) -----

import { formatPhone } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Pencil } from "lucide-react"
import type { CustomerOption } from "./kanban-types"
import { CustomerPanel } from "./customer-panel"

interface SideOverviewPanelProps {
  selectedItem: {
    id: string
    title: string
    inquiry_date: string | null
    memo: string | null
    confirmed_quote_id: string | null
    contract_id: string | null
    customer: { id: string; company_name: string; deleted_at: string | null } | null
  }
  localCustomers: CustomerOption[]
  onCustomerLink: (id: string) => void
  onCustomerUnlink: () => void
  onCustomerCreateAndLink: (form: { company_name: string; contact_name?: string; phone?: string }) => Promise<void>
  onOpenCustomerDetail: () => void
  onUpdateField: (field: string, value: string | null) => void
}

export function SideOverviewPanel({
  selectedItem,
  localCustomers,
  onCustomerLink,
  onCustomerUnlink,
  onCustomerCreateAndLink,
  onOpenCustomerDetail,
}: SideOverviewPanelProps) {
  const customerDetail = selectedItem.customer
    ? localCustomers.find((c) => c.id === selectedItem.customer!.id)
    : null

  // 미연결 상태
  if (!selectedItem.customer) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-xs font-semibold text-slate-400">고객</p>
            <p className="text-sm font-medium text-slate-500">미연결</p>
          </div>
          <CustomerPanel
            customer={null}
            customers={localCustomers}
            onLink={onCustomerLink}
            onUnlink={onCustomerUnlink}
            onCreateAndLink={onCustomerCreateAndLink}
            onOpenDetail={onOpenCustomerDetail}
            compact
          />
        </div>
      </section>
    )
  }

  // 삭제된 고객
  if (selectedItem.customer.deleted_at) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50/70 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-xs font-semibold text-red-400">고객</p>
            <p className="text-sm font-medium text-slate-600 line-through">삭제된 고객</p>
          </div>
          <CustomerPanel
            customer={selectedItem.customer}
            customers={localCustomers}
            onLink={onCustomerLink}
            onUnlink={onCustomerUnlink}
            onCreateAndLink={onCustomerCreateAndLink}
            onOpenDetail={onOpenCustomerDetail}
            compact
          />
        </div>
      </section>
    )
  }

  // 고객 정보 인라인 항목
  const infoItems = [
    { label: "담당자", value: customerDetail?.contact_name, },
    { label: "연락처", value: customerDetail?.phone ? formatPhone(customerDetail.phone) : null, },
    { label: "이메일", value: customerDetail?.email, },
  ]

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      {/* 1행: 고객명 + 액션 버튼 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="shrink-0 text-xs font-semibold text-slate-400">고객</p>
          <button
            onClick={onOpenCustomerDetail}
            className="min-w-0 truncate text-sm font-semibold text-slate-900 transition-colors hover:text-slate-600"
          >
            {selectedItem.customer.company_name}
          </button>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onOpenCustomerDetail}
            title="고객 상세"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-700"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <CustomerPanel
            customer={selectedItem.customer}
            customers={localCustomers}
            onLink={onCustomerLink}
            onUnlink={onCustomerUnlink}
            onCreateAndLink={onCustomerCreateAndLink}
            onOpenDetail={onOpenCustomerDetail}
            compact
          />
        </div>
      </div>

      {/* 2행: 핵심 정보 인라인 */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {infoItems.map((item) => (
          item.value ? (
            <span key={item.label} className="inline-flex items-center gap-1">
              <span className="text-slate-400">{item.label}</span>
              <span className="text-slate-600">{item.value}</span>
            </span>
          ) : null
        ))}
        {/* 아무 정보도 없으면 안내 */}
        {infoItems.every((item) => !item.value) && (
          <span className="text-slate-400">상세 정보 미등록</span>
        )}
      </div>
    </section>
  )
}
