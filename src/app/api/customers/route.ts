import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdminOrSales } from "@/lib/api-auth"
import { logError } from "@/lib/logger"
import { jsonWithUTF8, sanitizeDBResponse } from "@/lib/utf8-response"
import { revalidatePath } from "next/cache"
import { NextRequest } from "next/server"

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
      return jsonWithUTF8({ error: "회사명은 필수입니다" }, { status: 400 })
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
      logError("[POST /api/customers]", error.message)
      return jsonWithUTF8({ error: "고객 등록에 실패했습니다" }, { status: 500 })
    }

    revalidatePath("/clients")
    revalidatePath("/requests")
    // UTF-8로 정제된 응답 반환
    return jsonWithUTF8({ data: sanitizeDBResponse(data) })
  } catch (e: unknown) {
    logError("[POST /api/customers]", e)
    return jsonWithUTF8({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}

// 고객 수정 API
export async function PATCH(req: NextRequest) {
  try {
    const { id, ...fields } = await req.json()

    if (!id) {
      return jsonWithUTF8({ error: "id가 필요합니다" }, { status: 400 })
    }

    // 허용 필드만 추출
    const updateData: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in fields) {
        updateData[key] = fields[key]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return jsonWithUTF8({ error: "수정할 필드가 없습니다" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from("customers").update(updateData).eq("id", id)

    if (error) {
      logError("[PATCH /api/customers]", error.message)
      return jsonWithUTF8({ error: "고객 수정에 실패했습니다" }, { status: 500 })
    }

    // 캐시 갱신
    revalidatePath("/clients")
    revalidatePath("/requests")
    revalidatePath("/quotes")
    return jsonWithUTF8({ success: true })
  } catch (e: unknown) {
    logError("[PATCH /api/customers]", e)
    return jsonWithUTF8({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}

// 고객 삭제 API (소프트 삭제)
export async function DELETE(req: NextRequest) {
  try {
    // 역할 검증: admin 또는 sales만 삭제 가능
    const denied = await requireAdminOrSales(req)
    if (denied) return denied

    const { id } = await req.json()

    if (!id) {
      return jsonWithUTF8({ error: "id가 필요합니다" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from("customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)

    if (error) {
      logError("[DELETE /api/customers]", error.message)
      return jsonWithUTF8({ error: "고객 삭제에 실패했습니다" }, { status: 500 })
    }

    revalidatePath("/clients")
    revalidatePath("/requests")
    return jsonWithUTF8({ success: true })
  } catch (e: unknown) {
    logError("[DELETE /api/customers]", e)
    return jsonWithUTF8({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}
