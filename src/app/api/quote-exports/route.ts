// 견적서 내보내기 내역 API
// GET: 특정 견적서의 내보내기 내역 조회
// POST: 파일 업로드 + 내역 생성 (raw binary body + 커스텀 헤더)
// DELETE: 내역 + 파일 삭제

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logError } from "@/lib/logger"

const BUCKET = "quote-exports"

export async function GET(req: NextRequest) {
  const quotationId = req.nextUrl.searchParams.get("quotation_id")
  if (!quotationId) {
    return NextResponse.json({ error: "quotation_id 필수" }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("quote_exports")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("created_at", { ascending: false })
      .limit(20)

    // 테이블이 없으면 빈 배열 반환 (마이그레이션 전)
    if (error) {
      if (error.code === "PGRST205" || error.code === "42P01") {
        return NextResponse.json({ data: [] })
      }
      throw error
    }
    return NextResponse.json({ data: data || [] })
  } catch (e) {
    logError("quote-exports GET", e)
    return NextResponse.json({ data: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    // 커스텀 헤더에서 메타데이터 읽기
    const quotationId = req.headers.get("x-quotation-id")
    const fileType = req.headers.get("x-file-type")
    const fileName = decodeURIComponent(req.headers.get("x-file-name") || "")
    const contentType = req.headers.get("content-type") || "application/octet-stream"

    if (!quotationId || !fileType || !fileName) {
      return NextResponse.json({ error: "필수 헤더 누락 (x-quotation-id, x-file-type, x-file-name)" }, { status: 400 })
    }

    // raw body → ArrayBuffer
    const buffer = await req.arrayBuffer()
    if (!buffer || buffer.byteLength === 0) {
      return NextResponse.json({ error: "파일 데이터 없음" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 버킷 자동 생성 (없으면)
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!buckets?.find(b => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true })
    }

    // 파일 업로드
    const ext = fileType === "excel" ? "xlsx" : fileType
    const storagePath = `${quotationId}/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType,
        upsert: false,
      })

    if (uploadError) throw uploadError

    // DB 내역 저장
    const { data, error } = await supabase
      .from("quote_exports")
      .insert({
        quotation_id: quotationId,
        file_type: fileType,
        file_name: fileName,
        storage_path: storagePath,
        file_size: buffer.byteLength,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (e) {
    logError("quote-exports POST", e)
    return NextResponse.json({ error: "업로드 실패" }, { status: 500 })
  }
}

// PATCH: 확정 상태 토글
export async function PATCH(req: NextRequest) {
  try {
    const { id, confirmed } = await req.json()
    if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 })

    const supabase = createAdminClient()
    const { error } = await supabase
      .from("quote_exports")
      .update({ confirmed: !!confirmed })
      .eq("id", id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e) {
    logError("quote-exports PATCH", e)
    return NextResponse.json({ error: "업데이트 실패" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id 필수" }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    // DB에서 레코드 조회 (storage_path 가져오기)
    const { data: record } = await supabase
      .from("quote_exports")
      .select("storage_path")
      .eq("id", id)
      .single()

    // Storage 파일 삭제
    if (record?.storage_path) {
      await supabase.storage.from(BUCKET).remove([record.storage_path])
    }

    // DB 레코드 삭제
    const { error } = await supabase
      .from("quote_exports")
      .delete()
      .eq("id", id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e) {
    logError("quote-exports DELETE", e)
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 })
  }
}
