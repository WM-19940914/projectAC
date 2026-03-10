"use client"

// ----- 고객 정보 패널 (심플 플랫) -----

import { formatPhone } from "@/lib/format"
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
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">고객 미연결</span>
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
    )
  }

  // 삭제된 고객
  if (selectedItem.customer.deleted_at) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-red-400">삭제된 고객</span>
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
    )
  }

  // 연결된 고객 — 플랫 리스트
  return (
    <div className="space-y-2">
      {/* 회사명 + 액션 */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onOpenCustomerDetail}
          className="text-sm font-semibold text-gray-900 truncate hover:text-gray-700 transition-colors"
        >
          {selectedItem.customer.company_name}
        </button>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onOpenCustomerDetail}
            title="고객 상세"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
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

      {/* 상세 정보 — 라벨:값 */}
      <div className="space-y-1">
        {customerDetail?.contact_name && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">담당자</span>
            <span className="text-gray-700">{customerDetail.contact_name}</span>
          </div>
        )}
        {customerDetail?.phone && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">연락처</span>
            <span className="text-gray-700">{formatPhone(customerDetail.phone)}</span>
          </div>
        )}
        {customerDetail?.email && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">이메일</span>
            <span className="text-gray-700 truncate ml-4">{customerDetail.email}</span>
          </div>
        )}
        {customerDetail?.address && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 shrink-0">주소</span>
            <span className="text-gray-700 truncate ml-4">{customerDetail.address}</span>
          </div>
        )}
        {!customerDetail?.contact_name && !customerDetail?.phone && (
          <p className="text-xs text-gray-300">상세 정보 미등록</p>
        )}
      </div>
    </div>
  )
}
