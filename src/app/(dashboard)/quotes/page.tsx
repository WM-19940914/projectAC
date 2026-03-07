import { createAdminClient } from "@/lib/supabase/admin"
import QuotesList from "./quotes-list"

export const dynamic = "force-dynamic"

export default async function QuotesPage() {
  const supabase = createAdminClient()

  // 전체 견적서 목록 조회 (고객, 의뢰 조인)
  const { data: quotations, error } = await supabase
    .from("quotations")
    .select(`
      id, title, quotation_number, quotation_date,
      total_amount, tax_amount, grand_total, notes, site_name,
      customer:customers!quotations_customer_id_fkey(id, company_name),
      request:requests!quotations_request_id_fkey(id, title)
    `)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[QuotesPage] 견적서 조회 실패:", error.message)
  }

  // 고객 목록 (의뢰 생성 시 고객 선택용)
  const { data: customers } = await supabase
    .from("customers")
    .select("id, company_name, contact_name")
    .is("deleted_at", null)
    .order("company_name")

  return <QuotesList quotations={quotations || []} customers={customers || []} />
}
