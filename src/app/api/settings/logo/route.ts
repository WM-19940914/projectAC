// 회사 로고 업로드 API
import { createAdminClient } from "@/lib/supabase/admin"
import { logError } from "@/lib/logger"
import { NextRequest, NextResponse } from "next/server"

// 이미지 매직넘버 검증 — file.type은 클라이언트가 위조 가능하므로 바이트 헤더로 확인
function isValidImageMagic(buffer: Buffer): boolean {
  if (buffer.length < 4) return false
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true
  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return true
  return false
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 })
    }

    // 파일 크기 제한 (2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "파일 크기는 2MB 이하여야 합니다" }, { status: 400 })
    }

    // 이미지 타입 확인 (MIME 헤더 기본 검증)
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "이미지 파일만 업로드 가능합니다" }, { status: 400 })
    }

    // 매직넘버 검증 — 실제 파일 바이트 헤더 확인
    const buffer = Buffer.from(await file.arrayBuffer())
    if (!isValidImageMagic(buffer)) {
      return NextResponse.json({ error: "유효하지 않은 이미지 파일입니다" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // logos 버킷이 없으면 생성
    const { data: buckets } = await supabase.storage.listBuckets()
    const hasBucket = buckets?.some((b) => b.name === "logos")
    if (!hasBucket) {
      await supabase.storage.createBucket("logos", { public: true })
    }

    // 기존 로고 삭제 (덮어쓰기) — 확장자는 매직넘버 기반으로 결정
    const ext = buffer[0] === 0x89 ? "png" : buffer[0] === 0xFF ? "jpg" : buffer[0] === 0x47 ? "gif" : "webp"
    const fileName = `company-logo.${ext}`
    await supabase.storage.from("logos").remove([fileName])

    // 업로드
    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      logError("[/api/settings/logo]", uploadError.message)
      return NextResponse.json({ error: "업로드 실패: " + uploadError.message }, { status: 500 })
    }

    // 공개 URL 가져오기 (캐시 방지용 타임스탬프 추가)
    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(fileName)
    const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`

    // business_settings에 logo_url 저장
    const { data: existing } = await supabase
      .from("business_settings")
      .select("id")
      .limit(1)
      .single()

    if (existing) {
      await supabase
        .from("business_settings")
        .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
    } else {
      await supabase
        .from("business_settings")
        .insert({ logo_url: logoUrl })
    }

    return NextResponse.json({ success: true, logo_url: logoUrl })
  } catch (e: unknown) {
    logError("[/api/settings/logo]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}

// 로고 삭제
export async function DELETE() {
  try {
    const supabase = createAdminClient()

    // storage에서 삭제
    const { data: files } = await supabase.storage.from("logos").list()
    if (files && files.length > 0) {
      const paths = files.map((f) => f.name)
      await supabase.storage.from("logos").remove(paths)
    }

    // DB에서 URL 제거
    const { data: existing } = await supabase
      .from("business_settings")
      .select("id")
      .limit(1)
      .single()

    if (existing) {
      await supabase
        .from("business_settings")
        .update({ logo_url: null, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    logError("[/api/settings/logo]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}
