import { createAdminClient } from "@/lib/supabase/admin"
import { REQUEST_STATUSES } from "@/lib/constants"
import { RequestKanbanBoard } from "./kanban-board"

// 캐시 비활성화 → 항상 최신 데이터 불러오기
export const dynamic = "force-dynamic"

// ----- 서버 컴포넌트: 데이터 불러오기 -----
export default async function RequestsPage() {
  const supabase = createAdminClient()

  const { data: requests } = await supabase
    .from("requests")
    .select(`
      id, title, inquiry_date,
      status, memo, created_at,
      customer:customers(id, company_name)
    `)
    .neq("status", "숨김")
    .order("created_at", { ascending: false })

  // Supabase 결과를 RequestItem 형태로 변환
  const allItems = (requests || []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    inquiry_date: r.inquiry_date as string | null,
    status: r.status as string,
    memo: r.memo as string | null,
    created_at: r.created_at as string,
    // Supabase는 단일 관계도 배열로 반환할 수 있어서 첫 번째 요소만 추출
    customer: Array.isArray(r.customer)
      ? (r.customer[0] as { id: string; company_name: string } | undefined) ?? null
      : (r.customer as { id: string; company_name: string } | null),
  }))

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

  return <RequestKanbanBoard columns={columns} totalCount={totalCount} />
}
