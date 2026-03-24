// 첨부파일 CRUD API
// GET: 특정 엔티티의 첨부파일 목록 조회
// POST: 파일 업로드 (Supabase Storage + DB 레코드)
// DELETE: 파일 삭제 (Storage + DB)

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logError } from "@/lib/logger"
import { revalidatePath } from "next/cache"

const BUCKET = "attachments"
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

// 버킷 확인/생성
async function ensureBucket() {
  const supabase = createAdminClient()
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: false })
  }
  return supabase
}

/* ── GET: 첨부파일 목록 ── */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const entityType = searchParams.get("entity_type")
    const entityId = searchParams.get("entity_id")

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entity_type, entity_id 필수" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("attachments")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })

    if (error) throw error
    return NextResponse.json({ data: data || [] })
  } catch (e) {
    logError("첨부파일 조회 오류:", e)
    return NextResponse.json({ error: "첨부파일 조회 실패" }, { status: 500 })
  }
}

/* ── POST: 파일 업로드 ── */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const entityType = formData.get("entity_type") as string | null
    const entityId = formData.get("entity_id") as string | null

    if (!file || !entityType || !entityId) {
      return NextResponse.json({ error: "file, entity_type, entity_id 필수" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "파일 크기는 20MB 이하만 가능합니다" }, { status: 400 })
    }

    const supabase = await ensureBucket()

    // Storage 경로: attachments/{entity_type}/{entity_id}/{timestamp}_{filename}
    const ts = Date.now()
    // Supabase Storage는 한글/특수문자 키 불가 → 영문+숫자로 변환
    const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : ""
    const storagePath = `${entityType}/${entityId}/${ts}${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type || "application/octet-stream",
      })

    if (uploadError) {
      logError("Storage 업로드 오류:", uploadError.message)
      return NextResponse.json({ error: "파일 업로드 실패" }, { status: 500 })
    }

    // DB 레코드 생성
    const { data, error: dbError } = await supabase
      .from("attachments")
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || "application/octet-stream",
        storage_path: storagePath,
      })
      .select()
      .single()

    if (dbError) {
      // DB 실패 시 Storage 파일 정리
      await supabase.storage.from(BUCKET).remove([storagePath])
      throw dbError
    }

    revalidatePath("/requests")
    return NextResponse.json({ success: true, data })
  } catch (e) {
    logError("첨부파일 업로드 오류:", e)
    return NextResponse.json({ error: "첨부파일 업로드 실패" }, { status: 500 })
  }
}

/* ── DELETE: 파일 삭제 ── */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "id 필수" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // DB에서 레코드 조회 (storage_path 필요)
    const { data: attachment, error: findError } = await supabase
      .from("attachments")
      .select("*")
      .eq("id", id)
      .single()

    if (findError || !attachment) {
      return NextResponse.json({ error: "첨부파일을 찾을 수 없습니다" }, { status: 404 })
    }

    // Storage 파일 삭제
    await supabase.storage.from(BUCKET).remove([attachment.storage_path])

    // DB 레코드 삭제
    const { error: deleteError } = await supabase
      .from("attachments")
      .delete()
      .eq("id", id)

    if (deleteError) throw deleteError

    revalidatePath("/requests")
    return NextResponse.json({ success: true })
  } catch (e) {
    logError("첨부파일 삭제 오류:", e)
    return NextResponse.json({ error: "첨부파일 삭제 실패" }, { status: 500 })
  }
}

/* ── GET: 다운로드 URL 생성 (signed URL) ── */
export async function PATCH(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) {
      return NextResponse.json({ error: "id 필수" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: attachment } = await supabase
      .from("attachments")
      .select("storage_path, file_name")
      .eq("id", id)
      .single()

    if (!attachment) {
      return NextResponse.json({ error: "첨부파일을 찾을 수 없습니다" }, { status: 404 })
    }

    // 60초 유효 signed URL
    const { data: urlData, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(attachment.storage_path, 60)

    if (error || !urlData) {
      return NextResponse.json({ error: "다운로드 URL 생성 실패" }, { status: 500 })
    }

    return NextResponse.json({ url: urlData.signedUrl, fileName: attachment.file_name })
  } catch (e) {
    logError("다운로드 URL 생성 오류:", e)
    return NextResponse.json({ error: "다운로드 URL 생성 실패" }, { status: 500 })
  }
}
