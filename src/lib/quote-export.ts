// ============================================
// 견적서 PDF / Excel 내보내기 유틸리티
// ============================================

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
// xlsx → exceljs 로 교체 (동적 임포트, 아래 exportQuoteExcel 참고)

// ===== 품목 행 타입 (에디터와 동일) =====
interface ItemRow {
  item_name: string
  specification: string
  unit: string
  quantity: number
  unit_price: number
  amount: number
  memo: string
  retrieval_price: number
  discount_rate: number
  purchase_unit_price: number
  purchase_amount: number
  margin_rate: number
  proposed_price: number
  profit: number
  incentive_rate: number
}

// ===== 내보내기 데이터 타입 =====
export interface QuoteExportData {
  title: string
  quotationNumber: string
  quotationDate: string
  quoteType: "simple" | "detailed"
  notes: string

  supplier: {
    companyName: string
    bizNumber: string
    ceoName: string
    email: string
    address: string
    manager: string
    managerPhone: string
    managerEmail: string
  }

  receiver: {
    companyName: string
    bizNumber: string
    recipientName: string
    email: string
    address: string
    phone: string
  }

  deliveryDate: string
  deliveryPlace: string
  paymentCondition: string
  validUntil: string

  equipItems: ItemRow[]
  installItems: ItemRow[]
  coverItems: ItemRow[]

  coverEquipLabel: { name: string; desc: string }
  coverInstallLabel: { name: string; desc: string }

  equipTotal: number
  installTotal: number
  totalAmount: number
  truncationAmount: number // 양수 (예: 10000 → "-10,000"으로 표시)
  supplyAmount: number
  taxAmount: number
  grandTotal: number

  totalPurchase: number
  totalProfit: number

  logoUrl: string | null
  stampUrl: string | null
}

// ===== 상수 =====
const M = 15 // 마진 (mm)
const PW = 210 // 페이지 폭
const CW = PW - M * 2 // 콘텐츠 폭 (180mm)
const SLATE700: [number, number, number] = [51, 65, 85]
const SLATE400: [number, number, number] = [148, 163, 184]
const GRAY100: [number, number, number] = [243, 244, 246]
const GRAY200: [number, number, number] = [229, 231, 235]
const GRAY500: [number, number, number] = [107, 114, 128]
const GRAY900: [number, number, number] = [17, 24, 39]
const RED500: [number, number, number] = [239, 68, 68]
const SKY_AQUA: [number, number, number] = [66, 202, 253] // #42CAFD
const SKY_AQUA_BG: [number, number, number] = [230, 247, 254] // sky-aqua/15
const TROP_TEAL: [number, number, number] = [102, 179, 186] // #66B3BA
const TROP_TEAL_BG: [number, number, number] = [228, 244, 245] // tropical-teal/15

// ===== 유틸리티 =====

// 유효한 데이터가 있는 행인지 판단
function hasData(r: ItemRow): boolean {
  return !!(r.item_name.trim() || r.specification.trim() || r.unit.trim() || r.quantity !== 0 || r.unit_price > 0 || r.retrieval_price > 0)
}

// 숫자 → 천단위 콤마 문자열
function fmt(n: number): string {
  return n.toLocaleString("ko-KR")
}

// ArrayBuffer → base64 문자열
function ab2b64(buffer: ArrayBuffer): string {
  let binary = ""
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// 이미지 URL → data URL (base64)
async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}


// ===== 폰트 캐시 =====
let cachedRegular: string | null = null
let cachedBold: string | null = null

async function ensureFonts(doc: jsPDF): Promise<void> {
  // 폰트 파일 로드 (캐시 활용)
  if (!cachedRegular || !cachedBold) {
    const [regBuf, boldBuf] = await Promise.all([
      fetch("/fonts/Pretendard-Regular.ttf").then((r) => r.arrayBuffer()),
      fetch("/fonts/Pretendard-Bold.ttf").then((r) => r.arrayBuffer()),
    ])
    cachedRegular = ab2b64(regBuf)
    cachedBold = ab2b64(boldBuf)
  }
  doc.addFileToVFS("Pretendard-Regular.ttf", cachedRegular)
  doc.addFont("Pretendard-Regular.ttf", "Pretendard", "normal")
  doc.addFileToVFS("Pretendard-Bold.ttf", cachedBold)
  doc.addFont("Pretendard-Bold.ttf", "Pretendard", "bold")
  doc.setFont("Pretendard")
}

// jsPDF 텍스트 유틸 (반복 줄이기)
function txt(doc: jsPDF, text: string, x: number, y: number, opts?: { align?: "left" | "center" | "right"; size?: number; bold?: boolean; color?: [number, number, number] }) {
  if (opts?.size) doc.setFontSize(opts.size)
  if (opts?.bold !== undefined) doc.setFont("Pretendard", opts.bold ? "bold" : "normal")
  if (opts?.color) doc.setTextColor(...opts.color)
  else doc.setTextColor(...GRAY900)
  doc.text(text, x, y, { align: opts?.align || "left" })
}

// ============================================================
//  PDF 내보내기
// ============================================================

export async function exportQuotePDF(data: QuoteExportData): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true })
  await ensureFonts(doc)

  // 로고/도장 이미지 병렬 로드
  const [logoData, stampData] = await Promise.all([
    data.logoUrl ? loadImageDataUrl(data.logoUrl) : Promise.resolve(null),
    data.stampUrl ? loadImageDataUrl(data.stampUrl) : Promise.resolve(null),
  ])

  if (data.quoteType === "detailed") {
    renderCoverPage(doc, data, logoData, stampData)
    // 장비 내역서 페이지
    const validEquip = data.equipItems.filter(hasData)
    if (validEquip.length > 0) {
      doc.addPage()
      renderItemsPage(doc, "장비 내역서", validEquip, data.equipTotal)
    }
    // 설치비 내역서 페이지
    const validInstall = data.installItems.filter(hasData)
    if (validInstall.length > 0) {
      doc.addPage()
      renderItemsPage(doc, "설치비 내역서", validInstall, data.installTotal)
    }
  } else {
    renderSimplePage(doc, data, logoData, stampData)
  }

  // 페이지 번호 삽입 (1 / 2 형식, 하단 중앙)
  const totalPages = doc.getNumberOfPages()
  if (totalPages > 1) {
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setFont("Pretendard", "normal")
      doc.setTextColor(...GRAY500)
      doc.text(`${i} / ${totalPages}`, PW / 2, 290, { align: "center" })
    }
  }

  // 파일명에서 특수문자 제거
  const safeName = (data.title || "무제").replace(/[\\/:*?"<>|]/g, "_")
  doc.save(`견적서_${safeName}.pdf`)
}

// ----- 간이 견적서 렌더링 (에디터 UI 그대로 재현) -----
function renderSimplePage(doc: jsPDF, data: QuoteExportData, logoData: string | null, stampData: string | null) {
  let y = M

  // ============================================================
  //  상단 카드: 로고 → 제목 → 정보바 → 구분선 → 공급자/수신자
  //  (에디터의 border border-gray-200 rounded-lg 카드 그대로)
  // ============================================================
  const cardX = M
  const cardW = CW

  // 카드 높이 사전 계산 (내용에 따라 동적)
  const logoH = logoData ? 12 : 0 // 로고 영역 높이
  const titleH = 10 // 제목 영역
  const infoH = 5 // 정보 라인
  const dividerH = 3 // 구분선 + 여백
  // 공급자/수신자: 회사명 + info 항목 수에 따라
  const supplierLines = [data.supplier.bizNumber, data.supplier.ceoName, data.supplier.email, data.supplier.address].filter(Boolean).length
  const receiverLines = [data.receiver.bizNumber, data.receiver.recipientName, data.receiver.email, data.receiver.address].filter(Boolean).length
  const maxLines = Math.max(supplierLines, receiverLines, 3)
  const infoSectionH = 6 + 9.5 + maxLines * 5.5 + 4 // 라벨 + 회사명(넉넉) + info행 + 하단여백
  const totalCardH = 6 + logoH + titleH + infoH + dividerH + infoSectionH + 4

  // 카드 외곽선
  doc.setDrawColor(...GRAY200)
  doc.setLineWidth(0.3)
  doc.rect(cardX, y, cardW, totalCardH)

  let cy = y // 카드 내부 y 커서

  // ── 로고 영역 (bg-gray-50) ──
  if (logoData) {
    doc.setFillColor(249, 250, 251) // gray-50
    doc.rect(cardX + 0.15, cy + 0.15, cardW - 0.3, logoH + 4, "F")
    try {
      const props = doc.getImageProperties(logoData)
      const imgH = 8
      const imgW = imgH * (props.width / props.height)
      doc.addImage(logoData, cardX + 5, cy + 3, Math.min(imgW, 42), imgH)
    } catch { /* 무시 */ }
    cy += logoH + 4
  } else {
    cy += 4
  }

  // ── 제목 (text-[26px] font-bold) ──
  cy += 2
  txt(doc, data.title || "견적서", cardX + 5, cy + 6, { size: 16, bold: true })
  cy += titleH

  // ── 정보 라인 (견적일 | 견적번호 | 견적담당 | 연락처 | 이메일) ──
  cy += 1
  doc.setFontSize(6.5)
  doc.setFont("Pretendard", "normal")
  // 좌측: 견적일 + 견적번호
  const leftInfo = [`견적일  ${data.quotationDate}`, data.quotationNumber ? `견적번호  ${data.quotationNumber}` : ""].filter(Boolean).join("   |   ")
  doc.setTextColor(...GRAY500)
  doc.text(leftInfo, cardX + 5, cy + 2)
  // 우측: 견적담당 + 연락처 + 이메일
  const rightInfo = [
    data.supplier.manager ? `견적 담당  ${data.supplier.manager}` : "",
    data.supplier.managerPhone ? `연락처  ${data.supplier.managerPhone}` : "",
    data.supplier.managerEmail ? `이메일  ${data.supplier.managerEmail}` : "",
  ].filter(Boolean).join("   |   ")
  doc.text(rightInfo, cardX + cardW - 5, cy + 2, { align: "right" })
  cy += infoH

  // ── 구분선 (border-t border-gray-100) ──
  doc.setDrawColor(243, 244, 246) // gray-100
  doc.setLineWidth(0.2)
  doc.line(cardX + 5, cy, cardX + cardW - 5, cy)
  cy += dividerH

  // ── 공급자 (좌측) + 수신자 (우측) — grid grid-cols-2 gap-8 ──
  const halfW = (cardW - 16) / 2 // gap-8 ≈ 8mm
  const leftX = cardX + 5
  const rightX = cardX + 5 + halfW + 8

  // --- 공급자 ---
  let sly = cy
  txt(doc, "공급자", leftX, sly + 3, { size: 7, color: SLATE400 })
  sly += 6
  txt(doc, data.supplier.companyName || "", leftX, sly + 3, { size: 9.5, bold: true })
  sly += 9.5
  const sInfoPairs = [
    ["사업자", data.supplier.bizNumber],
    ["대표자", data.supplier.ceoName],
    ["이메일", data.supplier.email],
    ["주소", data.supplier.address],
  ]
  for (const [label, val] of sInfoPairs) {
    if (!val) continue
    txt(doc, label, leftX, sly, { size: 7, color: SLATE400 })
    const maxValW = halfW - 20
    const valLines = doc.splitTextToSize(val, maxValW)
    doc.setFontSize(7)
    doc.setFont("Pretendard", "normal")
    doc.setTextColor(...GRAY900)
    doc.text(valLines, leftX + 15, sly)
    sly += valLines.length * 4 + 1.5
  }

  // 도장 (공급자 영역 우측에 배치 — 72×72px ≈ 19×19mm)
  if (stampData) {
    try {
      const sp = doc.getImageProperties(stampData)
      const sH = 16
      const sW = sH * (sp.width / sp.height)
      doc.addImage(stampData, leftX + halfW - sW - 2, cy + 2, sW, sH)
    } catch { /* 무시 */ }
  }

  // --- 수신자 ---
  let rly = cy
  txt(doc, "수신자", rightX, rly + 3, { size: 7, color: SLATE400 })
  rly += 6
  txt(doc, data.receiver.companyName || "", rightX, rly + 3, { size: 9.5, bold: true })
  rly += 9.5
  const rInfoPairs = [
    ["사업자", data.receiver.bizNumber],
    ["수신자", data.receiver.recipientName],
    ["이메일", data.receiver.email],
    ["주소", data.receiver.address],
  ]
  for (const [label, val] of rInfoPairs) {
    if (!val) continue
    txt(doc, label, rightX, rly, { size: 7, color: SLATE400 })
    const maxValW = halfW - 20
    const valLines = doc.splitTextToSize(val, maxValW)
    doc.setFontSize(7)
    doc.setFont("Pretendard", "normal")
    doc.setTextColor(...GRAY900)
    doc.text(valLines, rightX + 15, rly)
    rly += valLines.length * 4 + 1.5
  }

  y += totalCardH + 3

  // ============================================================
  //  장비 내역 / 설치비 내역 테이블
  // ============================================================
  const validEquip = data.equipItems.filter(hasData)
  if (validEquip.length > 0) {
    y = renderItemsTable(doc, y, "장비 내역", validEquip, data.equipTotal, SKY_AQUA, SKY_AQUA_BG)
  }

  const validInstall = data.installItems.filter(hasData)
  if (validInstall.length > 0) {
    y = renderItemsTable(doc, y, "설치비 내역", validInstall, data.installTotal, TROP_TEAL, TROP_TEAL_BG)
  }

  // ============================================================
  //  하단: 비고 + 합계 (테이블 바로 아래에 붙임)
  // ============================================================
  const summaryNeedH = 45
  if (y + summaryNeedH > 285) {
    doc.addPage()
    y = M
  }

  renderSummaryCard(doc, y, data)
}

// ----- 아이템 테이블 렌더링 (간이 견적서용 — 카드 스타일) -----
function renderItemsTable(doc: jsPDF, startY: number, sectionTitle: string, items: ItemRow[], subtotal: number, iconColor?: [number, number, number], badgeBg?: [number, number, number]): number {
  // 섹션 헤더 배경 (bg-gray-50/50)
  const headerH = 10
  doc.setDrawColor(...GRAY200)
  doc.setFillColor(249, 250, 251)
  doc.rect(M, startY, CW, headerH, "FD")
  doc.setDrawColor(...GRAY200)
  doc.line(M, startY + headerH, M + CW, startY + headerH)

  // 아이콘(색상 원) + 섹션 타이틀 + 소계 뱃지
  const ic = iconColor || SLATE700
  doc.setFillColor(...ic)
  doc.circle(M + 6, startY + 5.2, 1.2, "F") // 원형 아이콘
  txt(doc, sectionTitle, M + 10, startY + 6.2, { size: 9.5, bold: true, color: SLATE700 })
  if (subtotal > 0) {
    const badgeText = `₩ ${fmt(subtotal)}`
    doc.setFontSize(8)
    const bw = doc.getTextWidth(badgeText) + 5
    doc.setFontSize(9.5) // sectionTitle 폭 측정용
    const bx = M + 10 + doc.getTextWidth(`${sectionTitle}`) + 6
    doc.setFillColor(...(badgeBg || GRAY100))
    doc.rect(bx, startY + 2.5, bw, 5.5, "F")
    txt(doc, badgeText, bx + 2.5, startY + 6, { size: 8, bold: true, color: SLATE700 })
  }

  autoTable(doc, {
    startY: startY + headerH,
    head: [["품목명", "규격", "단위", "수량", "단가", "금액"]],
    body: items.map((r) => [
      r.item_name,
      r.specification,
      r.unit,
      r.quantity !== 0 ? fmt(r.quantity) : "",
      r.unit_price > 0 ? fmt(r.unit_price) : "",
      r.amount > 0 ? fmt(r.amount) : "",
    ]),
    styles: {
      font: "Pretendard",
      fontSize: 7.5,
      cellPadding: { top: 1.8, bottom: 1.8, left: 1.5, right: 1.5 },
      lineColor: GRAY200,
      lineWidth: 0.15,
      textColor: GRAY900,
    },
    headStyles: {
      fillColor: [241, 245, 249] as [number, number, number], // slate-100
      textColor: GRAY500,
      fontStyle: "bold",
      fontSize: 7,
      halign: "center",
      lineColor: [203, 213, 225] as [number, number, number], // slate-300
    },
    columnStyles: {
      0: { cellWidth: 52 },               // 품목명: 좌측
      1: { halign: "center", cellWidth: 48 }, // 규격: 가운데
      2: { halign: "center", cellWidth: 14 }, // 단위: 가운데
      3: { halign: "center", cellWidth: 16 }, // 수량: 가운데
      4: { halign: "right", cellWidth: 24 },  // 단가: 우측
      5: { halign: "right", cellWidth: 26 },  // 금액: 우측
    },
    margin: { left: M, right: M },
    theme: "grid",
    tableLineColor: GRAY200,
    tableLineWidth: 0.15,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable.finalY + 3
}

// ----- 하단 비고/합계 카드 (에디터 UI 그대로 재현) -----
function renderSummaryCard(doc: jsPDF, y: number, data: QuoteExportData) {
  const cardW = CW

  // ── 합계 박스 (우측) + 비고 (좌측) 좌우 배치 ──
  const sumBoxW = 79
  const sumBoxX = M + cardW - sumBoxW
  const noteW = sumBoxX - M - 4 // 비고 영역 폭
  const lineH = 7.5

  const sumRows = [
    { label: "총 합계", value: `₩ ${fmt(data.totalAmount)}`, bold: true },
    ...(data.truncationAmount > 0 ? [{ label: "단위절사", value: `-₩ ${fmt(data.truncationAmount)}`, bold: false, red: true }] : []),
    { label: "공급가액", value: `₩ ${fmt(data.supplyAmount)}`, bold: false },
    { label: "VAT (10%)", value: `₩ ${fmt(data.taxAmount)}`, bold: false },
  ]
  const sumBoxH = sumRows.length * lineH + 1
  // 합계 제목 없음 (웹 UI와 동일)
  const boxY = y + 3
  doc.setDrawColor(...GRAY200)
  doc.rect(sumBoxX, boxY, sumBoxW, sumBoxH)

  let sy = boxY + 1
  for (const row of sumRows) {
    const isRed = "red" in row && row.red
    txt(doc, row.label, sumBoxX + 5, sy + 4, { size: 7.5, bold: false, color: isRed ? RED500 : GRAY500 })
    txt(doc, row.value, sumBoxX + sumBoxW - 5, sy + 4, { size: 7.5, bold: row.bold, color: isRed ? RED500 : GRAY900, align: "right" })
    sy += lineH
  }

  // 최종 견적 (회색 배경 + 굵은 검정 글씨 + 굵은 테두리)
  const finalH = 10
  doc.setFillColor(241, 245, 249) // slate-100
  doc.setDrawColor(...GRAY200)
  doc.setLineWidth(0.3)
  doc.rect(sumBoxX, sy, sumBoxW, finalH, "FD")
  // 합계 박스 전체 외곽선 마감
  doc.setDrawColor(...GRAY200)
  doc.setLineWidth(0.3)
  doc.rect(sumBoxX, boxY, sumBoxW, sumBoxH + finalH)
  txt(doc, "최종 견적", sumBoxX + 5, sy + 6.5, { size: 10, bold: true, color: GRAY900 })
  txt(doc, `₩ ${fmt(data.grandTotal)}`, sumBoxX + sumBoxW - 5, sy + 6.5, { size: 10, bold: true, color: GRAY900, align: "right" })

  // ── 비고 (좌측, 합계와 같은 높이 테두리 박스) ──
  const noteBoxH = sumBoxH + finalH // 합계 전체 높이와 동일
  // 제목: ● 비고 (웹 UI와 동일)
  txt(doc, "●  비고", M, y + 1, { size: 7.5, bold: true, color: GRAY500 })
  doc.setDrawColor(...GRAY200)
  doc.setLineWidth(0.3)
  doc.rect(M, boxY, noteW, noteBoxH)
  if (data.notes) {
    doc.setFontSize(8)
    doc.setFont("Pretendard", "normal")
    doc.setTextColor(...GRAY500)
    const noteLines = doc.splitTextToSize(data.notes, noteW - 8)
    doc.text(noteLines, M + 4, boxY + 5)
  } else {
    txt(doc, "비고 / 특이사항", M + 4, boxY + 5, { size: 7, color: SLATE400 })
  }
}

// ----- 상세 견적서: 갑지 페이지 -----
function renderCoverPage(doc: jsPDF, data: QuoteExportData, logoData: string | null, stampData: string | null) {
  let y = M

  // ── 대제목 "견 적 서" ──
  txt(doc, "견  적  서", PW / 2, y + 10, { align: "center", size: 24, bold: true, color: GRAY900 })
  txt(doc, "Quotation", PW / 2, y + 16, { align: "center", size: 9, color: SLATE400 })
  y += 20

  // 굵은 구분선
  doc.setDrawColor(...GRAY900)
  doc.setLineWidth(0.8)
  doc.line(M, y, PW - M, y)
  y += 5

  // ── 회사 정보 + 로고 + 도장 ──
  if (logoData) {
    try {
      const props = doc.getImageProperties(logoData)
      const imgH = 9
      const imgW = imgH * (props.width / props.height)
      doc.addImage(logoData, M, y, Math.min(imgW, 35), imgH)
    } catch { /* 무시 */ }
  }

  const companyX = M + (logoData ? 38 : 0)
  txt(doc, data.supplier.companyName || "회사명", companyX, y + 4, { size: 11, bold: true })
  if (data.supplier.address) {
    txt(doc, `A. ${data.supplier.address}`, companyX, y + 8.5, { size: 8, color: GRAY500 })
  }
  if (data.supplier.email) {
    txt(doc, `E. ${data.supplier.email}`, companyX, y + 12, { size: 8, color: GRAY500 })
  }

  // 도장 (우측)
  if (stampData) {
    try {
      const sp = doc.getImageProperties(stampData)
      const sH = 14
      const sW = sH * (sp.width / sp.height)
      doc.addImage(stampData, PW - M - sW, y - 1, sW, sH)
    } catch { /* 무시 */ }
  }
  y += 16

  // 구분선
  doc.setDrawColor(...GRAY200)
  doc.setLineWidth(0.3)
  doc.line(M, y, PW - M, y)
  y += 2

  // ── 3단 정보 그리드 ──
  const colW = CW / 3
  const gridH = 34
  doc.setDrawColor(...GRAY200)
  doc.rect(M, y, CW, gridH) // 외곽
  doc.line(M + colW, y, M + colW, y + gridH) // 세로선 1
  doc.line(M + colW * 2, y, M + colW * 2, y + gridH) // 세로선 2

  // 받는분 정보
  const g1x = M + 3
  let gy = y + 5
  doc.setFillColor(...SLATE700)
  doc.circle(g1x + 1.2, gy - 0.8, 0.8, "F")
  txt(doc, "받는분 정보", g1x + 4, gy, { size: 8, bold: true, color: SLATE700 })
  gy += 7
  const recvRows = [
    ["수 신 처", data.receiver.companyName || "-"],
    ["담 당 자", data.receiver.recipientName || "-"],
    ["연 락 처", data.receiver.phone || "-"],
  ]
  for (const [l, v] of recvRows) {
    txt(doc, l, g1x, gy, { size: 8, color: GRAY500 })
    txt(doc, v, g1x + 18, gy, { size: 8, bold: false })
    gy += 6.5
  }

  // 견적 정보
  const g2x = M + colW + 3
  gy = y + 5
  doc.setFillColor(...SLATE700)
  doc.circle(g2x + 1.2, gy - 0.8, 0.8, "F")
  txt(doc, "견 적 정 보", g2x + 4, gy, { size: 8, bold: true, color: SLATE700 })
  gy += 7
  const quoteRows = [
    ["견 적 일", data.quotationDate || "-"],
    ["담 당 자", data.supplier.manager || "-"],
    ["연 락 처", data.supplier.managerPhone || "-"],
  ]
  for (const [l, v] of quoteRows) {
    txt(doc, l, g2x, gy, { size: 8, color: GRAY500 })
    txt(doc, v, g2x + 18, gy, { size: 8, bold: false })
    gy += 6.5
  }

  // 납기/결제 정보
  const g3x = M + colW * 2 + 3
  gy = y + 5
  doc.setFillColor(...SLATE700)
  doc.circle(g3x + 1.2, gy - 0.8, 0.8, "F")
  txt(doc, "납기 / 결제 정보", g3x + 4, gy, { size: 8, bold: true, color: SLATE700 })
  gy += 7
  const deliveryRows = [
    ["납기일자", data.deliveryDate || "-"],
    ["납기장소", data.deliveryPlace || "-"],
    ["결제조건", data.paymentCondition || "-"],
  ]
  for (const [l, v] of deliveryRows) {
    txt(doc, l, g3x, gy, { size: 8, color: GRAY500 })
    txt(doc, v, g3x + 18, gy, { size: 8, bold: false })
    gy += 6.5
  }

  y += gridH + 4

  // ── 현장명 (아이콘 + 라벨: 값) ──
  doc.setFillColor(...SLATE700)
  doc.circle(M + 1.5, y + 3.5, 0.8, "F")
  txt(doc, `현장명: ${data.title || "-"}`, M + 5, y + 4, { size: 10, bold: true })
  y += 9

  // ── 품목 테이블 (갑지 형식) ──
  // 고정행: 장비(1), 설치비(2) + 추가 행(coverItems) + 빈 행
  const coverBody: (string | number)[][] = []
  // 장비 고정행
  coverBody.push([1, data.coverEquipLabel.name, data.coverEquipLabel.desc, "식", 1, fmt(data.equipTotal), fmt(data.equipTotal), ""])
  // 설치비 고정행
  coverBody.push([2, data.coverInstallLabel.name, data.coverInstallLabel.desc, "식", 1, fmt(data.installTotal), fmt(data.installTotal), ""])
  // 추가 행
  const validCover = data.coverItems.filter(hasData)
  validCover.forEach((r, i) => {
    coverBody.push([
      i + 3,
      r.item_name,
      r.specification,
      r.unit,
      r.quantity !== 0 ? fmt(r.quantity) : "",
      r.unit_price > 0 ? fmt(r.unit_price) : "",
      r.amount > 0 ? fmt(r.amount) : "",
      r.memo || "",
    ])
  })
  // 빈 행 채우기 (데이터 행 + 빈 행 합쳐서 최소 8행)
  const dataRowCount = coverBody.length // 데이터가 있는 행 수
  const emptyCount = Math.max(0, 10 - coverBody.length)
  for (let i = 0; i < emptyCount; i++) {
    coverBody.push(["", "", "", "", "", "", "", ""])
  }

  autoTable(doc, {
    startY: y,
    head: [["순번", "구 분", "내 용", "단위", "수량", "단 가", "공 급 가", "비 고"]],
    body: coverBody,
    // 빈 행은 내부 세로 테두리만 숨기고, 바깥 테두리 + 가로선은 유지
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.row.index >= dataRowCount) {
        hookData.cell.styles.lineColor = [255, 255, 255]
      }
    },
    didDrawCell: (hookData) => {
      if (hookData.section === "body" && hookData.row.index >= dataRowCount) {
        const { x, y: cy, width, height } = hookData.cell
        const colIdx = hookData.column.index
        const totalCols = hookData.table.columns.length
        doc.setDrawColor(...GRAY200)
        doc.setLineWidth(0.2)
        // 가로선 (하단)
        doc.line(x, cy + height, x + width, cy + height)
        // 데이터 마지막 행 바로 아래 구분선
        if (hookData.row.index === dataRowCount) {
          doc.setDrawColor(...GRAY200)
          doc.setLineWidth(0.2)
          doc.line(x, cy, x + width, cy)
        }
        // 바깥 테두리: 첫 열 좌측, 마지막 열 우측
        doc.setDrawColor(...GRAY200)
        doc.setLineWidth(0.2)
        if (colIdx === 0) doc.line(x, cy, x, cy + height)
        if (colIdx === totalCols - 1) doc.line(x + width, cy, x + width, cy + height)
      }
    },
    styles: {
      font: "Pretendard",
      fontSize: 8.5,
      cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 },
      lineColor: GRAY200,
      lineWidth: 0.2,
      textColor: GRAY900,
    },
    headStyles: {
      fillColor: GRAY100,
      textColor: SLATE700,
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { halign: "center", cellWidth: 22 },
      2: { cellWidth: 50 },
      3: { halign: "center", cellWidth: 12 },
      4: { halign: "center", cellWidth: 12 },
      5: { halign: "right", cellWidth: 24 },
      6: { halign: "right", cellWidth: 28 },
      7: { halign: "center", cellWidth: 20 },
    },
    margin: { left: M, right: M },
    theme: "grid",
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 2

  // ── 하단: 비고(좌) + 금액요약(우) — 에디터 grid grid-cols-[1fr_250px] ──
  const summaryW = 75
  const noteW = CW - summaryW - 2

  // 외곽선 (갑지 전체가 border border-gray-300)
  doc.setDrawColor(...GRAY200)
  doc.setLineWidth(0.3)

  // 금액 요약 (우측)
  const sX = M + noteW + 2
  const labelW = 26
  const valW = summaryW - labelW
  const rowH = 8
  doc.setDrawColor(...GRAY200)
  doc.setLineWidth(0.2)

  const summaryRows = [
    { label: "합  계", value: fmt(data.totalAmount) },
    ...(data.truncationAmount > 0 ? [{ label: "단위절사", value: `-${fmt(data.truncationAmount)}`, red: true }] : []),
    { label: "견적금액", value: fmt(data.supplyAmount) },
    { label: "부 가 세", value: fmt(data.taxAmount) },
  ]

  let sy = y
  for (const row of summaryRows) {
    const isRed = "red" in row && row.red
    // 라벨 셀 (bg-gray-50)
    doc.setFillColor(249, 250, 251)
    doc.rect(sX, sy, labelW, rowH, "FD")
    // 값 셀
    doc.rect(sX + labelW, sy, valW, rowH)
    txt(doc, row.label, sX + 3, sy + 5.2, { size: 9, bold: true, color: isRed ? RED500 : GRAY500 })
    txt(doc, row.value, sX + summaryW - 3, sy + 5.2, { size: 9, bold: false, color: isRed ? RED500 : GRAY900, align: "right" })
    sy += rowH
  }

  // 최종견적 (bg-slate-100, 큰 글자)
  const finalH = 11
  doc.setFillColor(241, 245, 249) // slate-100
  doc.rect(sX, sy, labelW, finalH, "FD")
  doc.setFillColor(241, 245, 249)
  doc.rect(sX + labelW, sy, valW, finalH, "FD")
  doc.setDrawColor(203, 213, 225) // slate-300
  doc.line(sX, sy, sX + summaryW, sy) // 상단 굵은 구분선
  txt(doc, "최종견적", sX + 3, sy + 7, { size: 10, bold: true, color: SLATE700 })
  txt(doc, `₩ ${fmt(data.grandTotal)}`, sX + summaryW - 3, sy + 7, { size: 11, bold: true, color: SLATE700, align: "right" })

  // 비고 (좌측, 합계와 같은 높이 테두리)
  const noteBoxH = (sy + finalH) - y // 합계 전체 높이와 동일
  doc.setDrawColor(...GRAY200)
  doc.setLineWidth(0.3)
  doc.rect(M, y, noteW - 2, noteBoxH)
  txt(doc, "※ 비 고", M + 3, y + 4, { size: 8, bold: true, color: SLATE700 })
  if (data.notes) {
    doc.setFontSize(7)
    doc.setFont("Pretendard", "normal")
    doc.setTextColor(...GRAY500)
    const noteLines = doc.splitTextToSize(data.notes, noteW - 10)
    doc.text(noteLines, M + 4, y + 8)
  }
}

// ----- 상세 견적서: 내역서 페이지 (장비/설치비 상세) -----
function renderItemsPage(doc: jsPDF, title: string, items: ItemRow[], subtotal: number) {
  let y = M

  // 제목
  txt(doc, title, PW / 2, y + 6, { align: "center", size: 14, bold: true, color: SLATE700 })
  y += 12

  autoTable(doc, {
    startY: y,
    head: [["품목명", "규격", "단위", "수량", "단가", "금액"]],
    body: items.map((r) => [
      r.item_name,
      r.specification,
      r.unit,
      r.quantity !== 0 ? fmt(r.quantity) : "",
      r.unit_price > 0 ? fmt(r.unit_price) : "",
      r.amount > 0 ? fmt(r.amount) : "",
    ]),
    foot: [["", "", "", "", { content: "소계", styles: { halign: "right" } }, { content: `₩ ${fmt(subtotal)}`, styles: { halign: "right", fontSize: 9 } }]],
    styles: {
      font: "Pretendard",
      fontSize: 8,
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      lineColor: GRAY200,
      lineWidth: 0.2,
      textColor: GRAY900,
    },
    headStyles: {
      fillColor: GRAY100,
      textColor: SLATE700,
      fontStyle: "bold",
      halign: "center",
    },
    footStyles: {
      fillColor: GRAY100,
      textColor: SLATE700,
      fontSize: 9,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 50 },               // 품목명: 좌측
      1: { halign: "center", cellWidth: 42 }, // 규격: 가운데
      2: { halign: "center", cellWidth: 14 }, // 단위: 가운데
      3: { halign: "center", cellWidth: 16 }, // 수량: 가운데
      4: { halign: "right", cellWidth: 26 },  // 단가: 우측
      5: { halign: "right", cellWidth: 32 },  // 금액: 우측
    },
    margin: { left: M, right: M },
    theme: "grid",
  })
}

// ============================================================
//  Excel 내보내기 (exceljs 기반 — 간이/상세 분리, 웹 UI 재현)
// ============================================================

// Excel ARGB 색상 (웹 UI 팔레트 매칭)
const XL = {
  SLATE100: 'FFF1F5F9', SLATE300: 'FFCBD5E1', SLATE500: 'FF64748B', SLATE700: 'FF334155',
  GRAY50: 'FFF9FAFB', GRAY100: 'FFF3F4F6', GRAY200: 'FFE5E7EB', GRAY500: 'FF6B7280', GRAY900: 'FF111827',
  WHITE: 'FFFFFFFF', GREEN600: 'FF16A34A', RED500: 'FFEF4444',
} as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function xlStyle(cell: any, o: { sz?: number; bold?: boolean; color?: string; bg?: string; bc?: string; align?: 'left' | 'center' | 'right'; fmt?: string }) {
  cell.font = { name: '맑은 고딕', size: o.sz ?? 10, bold: o.bold ?? false, color: { argb: o.color ?? XL.GRAY900 } }
  if (o.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.bg } }
  if (o.bc) { const s = { style: 'thin' as const, color: { argb: o.bc } }; cell.border = { top: s, bottom: s, left: s, right: s } }
  cell.alignment = { horizontal: o.align ?? 'left', vertical: 'middle' as const, wrapText: true }
  if (o.fmt) cell.numFmt = o.fmt
}

/** data URL → 워크북 이미지 등록 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function xlAddImg(wb: any, dataUrl: string | null): number | null {
  if (!dataUrl) return null
  const m = dataUrl.match(/^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/i)
  if (!m) return null
  try { return wb.addImage({ base64: m[2], extension: m[1].toLowerCase() === 'jpg' ? 'jpeg' : m[1].toLowerCase() }) } catch { return null }
}

/** 15열(A~O) 아이템+원가분석 워크시트 생성 (장려금 제거) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function xlCreateItemsWs(wb: any, name: string): any {
  const ws = wb.addWorksheet(name, { properties: { defaultRowHeight: 20 }, views: [{ showGridLines: false }] })
  ws.columns = [
    { width: 5 },   // A: #
    { width: 28 },  // B: 품명
    { width: 22 },  // C: 모델/사양
    { width: 7 },   // D: 단위
    { width: 9 },   // E: 수량
    { width: 14 },  // F: 단가
    { width: 16 },  // G: 공급가
    { width: 1.5 }, // H: 구분
    { width: 14 },  // I: 반출가
    { width: 9 },   // J: DC율
    { width: 14 },  // K: 매입단가
    { width: 16 },  // L: 매입총액
    { width: 9 },   // M: MG율
    { width: 14 },  // N: 제안가
    { width: 14 },  // O: 이윤
  ]
  return ws
}

// 열 분류 상수 (아이템 테이블 공통, 장려금 제거 후 15열)
const CALC_COLS = new Set([6, 7, 11, 12, 14, 15])
const NUM_COLS = new Set([5, 6, 7, 9, 11, 12, 14, 15])
const RIGHT_COLS = new Set([5, 6, 7, 9, 11, 12, 14, 15])
const CENTER_COLS = new Set([1, 4, 10, 13])

/* ─────────────────────────────────────────────────────────
   간이 견적서 헤더 카드 (로고 + 제목 + 메타 + 공급자/수신자)
   ───────────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function xlRenderSimpleHeader(ws: any, d: QuoteExportData, logoId: number | null, stampId: number | null, r: number): number {
  // ── 로고 ──
  if (logoId !== null) {
    ws.addImage(logoId, { tl: { col: 0.3, row: r - 0.8 }, ext: { width: 120, height: 36 } })
    ws.getRow(r).height = 35
  } else {
    ws.getRow(r).height = 6
  }
  r++

  // ── 제목 ──
  ws.mergeCells(`A${r}:Q${r}`)
  ws.getCell(`A${r}`).value = d.title || '견적서'
  xlStyle(ws.getCell(`A${r}`), { sz: 16, bold: true })
  ws.getRow(r).height = 28
  r++

  // ── 메타 정보 ──
  ws.mergeCells(`A${r}:Q${r}`)
  ws.getCell(`A${r}`).value = [
    `견적일  ${d.quotationDate}`,
    d.quotationNumber && `견적번호  ${d.quotationNumber}`,
    d.supplier.manager && `견적 담당  ${d.supplier.manager}`,
    d.supplier.managerPhone && `연락처  ${d.supplier.managerPhone}`,
    d.supplier.managerEmail && `이메일  ${d.supplier.managerEmail}`,
  ].filter(Boolean).join('   |   ')
  xlStyle(ws.getCell(`A${r}`), { sz: 8, color: XL.GRAY500 })
  ws.getRow(r).height = 16
  r++

  // ── 구분선 ──
  ws.getRow(r).height = 4
  for (let c = 1; c <= 17; c++) ws.getRow(r).getCell(c).border = { bottom: { style: 'thin' as const, color: { argb: XL.GRAY200 } } }
  r++

  // ── 공급자 / 수신자 라벨 ──
  ws.getCell(`B${r}`).value = '공급자'
  xlStyle(ws.getCell(`B${r}`), { sz: 8, color: XL.GRAY500 })
  ws.getCell(`I${r}`).value = '수신자'
  xlStyle(ws.getCell(`I${r}`), { sz: 8, color: XL.GRAY500 })
  ws.getRow(r).height = 14
  r++

  // ── 회사명 + 도장 ──
  ws.mergeCells(`B${r}:G${r}`)
  ws.getCell(`B${r}`).value = d.supplier.companyName || ''
  xlStyle(ws.getCell(`B${r}`), { sz: 12, bold: true })
  ws.mergeCells(`I${r}:Q${r}`)
  ws.getCell(`I${r}`).value = d.receiver.companyName || ''
  xlStyle(ws.getCell(`I${r}`), { sz: 12, bold: true })
  ws.getRow(r).height = 22
  if (stampId !== null) ws.addImage(stampId, { tl: { col: 5, row: r - 1.5 }, ext: { width: 55, height: 55 } })
  r++

  // ── 공급자/수신자 상세 정보 ──
  const sPairs = [['사업자', d.supplier.bizNumber], ['대표자', d.supplier.ceoName], ['이메일', d.supplier.email], ['주소', d.supplier.address]].filter(([, v]) => v)
  const rPairs = [['사업자', d.receiver.bizNumber], ['수신자', d.receiver.recipientName], ['이메일', d.receiver.email], ['주소', d.receiver.address]].filter(([, v]) => v)
  for (let i = 0; i < Math.max(sPairs.length, rPairs.length); i++) {
    ws.getRow(r).height = 16
    if (i < sPairs.length) {
      ws.getCell(`B${r}`).value = sPairs[i][0]; xlStyle(ws.getCell(`B${r}`), { sz: 8, color: XL.GRAY500 })
      ws.mergeCells(`C${r}:G${r}`); ws.getCell(`C${r}`).value = sPairs[i][1]; xlStyle(ws.getCell(`C${r}`), { sz: 8 })
    }
    if (i < rPairs.length) {
      ws.getCell(`I${r}`).value = rPairs[i][0]; xlStyle(ws.getCell(`I${r}`), { sz: 8, color: XL.GRAY500 })
      ws.mergeCells(`J${r}:Q${r}`); ws.getCell(`J${r}`).value = rPairs[i][1]; xlStyle(ws.getCell(`J${r}`), { sz: 8 })
    }
    r++
  }

  ws.getRow(r).height = 8; r++ // 간격
  return r
}

/* ─────────────────────────────────────────────────────────
   아이템 테이블 + 소계 (간이/상세 공통)
   ───────────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function xlRenderItemsTable(ws: any, items: ItemRow[], d: QuoteExportData, r: number, showTitle: boolean): number {
  if (showTitle) {
    // 시트 제목 (시트 이름 사용 — "장비 내역서" / "설치비 내역서")
    ws.mergeCells(`A${r}:G${r}`)
    ws.getCell(`A${r}`).value = ws.name || '내역서'
    xlStyle(ws.getCell(`A${r}`), { sz: 14, bold: true })
    ws.getRow(r).height = 32; r++
    ws.getRow(r).height = 8; r++
  }

  // 섹션 라벨
  ws.mergeCells(`A${r}:G${r}`); ws.getCell(`A${r}`).value = '● 견적 내역'; xlStyle(ws.getCell(`A${r}`), { sz: 11, bold: true, color: XL.SLATE700 })
  ws.mergeCells(`I${r}:O${r}`); ws.getCell(`I${r}`).value = '● 원가 분석'; xlStyle(ws.getCell(`I${r}`), { sz: 11, bold: true, color: XL.SLATE700 })
  ws.getRow(r).height = 24; r++

  // 컬럼 헤더
  const hdrs = ['#', '품명', '모델/사양', '단위', '수량', '단가', '공급가', '', '반출가', 'DC율(%)', '매입단가', '매입총액', 'MG율(%)', '제안가', '이윤']
  ws.getRow(r).height = 26
  hdrs.forEach((h, i) => { const c = i + 1; if (c === 8) return; ws.getRow(r).getCell(c).value = h; xlStyle(ws.getRow(r).getCell(c), { sz: 9, bold: true, color: XL.SLATE500, bg: XL.SLATE100, bc: XL.SLATE300, align: 'center' }) })
  r++

  // 데이터 행
  items.forEach((item, idx) => {
    const vals: (string | number | null)[] = [idx + 1, item.item_name, item.specification, item.unit, item.quantity || null, item.unit_price || null, item.amount || null, null, item.retrieval_price || null, item.discount_rate || null, item.purchase_unit_price || null, item.purchase_amount || null, item.margin_rate || null, item.proposed_price || null, item.profit]
    ws.getRow(r).height = 22
    vals.forEach((v, i) => {
      const c = i + 1; if (c === 8) return
      const cell = ws.getRow(r).getCell(c); cell.value = v
      const isProfit = c === 15
      xlStyle(cell, {
        color: isProfit ? (item.profit > 0 ? XL.GREEN600 : item.profit < 0 ? XL.RED500 : XL.GRAY900) : XL.GRAY900,
        bold: isProfit && item.profit !== 0,
        bg: CALC_COLS.has(c) ? XL.GRAY100 : XL.WHITE, bc: XL.GRAY200,
        align: CENTER_COLS.has(c) ? 'center' : RIGHT_COLS.has(c) ? 'right' : 'left',
        fmt: NUM_COLS.has(c) && typeof v === 'number' ? '#,##0' : undefined,
      })
    })
    r++
  })

  // 소계
  const sumAmt = items.reduce((s, x) => s + x.amount, 0)
  const sumPur = items.reduce((s, x) => s + x.purchase_amount, 0)
  const sumPro = items.reduce((s, x) => s + x.profit, 0)
  ws.getRow(r).height = 24
  ws.mergeCells(`A${r}:F${r}`); ws.getRow(r).getCell(1).value = '소계'
  xlStyle(ws.getRow(r).getCell(1), { bold: true, color: XL.SLATE700, bg: XL.GRAY50, bc: XL.SLATE300, align: 'right' })
  for (let c = 2; c <= 6; c++) xlStyle(ws.getRow(r).getCell(c), { bg: XL.GRAY50, bc: XL.SLATE300 })
  const subMap = new Map<number, number>([[7, sumAmt], [12, sumPur], [15, sumPro]])
  for (let c = 7; c <= 15; c++) {
    if (c === 8) continue; const cell = ws.getRow(r).getCell(c); const sv = subMap.get(c); cell.value = sv ?? null
    xlStyle(cell, { bold: sv !== undefined, color: c === 15 ? (sumPro >= 0 ? XL.GREEN600 : XL.RED500) : XL.SLATE700, bg: XL.GRAY50, bc: XL.SLATE300, align: 'right', fmt: sv !== undefined ? '#,##0' : undefined })
  }
  r++
  return r
}

/* ─────────────────────────────────────────────────────────
   금액 + 원가 요약 렌더링
   ───────────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function xlRenderSummary(ws: any, d: QuoteExportData, r: number): number {
  r++ // 빈 줄
  ws.mergeCells(`A${r}:C${r}`); ws.getCell(`A${r}`).value = '● 금액 요약'; xlStyle(ws.getCell(`A${r}`), { sz: 11, bold: true, color: XL.SLATE700 })
  ws.mergeCells(`E${r}:G${r}`); ws.getCell(`E${r}`).value = '● 원가 분석 요약'; xlStyle(ws.getCell(`E${r}`), { sz: 11, bold: true, color: XL.SLATE700 })
  ws.getRow(r).height = 24; r++

  interface SE { label: string; value: number | string; bold?: boolean; red?: boolean; hl?: boolean; clr?: string }
  const leftSum: SE[] = [
    { label: '총 합계', value: d.totalAmount, bold: true },
    ...(d.truncationAmount > 0 ? [{ label: '단위절사', value: -d.truncationAmount, red: true }] : []),
    { label: '공급가액', value: d.supplyAmount }, { label: 'VAT (10%)', value: d.taxAmount },
    { label: '최종 견적', value: d.grandTotal, bold: true, hl: true },
  ]
  const rightSum: SE[] = [
    { label: '총 매입', value: d.totalPurchase },
    { label: '총 이윤', value: d.totalProfit, bold: true, clr: d.totalProfit >= 0 ? XL.GREEN600 : XL.RED500 },
    ...(d.totalAmount > 0 ? [{ label: '이윤율', value: `${((d.totalProfit / d.totalAmount) * 100).toFixed(1)}%` }] : []),
  ]
  for (let i = 0; i < Math.max(leftSum.length, rightSum.length); i++) {
    ws.getRow(r).height = 24
    const L = leftSum[i]; const R = rightSum[i]
    if (L) {
      ws.mergeCells(`A${r}:B${r}`); ws.getRow(r).getCell(1).value = L.label
      xlStyle(ws.getRow(r).getCell(1), { bold: true, color: L.red ? XL.RED500 : XL.GRAY500, bg: L.hl ? XL.SLATE100 : XL.GRAY50, bc: XL.GRAY200, align: 'right' })
      xlStyle(ws.getRow(r).getCell(2), { bg: L.hl ? XL.SLATE100 : XL.GRAY50, bc: XL.GRAY200 })
      ws.getRow(r).getCell(3).value = L.value
      xlStyle(ws.getRow(r).getCell(3), { bold: L.bold, color: L.red ? XL.RED500 : XL.GRAY900, bg: L.hl ? XL.SLATE100 : XL.WHITE, bc: XL.GRAY200, align: 'right', fmt: typeof L.value === 'number' ? '#,##0' : undefined })
    }
    if (R) {
      ws.mergeCells(`E${r}:F${r}`); ws.getRow(r).getCell(5).value = R.label
      xlStyle(ws.getRow(r).getCell(5), { bold: true, color: XL.GRAY500, bg: XL.GRAY50, bc: XL.GRAY200, align: 'right' })
      xlStyle(ws.getRow(r).getCell(6), { bg: XL.GRAY50, bc: XL.GRAY200 })
      ws.getRow(r).getCell(7).value = R.value
      xlStyle(ws.getRow(r).getCell(7), { bold: true, color: R.clr || XL.GRAY900, bg: XL.WHITE, bc: XL.GRAY200, align: 'right', fmt: typeof R.value === 'number' ? '#,##0' : undefined })
    }
    r++
  }
  return r
}

/* ─────────────────────────────────────────────────────────
   상세 견적서 — 갑지 + 내역서 통합 빌드
   갑지: 템플릿 기반 (장비/설치비 요약 2행, 원가분석 없음)
   내역서: 템플릿 15행 이하 구조 + 원가분석 포함
   ───────────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function xlBuildDetailedAllSheets(wb: any, d: QuoteExportData, validEquip: ItemRow[], validInstall: ItemRow[]): Promise<ArrayBuffer> {
  // 1. 갑지 빌드 (템플릿 기반)
  const coverBuf = await xlBuildDetailedCover(wb, d)

  // 2. 갑지 결과 로드 → 내역서 시트 추가
  const ExcelJS2 = await import('exceljs')
  const wb2 = new ExcelJS2.Workbook()
  await wb2.xlsx.load(coverBuf)

  // 갑지 시트 페이지 나누기 미리보기
  const coverWs = wb2.getWorksheet('견적서')
  if (coverWs) {
    coverWs.views = [{ showGridLines: false, style: 'pageBreakPreview' }]
  }

  // 로고 이미지 로드 → wb2에 추가
  const logoDataUrl = d.logoUrl ? await loadImageDataUrl(d.logoUrl) : null
  const logoId2 = xlAddImg(wb2, logoDataUrl)

  // 내역서 시트 생성 (갑지와 이질감 없는 깔끔한 스타일)
  if (validEquip.length) xlBuildItemSheet(wb2, '장비 내역서', validEquip, d, logoId2)
  if (validInstall.length) xlBuildItemSheet(wb2, '설치비 내역서', validInstall, d, logoId2)

  return await wb2.xlsx.writeBuffer() as ArrayBuffer
}

/* ─────────────────────────────────────────────────────────
   상세 견적서 — 내역서 시트 (최종 템플릿 0320 기준 100% 동일)
   ───────────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function xlBuildItemSheet(wb: any, name: string, items: ItemRow[], d: QuoteExportData, logoId: number | null = null) {
  const ws = wb.addWorksheet(name, { views: [{ showGridLines: false, style: 'pageBreakPreview' }] })

  // 컬럼 너비 — 최종 템플릿과 동일
  const widths = [
    3.7,                       // A (순번)
    5.7, 5.7, 5.7, 5.7, 5.7,  // B~F (품명 병합)
    9.7, 9.7, 9.7,             // G~I (모델/사양 병합)
    5.7, 5.7,                  // J~K (단위, 수량)
    5.7, 5.7, 5.7,             // L~N (단가 병합)
    8.7, 8.7,                  // O~P (공급가 병합)
    5.5, 5.5,                  // Q~R (비고 병합)
    1,                         // S (구분선)
    6, 10, 7, 10, 12, 7, 10, 12, 7, 12, // T~AC (원가분석)
  ]
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  const thin = { style: 'thin' as const }
  const hair = { style: 'hair' as const }
  const grayBg = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF3F4F6' } }
  const whiteBg = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { theme: 0 } }
  const bodyFont = { size: 9, name: '맑은 고딕' } as const

  // ── Row 1~3: 대제목 (3행 병합) ──
  ws.mergeCells('A1:R3')
  ws.getCell('A1').value = '세   부   내   역   서 [ Statement ]'
  ws.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF434343' }, name: 'Noto Sans KR' }
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getCell('A1').fill = whiteBg
  // 머지 후 master cell에 4면 테두리 → ExcelJS가 전체 머지 셀에 자동 전파
  ws.getCell('A1').border = { left: thin, right: thin, top: thin, bottom: thin }
  ws.getRow(1).height = 15
  ws.getRow(2).height = 15
  ws.getRow(3).height = 15

  // 로고 이미지 — 우측 상단 (O열 근처, 150×27px)
  if (logoId !== null) {
    ws.addImage(logoId, {
      tl: { nativeCol: 14, nativeColOff: 595439, nativeRow: 0, nativeRowOff: 150480 },
      ext: { width: 150.3, height: 26.6 },
      editAs: 'oneCell',
    })
  }

  // ── Row 4: 섹션 라벨 ──
  const sectionNum = name.includes('장비') ? '1' : '2'
  ws.getCell('A4').value = `  ${sectionNum}. ${name.replace(' 내역서', '')} 내역`
  ws.getCell('A4').font = { bold: true, size: 11, name: '맑은 고딕' }
  ws.getRow(4).height = 19.95

  // ── Row 5: 빈 구분선 ──
  ws.getRow(5).height = 4.8

  // ── Row 6: 컬럼 헤더 ──
  ws.mergeCells('B6:F6')
  ws.mergeCells('G6:I6')
  ws.mergeCells('L6:N6')
  ws.mergeCells('O6:P6')
  ws.mergeCells('Q6:R6')
  // 본문 헤더 — 상하 thin + 좌우 hair (A만 좌 thin, Q는 좌 없음)
  const mainHdrs: [string, string][] = [
    ['A', '순번'], ['B', '품  명'], ['G', '모델/사양'], ['J', '단위'], ['K', '수량'], ['L', '단  가'], ['O', '공 급 가'], ['Q', '비 고'],
  ]
  for (const [col, label] of mainHdrs) {
    const cell = ws.getCell(`${col}6`)
    cell.value = label
    cell.font = { ...bodyFont, bold: true }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.fill = grayBg
    // 헤더 테두리는 마지막에 일괄 적용
  }
  // 원가분석 헤더 (테두리 없음)
  const costHdrs: [string, string][] = [
    ['T', '구분'], ['U', '반출가'], ['V', 'DC율'], ['W', '매입단가'], ['X', '매입총액'], ['Y', 'MG율'], ['Z', '제안가'], ['AA', '이윤'], ['AB', '장려금%'], ['AC', '장려금'],
  ]
  for (const [col, label] of costHdrs) {
    const cell = ws.getCell(`${col}6`)
    cell.value = label
    cell.font = { size: 9, bold: true }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  }
  ws.getRow(6).height = 19.95

  const dataStartRow = 7

  // ── 데이터 행 (R7~) ──
  let r = dataStartRow
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    ws.getRow(r).height = 22.05
    ws.mergeCells(`B${r}:F${r}`)
    ws.mergeCells(`G${r}:I${r}`)
    ws.mergeCells(`L${r}:N${r}`)
    ws.mergeCells(`O${r}:P${r}`)
    ws.mergeCells(`Q${r}:R${r}`)

    // 본문 값
    ws.getCell(`A${r}`).value = i + 1
    ws.getCell(`B${r}`).value = item.item_name || null
    ws.getCell(`G${r}`).value = item.specification || null
    ws.getCell(`J${r}`).value = item.unit || null
    ws.getCell(`K${r}`).value = item.quantity || null

    if (item.retrieval_price < 0) {
      ws.getCell(`L${r}`).value = item.retrieval_price
    } else {
      ws.getCell(`L${r}`).value = { formula: `ROUNDUP(Z${r},-3)` }
    }
    ws.getCell(`O${r}`).value = { formula: `L${r}*K${r}` }

    // 본문 스타일 (테두리는 마지막에 일괄 적용)
    ws.getCell(`A${r}`).font = bodyFont
    ws.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' }
    for (const col of ['B', 'G']) {
      const cell = ws.getCell(`${col}${r}`)
      cell.font = bodyFont
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    }
    for (const col of ['J', 'K']) {
      const cell = ws.getCell(`${col}${r}`)
      cell.font = bodyFont
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    }
    ws.getCell(`L${r}`).font = bodyFont
    ws.getCell(`L${r}`).alignment = { horizontal: 'right', vertical: 'middle' }
    ws.getCell(`L${r}`).numFmt = '#,##0'
    ws.getCell(`O${r}`).font = bodyFont
    ws.getCell(`O${r}`).alignment = { horizontal: 'right', vertical: 'middle' }
    ws.getCell(`O${r}`).numFmt = '#,##0'

    // 원가분석
    ws.getCell(`T${r}`).value = name.includes('장비') ? '장비' : '설치비'
    ws.getCell(`U${r}`).value = item.retrieval_price || null
    ws.getCell(`V${r}`).value = item.discount_rate ? item.discount_rate / 100 : null
    ws.getCell(`Y${r}`).value = item.margin_rate ? item.margin_rate / 100 : null
    if (item.retrieval_price < 0) {
      ws.getCell(`W${r}`).value = 0
      ws.getCell(`X${r}`).value = 0
      ws.getCell(`Z${r}`).value = item.retrieval_price
      ws.getCell(`AA${r}`).value = { formula: `O${r}` }
    } else {
      ws.getCell(`W${r}`).value = { formula: `U${r}-(U${r}*V${r})` }
      ws.getCell(`X${r}`).value = { formula: `W${r}*K${r}` }
      ws.getCell(`Z${r}`).value = { formula: `W${r}+(W${r}*Y${r})` }
      ws.getCell(`AA${r}`).value = { formula: `O${r}-X${r}` }
    }
    ws.getCell(`AB${r}`).value = item.incentive_rate ? item.incentive_rate / 100 : null
    ws.getCell(`AC${r}`).value = { formula: `X${r}*AB${r}` }

    // 원가분석 스타일 (테두리 없이 값만, MG율=파랑, 이윤/장려금=빨강)
    for (const col of ['T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC']) {
      const cell = ws.getCell(`${col}${r}`)
      if (col === 'Y') {
        cell.font = { ...bodyFont, color: { argb: 'FF0070C0' } } // MG율 — 파랑
      } else if (['AA', 'AC'].includes(col)) {
        cell.font = { ...bodyFont, color: { argb: 'FFFF0000' } } // 이윤/장려금 — 빨강
      } else {
        cell.font = bodyFont
      }
      cell.alignment = { vertical: 'middle', horizontal: col === 'T' ? 'center' : 'right' }
      if (['U', 'W', 'X', 'Z', 'AA', 'AC'].includes(col)) cell.numFmt = '#,##0'
      if (['V', 'Y', 'AB'].includes(col)) cell.numFmt = '0%'
    }
    r++
  }
  const lastDataRow = r - 1

  // ── 소계 행 ──
  const section = name.replace(' 내역서', '').replace('장비', '장 비').replace('설치비', '설 치 비')
  ws.getRow(r).height = 28.05
  ws.mergeCells(`A${r}:K${r}`)
  ws.getCell(`A${r}`).value = `${section} 소 계 `
  ws.getCell(`A${r}`).font = { ...bodyFont, size: 11, bold: true }
  ws.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' }

  // 소계 금액 — L:P 병합
  ws.mergeCells(`L${r}:P${r}`)
  ws.getCell(`L${r}`).value = { formula: `SUM(O${dataStartRow}:P${lastDataRow})` }
  ws.getCell(`L${r}`).font = { ...bodyFont, size: 11, bold: true }
  ws.getCell(`L${r}`).alignment = { horizontal: 'right', vertical: 'middle' }
  ws.getCell(`L${r}`).numFmt = '#,##0'

  // Q:R 별도 병합
  ws.mergeCells(`Q${r}:R${r}`)
  ws.getCell(`Q${r}`).font = { ...bodyFont, size: 11 }

  // 이윤/장려금 합계
  const medBdr = { style: 'medium' as const }
  ws.getCell(`AA${r}`).value = { formula: `SUM(AA${dataStartRow}:AA${lastDataRow})` }
  ws.getCell(`AA${r}`).numFmt = '#,##0'
  ws.getCell(`AA${r}`).font = { ...bodyFont, bold: true }
  ws.getCell(`AA${r}`).border = { top: medBdr, bottom: medBdr, left: medBdr, right: medBdr }
  ws.getCell(`AC${r}`).value = { formula: `SUM(AC${dataStartRow}:AC${lastDataRow})` }
  ws.getCell(`AC${r}`).numFmt = '#,##0'
  ws.getCell(`AC${r}`).font = { ...bodyFont, bold: true }
  ws.getCell(`AC${r}`).border = { top: medBdr, bottom: medBdr, left: medBdr, right: medBdr }

  /* ══════ 테두리 일괄 적용 (인쇄 영역 A~R 전체) ══════ */

  // R1~R3: master cell 4면 테두리로 재확인 (위에서 이미 설정됨)
  ws.getCell('A1').border = { left: thin, right: thin, top: thin, bottom: thin }

  // R4~R5: 좌우 thin 엣지만
  for (let row = 4; row <= 5; row++) {
    ws.getRow(row).getCell(1).border = { left: thin }
    ws.getRow(row).getCell(18).border = { right: thin }
  }

  // R6: 헤더 — 모든 셀 상하 thin + 내부 좌우 hair + 양끝 thin
  for (let c = 1; c <= 18; c++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bd: any = { top: thin, bottom: thin }
    if (c === 1) { bd.left = thin; bd.right = hair }         // A
    else if (c <= 16) { bd.left = hair; bd.right = hair }    // B~P
    else if (c === 17) { bd.right = hair }                   // Q (좌 없음)
    else { bd.right = thin }                                  // R
    ws.getRow(6).getCell(c).border = bd
  }

  // R7~lastDataRow: 세로 구분선만 + 양끝 thin
  for (let row = dataStartRow; row <= lastDataRow; row++) {
    ws.getRow(row).getCell(1).border = { left: thin, right: hair }                  // A
    for (let c = 2; c <= 9; c++) ws.getRow(row).getCell(c).border = { left: hair }  // B~I
    ws.getRow(row).getCell(10).border = { left: hair, right: hair }                 // J
    ws.getRow(row).getCell(11).border = { left: hair, right: hair }                 // K
    for (let c = 12; c <= 15; c++) ws.getRow(row).getCell(c).border = { left: hair } // L~O
    ws.getRow(row).getCell(16).border = { left: hair, right: hair }                  // P
    // Q(17): 테두리 없음
    ws.getRow(row).getCell(18).border = { right: thin }                              // R
  }

  // 마지막 데이터행: O(15)~P(16) 하단 thin 추가 (소계 상단 구분선)
  if (lastDataRow >= dataStartRow) {
    ws.getRow(lastDataRow).getCell(15).border = { left: hair, bottom: thin }
    ws.getRow(lastDataRow).getCell(16).border = { left: hair, right: hair, bottom: thin }
  }

  // 소계행(r): 모든 셀 개별 테두리
  for (let c = 1; c <= 10; c++) ws.getRow(r).getCell(c).border = { left: thin, top: thin, bottom: thin }  // A~J
  ws.getRow(r).getCell(11).border = { left: thin, right: thin, top: thin, bottom: thin }                   // K
  for (let c = 12; c <= 16; c++) ws.getRow(r).getCell(c).border = { right: thin, top: thin, bottom: thin } // L~P
  ws.getRow(r).getCell(17).border = { left: thin, top: thin, bottom: thin }                                 // Q
  ws.getRow(r).getCell(18).border = { left: thin, right: thin, top: thin, bottom: thin }                    // R

  // 인쇄 설정 — xvf1.xlsx 기준 (scale 68%, fitToHeight 1, A4 용지)
  ws.pageSetup.printArea = `A1:R${r}`
  ws.pageSetup.fitToPage = true
  ws.pageSetup.fitToWidth = 1
  ws.pageSetup.fitToHeight = 1
  ws.pageSetup.scale = 68
  ws.pageSetup.paperSize = 9
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function xlBuildDetailedCover(wb: any, d: QuoteExportData): Promise<ArrayBuffer> {
  // 템플릿 파일 로드 (간이 견적서와 동일한 템플릿 사용)
  let buf: ArrayBuffer
  try {
    const storageRes = await fetch('/api/quote-template')
    if (storageRes.ok && storageRes.headers.get('content-type')?.includes('spreadsheet')) {
      buf = await storageRes.arrayBuffer()
    } else {
      throw new Error('Storage 응답 실패')
    }
  } catch {
    const localRes = await fetch('/templates/quote-template.xlsx')
    buf = await localRes.arrayBuffer()
  }

  // 원본 drawing XML 보존 (도장 투명 배경 등)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jszipMod = await import('jszip') as any
  const JSZip = jszipMod.default || jszipMod
  const origZip = await JSZip.loadAsync(buf)
  const origDrawingXml = await origZip.file('xl/drawings/drawing1.xml')?.async('string') ?? null
  const origDrawingRels = await origZip.file('xl/drawings/_rels/drawing1.xml.rels')?.async('string') ?? null
  const origMedia: Record<string, Uint8Array> = {}
  for (const [path, file] of Object.entries(origZip.files)) {
    if (path.startsWith('xl/media/') && !(file as {dir:boolean}).dir) {
      origMedia[path] = await (file as {async:(t:string)=>Promise<Uint8Array>}).async('uint8array')
    }
  }

  await wb.xlsx.load(buf)

  const ws = wb.getWorksheet('견적서')
  if (!ws) throw new Error('템플릿에 "견적서" 시트가 없습니다')

  // 갑지 아이템: 장비내역 + 설치비내역 + coverItems
  const allItems = [
    { item_name: d.coverEquipLabel.name, specification: d.coverEquipLabel.desc, unit: '식', quantity: 1, unit_price: d.equipTotal, _isFixed: true },
    { item_name: d.coverInstallLabel.name, specification: d.coverInstallLabel.desc, unit: '식', quantity: 1, unit_price: d.installTotal, _isFixed: true },
    ...d.coverItems.filter(hasData).map(ci => ({
      item_name: ci.item_name, specification: ci.specification, unit: ci.unit || '식',
      quantity: ci.quantity, unit_price: ci.unit_price, _isFixed: false,
    })),
  ]

  // 행 삽입: 15행 초과 시 duplicateRow
  const TEMPLATE_DATA_ROWS = 15
  const extraRows = Math.max(0, allItems.length - TEMPLATE_DATA_ROWS)

  if (extraRows > 0) {
    ws.duplicateRow(30, extraRows, true)
    const oldFooterMerges = [
      'A31:K31', 'L31:R31', 'A32:K32', 'L32:R32',
      'A33:K33', 'L33:R33', 'A35:E35', 'A36:R41',
    ]
    for (const m of oldFooterMerges) {
      try { ws.unMergeCells(m) } catch { /* 무시 */ }
    }
    for (let i = 0; i < extraRows; i++) {
      const r = 31 + i
      ws.mergeCells(`B${r}:F${r}`)
      ws.mergeCells(`G${r}:I${r}`)
      ws.mergeCells(`L${r}:N${r}`)
      ws.mergeCells(`O${r}:P${r}`)
      ws.mergeCells(`Q${r}:R${r}`)
    }
    const lastDataRow = 30 + extraRows
    const sumRow = 31 + extraRows
    const vatRow = 32 + extraRows
    const totalRow = 33 + extraRows
    const noteLabelRow = 35 + extraRows
    const noteStartRow = 36 + extraRows
    const noteEndRow = 41 + extraRows
    ws.mergeCells(`A${sumRow}:K${sumRow}`)
    ws.mergeCells(`L${sumRow}:R${sumRow}`)
    ws.mergeCells(`A${vatRow}:K${vatRow}`)
    ws.mergeCells(`L${vatRow}:R${vatRow}`)
    ws.mergeCells(`A${totalRow}:K${totalRow}`)
    ws.mergeCells(`L${totalRow}:R${totalRow}`)
    ws.mergeCells(`A${noteLabelRow}:E${noteLabelRow}`)
    ws.mergeCells(`A${noteStartRow}:R${noteEndRow}`)
    ws.getCell(`L${sumRow}`).value = { formula: `SUM(O16:P${lastDataRow})` }
    ws.getCell(`L${vatRow}`).value = { formula: `L${sumRow}*0.1` }
    ws.getCell(`L${totalRow}`).value = { formula: `SUM(L${sumRow}:R${vatRow})` }
    ws.getCell('D13').value = { formula: `NUMBERSTRING(L${totalRow},1)` }
    ws.getCell('M13').value = { formula: `L${totalRow}` }
  }

  // 헤더 정보 채우기 (간이 견적서와 동일)
  ws.getCell('A6').value = `${d.receiver.companyName || ''} 귀하`
  ws.getCell('D7').value = d.receiver.recipientName || ''
  ws.getCell('M7').value = d.supplier.bizNumber || ''
  ws.getCell('P7').value = d.supplier.ceoName || ''
  ws.getCell('D8').value = `${d.deliveryDate || '협의 일정'} / ${d.deliveryPlace || '협의 장소'}`
  ws.getCell('M8').value = d.supplier.address || ''
  ws.getCell('D9').value = d.paymentCondition || '협의 조건'
  ws.getCell('M9').value = d.supplier.managerPhone || ''
  ws.getCell('D10').value = d.quotationDate || ''
  ws.getCell('D11').value = d.validUntil || '견적 후 7일'
  ws.getCell('M11').value = d.supplier.manager || ''
  ws.getCell('P11').value = d.supplier.managerPhone || ''

  // 특이사항
  const notesRow = 36 + extraRows
  if (d.notes) {
    const notesCell = ws.getCell(`A${notesRow}`)
    notesCell.value = d.notes
    notesCell.alignment = { vertical: 'top', wrapText: true }
  }

  // 기존 데이터 행 초기화 (R16~R30+extraRows) — 본문만, 원가분석은 비워둠
  const lastDataRow = 30 + extraRows
  for (let r = 16; r <= lastDataRow; r++) {
    for (const col of ['A', 'B', 'G', 'J', 'K', 'L', 'O', 'Q']) {
      ws.getCell(`${col}${r}`).value = null
    }
    // 원가분석 영역도 비움 (갑지에는 원가분석 불필요)
    for (const col of ['T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC']) {
      ws.getCell(`${col}${r}`).value = null
    }
  }

  // S~AF 열 헤더 값 제거 (갑지에는 원가분석 헤더 불필요)
  for (let c = 19; c <= 32; c++) { // S(19) ~ AF(32)
    ws.getRow(15).getCell(c).value = null
  }

  // 데이터 행 채우기 (장비/설치비 요약 + coverItems)
  for (let i = 0; i < allItems.length; i++) {
    const row = 16 + i
    const item = allItems[i]
    ws.getCell(`A${row}`).value = i + 1                          // 순번
    ws.getCell(`B${row}`).value = item.item_name || null         // 품명
    ws.getCell(`G${row}`).value = item.specification || null     // 모델/사양
    ws.getCell(`J${row}`).value = item.unit || null              // 단위
    ws.getCell(`K${row}`).value = item.quantity || null          // 수량
    ws.getCell(`L${row}`).value = item.unit_price || null        // 단가 (직접 값)
    ws.getCell(`O${row}`).value = { formula: `L${row}*K${row}` } // 공급가
    // 원가분석 안 넣음 (갑지이므로)
  }

  // 합계 행 수식
  const sumRow = 31 + extraRows
  // 원가분석 합계는 불필요하므로 생략

  // S~AF 합계행 값도 제거 (템플릿에 남아있는 원가분석 수식 제거)
  for (let c = 19; c <= 32; c++) {
    ws.getRow(sumRow).getCell(c).value = null
  }

  // 테두리 보정
  const thinBorder = { style: 'thin' as const }
  const hairBorder = { style: 'hair' as const }
  const vatRow = sumRow + 1
  const totalRow = sumRow + 2
  for (let r = 16; r <= lastDataRow; r++) {
    const cellA = ws.getCell(`A${r}`)
    cellA.border = { ...cellA.border, left: thinBorder }
    const cellR = ws.getCell(`R${r}`)
    cellR.border = { ...cellR.border, right: thinBorder }
  }
  ws.getCell(`R${sumRow}`).border = { ...ws.getCell(`R${sumRow}`).border, right: thinBorder, top: thinBorder, bottom: hairBorder }
  ws.getCell(`R${vatRow}`).border = { ...ws.getCell(`R${vatRow}`).border, right: thinBorder, top: hairBorder, bottom: hairBorder }
  ws.getCell(`R${totalRow}`).border = { ...ws.getCell(`R${totalRow}`).border, right: thinBorder, top: hairBorder, bottom: thinBorder }

  const noteStartRow = totalRow + 3
  const noteEndRow = totalRow + 8
  for (let r = noteStartRow; r <= noteEndRow; r++) {
    const cellR = ws.getCell(`R${r}`)
    if (r === noteEndRow) {
      cellR.border = { ...cellR.border, right: thinBorder, bottom: thinBorder }
      for (let c = 1; c <= 17; c++) {
        const cell = ws.getCell(r, c)
        cell.border = { ...cell.border, bottom: thinBorder }
      }
    } else {
      cellR.border = { ...cellR.border, right: thinBorder }
    }
  }

  // 인쇄영역 — A~R 열만 (원가분석 제외)
  ws.pageSetup.printArea = `A1:R${noteEndRow}`

  // 워크북 출력 → drawing XML 복원
  const outArrayBuf = await wb.xlsx.writeBuffer()
  if (origDrawingXml) {
    const outZip = await JSZip.loadAsync(outArrayBuf)
    outZip.file('xl/drawings/drawing1.xml', origDrawingXml)
    if (origDrawingRels) {
      outZip.file('xl/drawings/_rels/drawing1.xml.rels', origDrawingRels)
    }
    for (const [p, data] of Object.entries(origMedia)) {
      outZip.file(p, data)
    }
    return await outZip.generateAsync({ type: 'arraybuffer' })
  }
  return outArrayBuf
}

/* ─────────────────────────────────────────────────────────
   상세 견적서 — 갑지 시트 (구버전, 참조용 보존)
   ───────────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function xlBuildCoverSheet(wb: any, d: QuoteExportData, logoId: number | null, stampId: number | null) {
  const ws = wb.addWorksheet('갑지', { properties: { defaultRowHeight: 20 }, views: [{ showGridLines: false }] })
  // 8열 (순번~비고) — 갑지 전용
  ws.columns = [
    { width: 8 }, { width: 14 }, { width: 36 }, { width: 8 },
    { width: 10 }, { width: 16 }, { width: 18 }, { width: 14 },
  ]
  let r = 1

  // ── "견  적  서" 대제목 ──
  ws.getRow(r).height = 10; r++
  ws.mergeCells(`A${r}:H${r}`)
  ws.getCell(`A${r}`).value = '견  적  서'
  xlStyle(ws.getCell(`A${r}`), { sz: 22, bold: true, align: 'center' })
  ws.getRow(r).height = 36; r++
  ws.mergeCells(`A${r}:H${r}`)
  ws.getCell(`A${r}`).value = 'Quotation'
  xlStyle(ws.getCell(`A${r}`), { sz: 9, color: XL.GRAY500, align: 'center' })
  ws.getRow(r).height = 16; r++

  // ── 굵은 구분선 ──
  ws.getRow(r).height = 4
  for (let c = 1; c <= 8; c++) ws.getRow(r).getCell(c).border = { bottom: { style: 'medium' as const, color: { argb: XL.GRAY900 } } }
  r++

  // ── 회사 정보 + 로고 + 도장 ──
  if (logoId !== null) ws.addImage(logoId, { tl: { col: 0.2, row: r - 0.5 }, ext: { width: 100, height: 30 } })
  if (stampId !== null) ws.addImage(stampId, { tl: { col: 6.5, row: r - 0.5 }, ext: { width: 50, height: 50 } })
  ws.mergeCells(`B${r}:F${r}`)
  ws.getCell(`B${r}`).value = d.supplier.companyName || ''
  xlStyle(ws.getCell(`B${r}`), { sz: 11, bold: true })
  ws.getRow(r).height = 16; r++
  if (d.supplier.address) {
    ws.mergeCells(`B${r}:F${r}`); ws.getCell(`B${r}`).value = `A. ${d.supplier.address}`; xlStyle(ws.getCell(`B${r}`), { sz: 8, color: XL.GRAY500 })
    ws.getRow(r).height = 14; r++
  }
  if (d.supplier.email) {
    ws.mergeCells(`B${r}:F${r}`); ws.getCell(`B${r}`).value = `E. ${d.supplier.email}`; xlStyle(ws.getCell(`B${r}`), { sz: 8, color: XL.GRAY500 })
    ws.getRow(r).height = 14; r++
  }

  // ── 얇은 구분선 ──
  ws.getRow(r).height = 4
  for (let c = 1; c <= 8; c++) ws.getRow(r).getCell(c).border = { bottom: { style: 'thin' as const, color: { argb: XL.GRAY200 } } }
  r++

  // ── 3단 정보 그리드 (받는분 / 견적 / 납기) ──
  // 헤더
  ws.mergeCells(`A${r}:C${r}`); ws.getCell(`A${r}`).value = '● 받는분 정보'; xlStyle(ws.getCell(`A${r}`), { sz: 9, bold: true, color: XL.SLATE700, bc: XL.GRAY200, bg: XL.GRAY50 })
  ws.mergeCells(`D${r}:F${r}`); ws.getCell(`D${r}`).value = '● 견적정보'; xlStyle(ws.getCell(`D${r}`), { sz: 9, bold: true, color: XL.SLATE700, bc: XL.GRAY200, bg: XL.GRAY50 })
  ws.mergeCells(`G${r}:H${r}`); ws.getCell(`G${r}`).value = '● 납기 / 결제정보'; xlStyle(ws.getCell(`G${r}`), { sz: 9, bold: true, color: XL.SLATE700, bc: XL.GRAY200, bg: XL.GRAY50 })
  ws.getRow(r).height = 22; r++

  // 정보 행 3줄
  const gridRows = [
    [['수 신 처', d.receiver.companyName], ['견 적 일', d.quotationDate], ['납기일자', d.deliveryDate || '협의 일정']],
    [['담 당 자', d.receiver.recipientName], ['담 당 자', d.supplier.manager], ['납기장소', d.deliveryPlace || '협의 장소']],
    [['연 락 처', d.receiver.phone], ['연 락 처', d.supplier.managerPhone], ['결제조건', d.paymentCondition || '협의 조건']],
  ]
  for (const row of gridRows) {
    ws.getRow(r).height = 20
    // 섹션 1 (A=label, B:C=value)
    ws.getCell(`A${r}`).value = row[0][0]; xlStyle(ws.getCell(`A${r}`), { sz: 8, color: XL.GRAY500, bc: XL.GRAY200 })
    ws.mergeCells(`B${r}:C${r}`); ws.getCell(`B${r}`).value = row[0][1] || '-'; xlStyle(ws.getCell(`B${r}`), { sz: 8, bc: XL.GRAY200 })
    // 섹션 2 (D=label, E:F=value)
    ws.getCell(`D${r}`).value = row[1][0]; xlStyle(ws.getCell(`D${r}`), { sz: 8, color: XL.GRAY500, bc: XL.GRAY200 })
    ws.mergeCells(`E${r}:F${r}`); ws.getCell(`E${r}`).value = row[1][1] || '-'; xlStyle(ws.getCell(`E${r}`), { sz: 8, bc: XL.GRAY200 })
    // 섹션 3 (G=label, H=value)
    ws.getCell(`G${r}`).value = row[2][0]; xlStyle(ws.getCell(`G${r}`), { sz: 8, color: XL.GRAY500, bc: XL.GRAY200 })
    ws.getCell(`H${r}`).value = row[2][1] || '-'; xlStyle(ws.getCell(`H${r}`), { sz: 8, bc: XL.GRAY200 })
    r++
  }

  ws.getRow(r).height = 6; r++ // 간격

  // ── 현장명 ──
  ws.mergeCells(`A${r}:H${r}`)
  ws.getCell(`A${r}`).value = `현장명: ${d.title || '-'}`
  xlStyle(ws.getCell(`A${r}`), { sz: 10, bold: true })
  ws.getRow(r).height = 22; r++

  // ── 갑지 테이블 ──
  const coverHdrs = ['순번', '구 분', '내 용', '단위', '수량', '단 가', '공 급 가', '비 고']
  ws.getRow(r).height = 24
  coverHdrs.forEach((h, i) => { ws.getRow(r).getCell(i + 1).value = h; xlStyle(ws.getRow(r).getCell(i + 1), { sz: 9, bold: true, color: XL.SLATE700, bg: XL.GRAY100, bc: XL.GRAY200, align: 'center' }) })
  r++

  // 고정행: 장비 + 설치비
  const fixedRows = [
    [1, d.coverEquipLabel.name, d.coverEquipLabel.desc, '식', 1, d.equipTotal, d.equipTotal, ''],
    [2, d.coverInstallLabel.name, d.coverInstallLabel.desc, '식', 1, d.installTotal, d.installTotal, ''],
  ]
  const validCover = d.coverItems.filter(hasData)
  validCover.forEach((ci, i) => fixedRows.push([i + 3, ci.item_name, ci.specification, ci.unit, ci.quantity || '', ci.unit_price || '', ci.amount || '', ci.memo || '']))

  // 빈 행 채우기 (최소 8행)
  const emptyStart = fixedRows.length
  while (fixedRows.length < 8) fixedRows.push(['', '', '', '', '', '', '', ''])

  fixedRows.forEach((row, idx) => {
    ws.getRow(r).height = 22
    row.forEach((v, ci) => {
      const cell = ws.getRow(r).getCell(ci + 1)
      cell.value = v === '' ? null : v
      const isEmpty = idx >= emptyStart
      xlStyle(cell, {
        sz: 9, bold: ci === 6 && idx < emptyStart,
        bg: idx < 2 ? XL.GRAY50 : XL.WHITE,
        bc: isEmpty ? XL.WHITE : XL.GRAY200,
        align: ci === 0 || ci === 3 || ci === 4 ? 'center' : ci >= 5 ? 'right' : 'left',
        fmt: typeof v === 'number' ? '#,##0' : undefined,
      })
    })
    r++
  })

  // ── 비고 + 금액 요약 ──
  r++ // 빈 줄

  // 비고 (좌측 A:D)
  ws.mergeCells(`A${r}:A${r + 4}`)
  ws.getCell(`A${r}`).value = '※ 비 고'
  xlStyle(ws.getCell(`A${r}`), { sz: 8, bold: true, color: XL.SLATE700, bc: XL.GRAY200 })
  if (d.notes) {
    ws.mergeCells(`B${r}:D${r + 4}`)
    ws.getCell(`B${r}`).value = d.notes
    xlStyle(ws.getCell(`B${r}`), { sz: 8, color: XL.GRAY500, bc: XL.GRAY200 })
  }

  // 금액 요약 (우측 E:H)
  const coverSumRows = [
    { label: '합  계', value: d.totalAmount, bold: false },
    ...(d.truncationAmount > 0 ? [{ label: '단위절사', value: -d.truncationAmount, bold: false, red: true }] : []),
    { label: '견적금액', value: d.supplyAmount, bold: false },
    { label: '부 가 세', value: d.taxAmount, bold: false },
    { label: '최종견적', value: d.grandTotal, bold: true, hl: true },
  ]
  let sr = r
  for (const row of coverSumRows) {
    const isRed = 'red' in row && row.red
    const isHl = 'hl' in row && row.hl
    // 라벨 (E:F)
    ws.mergeCells(`E${sr}:F${sr}`)
    ws.getCell(`E${sr}`).value = row.label
    xlStyle(ws.getCell(`E${sr}`), { sz: 9, bold: true, color: isRed ? XL.RED500 : XL.GRAY500, bg: isHl ? XL.SLATE100 : XL.GRAY50, bc: XL.GRAY200, align: 'right' })
    xlStyle(ws.getRow(sr).getCell(6), { bg: isHl ? XL.SLATE100 : XL.GRAY50, bc: XL.GRAY200 })
    // 값 (G:H)
    ws.mergeCells(`G${sr}:H${sr}`)
    ws.getCell(`G${sr}`).value = row.value
    xlStyle(ws.getCell(`G${sr}`), { sz: isHl ? 11 : 9, bold: row.bold, color: isRed ? XL.RED500 : XL.GRAY900, bg: isHl ? XL.SLATE100 : XL.WHITE, bc: XL.GRAY200, align: 'right', fmt: '#,##0' })
    ws.getRow(sr).height = isHl ? 28 : 22
    sr++
  }
}

/* ─────────────────────────────────────────────────────────
   간이 견적서 — 엑셀 템플릿 파일에 데이터만 채워넣기
   서식/수식/병합/테두리 100% 보존, 데이터만 기록
   ───────────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function xlBuildSimpleFromTemplate(wb: any, d: QuoteExportData): Promise<ArrayBuffer> {
  // 템플릿 파일 로드 (Supabase Storage → 로컬 폴백)
  let buf: ArrayBuffer
  try {
    const storageRes = await fetch('/api/quote-template')
    if (storageRes.ok && storageRes.headers.get('content-type')?.includes('spreadsheet')) {
      buf = await storageRes.arrayBuffer()
    } else {
      throw new Error('Storage 응답 실패')
    }
  } catch {
    // API 실패 시 로컬 파일 폴백
    const localRes = await fetch('/templates/quote-template.xlsx')
    buf = await localRes.arrayBuffer()
  }

  // ── 원본 템플릿의 drawing XML 보존 ──
  // ExcelJS가 로드/저장 과정에서 <a:clrChange> (도장 투명 배경) 등
  // 커스텀 drawing 속성을 제거하므로, 원본 XML을 보존했다가 나중에 복원한다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jszipMod = await import('jszip') as any
  const JSZip = jszipMod.default || jszipMod
  const origZip = await JSZip.loadAsync(buf)
  const origDrawingXml = await origZip.file('xl/drawings/drawing1.xml')?.async('string') ?? null
  const origDrawingRels = await origZip.file('xl/drawings/_rels/drawing1.xml.rels')?.async('string') ?? null
  // 원본 미디어 파일(로고, 도장 이미지)도 보존
  const origMedia: Record<string, Uint8Array> = {}
  for (const [path, file] of Object.entries(origZip.files) as [string, any][]) {
    if (path.startsWith('xl/media/') && !file.dir) {
      origMedia[path] = await file.async('uint8array')
    }
  }

  await wb.xlsx.load(buf)

  const ws = wb.getWorksheet('견적서')
  if (!ws) throw new Error('템플릿에 "견적서" 시트가 없습니다')

  // 장비+설치비 합쳐서 순번 이어지게
  const equipFiltered = d.equipItems.filter(hasData)
  const installFiltered = d.installItems.filter(hasData)
  const allItems = [
    ...equipFiltered.map(item => ({ ...item, _section: '장비' })),
    ...installFiltered.map(item => ({ ...item, _section: '설치비' })),
  ]

  /* ══════ 행 삽입: 15행(R16~R30) 초과 시 duplicateRow로 추가 ══════ */
  const TEMPLATE_DATA_ROWS = 15 // 템플릿 기본 데이터 행 수 (R16~R30)
  const extraRows = Math.max(0, allItems.length - TEMPLATE_DATA_ROWS)

  if (extraRows > 0) {
    // R30(마지막 데이터 행)을 복제 → 데이터/스타일 복사, 아래 행들 자동으로 밀림
    ws.duplicateRow(30, extraRows, true)

    // ── duplicateRow 버그 수정: 머지가 안 밀리므로 수동 보정 ──

    // 1) 잘못된 위치에 남아있는 footer 머지 제거
    const oldFooterMerges = [
      'A31:K31', 'L31:R31',   // 합계
      'A32:K32', 'L32:R32',   // 부가세
      'A33:K33', 'L33:R33',   // 총계
      'A35:E35',               // 특이사항 라벨
      'A36:R41',               // 특이사항 내용
    ]
    for (const m of oldFooterMerges) {
      try { ws.unMergeCells(m) } catch { /* 이미 없으면 무시 */ }
    }

    // 2) 복제된 데이터 행에 올바른 머지 추가 (품명/사양/단가/공급가/비고)
    for (let i = 0; i < extraRows; i++) {
      const r = 31 + i
      ws.mergeCells(`B${r}:F${r}`)
      ws.mergeCells(`G${r}:I${r}`)
      ws.mergeCells(`L${r}:N${r}`)
      ws.mergeCells(`O${r}:P${r}`)
      ws.mergeCells(`Q${r}:R${r}`)
    }

    // 3) footer 머지를 새 위치에 복원
    const lastDataRow = 30 + extraRows
    const sumRow = 31 + extraRows
    const vatRow = 32 + extraRows
    const totalRow = 33 + extraRows
    const noteLabelRow = 35 + extraRows
    const noteStartRow = 36 + extraRows
    const noteEndRow = 41 + extraRows

    ws.mergeCells(`A${sumRow}:K${sumRow}`)
    ws.mergeCells(`L${sumRow}:R${sumRow}`)
    ws.mergeCells(`A${vatRow}:K${vatRow}`)
    ws.mergeCells(`L${vatRow}:R${vatRow}`)
    ws.mergeCells(`A${totalRow}:K${totalRow}`)
    ws.mergeCells(`L${totalRow}:R${totalRow}`)
    ws.mergeCells(`A${noteLabelRow}:E${noteLabelRow}`)
    ws.mergeCells(`A${noteStartRow}:R${noteEndRow}`)

    // 4) 합계/부가세/총계 수식 업데이트 (행 번호가 밀렸으므로)
    ws.getCell(`L${sumRow}`).value = { formula: `SUM(O16:P${lastDataRow})` }
    ws.getCell(`L${vatRow}`).value = { formula: `L${sumRow}*0.1` }
    ws.getCell(`L${totalRow}`).value = { formula: `SUM(L${sumRow}:R${vatRow})` }

    // R13 합계금액 수식도 총계 행 참조 업데이트
    ws.getCell('D13').value = { formula: `NUMBERSTRING(L${totalRow},1)` }
    ws.getCell('M13').value = { formula: `L${totalRow}` }
  }

  /* ══════ 헤더 정보 채우기 ══════ */
  // Row 6: 수신처 귀하
  ws.getCell('A6').value = `${d.receiver.companyName || ''} 귀하`
  // Row 7: 담당자 / 등록번호 / 성명
  ws.getCell('D7').value = d.receiver.recipientName || ''
  ws.getCell('M7').value = d.supplier.bizNumber || ''
  ws.getCell('P7').value = d.supplier.ceoName || ''
  // Row 8: 납기/장소 / 사업장주소
  ws.getCell('D8').value = `${d.deliveryDate || '협의 일정'} / ${d.deliveryPlace || '협의 장소'}`
  ws.getCell('M8').value = d.supplier.address || ''
  // Row 9: 결제조건 / 전화번호
  ws.getCell('D9').value = d.paymentCondition || '협의 조건'
  ws.getCell('M9').value = d.supplier.managerPhone || ''
  // Row 10: 견적일자
  ws.getCell('D10').value = d.quotationDate || ''
  // Row 11: 유효기간 / 견적담당 / Mobile
  ws.getCell('D11').value = d.validUntil || '견적 후 7일'
  ws.getCell('M11').value = d.supplier.manager || ''
  ws.getCell('P11').value = d.supplier.managerPhone || ''

  // 특이사항 (행 삽입 후 밀린 위치에 기록)
  const notesRow = 36 + extraRows
  if (d.notes) {
    const notesCell = ws.getCell(`A${notesRow}`)
    notesCell.value = d.notes
    notesCell.alignment = { vertical: 'top', wrapText: true }
  }

  // 도장/로고는 템플릿에 이미 포함되어 있으므로 별도 추가 불필요

  /* ══════ 기존 템플릿 데이터 행 초기화 (R16~R30+extraRows) ══════ */
  // 템플릿에 샘플 데이터가 남아있으므로, 새 데이터를 채우기 전에 전부 비운다
  const lastDataRow = 30 + extraRows
  for (let r = 16; r <= lastDataRow; r++) {
    // 본문 영역 (A~R) 값만 비움 (스타일/머지는 유지)
    for (const col of ['A', 'B', 'G', 'J', 'K', 'L', 'O', 'Q']) {
      ws.getCell(`${col}${r}`).value = null
    }
    // 원가분석 영역 (T~AC) 값 비움
    for (const col of ['T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC']) {
      ws.getCell(`${col}${r}`).value = null
    }
  }

  /* ══════ 데이터 행 채우기 (전체 아이템, 행 수 제한 없음) ══════ */
  for (let i = 0; i < allItems.length; i++) {
    const row = 16 + i
    const item = allItems[i]

    // 견적서 본문
    ws.getCell(`A${row}`).value = i + 1                          // 순번
    ws.getCell(`B${row}`).value = item.item_name || null         // 품명
    ws.getCell(`G${row}`).value = item.specification || null     // 모델/사양 (G:I 머지 영역)
    ws.getCell(`J${row}`).value = item.unit || null              // 단위
    ws.getCell(`K${row}`).value = item.quantity || null          // 수량
    ws.getCell(`L${row}`).value = { formula: `ROUNDUP(Z${row},-3)` }  // 단가 = 제안가(Z) 1000원 단위 올림

    // 공급가 수식 — sharedFormula 깨짐 방지를 위해 명시적으로 설정
    ws.getCell(`O${row}`).value = { formula: `L${row}*K${row}` }

    // 원가분석 — 입력값
    ws.getCell(`T${row}`).value = item._section                                              // 구분 (장비/설치비)
    ws.getCell(`U${row}`).value = item.retrieval_price || null                                // 반출가
    ws.getCell(`V${row}`).value = item.discount_rate ? item.discount_rate / 100 : null        // DC율 (45 → 0.45, 셀 포맷 0%)
    ws.getCell(`Y${row}`).value = item.margin_rate ? item.margin_rate / 100 : null            // MG율 (10 → 0.10, 셀 포맷 0%)

    if (item.retrieval_price < 0) {
      // 음수 반출가 = 단위절사/할인 항목: 매입 없음, 금액만 차감
      ws.getCell(`W${row}`).value = 0                                            // 매입단가 = 0
      ws.getCell(`X${row}`).value = 0                                            // 매입총액 = 0
      ws.getCell(`Z${row}`).value = item.retrieval_price                         // 제안가 = 반출가 그대로
      ws.getCell(`AA${row}`).value = { formula: `O${row}` }                      // 이윤 = 공급가 (매입 없으므로)
    } else {
      // 원가분석 수식 — sharedFormula 깨짐 방지를 위해 명시적으로 설정
      ws.getCell(`W${row}`).value = { formula: `U${row}-(U${row}*V${row})` }     // 매입단가
      ws.getCell(`X${row}`).value = { formula: `W${row}*K${row}` }               // 매입총액
      ws.getCell(`Z${row}`).value = { formula: `W${row}+(W${row}*Y${row})` }     // 제안가
      ws.getCell(`AA${row}`).value = { formula: `O${row}-X${row}` }              // 이윤
    }
    ws.getCell(`AB${row}`).value = item.incentive_rate ? item.incentive_rate / 100 : null  // 장려금% (6 → 0.06, 셀 포맷 0%)
    ws.getCell(`AC${row}`).value = { formula: `X${row}*AB${row}` }             // 장려금 금액
  }

  // 합계 행에 이윤/장려금 SUM 수식 추가
  const sumRow = 31 + extraRows
  // 이윤 합계 — 굵은 테두리 상자
  const aaSumCell = ws.getCell(`AA${sumRow}`)
  aaSumCell.value = { formula: `SUM(AA16:AA${lastDataRow})` }
  aaSumCell.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'medium' } }

  // 장려금 합계 — 굵은 테두리 상자 + 콤마 포맷
  const acSumCell = ws.getCell(`AC${sumRow}`)
  acSumCell.value = { formula: `SUM(AC16:AC${lastDataRow})` }
  acSumCell.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'medium' } }
  acSumCell.numFmt = '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-'

  /* ══════ 테두리 보정 — ExcelJS가 누락시키는 테두리만 복원 ══════ */
  const thinBorder = { style: 'thin' as const }
  const hairBorder = { style: 'hair' as const }
  const vatRow = sumRow + 1
  const totalRow = sumRow + 2

  // 데이터 행: A열 좌측(thin) + R열 우측(thin) — 안쪽은 템플릿 원본 hair 유지
  for (let r = 16; r <= lastDataRow; r++) {
    const cellA = ws.getCell(`A${r}`)
    cellA.border = { ...cellA.border, left: thinBorder }
    const cellR = ws.getCell(`R${r}`)
    cellR.border = { ...cellR.border, right: thinBorder }
  }

  // 합계/부가세/총계: R열 우측(thin) + 상하(hair/thin)
  ws.getCell(`R${sumRow}`).border = { ...ws.getCell(`R${sumRow}`).border, right: thinBorder, top: thinBorder, bottom: hairBorder }
  ws.getCell(`R${vatRow}`).border = { ...ws.getCell(`R${vatRow}`).border, right: thinBorder, top: hairBorder, bottom: hairBorder }
  ws.getCell(`R${totalRow}`).border = { ...ws.getCell(`R${totalRow}`).border, right: thinBorder, top: hairBorder, bottom: thinBorder }

  // 특이사항: R열 우측(thin) + 마지막 행 하단(thin)
  const noteStartRow = totalRow + 3
  const noteEndRow = totalRow + 8
  for (let r = noteStartRow; r <= noteEndRow; r++) {
    const cellR = ws.getCell(`R${r}`)
    if (r === noteEndRow) {
      cellR.border = { ...cellR.border, right: thinBorder, bottom: thinBorder }
      for (let c = 1; c <= 17; c++) {
        const cell = ws.getCell(r, c)
        cell.border = { ...cell.border, bottom: thinBorder }
      }
    } else {
      cellR.border = { ...cellR.border, right: thinBorder }
    }
  }

  // 인쇄영역 업데이트 (행 삽입 시 마지막 행까지 포함)
  ws.pageSetup.printArea = `A1:R${41 + extraRows}`

  /* ══════ ExcelJS 출력 후 원본 drawing XML 복원 ══════ */
  // ExcelJS가 writeBuffer 하면 <a:clrChange> (도장 투명색) 등이 사라지므로
  // 원본 drawing XML과 미디어 파일을 복원해서 도장이 정상 표시되도록 한다.
  const excelBuffer = await wb.xlsx.writeBuffer()
  const outZip = await JSZip.loadAsync(excelBuffer)

  if (origDrawingXml) {
    outZip.file('xl/drawings/drawing1.xml', origDrawingXml)
  }
  if (origDrawingRels) {
    outZip.file('xl/drawings/_rels/drawing1.xml.rels', origDrawingRels)
  }
  for (const [path, data] of Object.entries(origMedia)) {
    outZip.file(path, data)
  }

  return await outZip.generateAsync({ type: 'arraybuffer' })
}

/* ═════════════════════════════════════════════════════════
   메인 진입점 — 간이/상세 분기
   ═════════════════════════════════════════════════════════ */
// Excel 버퍼만 생성 (PDF 변환 등에서 재사용)
export async function buildQuoteExcelBuffer(data: QuoteExportData): Promise<ArrayBuffer | null> {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()

  // 이미지 로드 (로고 + 도장)
  const [logoData, stampData] = await Promise.all([
    data.logoUrl ? loadImageDataUrl(data.logoUrl) : Promise.resolve(null),
    data.stampUrl ? loadImageDataUrl(data.stampUrl) : Promise.resolve(null),
  ])
  const logoId = xlAddImg(wb, logoData)
  const stampId = xlAddImg(wb, stampData)

  const validEquip = data.equipItems.filter(hasData)
  const validInstall = data.installItems.filter(hasData)
  if (!validEquip.length && !validInstall.length) return null

  if (data.quoteType === 'detailed') {
    // 상세 견적서: 갑지 + 장비내역서 + 설치비내역서 (모두 템플릿 기반)
    return await xlBuildDetailedAllSheets(wb, data, validEquip, validInstall)
  } else {
    return await xlBuildSimpleFromTemplate(wb, data)
  }
}

export async function exportQuoteExcel(data: QuoteExportData): Promise<void> {
  const buffer = await buildQuoteExcelBuffer(data)
  if (!buffer) return

  // 브라우저 다운로드
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `견적서_${(data.title || '무제').replace(/[\\/:*?"<>|]/g, '_')}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/* ═════════════════════════════════════════════════════════
   PDF 내보내기 — Excel 인쇄영역 기반 HTML → 브라우저 인쇄
   ═════════════════════════════════════════════════════════ */
export async function exportQuoteExcelAsPdf(data: QuoteExportData): Promise<void> {
  const validEquip = data.equipItems.filter(hasData)
  const validInstall = data.installItems.filter(hasData)
  if (!validEquip.length && !validInstall.length) return

  const allItems = [
    ...validEquip.map(item => ({ ...item, _section: '장비' as const })),
    ...validInstall.map(item => ({ ...item, _section: '설치비' as const })),
  ]

  // 로고/도장 이미지 로드
  const [logoDataUrl, stampDataUrl] = await Promise.all([
    data.logoUrl ? loadImageDataUrl(data.logoUrl) : Promise.resolve(null),
    data.stampUrl ? loadImageDataUrl(data.stampUrl) : Promise.resolve(null),
  ])

  // 합계 계산
  const supplyTotal = allItems.reduce((s, r) => s + (r.quantity * r.unit_price), 0)
  const vat = Math.round(supplyTotal * 0.1)
  const grandTotal = supplyTotal + vat

  // 한글 금액 변환
  const koreanNum = numToKorPdf(grandTotal)

  // 항목 행 HTML
  const itemRows = allItems.map((item, i) => {
    const supply = item.quantity * item.unit_price
    return `<tr>
      <td class="c" style="border-left:1px solid #333;">${i + 1}</td>
      <td class="l" colspan="5">${esc(item.item_name)}</td>
      <td class="l" colspan="3">${esc(item.specification)}</td>
      <td class="c">${esc(item.unit)}</td>
      <td class="r">${item.quantity || ''}</td>
      <td class="r" colspan="3">${item.unit_price ? item.unit_price.toLocaleString() : ''}</td>
      <td class="r" colspan="2">${supply ? supply.toLocaleString() : ''}</td>
      <td class="l" colspan="2" style="border-right:1px solid #333;"></td>
    </tr>`
  }).join('\n')

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>견적서_${esc(data.title || '무제')}</title>
<style>
  @page { size: A4 portrait; margin: 15mm 10mm 10mm 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: '맑은 고딕', 'Malgun Gothic', sans-serif; font-size: 10pt; color: #111; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  td, th { padding: 2px 4px; vertical-align: middle; font-size: 10pt; }
  .c { text-align: center; } .l { text-align: left; } .r { text-align: right; } .b { font-weight: bold; }
  .title { font-family: '바탕', serif; font-size: 28pt; font-weight: bold; text-align: center;
    padding: 8px 0; border-bottom: 3px solid #111; letter-spacing: 0.8em; }
  .header-row td { padding: 1px 4px; font-size: 10pt; height: 20px; }
  .header-label { color: #555; font-weight: bold; letter-spacing: 0.1em; }
  .receiver { font-size: 12pt; font-weight: bold; border-bottom: 1px solid #111; padding-bottom: 2px; }
  .items-header th { background: #f5f5f5; border: 1px solid #333; font-weight: bold; padding: 4px 2px; font-size: 10pt; text-align: center; }
  .items-body td { border-left: 1px solid #ccc; border-bottom: 1px solid #ddd; padding: 3px 4px; font-size: 9pt; height: 19px; }
  .footer-row td { border: 1px solid #333; padding: 3px 4px; font-size: 10pt; height: 22px; }
  .total-bar { border: 1px solid #333; } .total-bar td { padding: 4px 6px; font-size: 10pt; }
  .notes-label { border: 1px solid #333; border-bottom: none; padding: 3px 6px; font-weight: bold; }
  .notes-area { border: 1px solid #333; padding: 6px 8px; min-height: 80px; font-size: 9pt; white-space: pre-wrap; vertical-align: top; }
  .logo-area { text-align: right; padding: 10px 0; position: relative; }
  .logo-area img.logo { height: 30px; } .logo-area .cname { font-size: 14pt; font-weight: bold; vertical-align: middle; }
  .stamp-img { position: absolute; right: 0; top: 50%; transform: translateY(-50%); height: 56px; width: 56px; opacity: 0.85; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="title">見　積　書</div>
<div class="logo-area">
  <div style="display:inline-flex;align-items:center;gap:8px;margin-right:70px;">
    ${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" />` : ''}
    <span class="cname">${esc(data.supplier.companyName)}</span>
  </div>
  ${stampDataUrl ? `<img class="stamp-img" src="${stampDataUrl}" />` : ''}
</div>
<div style="padding:0 4px 4px;"><span class="receiver">${esc(data.receiver.companyName)} 귀하</span></div>
<table style="margin:4px 0;">
  <tr class="header-row"><td width="13%" class="header-label">담 당 자 :</td><td width="22%">${esc(data.receiver.recipientName)}</td>
    <td width="13%" class="header-label">등 록 번 호</td><td width="17%">${esc(data.supplier.bizNumber)}</td>
    <td width="10%" class="header-label">성　명</td><td width="25%">${esc(data.supplier.ceoName)}　(인)</td></tr>
  <tr class="header-row"><td class="header-label">납 기/장 소 :</td><td>${esc(data.deliveryDate || '협의 일정')} / ${esc(data.deliveryPlace || '협의 장소')}</td>
    <td class="header-label">사업장주소</td><td colspan="3">${esc(data.supplier.address)}</td></tr>
  <tr class="header-row"><td class="header-label">결 제 조 건 :</td><td>${esc(data.paymentCondition || '협의 조건')}</td>
    <td class="header-label">전 화 번 호</td><td>${esc(data.supplier.managerPhone)}</td>
    <td class="header-label">팩스번호</td><td>02) 711-7807</td></tr>
  <tr class="header-row"><td class="header-label">견 적 일 자 :</td><td>${esc(data.quotationDate)}</td><td colspan="4"></td></tr>
  <tr class="header-row"><td class="header-label">유 효 기 간 :</td><td>${esc(data.validUntil || '견적 후 7일')}</td>
    <td class="header-label">견 적 담 당</td><td>${esc(data.supplier.manager)}</td>
    <td class="header-label">Mobile</td><td>${esc(data.supplier.managerPhone)}</td></tr>
</table>
<div style="padding:2px 4px 6px;"><span style="font-size:10pt;border-bottom:1px solid #999;">아래와 같이 견적합니다.</span></div>
<table class="total-bar" style="margin-bottom:2px;">
  <tr><td width="14%" class="c b" style="background:#f5f5f5;border-right:1px solid #333;line-height:1.3;">합계금액<br><span style="font-size:8pt;font-weight:normal;color:#666;">(공급가+부가세)</span></td>
    <td width="50%" class="b">${koreanNum} 원整</td>
    <td width="36%" class="r">(₩ <b>${grandTotal.toLocaleString()}</b> )</td></tr>
</table>
<table><thead><tr class="items-header">
  <th width="5%">순번</th><th colspan="5" width="28%">품　명</th><th colspan="3" width="20%">모델 및 사양</th>
  <th width="5%">단위</th><th width="5%">수량</th><th colspan="3" width="14%">단　가</th>
  <th colspan="2" width="13%">공 급 가</th><th colspan="2" width="10%">비　고</th>
</tr></thead><tbody class="items-body">${itemRows}</tbody></table>
<table>
  <tr class="footer-row"><td colspan="11" class="c b" width="60%">합　　계</td><td colspan="7" class="r b">${supplyTotal.toLocaleString()}</td></tr>
  <tr class="footer-row"><td colspan="11" class="c">부 가 세</td><td colspan="7" class="r">${vat.toLocaleString()}</td></tr>
  <tr class="footer-row"><td colspan="11" class="c b">총　　계</td><td colspan="7" class="r b">${grandTotal.toLocaleString()}</td></tr>
</table>
<div class="notes-label" style="margin-top:8px;">※ 특 이 사 항</div>
<div class="notes-area">${esc(data.notes || '')}</div>
</body></html>`

  const win = window.open('', '_blank')
  if (!win) { alert('팝업이 차단되었습니다. 팝업을 허용해주세요.'); return }
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 800)
}

// HTML 이스케이프
function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// 숫자 → 한글 금액 (PDF용)
function numToKorPdf(n: number): string {
  if (n === 0) return '영'
  const units = ['', '만', '억', '조']
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
  const subUnits = ['', '십', '백', '천']
  let result = ''
  let unitIdx = 0
  while (n > 0) {
    const chunk = n % 10000
    if (chunk > 0) {
      let chunkStr = ''
      let c = chunk
      for (let i = 0; i < 4; i++) {
        const d = c % 10
        if (d > 0) chunkStr = digits[d] + subUnits[i] + chunkStr
        c = Math.floor(c / 10)
      }
      result = chunkStr + units[unitIdx] + result
    }
    n = Math.floor(n / 10000)
    unitIdx++
  }
  return result
}
