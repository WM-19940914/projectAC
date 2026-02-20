import { createAdminClient } from "@/lib/supabase/admin"
import { CustomerList } from "./customer-list"

// 캐시 비활성화 → 항상 최신 데이터 불러오기
export const dynamic = "force-dynamic"

// ----- 서버 컴포넌트: 데이터 불러오기 -----
export default async function ClientsPage() {
  const supabase = createAdminClient()

  const { data: customers } = await supabase
    .from("customers")
    .select(`
      id, company_name, contact_name,
      phone, email, business_number, representative,
      address, memo, created_at
    `)
    .order("created_at", { ascending: false })

  return <CustomerList customers={customers || []} />
}
