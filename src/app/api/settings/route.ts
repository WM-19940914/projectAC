import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

// 우리 회사 기본 정보 조회
export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("business_settings")
      .select("*")
      .limit(1)
      .single()

    if (error) {
      console.error("[/api/settings]", error.message)
      return NextResponse.json({ error: "설정 조회 실패" }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (e: unknown) {
    console.error("[/api/settings]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}

// 우리 회사 기본 정보 수정
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = createAdminClient()

    const allowedFields = [
      "company_name", "biz_number", "ceo_name",
      "email", "address", "manager", "manager_phone", "manager_email",
      "logo_url", "stamp_url",
    ]

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    for (const key of allowedFields) {
      if (key in body) {
        updateData[key] = body[key] ?? ""
      }
    }

    // 싱글톤: 첫 번째 행 업데이트
    const { data: existing } = await supabase
      .from("business_settings")
      .select("id")
      .limit(1)
      .single()

    if (!existing) {
      // 행이 없으면 생성
      const { error } = await supabase
        .from("business_settings")
        .insert(updateData)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
      const { error } = await supabase
        .from("business_settings")
        .update(updateData)
        .eq("id", existing.id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error("[/api/settings]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}
