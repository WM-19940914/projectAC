import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// ── GET: 알림 건수 (미수금 + 입금예정 + 미발행 + 미지급) ──
// 헤더 벨 아이콘 뱃지용 — 가볍게 건수만 반환
export async function GET() {
  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  let total = 0

  try {
    // 미지급 지출 건수
    const { count: unpaidCount } = await supabase
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("is_paid", false)
      .gt("amount_incl_tax", 0)

    total += unpaidCount || 0

    // 계약 정산 메타에서 미수금/입금예정 건수 계산은 복잡하므로
    // 간이 방식: settlement_status_map에 unpaid/partial 상태가 있는 계약 수
    const { data: metas } = await supabase
      .from("contract_settlement_meta")
      .select("settlement_status_map, stage_scheduled_dates")

    if (metas) {
      for (const meta of metas) {
        const statusMap = (meta.settlement_status_map || {}) as Record<string, { actual_amount?: number; payment_entries?: { confirmed?: boolean; amount?: number }[] }>
        const dates = (meta.stage_scheduled_dates || {}) as Record<string, string>

        for (const [stage, info] of Object.entries(statusMap)) {
          const paid = (info.payment_entries || [])
            .filter((e) => e.confirmed)
            .reduce((s, e) => s + (e.amount || 0), 0)
          const scheduled = dates[stage]

          // 입금이 0이고 예정일이 있으면 = 미수금 or 입금예정
          if (paid === 0 && scheduled) {
            total++
          }
          // 부분입금
          if (paid > 0 && info.actual_amount && paid < info.actual_amount) {
            total++
          }
        }
      }
    }
  } catch { /* 에러 시 0 반환 */ }

  return NextResponse.json({ data: { total } })
}
