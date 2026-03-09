// 임시 마이그레이션 실행용 API 라우트 (실행 후 삭제 예정)
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const supabase = createAdminClient()
  const results: Record<string, string> = {}

  // ===== 기존 payment_entries에 confirmed: true 추가 =====
  try {
    const { data: metas, error: fetchErr } = await supabase
      .from("contract_settlement_meta")
      .select("contract_id, settlement_status_map")
      .not("settlement_status_map", "is", null)

    if (fetchErr) {
      results["payment_confirmed_migration"] = `조회 실패: ${fetchErr.message}`
    } else {
      let updated = 0
      let skipped = 0

      for (const meta of metas || []) {
        const map = meta.settlement_status_map as Record<string, Record<string, unknown>>
        if (!map) { skipped++; continue }

        let needsUpdate = false
        const newMap = { ...map }

        // 각 단계(선금/중도금/잔금)의 payment_entries를 순회
        for (const [stageKey, stageVal] of Object.entries(newMap)) {
          const entries = (stageVal as Record<string, unknown>).payment_entries
          if (!Array.isArray(entries)) continue

          const updatedEntries = entries.map((entry: Record<string, unknown>) => {
            // confirmed 필드가 없는 기존 데이터 → true로 설정
            if (entry.confirmed === undefined || entry.confirmed === null) {
              needsUpdate = true
              return { ...entry, confirmed: true }
            }
            return entry
          })

          newMap[stageKey] = { ...stageVal, payment_entries: updatedEntries }
        }

        if (needsUpdate) {
          const { error: updateErr } = await supabase
            .from("contract_settlement_meta")
            .update({ settlement_status_map: newMap })
            .eq("contract_id", meta.contract_id)

          if (updateErr) {
            results[`update_${meta.contract_id}`] = `실패: ${updateErr.message}`
          } else {
            updated++
          }
        } else {
          skipped++
        }
      }

      results["payment_confirmed_migration"] = `완료! 업데이트: ${updated}건, 스킵: ${skipped}건`
    }
  } catch (e) {
    results["payment_confirmed_migration"] = `에러: ${e}`
  }

  return NextResponse.json({ results })
}
