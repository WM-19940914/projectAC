import { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { jsonWithUTF8 } from "@/lib/utf8-response"
import { getApiUserId } from "@/lib/api-auth"

// GET /api/work-notes — 인증된 사용자의 업무 노트 조회 (본인 노트만)
export async function GET(req: NextRequest) {
  const authUserId = await getApiUserId(req)
  if (!authUserId) {
    return jsonWithUTF8({ error: "인증이 필요합니다" }, { status: 401 })
  }

  const supabase = createAdminClient()

  // 완료 후 24시간 지난 항목 자동 삭제
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await supabase
    .from("work_notes")
    .delete()
    .eq("user_id", authUserId)
    .eq("done", true)
    .lt("done_at", cutoff)

  const { data, error } = await supabase
    .from("work_notes")
    .select("id, text, done, done_at, created_at")
    .eq("user_id", authUserId)
    .order("created_at", { ascending: false })

  if (error) {
    return jsonWithUTF8({ error: error.message }, { status: 500 })
  }

  return jsonWithUTF8({ data })
}

// POST /api/work-notes — 업무 노트 추가 (인증된 사용자 본인으로 생성)
export async function POST(req: NextRequest) {
  const authUserId = await getApiUserId(req)
  if (!authUserId) {
    return jsonWithUTF8({ error: "인증이 필요합니다" }, { status: 401 })
  }

  const body = await req.json()
  const { text } = body

  if (!text?.trim()) {
    return jsonWithUTF8({ error: "text 필요" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("work_notes")
    .insert({ user_id: authUserId, text: text.trim() })
    .select("id, text, done, done_at, created_at")
    .single()

  if (error) {
    return jsonWithUTF8({ error: error.message }, { status: 500 })
  }

  return jsonWithUTF8({ data })
}

// PATCH /api/work-notes — 업무 노트 수정 (본인 노트만 수정 가능)
export async function PATCH(req: NextRequest) {
  const authUserId = await getApiUserId(req)
  if (!authUserId) {
    return jsonWithUTF8({ error: "인증이 필요합니다" }, { status: 401 })
  }

  const body = await req.json()
  const { id, done } = body

  if (!id || typeof done !== "boolean") {
    return jsonWithUTF8({ error: "id, done 필요" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("work_notes")
    .update({
      done,
      done_at: done ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("user_id", authUserId) // 본인 노트만 수정 가능
    .select("id, text, done, done_at, created_at")
    .single()

  if (error) {
    return jsonWithUTF8({ error: error.message }, { status: 500 })
  }

  return jsonWithUTF8({ data })
}

// DELETE /api/work-notes?id=xxx — 업무 노트 삭제 (본인 노트만 삭제 가능)
export async function DELETE(req: NextRequest) {
  const authUserId = await getApiUserId(req)
  if (!authUserId) {
    return jsonWithUTF8({ error: "인증이 필요합니다" }, { status: 401 })
  }

  const id = req.nextUrl.searchParams.get("id")
  if (!id) {
    return jsonWithUTF8({ error: "id 필요" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("work_notes")
    .delete()
    .eq("id", id)
    .eq("user_id", authUserId) // 본인 노트만 삭제 가능

  if (error) {
    return jsonWithUTF8({ error: error.message }, { status: 500 })
  }

  return jsonWithUTF8({ success: true })
}
