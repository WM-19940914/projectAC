// ============================================
// 견적서 PDF/PNG 렌더러
//
// Excel 버퍼 → /api/excel-to-pdf (Gotenberg 또는 Windows COM) → PDF
// PDF → pdf.js → Canvas → PNG
//
// Excel 프린터 출력과 100% 동일한 결과
// ============================================

import type { QuoteExportData } from "./quote-export"

// ===== Excel 버퍼 → PDF Blob (서버 API 경유) =====
async function excelToPdf(excelBuffer: ArrayBuffer): Promise<Blob> {
  const res = await fetch("/api/excel-to-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: excelBuffer,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "PDF 변환 실패" }))
    throw new Error(err.error || "PDF 변환 실패")
  }

  return res.blob()
}

// ===== PDF Blob → PNG Blob (pdf.js로 캔버스 렌더링) =====
async function pdfToCanvases(pdfBlob: Blob, scale = 3): Promise<HTMLCanvasElement[]> {
  const pdfArrayBuf = await pdfBlob.arrayBuffer()

  // pdf.js CDN 로드
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pdfjsLib = (window as any)["pdfjs-dist/build/pdf"]
  if (!pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script")
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
      s.onload = () => resolve()
      s.onerror = () => reject(new Error("pdf.js 로드 실패"))
      document.head.appendChild(s)
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfjsLib = (window as any)["pdfjs-dist/build/pdf"]
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfArrayBuf) }).promise
  const canvases: HTMLCanvasElement[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise
    canvases.push(canvas)
  }

  return canvases
}

export async function renderPdfPagesToPngBlobs(pdfBlob: Blob): Promise<Blob[]> {
  const canvases = await pdfToCanvases(pdfBlob)

  return Promise.all(
    canvases.map(
      (canvas) =>
        new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("PNG 변환 실패"))),
            "image/png",
            1.0
          )
        })
    )
  )
}

// ===================================================
//  공개 API: 견적서 → PDF Blob
// ===================================================
export async function renderQuotePdf(data: QuoteExportData): Promise<Blob> {
  // 1. Excel 버퍼 생성
  const { buildQuoteExcelBuffer } = await import("./quote-export")
  const excelBuffer = await buildQuoteExcelBuffer(data, {
    hideCostColumnsForPrint: true,
    replaceExcelOnlyFormulasForPrint: true,
    normalizeNegativeNumberFormatForPrint: true,
  })
  if (!excelBuffer) throw new Error("Excel 버퍼 생성 실패")

  // 2. 서버에서 Excel → PDF 변환 (Gotenberg 또는 Windows COM)
  return excelToPdf(excelBuffer)
}

// ===================================================
//  공개 API: 견적서 → PNG Blob (첫 페이지)
// ===================================================
export async function renderQuotePng(data: QuoteExportData): Promise<Blob> {
  const pdfBlob = await renderQuotePdf(data)
  const pngBlobs = await renderPdfPagesToPngBlobs(pdfBlob)
  return pngBlobs[0]
}

// ===================================================
//  공개 API: 견적서 → PNG Blob 배열 (모든 페이지)
// ===================================================
export async function renderQuotePngAll(data: QuoteExportData): Promise<Blob[]> {
  const pdfBlob = await renderQuotePdf(data)
  return renderPdfPagesToPngBlobs(pdfBlob)
}
