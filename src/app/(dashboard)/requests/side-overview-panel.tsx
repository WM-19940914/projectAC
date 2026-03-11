"use client"

// ----- 고객 정보 패널 (심플 플랫) -----

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
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">고객 정보</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">고객을 연결해주세요</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              영업 진행 전 고객사를 먼저 연결하면 견적, 계약, 정산 정보가 한 흐름으로 묶입니다.
            </p>
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
      <section className="rounded-2xl border border-red-200 bg-red-50/70 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-red-400">고객 정보</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">삭제된 고객이 연결되어 있습니다</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              다른 고객으로 교체하거나 연결을 해제해야 현재 현장 정보가 정확하게 유지됩니다.
            </p>
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

  const infoItems = [
    {
      label: "담당자",
      value: customerDetail?.contact_name || "미등록",
      muted: !customerDetail?.contact_name,
    },
    {
      label: "연락처",
      value: customerDetail?.phone ? formatPhone(customerDetail.phone) : "미등록",
      muted: !customerDetail?.phone,
    },
    {
      label: "이메일",
      value: customerDetail?.email || "미등록",
      muted: !customerDetail?.email,
    },
    {
      label: "주소",
      value: customerDetail?.address || "미등록",
      muted: !customerDetail?.address,
    },
  ]

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">고객 정보</p>
          <button
            onClick={onOpenCustomerDetail}
            className="mt-2 block min-w-0 text-left text-lg font-semibold text-slate-900 transition-colors hover:text-slate-700"
          >
            <span className="block truncate">{selectedItem.customer.company_name}</span>
          </button>
          <p className="mt-1 text-sm text-slate-500">
            현장과 연결된 고객 기본 정보를 빠르게 확인하고 수정할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onOpenCustomerDetail}
            title="고객 상세"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-700"
          >
            <Pencil className="h-4 w-4" />
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {infoItems.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
            <p className={cn("mt-2 text-sm leading-6", item.muted ? "text-slate-400" : "text-slate-700")}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
