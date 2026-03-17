// ============================================
// 견적서 PDF / Excel 내보내기 유틸리티
// ============================================

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

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
  return !!(r.item_name.trim() || r.specification.trim() || r.unit.trim() || r.quantity > 0 || r.unit_price > 0 || r.retrieval_price > 0)
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
  const headerH = 8
  doc.setDrawColor(...GRAY200)
  doc.setFillColor(249, 250, 251)
  doc.rect(M, startY, CW, headerH, "FD")
  doc.setDrawColor(...GRAY200)
  doc.line(M, startY + headerH, M + CW, startY + headerH)

  // 아이콘(색상 원) + 섹션 타이틀 + 소계 뱃지
  const ic = iconColor || SLATE700
  doc.setFillColor(...ic)
  doc.circle(M + 6, startY + 4.2, 1.3, "F") // 작은 원형 아이콘
  txt(doc, sectionTitle, M + 10, startY + 5.2, { size: 8.5, bold: true, color: SLATE700 })
  if (subtotal > 0) {
    const badgeText = `₩ ${fmt(subtotal)}`
    doc.setFontSize(6.5)
    const bw = doc.getTextWidth(badgeText) + 4
    const bx = M + 10 + doc.getTextWidth(`${sectionTitle}`) + 6
    doc.setFillColor(...(badgeBg || GRAY100))
    doc.rect(bx, startY + 2.2, bw, 4.5, "F")
    txt(doc, badgeText, bx + 2, startY + 5, { size: 6.5, bold: true, color: SLATE700 })
  }

  autoTable(doc, {
    startY: startY + headerH,
    head: [["품목명", "규격", "단위", "수량", "단가", "금액"]],
    body: items.map((r) => [
      r.item_name,
      r.specification,
      r.unit,
      r.quantity > 0 ? fmt(r.quantity) : "",
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

  // ── 견적서 제목 (아이콘 + 제목) ──
  doc.setFillColor(...SLATE700)
  doc.circle(M + 1.5, y + 3.5, 1, "F")
  txt(doc, data.title || "견적서", M + 5, y + 4, { size: 12, bold: true })
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
      r.quantity > 0 ? fmt(r.quantity) : "",
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
      r.quantity > 0 ? fmt(r.quantity) : "",
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
//  Excel 내보내기 (원가분석 포함)
// ============================================================

export function exportQuoteExcel(data: QuoteExportData): void {
  const wb = XLSX.utils.book_new()

  // 장비 내역 시트
  const validEquip = data.equipItems.filter(hasData)
  if (validEquip.length > 0) {
    addItemsSheet(wb, "장비 내역", validEquip, data, true)
  }

  // 설치비 내역 시트
  const validInstall = data.installItems.filter(hasData)
  if (validInstall.length > 0) {
    addItemsSheet(wb, "설치비 내역", validInstall, data, false)
  }

  const safeName = (data.title || "무제").replace(/[\\/:*?"<>|]/g, "_")
  XLSX.writeFile(wb, `견적서_${safeName}.xlsx`)
}

function addItemsSheet(wb: XLSX.WorkBook, sheetName: string, items: ItemRow[], data: QuoteExportData, isFirst: boolean) {
  const rows: (string | number | null)[][] = []

  // ── 헤더 영역 ──
  rows.push([`견적서 — ${data.title || "무제"}`])
  rows.push([
    `견적번호: ${data.quotationNumber || "-"}`,
    "",
    `견적일: ${data.quotationDate}`,
    "",
    `견적담당: ${data.supplier.manager || "-"}`,
    "",
    `연락처: ${data.supplier.managerPhone || "-"}`,
  ])
  rows.push([]) // 빈 행

  // ── 구분 헤더 ──
  rows.push([
    "[ 견적 내역 ]", "", "", "", "", "", "",
    "", "[ 원가 분석 ]",
  ])

  // ── 테이블 헤더 ──
  rows.push([
    "#", "품목명", "규격", "단위", "수량", "단가", "금액",
    "", // 구분 열
    "반출가", "DC율(%)", "매입단가", "매입금액", "MG율(%)", "제안가", "이윤", "장려금(%)", "장려금액",
  ])

  // ── 데이터 행 ──
  items.forEach((r, i) => {
    const incentiveAmt = Math.round(r.purchase_amount * r.incentive_rate / 100)
    rows.push([
      i + 1,
      r.item_name,
      r.specification,
      r.unit,
      r.quantity || null,
      r.unit_price || null,
      r.amount || null,
      null, // 구분 열
      r.retrieval_price || null,
      r.discount_rate || null,
      r.purchase_unit_price || null,
      r.purchase_amount || null,
      r.margin_rate || null,
      r.proposed_price || null,
      r.profit || null,
      r.incentive_rate || null,
      incentiveAmt || null,
    ])
  })

  // ── 소계 행 ──
  const subtotal = items.reduce((s, r) => s + r.amount, 0)
  const purchaseTotal = items.reduce((s, r) => s + r.purchase_amount, 0)
  const profitTotal = items.reduce((s, r) => s + r.profit, 0)
  const incentiveTotal = items.reduce((s, r) => s + Math.round(r.purchase_amount * r.incentive_rate / 100), 0)

  rows.push([
    "", "", "", "", "", "소계", subtotal,
    null,
    "", "", "", purchaseTotal, "", "", profitTotal, "", incentiveTotal,
  ])

  // ── 첫 번째 시트에만 종합 요약 추가 ──
  if (isFirst) {
    rows.push([]) // 빈 행
    rows.push(["[ 금액 요약 ]"])
    rows.push(["총 합계", data.totalAmount])
    if (data.truncationAmount > 0) {
      rows.push(["단위절사", -data.truncationAmount])
    }
    rows.push(["공급가액", data.supplyAmount])
    rows.push(["VAT (10%)", data.taxAmount])
    rows.push(["최종 견적", data.grandTotal])
    rows.push([])
    rows.push(["[ 원가 분석 요약 ]"])
    rows.push(["총 매입", data.totalPurchase])
    rows.push(["총 이윤", data.totalProfit])
    if (data.totalAmount > 0) {
      rows.push(["이윤율", `${((data.totalProfit / data.totalAmount) * 100).toFixed(1)}%`])
    }
  }

  // ── 시트 생성 ──
  const ws = XLSX.utils.aoa_to_sheet(rows)

  // ── 열 너비 설정 ──
  ws["!cols"] = [
    { wch: 5 },   // A: #
    { wch: 22 },  // B: 품목명
    { wch: 18 },  // C: 규격
    { wch: 6 },   // D: 단위
    { wch: 8 },   // E: 수량
    { wch: 12 },  // F: 단가
    { wch: 14 },  // G: 금액
    { wch: 2 },   // H: 구분
    { wch: 12 },  // I: 반출가
    { wch: 8 },   // J: DC율
    { wch: 12 },  // K: 매입단가
    { wch: 14 },  // L: 매입금액
    { wch: 8 },   // M: MG율
    { wch: 12 },  // N: 제안가
    { wch: 12 },  // O: 이윤
    { wch: 8 },   // P: 장려금%
    { wch: 12 },  // Q: 장려금액
  ]

  // ── 행 병합 (제목) ──
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // 제목 병합
  ]

  // ── 숫자 서식 적용 ──
  // 데이터 행 범위 (5행째부터 시작, 0-indexed = 4)
  const dataStartRow = 4
  const dataEndRow = dataStartRow + items.length
  for (let r = dataStartRow; r <= dataEndRow; r++) {
    // 금액 열에 숫자 포맷 적용
    const numCols = [4, 5, 6, 8, 10, 11, 13, 14, 16] // E,F,G, I,K,L, N,O,Q
    for (const c of numCols) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (ws[addr] && typeof ws[addr].v === "number") {
        ws[addr].z = "#,##0"
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName)
}
