import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// 의뢰 목록 조회 (견적서 생성 시 의뢰 선택용)
export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("requests")
      .select("id, title, status, customer:customers(id, company_name)")
      .eq("hidden", false)
      .in("status", ["견적 문의", "영업중"])
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[GET /api/requests/list]", error.message)
      return NextResponse.json({ error: "의뢰 목록 조회 실패" }, { status: 500 })
    }

    // 조인 결과 정리 (배열→단건)
    const cleaned = (data || []).map((r) => ({
      id: r.id,
      title: r.title,
      customer: Array.isArray(r.customer) ? r.customer[0] ?? null : r.customer,
    }))

    return NextResponse.json({ data: cleaned })
  } catch (e: unknown) {
    console.error("[GET /api/requests/list]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}
