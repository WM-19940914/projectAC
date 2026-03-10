"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Search, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import SalesTabNav from "@/components/layout/sales-tab-nav"
import { Contract } from "@/types"
import { useRouter } from "next/navigation"
import ContractCard from "./contract-card"
import ContractSheet from "./contract-sheet"
import NewContractDialog from "./new-contract-dialog"

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
  items: Contract[]
  totalCount: number
  customers: CustomerOption[]
}

export function ContractKanbanBoard({
  items: initialItems,
  totalCount,
  customers,
}: Props) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [search, setSearch] = useState("")
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [saveMessage, setSaveMessage] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const [localCustomers, setLocalCustomers] = useState(customers)
  const prevCustomersRef = useRef(JSON.stringify(customers))
  useEffect(() => {
    const nextCustomers = JSON.stringify(customers)
    if (prevCustomersRef.current !== nextCustomers) {
      prevCustomersRef.current = nextCustomers
      setLocalCustomers(customers)
    }
  }, [customers])

  const prevItemsRef = useRef(JSON.stringify(initialItems.map((item) => `${item.id}:${item.updated_at}`)))
  useEffect(() => {
    const nextItems = JSON.stringify(initialItems.map((item) => `${item.id}:${item.updated_at}`))
    if (prevItemsRef.current !== nextItems) {
      prevItemsRef.current = nextItems
      setItems(initialItems)
    }
  }, [initialItems])

  const updateContractField = useCallback(async (field: string, value: string | number | boolean | string[] | null) => {
    if (!selectedContract) return

    setSaveMessage("저장 중...")

    const updatedContract: Contract = { ...selectedContract, [field]: value }

    if (field === "customer_id") {
      if (value && typeof value === "string") {
        const linkedCustomer = localCustomers.find((customer) => customer.id === value)
        updatedContract.customer = linkedCustomer
          ? {
              id: linkedCustomer.id,
              company_name: linkedCustomer.company_name,
              customer_type: "",
              created_at: "",
              updated_at: "",
              deleted_at: undefined,
            }
          : undefined
      } else {
        updatedContract.customer = undefined
      }
    }

    setSelectedContract((prev) => (prev ? updatedContract : null))
    setItems((prev) => prev.map((item) => (item.id === selectedContract.id ? updatedContract : item)))

    let apiField = field
    if (field === "name") apiField = "title"
    if (field === "amount") apiField = "contract_amount"

    try {
      const res = await fetch("/api/contracts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedContract.id, [apiField]: value }),
      })

      if (!res.ok) {
        setSaveMessage("저장 실패")
        setTimeout(() => setSaveMessage(""), 2000)
        return
      }

      setSaveMessage("자동 저장됨")
      setTimeout(() => setSaveMessage(""), 1500)
      router.refresh()
    } catch {
      setSaveMessage("저장 실패")
      setTimeout(() => setSaveMessage(""), 2000)
    }
  }, [selectedContract, localCustomers, router])

  const handleDelete = async () => {
    const target = selectedContract
    if (!target) return
    if (!confirm("이 계약을 정말 삭제하시겠습니까?")) return

    try {
      await fetch(`/api/contracts?id=${target.id}`, { method: "DELETE" })
      setSelectedContract(null)
      router.refresh()
    } catch (error) {
      console.error(error)
      alert("삭제 중 오류가 발생했습니다.")
    }
  }

  const filteredItems = items.filter((item) => {
    if (!search) return true
    const keyword = search.toLowerCase()
    const title = item.title || ""
    const customerName = item.customer?.company_name || ""
    return title.toLowerCase().includes(keyword) || customerName.toLowerCase().includes(keyword)
  })

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] bg-gray-50 overflow-hidden">
      <SalesTabNav />

      <div className="flex flex-col gap-4 p-6 pb-4 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-sans">계약 목록</h1>
            <p className="text-sm text-gray-500 mt-1">
              총 <span className="font-semibold text-gray-900">{totalCount}</span>개의 계약이 등록되어 있습니다
            </p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors shadow-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            새 계약 생성
          </button>
        </div>

        <div className="relative w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="계약명, 고객명 등 검색..."
            className="pl-9 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {filteredItems.length === 0 ? (
          <div className="h-full flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-sm text-gray-500">
            표시할 계약이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map((item) => (
              <ContractCard
                key={item.id}
                contract={item}
                cardBarClass="border-l-gray-300"
                onClick={() => setSelectedContract(item)}
              />
            ))}
          </div>
        )}
      </div>

      <ContractSheet
        contract={selectedContract}
        customers={localCustomers}
        onFieldUpdate={updateContractField}
        onClose={() => setSelectedContract(null)}
        onDelete={handleDelete}
        saveMessage={saveMessage}
      />

      <NewContractDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        customers={localCustomers}
      />
    </div>
  )
}
