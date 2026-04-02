// 엑셀 템플릿에서 로고/도장 이미지를 추출 → logos 버킷에 저장 → business_settings 업데이트
import { createAdminClient } from "@/lib/supabase/admin"
import { logError } from "@/lib/logger"
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const supabase = createAdminClient()

    // ── 1) 엑셀 템플릿 다운로드 ──
    const { data: templateData, error: dlError } = await supabase.storage
      .from("templates")
      .download("quote-template.xlsx")

    if (dlError || !templateData) {
      return NextResponse.json({ error: "템플릿 파일을 찾을 수 없습니다" }, { status: 404 })
    }

    // ── 2) exceljs로 이미지 추출 ──
    const ExcelJS = await import("exceljs")
    const wb = new ExcelJS.Workbook()
    const buf = await templateData.arrayBuffer()
    await wb.xlsx.load(buf)

    // 워크북에 등록된 모든 이미지 가져오기
    // exceljs의 model.media에 이미지가 저장됨
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const media = (wb as any).model?.media
    if (!media || media.length === 0) {
      return NextResponse.json({ error: "템플릿에 이미지가 없습니다" }, { status: 404 })
    }

    // 워크시트에서 이미지 위치 정보 가져오기 (로고 vs 도장 구분용)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imagePositions: { imageId: number; col: number; row: number }[] = []
    wb.eachSheet((ws) => {
      const images = ws.getImages()
      for (const img of images) {
        imagePositions.push({
          imageId: img.imageId as unknown as number,
          col: img.range.tl.col,
          row: img.range.tl.row,
        })
      }
    })

    // ── 3) 로고/도장 구분 ──
    // 위치 기준: col이 작으면(왼쪽) 로고, col이 크면(오른쪽) 도장
    // 또는 이미지가 1개면 로고, 2개면 왼쪽=로고 오른쪽=도장
    let logoBuffer: Buffer | null = null
    let logoExt = "png"
    let stampBuffer: Buffer | null = null
    let stampExt = "png"

    if (imagePositions.length === 1 && media.length >= 1) {
      // 이미지 1개 → 로고로 간주
      const m = media[imagePositions[0].imageId] || media[0]
      logoBuffer = Buffer.from(m.buffer)
      logoExt = m.extension || "png"
    } else if (imagePositions.length >= 2) {
      // 이미지 2개 이상 → col 기준으로 정렬, 왼쪽=로고 오른쪽=도장
      const sorted = [...imagePositions].sort((a, b) => a.col - b.col)

      const logoMedia = media[sorted[0].imageId] || media[0]
      const stampMedia = media[sorted[sorted.length - 1].imageId] || media[media.length - 1]

      if (logoMedia?.buffer) {
        logoBuffer = Buffer.from(logoMedia.buffer)
        logoExt = logoMedia.extension || "png"
      }
      if (stampMedia?.buffer) {
        stampBuffer = Buffer.from(stampMedia.buffer)
        stampExt = stampMedia.extension || "png"
      }
    } else if (media.length >= 1) {
      // imagePositions가 비어있지만 media는 있는 경우 — 순서대로 할당
      logoBuffer = Buffer.from(media[0].buffer)
      logoExt = media[0].extension || "png"
      if (media.length >= 2) {
        stampBuffer = Buffer.from(media[1].buffer)
        stampExt = media[1].extension || "png"
      }
    }

    // ── 4) logos 버킷 확인/생성 ──
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!buckets?.some((b) => b.name === "logos")) {
      await supabase.storage.createBucket("logos", { public: true })
    }

    // ── 5) 이미지 업로드 ──
    let logoUrl: string | null = null
    let stampUrl: string | null = null

    if (logoBuffer) {
      const logoName = `company-logo.${logoExt}`
      // 기존 파일 삭제 후 업로드
      await supabase.storage.from("logos").remove([logoName])
      const { error: logoErr } = await supabase.storage
        .from("logos")
        .upload(logoName, logoBuffer, {
          contentType: `image/${logoExt === "jpg" ? "jpeg" : logoExt}`,
          upsert: true,
        })
      if (!logoErr) {
        const { data: urlData } = supabase.storage.from("logos").getPublicUrl(logoName)
        logoUrl = urlData.publicUrl
      } else {
        logError("[extract-template-images] 로고 업로드 실패:", logoErr.message)
      }
    }

    if (stampBuffer) {
      const stampName = `company-stamp.${stampExt}`
      await supabase.storage.from("logos").remove([stampName])
      const { error: stampErr } = await supabase.storage
        .from("logos")
        .upload(stampName, stampBuffer, {
          contentType: `image/${stampExt === "jpg" ? "jpeg" : stampExt}`,
          upsert: true,
        })
      if (!stampErr) {
        const { data: urlData } = supabase.storage.from("logos").getPublicUrl(stampName)
        stampUrl = urlData.publicUrl
      } else {
        logError("[extract-template-images] 도장 업로드 실패:", stampErr.message)
      }
    }

    // ── 6) business_settings 업데이트 ──
    const { data: existing } = await supabase
      .from("business_settings")
      .select("id")
      .limit(1)
      .single()

    const updates: Record<string, string | null> = {}
    if (logoUrl) updates.logo_url = logoUrl
    if (stampUrl) updates.stamp_url = stampUrl
    updates.updated_at = new Date().toISOString()

    if (existing) {
      await supabase.from("business_settings").update(updates).eq("id", existing.id)
    } else {
      await supabase.from("business_settings").insert(updates)
    }

    revalidatePath("/quotes")
    revalidatePath("/requests")

    return NextResponse.json({
      success: true,
      logo_url: logoUrl,
      stamp_url: stampUrl,
      message: `추출 완료 — 로고: ${logoUrl ? "O" : "X"}, 도장: ${stampUrl ? "O" : "X"}`,
    })
  } catch (e: unknown) {
    logError("[extract-template-images]", e)
    return NextResponse.json({ error: "이미지 추출 실패" }, { status: 500 })
  }
}
