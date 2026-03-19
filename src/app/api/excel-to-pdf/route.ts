// Excel → PDF 변환 API
// Windows Excel COM 자동화를 사용하여 실제 Excel 인쇄와 동일한 PDF 생성
import { NextRequest, NextResponse } from "next/server"
import { writeFile, readFile, unlink, mkdir } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"
import { randomUUID } from "crypto"

export async function POST(req: NextRequest) {
  const tmpDir = join(process.env.TEMP || "C:/Users/User/AppData/Local/Temp", "quote-pdf")

  try {
    // 임시 디렉토리 생성
    if (!existsSync(tmpDir)) {
      await mkdir(tmpDir, { recursive: true })
    }

    // Excel 파일 받기
    const buffer = await req.arrayBuffer()
    const id = randomUUID().slice(0, 8)
    const xlsxPath = join(tmpDir, `quote_${id}.xlsx`)
    const pdfPath = join(tmpDir, `quote_${id}.pdf`)

    // Excel 파일 저장
    await writeFile(xlsxPath, Buffer.from(buffer))

    // PowerShell로 Excel COM 자동화 → PDF 변환
    // Excel의 ExportAsFixedFormat(0 = PDF)을 사용하여 인쇄영역 기반 PDF 생성
    // Excel COM: 파일 열기 → PrintOut으로 "Microsoft Print to PDF" 프린터 사용
    // ExportAsFixedFormat 대신 실제 프린터 드라이버를 사용하여 수동 인쇄와 동일한 결과
    const psScript = `
      $excel = New-Object -ComObject Excel.Application
      $excel.Visible = $false
      $excel.DisplayAlerts = $false
      try {
        $wb = $excel.Workbooks.Open('${xlsxPath.replace(/\//g, "\\\\")}')
        $ws = $wb.Worksheets.Item(1)
        $ws.PrintOut([Type]::Missing, [Type]::Missing, 1, $false, 'Microsoft Print to PDF', $true, $false, '${pdfPath.replace(/\//g, "\\\\")}')
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

    // PDF 읽기
    const pdfBuffer = await readFile(pdfPath)

    // 임시 파일 정리
    await unlink(xlsxPath).catch(() => {})
    await unlink(pdfPath).catch(() => {})

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment",
      },
    })
  } catch (e) {
    console.error("Excel → PDF 변환 오류:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "PDF 변환 실패" },
      { status: 500 }
    )
  }
}
