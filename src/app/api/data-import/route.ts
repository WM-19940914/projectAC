import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

// ── POST: 엑셀에서 파싱된 고객 + 계약 데이터 업서트 ──
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { customers, contracts } = body as {
    customers: Record<string, unknown>[]
    contracts: Record<string, unknown>[]
  }

  const supabase = createAdminClient()
  const results = { customersCreated: 0, customersUpdated: 0, contractsCreated: 0, contractsUpdated: 0, errors: [] as string[] }

  // ── 고객 처리 ──
  for (const row of customers || []) {
    const id = row.id as string | undefined
    const payload: Record<string, unknown> = {
      company_name: row.company_name || "",
      contact_name: row.contact_name || null,
      phone: row.phone || null,
      email: row.email || null,
      business_number: row.business_number || null,
      representative: row.representative || null,
      address: row.address || null,
      memo: row.memo || null,
      updated_at: new Date().toISOString(),
    }

    // 빈 회사명은 건너뜀
    if (!payload.company_name) continue

    try {
      if (id && id.length > 10) {
        // id가 있으면 수정
        const { error } = await supabase.from("customers").update(payload).eq("id", id)
        if (error) throw error
        results.customersUpdated++
      } else {
        // id가 없으면 신규 생성
        const { error } = await supabase.from("customers").insert(payload)
        if (error) throw error
        results.customersCreated++
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      results.errors.push(`고객 [${payload.company_name}]: ${msg}`)
    }
  }

  // ── 고객명 → ID 매핑 (계약에서 고객 연결용) ──
  const { data: allCustomers } = await supabase
    .from("customers")
    .select("id, company_name")
    .is("deleted_at", null)

  const nameToId = new Map<string, string>()
  for (const c of allCustomers || []) {
    nameToId.set(c.company_name.trim(), c.id)
  }

  // ── 계약 처리 ──
  for (const row of contracts || []) {
    const id = row.id as string | undefined
    // 고객명으로 customer_id 찾기
    let customerId = row.customer_id as string | null
    if (!customerId && row.customer_name) {
      customerId = nameToId.get(String(row.customer_name).trim()) || null
    }

    const payload: Record<string, unknown> = {
      title: row.title || "",
      contract_number: row.contract_number || null,
      customer_id: customerId || null,
      contract_amount: Number(row.contract_amount) || 0,
      settlement_type: row.settlement_type || null,
      start_date: row.start_date || null,
      end_date: row.end_date || null,
      category: row.category || null,
      memo: row.memo || null,
      updated_at: new Date().toISOString(),
    }

    // 빈 제목은 건너뜀
    if (!payload.title) continue

    try {
      if (id && id.length > 10) {
        const { error } = await supabase.from("contracts").update(payload).eq("id", id)
        if (error) throw error
        results.contractsUpdated++
      } else {
        // 신규 계약 — request_id 연결 (있으면)
        if (row.request_id) payload.request_id = row.request_id
        const { error } = await supabase.from("contracts").insert(payload)
        if (error) throw error
        results.contractsCreated++
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      results.errors.push(`계약 [${payload.title}]: ${msg}`)
    }
  }

  revalidatePath("/requests")
  revalidatePath("/clients")
  revalidatePath("/contracts")
  return NextResponse.json({ data: results })
}
