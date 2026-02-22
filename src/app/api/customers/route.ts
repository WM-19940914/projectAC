import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

// 허용 필드 화이트리스트
const ALLOWED_FIELDS = [
  "company_name", "contact_name", "phone", "email", "customer_type",
  "business_number", "representative", "address", "sub_business_number",
  "business_item", "business_type", "tax_email", "latitude", "longitude", "memo",
]

// 고객 추가 API
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.company_name?.trim()) {
      return NextResponse.json({ error: "회사명은 필수입니다" }, { status: 400 })
    }

    // 허용 필드만 추출
    const insertData: Record<string, unknown> = { customer_type: "법인" }
    for (const key of ALLOWED_FIELDS) {
      if (key in body) {
        insertData[key] = body[key]
      }
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("customers")
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error("[POST /api/customers]", error.message)
      return NextResponse.json({ error: "고객 등록에 실패했습니다" }, { status: 500 })
    }

    revalidatePath("/clients")
    revalidatePath("/requests")
    return NextResponse.json({ data })
  } catch (e: unknown) {
    console.error("[POST /api/customers]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}

// 고객 수정 API
export async function PATCH(req: NextRequest) {
  try {
    const { id, ...fields } = await req.json()

    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 })
    }

    // 허용 필드만 추출
    const updateData: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in fields) {
        updateData[key] = fields[key]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "수정할 필드가 없습니다" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from("customers").update(updateData).eq("id", id)

    if (error) {
      console.error("[PATCH /api/customers]", error.message)
      return NextResponse.json({ error: "고객 수정에 실패했습니다" }, { status: 500 })
    }

    // 캐시 갱신 (고객 데이터를 참조하는 모든 페이지)
    // 클라이언트는 낙관적 업데이트로 즉시 반영하므로 응답 속도에 영향 없음
    revalidatePath("/clients")
    revalidatePath("/requests")
    revalidatePath("/quotes")
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error("[PATCH /api/customers]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}

// 고객 삭제 API (소프트 삭제: deleted_at 설정)
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()

    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from("customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)

    if (error) {
      console.error("[DELETE /api/customers]", error.message)
      return NextResponse.json({ error: "고객 삭제에 실패했습니다" }, { status: 500 })
    }

    revalidatePath("/clients")
    revalidatePath("/requests")
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error("[DELETE /api/customers]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}
