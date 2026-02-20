import { createAdminClient } from "@/lib/supabase/admin"
import QuotesList from "./quotes-list"

export const dynamic = "force-dynamic"

export default async function QuotesPage() {
  const supabase = createAdminClient()

  // 전체 견적서 목록 조회 (고객, 의뢰 조인)
  const { data: quotations } = await supabase
    .from("quotations")
    .select(`
      id, title, quotation_number, quotation_date, type,
      total_amount, tax_amount, grand_total, notes,
      customer:customers(id, company_name),
      request:requests(id, title)
    `)
    .order("created_at", { ascending: false })

  return <QuotesList quotations={quotations || []} />
}
