// Excel → PDF 변환 API
// 1순위: Gotenberg (LibreOffice 기반, Vercel 호환)
// 2순위: Windows Excel COM (로컬 개발 전용)
import { NextRequest, NextResponse } from "next/server"
import { logError } from "@/lib/logger"

export async function POST(req: NextRequest) {
  try {
    const buffer = await req.arrayBuffer()

    // ── 1순위: Gotenberg (GOTENBERG_URL 환경변수가 있으면 사용) ──
    const gotenbergUrl = process.env.GOTENBERG_URL
    if (gotenbergUrl) {
      const formData = new FormData()
      formData.append(
        "files",
        new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        "quote.xlsx"
      )

      const res = await fetch(`${gotenbergUrl}/forms/libreoffice/convert`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => "")
        throw new Error(`Gotenberg 변환 실패 (${res.status}): ${errText}`)
      }

      const pdfBuffer = await res.arrayBuffer()
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": "attachment",
        },
      })
    }

    // ── 2순위: Windows Excel COM (로컬 개발 환경) ──
    if (process.platform === "win32") {
      return await windowsExcelToPdf(buffer)
    }

    // ── 둘 다 없으면 에러 ──
    return NextResponse.json(
      { error: "PDF 변환 서비스가 설정되지 않았습니다. GOTENBERG_URL 환경변수를 설정하세요." },
      { status: 503 }
    )
  } catch (e) {
    logError("Excel → PDF 변환 오류:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "PDF 변환 실패" },
      { status: 500 }
    )
  }
}

// ── Windows Excel COM 변환 (기존 코드) ──
async function windowsExcelToPdf(buffer: ArrayBuffer): Promise<NextResponse> {
  const { writeFile, readFile, unlink, mkdir, stat } = await import("fs/promises")
  const { existsSync } = await import("fs")
  const { join } = await import("path")
  const { execSync } = await import("child_process")
  const { randomUUID } = await import("crypto")

  const tmpDir = join(process.env.TEMP || "C:/Users/User/AppData/Local/Temp", "quote-pdf")
  if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true })

  const id = randomUUID().slice(0, 8)
  const xlsxPath = join(tmpDir, `quote_${id}.xlsx`)
  const pdfPath = join(tmpDir, `quote_${id}.pdf`)

  await writeFile(xlsxPath, Buffer.from(buffer))

  const psScript = `
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    try {
      $wb = $excel.Workbooks.Open('${xlsxPath.replace(/\//g, "\\\\")}')
      $wb.PrintOut([Type]::Missing, [Type]::Missing, 1, $false, 'Microsoft Print to PDF', $true, $false, '${pdfPath.replace(/\//g, "\\\\")}')
      $wb.Close($false)
    } finally {
      $excel.Quit()
      [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    }
  `.trim()

  execSync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, '; ')}"`, {
    timeout: 30000,
    windowsHide: true,
  })

  // PDF 완성 대기
  let pdfReady = false
  for (let i = 0; i < 25; i++) {
    try {
      const st = await stat(pdfPath)
      if (st.size > 0) { pdfReady = true; break }
    } catch { /* 아직 없음 */ }
    await new Promise((r) => setTimeout(r, 200))
  }
  if (!pdfReady) throw new Error("PDF 파일 생성 시간 초과")

  const pdfBuffer = await readFile(pdfPath)
  await unlink(xlsxPath).catch(() => {})
  await unlink(pdfPath).catch(() => {})

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment",
    },
  })
}
