import { createAdminClient } from "@/lib/supabase/admin"
import { REQUEST_STATUSES } from "@/lib/constants"
import { RequestKanbanBoard } from "./kanban-board"

// 캐시 비활성화 → 항상 최신 데이터 불러오기
export const dynamic = "force-dynamic"

// Supabase 결과를 RequestItem 형태로 변환하는 헬퍼
function toRequestItem(
  r: Record<string, unknown>,
  // contract_id → { contract_amount, total_paid, has_upcoming } 매핑
  settlementMap: Map<string, { contract_amount: number; total_paid: number; has_upcoming: boolean }>
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
      ? { id: contractId!, contract_amount: settlement.contract_amount, total_paid: settlement.total_paid, has_upcoming: settlement.has_upcoming }
      : null,
  }
}

// settlement_status_map JSONB에서 입금 합계 + 미확인 입금 여부 계산
// confirmed 체크된 입금내역만 정산 금액에 합산
function calcSettlement(statusMap: Record<string, { payment_entries?: { amount: number; confirmed?: boolean }[] }> | null): { total_paid: number; has_upcoming: boolean } {
  if (!statusMap) return { total_paid: 0, has_upcoming: false }
  let totalPaid = 0
  let hasUpcoming = false
  for (const stage of Object.values(statusMap)) {
    if (stage.payment_entries && Array.isArray(stage.payment_entries)) {
      for (const entry of stage.payment_entries) {
        const amount = Number(entry.amount) || 0
        if (entry.confirmed === true) {
          // 입금 확인된 것만 합산
          totalPaid += amount
        } else if (amount > 0) {
          // 미확인 입금내역이 있으면 "입금예정"
          hasUpcoming = true
        }
      }
    }
  }
  return { total_paid: totalPaid, has_upcoming: hasUpcoming }
}

// ----- 서버 컴포넌트: 데이터 불러오기 -----
export default async function RequestsPage() {
  const supabase = createAdminClient()

  // 보이는 의뢰 (hidden = false)
  const { data: requests } = await supabase
    .from("requests")
    .select(`
      id, title, inquiry_date, contract_id, confirmed_quote_id,
      status, memo, created_at,
      customer:customers(id, company_name, deleted_at)
    `)
    .neq("status", "숨김")
    .eq("hidden", false)
    .order("created_at", { ascending: false })

  // 숨긴 의뢰 (hidden = true)
  const { data: hiddenRequests } = await supabase
    .from("requests")
    .select(`
      id, title, inquiry_date, contract_id, confirmed_quote_id,
      status, memo, created_at,
      customer:customers(id, company_name, deleted_at)
    `)
    .neq("status", "숨김")
    .eq("hidden", true)
    .order("created_at", { ascending: false })

  // 모든 의뢰에서 contract_id 수집
  const allRequests = [...(requests || []), ...(hiddenRequests || [])]
  const contractIds = allRequests
    .map((r) => r.contract_id)
    .filter((id): id is string => id != null)

  // 계약 금액 + 정산 메타 데이터를 한 번에 조회
  const settlementMap = new Map<string, { contract_amount: number; total_paid: number; has_upcoming: boolean }>()

  if (contractIds.length > 0) {
    // 계약 금액 조회
    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, contract_amount")
      .in("id", contractIds)

    // 정산 메타 조회 (입금내역이 들어있는 settlement_status_map)
    const { data: metas } = await supabase
      .from("contract_settlement_meta")
      .select("contract_id, settlement_status_map")
      .in("contract_id", contractIds)

    // contract_id별 입금 합계 + 입금예정 여부 계산
    const paidMap = new Map<string, { total_paid: number; has_upcoming: boolean }>()
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

  // 고객 목록 조회 (의뢰 생성 + 고객 상세 표시용, 삭제되지 않은 고객만)
  const { data: customers } = await supabase
    .from("customers")
    .select("id, company_name, contact_name, phone, email, address, representative, business_number, memo")
    .is("deleted_at", null)
    .order("company_name")

  return (
    <RequestKanbanBoard
      columns={columns}
      totalCount={totalCount}
      customers={(customers || []) as { id: string; company_name: string; contact_name: string | null; phone: string | null; email: string | null; address: string | null; representative: string | null; business_number: string | null; memo: string | null }[]}
      hiddenItems={hiddenItems}
    />
  )
}
