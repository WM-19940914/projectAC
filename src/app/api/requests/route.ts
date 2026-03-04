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
      console.error("[POST /api/requests]", error.message)
      return NextResponse.json({ error: "의뢰 생성에 실패했습니다" }, { status: 500 })
    }

    // 페이지 캐시 강제 갱신
    revalidatePath("/requests")

    return NextResponse.json({ success: true, data })
  } catch (e: unknown) {
    console.error("[POST /api/requests]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}

// 의뢰 수정 API (hidden 토글 + 필드 업데이트)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...fields } = body

    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 })
    }

    // 허용 필드만 추출
    const allowedFields = ["hidden", "title", "customer_id", "contract_id", "confirmed_quote_id", "inquiry_date", "memo", "status"]
    const updateData: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (key in fields) {
        updateData[key] = fields[key]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "수정할 필드가 없습니다" }, { status: 400 })
    }

    // hidden 필드는 boolean 변환
    if ("hidden" in updateData) {
      updateData.hidden = !!updateData.hidden
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from("requests")
      .update(updateData)
      .eq("id", id)

    if (error) {
      console.error("[PATCH /api/requests]", error.message)
      return NextResponse.json({ error: "의뢰 수정에 실패했습니다" }, { status: 500 })
    }

    revalidatePath("/requests")
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error("[PATCH /api/requests]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
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
      console.error("[DELETE /api/requests]", error.message)
      return NextResponse.json({ error: "의뢰 삭제에 실패했습니다" }, { status: 500 })
    }

    // 페이지 캐시 강제 갱신 → F5 새로고침해도 최신 데이터 표시
    revalidatePath("/requests")

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error("[DELETE /api/requests]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}
