import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import { createAdminClient } from "@/lib/supabase/admin"

// 로컬 기본 템플릿 (최초 업로드 전 폴백용)
const LOCAL_FALLBACK = path.join(process.cwd(), "public", "templates", "quote-template.xlsx")

// Supabase Storage 설정
const BUCKET = "templates"
const FILE_NAME = "quote-template.xlsx"

// Supabase Storage에서 템플릿 가져오기 (없으면 로컬 폴백)
async function loadTemplateBuffer(): Promise<Buffer> {
  const supabase = createAdminClient()

  // 버킷 확인/생성
  const { data: buckets } = await supabase.storage.listBuckets()
  const hasBucket = buckets?.some((b) => b.name === BUCKET)
  if (!hasBucket) {
    await supabase.storage.createBucket(BUCKET, { public: true })
  }

  // Storage에서 다운로드 시도
  const { data, error } = await supabase.storage.from(BUCKET).download(FILE_NAME)
  if (!error && data) {
    const arrayBuffer = await data.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  // Storage에 없으면 로컬 파일 사용 + Storage에 초기 업로드
  const localBuf = await readFile(LOCAL_FALLBACK)
  await supabase.storage.from(BUCKET).upload(FILE_NAME, localBuf, {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: true,
  })
  return localBuf
}

/* ── GET: 템플릿 다운로드 (원본 그대로) ── */
export async function GET() {
  try {
    const buf = await loadTemplateBuffer()
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="quote-template.xlsx"',
      },
    })
  } catch (e) {
    console.error("템플릿 다운로드 오류:", e)
    return NextResponse.json({ error: "템플릿 파일을 찾을 수 없습니다" }, { status: 404 })
  }
}

/* ── POST: 새 템플릿 업로드 (Supabase Storage에 저장) ── */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 })
    }
    if (!file.name.endsWith(".xlsx")) {
      return NextResponse.json({ error: ".xlsx 파일만 업로드 가능합니다" }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "파일 크기는 5MB 이하만 가능합니다" }, { status: 400 })
    }

    // Supabase Storage에 업로드 (기존 파일 삭제 → 새로 업로드)
    const arrayBuffer = await file.arrayBuffer()
    const buf = Buffer.from(arrayBuffer)
    const supabase = createAdminClient()

    // 버킷 확인/생성
    const { data: buckets } = await supabase.storage.listBuckets()
    const hasBucket = buckets?.some((b) => b.name === BUCKET)
    if (!hasBucket) {
      await supabase.storage.createBucket(BUCKET, { public: true })
    }

    // 기존 파일 삭제 후 새로 업로드
    await supabase.storage.from(BUCKET).remove([FILE_NAME])
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(FILE_NAME, buf, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })

    if (uploadError) {
      console.error("Storage 업로드 오류:", uploadError.message)
      return NextResponse.json({ error: "업로드 실패: " + uploadError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "템플릿이 업데이트되었습니다" })
  } catch (e) {
    console.error("템플릿 업로드 오류:", e)
    return NextResponse.json({ error: "템플릿 업로드에 실패했습니다" }, { status: 500 })
  }
}
