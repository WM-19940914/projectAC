import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

// 의뢰 생성 API (admin 권한으로 RLS 우회)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, customer_id, inquiry_date, memo } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "제목은 필수입니다" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("requests")
      .insert({
        title: title.trim(),
        status: "견적 문의",            // 새 의뢰는 항상 "견적 문의"로 시작
        customer_id: customer_id || null,
        inquiry_date: inquiry_date || null,
        memo: memo || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 페이지 캐시 강제 갱신
    revalidatePath("/requests")

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// 의뢰 숨김/복원 API (hidden 토글)
export async function PATCH(req: NextRequest) {
  try {
    const { id, hidden } = await req.json()

    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from("requests")
      .update({ hidden: !!hidden })
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidatePath("/requests")
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// 의뢰 삭제 API (admin 권한으로 RLS 우회)
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()

    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from("requests").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 페이지 캐시 강제 갱신 → F5 새로고침해도 최신 데이터 표시
    revalidatePath("/requests")

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
