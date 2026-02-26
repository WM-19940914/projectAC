// 회사 도장 업로드/삭제 API
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

        // logos 버킷 재활용 (stamps 서브폴더 사용)
        const { data: buckets } = await supabase.storage.listBuckets()
        const hasBucket = buckets?.some((b) => b.name === "logos")
        if (!hasBucket) {
            await supabase.storage.createBucket("logos", { public: true })
        }

        // 기존 도장 삭제 (덮어쓰기)
        const fileName = `company-stamp.${file.name.split(".").pop()}`
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
            console.error("[/api/settings/stamp]", uploadError.message)
            return NextResponse.json({ error: "업로드 실패: " + uploadError.message }, { status: 500 })
        }

        // 공개 URL (캐시 방지용 타임스탬프)
        const { data: urlData } = supabase.storage.from("logos").getPublicUrl(fileName)
        const stampUrl = `${urlData.publicUrl}?t=${Date.now()}`

        // business_settings에 stamp_url 저장
        const { data: existing } = await supabase
            .from("business_settings")
            .select("id")
            .limit(1)
            .single()

        if (existing) {
            await supabase
                .from("business_settings")
                .update({ stamp_url: stampUrl, updated_at: new Date().toISOString() })
                .eq("id", existing.id)
        } else {
            await supabase
                .from("business_settings")
                .insert({ stamp_url: stampUrl })
        }

        return NextResponse.json({ success: true, stamp_url: stampUrl })
    } catch (e: unknown) {
        console.error("[/api/settings/stamp]", e)
        return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
    }
}

// 도장 삭제
export async function DELETE() {
    try {
        const supabase = createAdminClient()

        // storage에서 도장 파일 삭제
        const { data: files } = await supabase.storage.from("logos").list()
        if (files && files.length > 0) {
            const stampFiles = files.filter((f) => f.name.startsWith("company-stamp"))
            if (stampFiles.length > 0) {
                await supabase.storage.from("logos").remove(stampFiles.map((f) => f.name))
            }
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
                .update({ stamp_url: null, updated_at: new Date().toISOString() })
                .eq("id", existing.id)
        }

        return NextResponse.json({ success: true })
    } catch (e: unknown) {
        console.error("[/api/settings/stamp]", e)
        return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
    }
}
