// 회사 로고 업로드 API
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

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

    // 이미지 타입 확인
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "이미지 파일만 업로드 가능합니다" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // logos 버킷이 없으면 생성
    const { data: buckets } = await supabase.storage.listBuckets()
    const hasBucket = buckets?.some((b) => b.name === "logos")
    if (!hasBucket) {
      await supabase.storage.createBucket("logos", { public: true })
    }

    // 기존 로고 삭제 (덮어쓰기)
    const fileName = `company-logo.${file.name.split(".").pop()}`
    await supabase.storage.from("logos").remove([fileName])

    // 업로드
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error("[/api/settings/logo]", uploadError.message)
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
    console.error("[/api/settings/logo]", e)
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
    console.error("[/api/settings/logo]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}
