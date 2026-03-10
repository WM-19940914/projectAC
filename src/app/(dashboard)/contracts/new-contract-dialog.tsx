"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { Building2, Plus } from "lucide-react"

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

interface NewContractDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customers: CustomerOption[]
}

export default function NewContractDialog({ open, onOpenChange, customers }: NewContractDialogProps) {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    customer_id: "",
  })

  // 고객 검색 모달
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState("")

  const selectedCustomer = customers.find(c => c.id === formData.customer_id)

  const handleCustomerSelect = (customerId: string) => {
    const cust = customers.find(c => c.id === customerId)
    if (cust) {
      if (!formData.name) {
        setFormData(prev => ({
          ...prev,
          customer_id: customerId,
          name: `[${cust.company_name}] 계약`
        }))
      } else {
        setFormData(prev => ({ ...prev, customer_id: customerId }))
      }
    }
    setIsCustomerModalOpen(false)
  }

  const handleCreate = async () => {
    if (!formData.name.trim()) return alert("계약명을 입력해주세요.")

    setIsCreating(true)
    try {
      const payload = {
        title: formData.name.trim(),
        customer_id: formData.customer_id && formData.customer_id !== "" ? formData.customer_id : null,
        contract_amount: 0,
        settlement_type: null,
        start_date: null,
        end_date: null,
        memo: null,
      }

      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.error || "생성 실패")
      }

      router.refresh()
      onOpenChange(false)
      setFormData({ name: "", customer_id: "" })
    } catch (e) {
      console.error(e)
      const msg = e instanceof Error ? e.message : "알 수 없는 오류"
      alert(`저장 중 오류가 발생했습니다: ${msg}`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => {
        if (!v) setFormData({ name: "", customer_id: "" })
        onOpenChange(v)
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-sans text-lg">새 계약 생성</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              계약명과 고객을 입력한 후 생성하세요. 상세 정보는 생성 후 수정할 수 있습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 계약명 */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                계약명 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="예: [현장명] 계약"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && formData.name.trim()) handleCreate()
                }}
              />
            </div>

            {/* 고객 연동 */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">고객사 연동</Label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-300 bg-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-white text-slate-700 shadow-sm">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{selectedCustomer.company_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {selectedCustomer.contact_name || "담당자 미정"} {selectedCustomer.phone && `· ${selectedCustomer.phone}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="text-xs text-gray-500 hover:text-slate-700 px-2 py-1"
                  >
                    변경
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="w-full h-[56px] border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center gap-2 text-sm text-gray-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                >
                  <Plus className="h-4 w-4" /> 고객사 선택하기
                </button>
              )}
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <button
              onClick={() => {
                setFormData({ name: "", customer_id: "" })
                onOpenChange(false)
              }}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating || !formData.name.trim()}
              className="px-4 py-2 text-sm rounded-md bg-slate-700 text-white hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              {isCreating ? "생성 중..." : "생성"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 고객 검색 모달 */}
      <Dialog open={isCustomerModalOpen} onOpenChange={setIsCustomerModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-gray-50">
            <DialogTitle>고객사 검색</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <Input
              autoFocus
              placeholder="회사명, 담당자 이름 검색..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="mb-4"
            />
            <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1">
              {customers
                .filter(c =>
                  c.company_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                  (c.contact_name && c.contact_name.toLowerCase().includes(customerSearch.toLowerCase()))
                )
                .map(cust => (
                  <button
                    key={cust.id}
                    onClick={() => handleCustomerSelect(cust.id)}
                    className="w-full flex flex-col text-left p-3 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-400/20 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-gray-900 group-hover:text-slate-700 transition-colors">{cust.company_name}</span>
                      <span className="text-xs text-gray-400 font-sans">{cust.contact_name}</span>
                    </div>
                    {cust.phone && <span className="text-xs text-gray-500">{cust.phone}</span>}
                  </button>
                ))
              }
              {customers.length > 0 && customers.filter(c => c.company_name.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">검색 결과가 없습니다.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
