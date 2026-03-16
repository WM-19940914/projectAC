import { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { jsonWithUTF8 } from "@/lib/utf8-response"

// GET /api/work-notes?user_id=xxx — 사용자별 업무 노트 조회
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("user_id")
  if (!userId) {
    return jsonWithUTF8({ error: "user_id 필요" }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 완료 후 24시간 지난 항목 자동 삭제
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await supabase
    .from("work_notes")
    .delete()
    .eq("user_id", userId)
    .eq("done", true)
    .lt("done_at", cutoff)

  const { data, error } = await supabase
    .from("work_notes")
    .select("id, text, done, done_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    return jsonWithUTF8({ error: error.message }, { status: 500 })
  }

  return jsonWithUTF8({ data })
}

// POST /api/work-notes — 업무 노트 추가
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { user_id, text } = body

  if (!user_id || !text?.trim()) {
    return jsonWithUTF8({ error: "user_id, text 필요" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("work_notes")
    .insert({ user_id, text: text.trim() })
    .select("id, text, done, done_at, created_at")
    .single()

  if (error) {
    return jsonWithUTF8({ error: error.message }, { status: 500 })
  }

  return jsonWithUTF8({ data })
}

// PATCH /api/work-notes — 업무 노트 수정 (완료 토글)
export async function PATCH(req: NextRequest) {
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
    .select("id, text, done, done_at, created_at")
    .single()

  if (error) {
    return jsonWithUTF8({ error: error.message }, { status: 500 })
  }

  return jsonWithUTF8({ data })
}

// DELETE /api/work-notes?id=xxx — 업무 노트 삭제
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) {
    return jsonWithUTF8({ error: "id 필요" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("work_notes")
    .delete()
    .eq("id", id)

  if (error) {
    return jsonWithUTF8({ error: error.message }, { status: 500 })
  }

  return jsonWithUTF8({ success: true })
}
