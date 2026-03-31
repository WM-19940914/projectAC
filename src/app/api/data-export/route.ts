import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// ── GET: 고객 + 계약 데이터를 JSON으로 내보내기 ──
export async function GET() {
  const supabase = createAdminClient()

  // 고객 조회 (삭제되지 않은 것만)
  const { data: customers, error: cErr } = await supabase
    .from("customers")
    .select("id, company_name, contact_name, phone, email, business_number, representative, address, memo")
    .is("deleted_at", null)
    .order("company_name")

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

  // 계약 조회 (삭제되지 않은 것만, 고객명 포함)
  const { data: contracts, error: ctErr } = await supabase
    .from("contracts")
    .select(`
      id, title, contract_number, customer_id,
      contract_amount, settlement_type,
      start_date, end_date, category, memo,
      request_id
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (ctErr) return NextResponse.json({ error: ctErr.message }, { status: 500 })

  // 고객 ID → 이름 매핑 (계약에 고객명 넣기 위해)
  const customerMap = new Map<string, string>()
  for (const c of customers || []) {
    customerMap.set(c.id, c.company_name)
  }

  // 계약에 고객명 추가
  const contractsWithCustomer = (contracts || []).map((ct) => ({
    ...ct,
    customer_name: ct.customer_id ? customerMap.get(ct.customer_id) || "" : "",
  }))

  return NextResponse.json({
    data: {
      customers: customers || [],
      contracts: contractsWithCustomer,
    },
  })
}
