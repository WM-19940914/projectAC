import { createAdminClient } from "@/lib/supabase/admin"
import { ContractKanbanBoard } from "./kanban-board"
import { Contract } from "@/types"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function ContractsPage() {
  const supabase = createAdminClient()

  const { data: contracts } = await supabase
    .from("contracts")
    .select(`
      *,
      customer:customers(id, company_name, deleted_at)
    `)
    .order("created_at", { ascending: false })

  const allItems = (contracts || []) as Contract[]
  const totalCount = allItems.length

  const { data: customers } = await supabase
    .from("customers")
    .select("id, company_name, contact_name, phone, email, address, representative, business_number, memo")
    .is("deleted_at", null)
    .order("company_name")

  return (
    <ContractKanbanBoard
      items={allItems}
      totalCount={totalCount}
      customers={(customers || [])}
    />
  )
}
