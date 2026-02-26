import { createAdminClient } from "@/lib/supabase/admin"
import { CONTRACT_STATUSES } from "@/lib/constants"
import { ContractKanbanBoard } from "./kanban-board"
import { Contract } from "@/types"

export const dynamic = "force-dynamic"

export default async function ContractsPage() {
  const supabase = createAdminClient()

  const { data: contracts } = await supabase
    .from("contracts")
    .select(`
      *,
      customer:customers(id, company_name, deleted_at)
    `)
    .neq("status", "숨김")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  const { data: hiddenContracts } = await supabase
    .from("contracts")
    .select(`
      *,
      customer:customers(id, company_name, deleted_at)
    `)
    .eq("status", "숨김")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  const allItems = (contracts || []) as Contract[]
  const hiddenItems = (hiddenContracts || []) as Contract[]

  const columns = CONTRACT_STATUSES
    .filter((s) => s.value !== "숨김")
    .map((status) => {
      const items = allItems.filter((item) => item.status === status.value)
      return {
        status: status.value,
        items,
        count: items.length,
      }
    })

  const totalCount = allItems.length

  const { data: customers } = await supabase
    .from("customers")
    .select("id, company_name, contact_name, phone, email, address, representative, business_number, memo")
    .is("deleted_at", null)
    .order("company_name")

  return (
    <ContractKanbanBoard
      columns={columns}
      totalCount={totalCount}
      customers={(customers || []) as any[]}
      hiddenItems={hiddenItems}
    />
  )
}
