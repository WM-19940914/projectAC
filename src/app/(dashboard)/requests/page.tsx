import { createAdminClient } from "@/lib/supabase/admin"
import { REQUEST_STATUSES } from "@/lib/constants"
import { RequestKanbanBoard } from "./kanban-board"

// 캐시 비활성화 → 항상 최신 데이터 불러오기
export const dynamic = "force-dynamic"

// Supabase 결과를 RequestItem 형태로 변환하는 헬퍼
function toRequestItem(
  r: Record<string, unknown>,
  settlementMap: Map<string, { contract_amount: number; total_paid: number; has_upcoming: boolean; all_confirmed: boolean; tax_invoice_all_issued: boolean; tax_invoice_some_issued: boolean }>
) {
  const contractId = (r.contract_id as string | null) ?? null
  // 정산 매핑에서 해당 계약 정보 꺼내기
  const settlement = contractId ? settlementMap.get(contractId) ?? null : null

  return {
    id: r.id as string,
    title: r.title as string,
    inquiry_date: r.inquiry_date as string | null,
    status: r.status as string,
    contract_id: contractId,
    confirmed_quote_id: (r.confirmed_quote_id as string | null) ?? null,
    memo: r.memo as string | null,
    created_at: r.created_at as string,
    customer: Array.isArray(r.customer)
      ? (r.customer[0] as { id: string; company_name: string; deleted_at: string | null } | undefined) ?? null
      : (r.customer as { id: string; company_name: string; deleted_at: string | null } | null),
    // 정산 상태 표시용 계약 정보
    contract: settlement
      ? { id: contractId!, contract_amount: settlement.contract_amount, total_paid: settlement.total_paid, has_upcoming: settlement.has_upcoming, all_confirmed: settlement.all_confirmed, tax_invoice_all_issued: settlement.tax_invoice_all_issued, tax_invoice_some_issued: settlement.tax_invoice_some_issued }
      : null,
  }
}

// settlement_status_map JSONB에서 입금 합계 + 미확인 입금 여부 계산
// confirmed 체크된 입금내역만 정산 금액에 합산
function calcSettlement(statusMap: Record<string, { payment_entries?: { amount: number; confirmed?: boolean }[]; tax_invoice_issued?: boolean }> | null): { total_paid: number; has_upcoming: boolean; all_confirmed: boolean; tax_invoice_all_issued: boolean; tax_invoice_some_issued: boolean } {
  if (!statusMap) return { total_paid: 0, has_upcoming: false, all_confirmed: false, tax_invoice_all_issued: false, tax_invoice_some_issued: false }
  let totalPaid = 0
  let hasUpcoming = false
  let hasEntries = false
  let allConfirmed = true
  let stageCount = 0
  let issuedCount = 0
  for (const stage of Object.values(statusMap)) {
    if (!stage || typeof stage !== 'object') continue
    stageCount++
    if (stage.tax_invoice_issued === true) issuedCount++
    if (stage.payment_entries && Array.isArray(stage.payment_entries)) {
      for (const entry of stage.payment_entries) {
        hasEntries = true
        const amount = Number(entry.amount) || 0
        if (entry.confirmed === true) {
          totalPaid += amount
        } else {
          allConfirmed = false
          if (amount > 0) {
            hasUpcoming = true
          }
        }
      }
    }
  }
  return {
    total_paid: totalPaid,
    has_upcoming: hasUpcoming,
    all_confirmed: hasEntries && allConfirmed,
    tax_invoice_all_issued: stageCount > 0 && issuedCount === stageCount,
    tax_invoice_some_issued: issuedCount > 0 && issuedCount < stageCount,
  }
}

// ----- 서버 컴포넌트: 데이터 불러오기 -----
export default async function RequestsPage() {
  const supabase = createAdminClient()

  // 1단계: 의뢰 + 고객 목록을 병렬 조회
  const [requestsResult, hiddenResult, customersResult] = await Promise.all([
    // 보이는 의뢰 (hidden = false)
    supabase
      .from("requests")
      .select(`
        id, title, inquiry_date, contract_id, confirmed_quote_id,
        status, memo, created_at,
        customer:customers(id, company_name, deleted_at)
      `)
      .neq("status", "숨김")
      .eq("hidden", false)
      .order("created_at", { ascending: false }),
    // 숨긴 의뢰 (hidden = true)
    supabase
      .from("requests")
      .select(`
        id, title, inquiry_date, contract_id, confirmed_quote_id,
        status, memo, created_at,
        customer:customers(id, company_name, deleted_at)
      `)
      .neq("status", "숨김")
      .eq("hidden", true)
      .order("created_at", { ascending: false }),
    // 고객 목록 (의뢰 생성 + 고객 상세 표시용, 삭제되지 않은 고객만)
    supabase
      .from("customers")
      .select("id, company_name, contact_name, phone, email, address, representative, business_number, memo")
      .is("deleted_at", null)
      .order("company_name"),
  ])

  const requests = requestsResult.data
  const hiddenRequests = hiddenResult.data
  const customers = customersResult.data

  // 모든 의뢰에서 contract_id 수집
  const allRequests = [...(requests || []), ...(hiddenRequests || [])]
  const contractIds = allRequests
    .map((r) => r.contract_id)
    .filter((id): id is string => id != null)

  // 계약 금액 + 정산 메타 데이터를 한 번에 조회
  const settlementMap = new Map<string, { contract_amount: number; total_paid: number; has_upcoming: boolean; all_confirmed: boolean; tax_invoice_all_issued: boolean; tax_invoice_some_issued: boolean }>()

  if (contractIds.length > 0) {
    // 2단계: 계약 + 정산 메타를 병렬 조회
    const [contractsResult, metasResult] = await Promise.all([
      supabase.from("contracts").select("id, contract_amount").in("id", contractIds),
      supabase.from("contract_settlement_meta").select("contract_id, settlement_status_map").in("contract_id", contractIds),
    ])

    const contracts = contractsResult.data
    const metas = metasResult.data

    // contract_id별 입금 합계 + 입금예정 여부 계산
    const paidMap = new Map<string, { total_paid: number; has_upcoming: boolean; all_confirmed: boolean; tax_invoice_all_issued: boolean; tax_invoice_some_issued: boolean }>()
    for (const meta of metas || []) {
      paidMap.set(
        meta.contract_id,
        calcSettlement(meta.settlement_status_map as Record<string, { payment_entries?: { date: string; amount: number }[] }> | null)
      )
    }

    // 최종 매핑: contract_amount + total_paid + has_upcoming
    for (const c of contracts || []) {
      const paid = paidMap.get(c.id)
      settlementMap.set(c.id, {
        contract_amount: Number(c.contract_amount) || 0,
        total_paid: paid?.total_paid || 0,
        has_upcoming: paid?.has_upcoming || false,
        all_confirmed: paid?.all_confirmed || false,
        tax_invoice_all_issued: paid?.tax_invoice_all_issued || false,
        tax_invoice_some_issued: paid?.tax_invoice_some_issued || false,
      })
    }
  }

  const allItems = (requests || []).map((r) => toRequestItem(r as Record<string, unknown>, settlementMap))
  const hiddenItems = (hiddenRequests || []).map((r) => toRequestItem(r as Record<string, unknown>, settlementMap))

  // 상태별 그룹핑
  const columns = REQUEST_STATUSES
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

  return (
    <RequestKanbanBoard
      columns={columns}
      totalCount={totalCount}
      customers={(customers || []) as { id: string; company_name: string; contact_name: string | null; phone: string | null; email: string | null; address: string | null; representative: string | null; business_number: string | null; memo: string | null }[]}
      hiddenItems={hiddenItems}
    />
  )
}
