import { createAdminClient } from "@/lib/supabase/admin"
import { REQUEST_STATUSES } from "@/lib/constants"
import { RequestKanbanBoard } from "./kanban-board"

// 캐시 비활성화 → 항상 최신 데이터 불러오기
export const dynamic = "force-dynamic"

// Supabase 결과를 RequestItem 형태로 변환하는 헬퍼
function toRequestItem(r: Record<string, unknown>) {
  return {
    id: r.id as string,
    title: r.title as string,
    inquiry_date: r.inquiry_date as string | null,
    status: r.status as string,
    contract_id: (r.contract_id as string | null) ?? null,
    confirmed_quote_id: (r.confirmed_quote_id as string | null) ?? null,
    memo: r.memo as string | null,
    created_at: r.created_at as string,
    customer: Array.isArray(r.customer)
      ? (r.customer[0] as { id: string; company_name: string; deleted_at: string | null } | undefined) ?? null
      : (r.customer as { id: string; company_name: string; deleted_at: string | null } | null),
  }
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

  const allItems = (requests || []).map(toRequestItem)
  const hiddenItems = (hiddenRequests || []).map(toRequestItem)

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
