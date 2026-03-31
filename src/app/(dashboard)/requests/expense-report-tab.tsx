"use client"

import { memo, useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, Download, Eraser } from "lucide-react"
import { cn } from "@/lib/utils"

// ══════════════════════════════════════════════════════════
// 타입 정의
// ══════════════════════════════════════════════════════════

// 사용자가 직접 입력하는 필드 (자동 계산 필드는 렌더링 시 계산)
interface ReportRow {
  id: string
  category: string       // A열: 구분
  supplier: string       // B열: 매입처
  item: string           // C열: 품목
  spec: string           // D열: 규격
  quantity: number        // E열: 수량
  listPrice: number       // F열: 반출가
  dcRate: number          // G열: DC율 (%, 사용자가 10 입력 → 10%)
  optionAmount: number    // H열: 옵션물
  proposedUnit: number    // L열: 제안가 단가
  gradeReb: number        // P열: 등급 Reb (%, 사용자가 5 입력 → 5%)
  itemReb: number         // R열: 품목 Reb (%, 사용자가 3 입력 → 3%)
}

// 자동 계산 결과 (엑셀 수식과 동일)
interface Calc {
  purchaseUnit: number     // I열: 매입가 단가 = F-(F×G%)
  purchaseAmt: number      // J열: 매입가 금액 = I×E
  mgRate: number           // K열: MG율 = O/M (비율, 소수)
  proposedAmt: number      // M열: 제안가 금액 = L×E
  frontUnit: number        // N열: 프론트이윤 단가 = L-I
  frontAmt: number         // O열: 프론트이윤 금액 = N×E
  gradeRebAmt: number     // Q열: 등급 Reb 금액 = P%×F
  itemRebAmt: number      // S열: 품목 Reb 금액 = R%×F
  rebateTotal: number      // T열: 장려금 금액 = J×P% + J×R%
  totalProfit: number      // U열: 전체이윤 = O+T
}

// 상단 정보 (편집 가능)
interface HeaderInfo {
  projectName: string      // 영업건명
  customer: string         // 수요처
  customerContact: string  // 수요처 담당
  team: string             // 멜레아 소속
  manager: string          // 멜레아 담당
}

// ══════════════════════════════════════════════════════════
// 헬퍼 함수
// ══════════════════════════════════════════════════════════

let _rid = 0
function createEmptyRow(): ReportRow {
  return {
    id: `er_${Date.now()}_${_rid++}`,
    category: "", supplier: "", item: "", spec: "",
    quantity: 0, listPrice: 0, dcRate: 0, optionAmount: 0,
    proposedUnit: 0, gradeReb: 0, itemReb: 0,
  }
}

// 행 자동 계산 (엑셀 수식 그대로)
// I=F-(F*G), J=I*E, K=O/M, M=L*E, N=L-I, O=N*E, Q=P*F, T=J*P+J*R, U=O+T
// ※ G,P,R은 사용자가 "10"으로 입력하면 10%. 엑셀은 내부 소수(0.10)로 저장하므로 /100 필요
function calc(r: ReportRow): Calc {
  const g = r.dcRate / 100
  const p = r.gradeReb / 100
  const rr = r.itemReb / 100
  const purchaseUnit = r.listPrice - (r.listPrice * g)       // I = F-(F*G)
  const purchaseAmt = purchaseUnit * r.quantity                // J = I*E
  const proposedAmt = r.proposedUnit * r.quantity              // M = L*E
  const frontUnit = r.proposedUnit - purchaseUnit              // N = L-I
  const frontAmt = frontUnit * r.quantity                      // O = N*E
  const mgRate = proposedAmt ? (frontAmt / proposedAmt) : 0   // K = O/M
  const gradeRebAmt = p * r.listPrice                         // Q = P*F (단위당)
  const itemRebAmt = rr * r.listPrice                          // S = R*F (단위당)
  const rebateTotal = purchaseAmt * p + purchaseAmt * rr       // T = J*P + J*R
  const totalProfit = frontAmt + rebateTotal                   // U = O+T
  return { purchaseUnit, purchaseAmt, mgRate, proposedAmt, frontUnit, frontAmt, gradeRebAmt, itemRebAmt, rebateTotal, totalProfit }
}

// 숫자 → 콤마 포맷 (0이면 빈 문자열)
const fmt = (n: number) => {
  if (!n || !isFinite(n)) return ""
  return Math.round(n).toLocaleString("ko-KR")
}
// 퍼센트 표시 (소수점 1자리)
const fmtPct = (n: number) => {
  if (!n || !isFinite(n)) return ""
  const v = Math.round(n * 1000) / 10  // 소수 비율 → 퍼센트
  return v % 1 === 0 ? `${v}%` : `${v.toFixed(1)}%`
}
// 입력 파싱
const parseNum = (v: string) => {
  const n = Number(v.replace(/[,%]/g, ""))
  return isNaN(n) ? 0 : n
}

// 초기 행 6행 (원본 템플릿 8~13행과 동일)
function createInitialRows(): ReportRow[] {
  return Array.from({ length: 6 }, () => createEmptyRow())
}

// ══════════════════════════════════════════════════════════
// 셀 컴포넌트
// ══════════════════════════════════════════════════════════

// 공통 셀 스타일
const TH = "px-1 py-0.5 text-[10px] font-semibold text-center border border-gray-300 whitespace-nowrap text-gray-700"
const TD = "p-0 border border-gray-200 h-[32px]"

// 텍스트 입력 셀
function CellText({ value, onChange, placeholder, row, col }: {
  value: string; onChange: (v: string) => void; placeholder?: string; row?: number; col?: number
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      data-row={row}
      data-col={col}
      className="w-full h-full px-1 text-[11px] bg-transparent border-0 outline-none focus:bg-blue-50/60"
    />
  )
}

// 숫자 입력 셀 (blur 시 콤마 포맷)
function CellNum({ value, onChange, suffix, row, col }: {
  value: number; onChange: (v: number) => void; suffix?: string; row?: number; col?: number
}) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState("")
  const display = value
    ? suffix
      ? `${value}${suffix}`
      : fmt(value)
    : ""
  return (
    <input
      type="text"
      inputMode="numeric"
      value={editing ? raw : display}
      onChange={(e) => setRaw(e.target.value)}
      onFocus={() => { setEditing(true); setRaw(value ? String(value) : "") }}
      onBlur={() => { setEditing(false); onChange(parseNum(raw)) }}
      data-row={row}
      data-col={col}
      className="w-full h-full px-1 text-[11px] text-right bg-transparent border-0 outline-none focus:bg-blue-50/60 tabular-nums"
    />
  )
}

// 자동 계산 읽기 전용 셀
function CellAuto({ children }: { children: string }) {
  return (
    <div className="w-full h-full px-1 text-[11px] text-right bg-gray-100 tabular-nums text-gray-600 leading-[32px] select-none truncate">
      {children}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════════════════
interface ExpenseReportTabProps {
  requestId: string
  requestTitle?: string
  customerName?: string
  customerContact?: string
  userName?: string
  userTeam?: string
}

// ══════════════════════════════════════════════════════════
// 메인 컴포넌트
// ══════════════════════════════════════════════════════════
function ExpenseReportTab({
  requestId,
  requestTitle = "",
  customerName = "",
  customerContact = "",
  userName = "",
  userTeam = "MA영업팀",
}: ExpenseReportTabProps) {
  // ── 상단 정보 (편집 가능) ──
  const [header, setHeader] = useState<HeaderInfo>({
    projectName: requestTitle,
    customer: customerName,
    customerContact: customerContact,
    team: userTeam,
    manager: userName,
  })
  const setH = useCallback((k: keyof HeaderInfo, v: string) => {
    setHeader((prev) => ({ ...prev, [k]: v }))
  }, [])

  // ── DB 저장용 ID (null = 아직 생성 안 됨) ──
  const [reportId, setReportId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState("")

  // ── 데이터 행 ──
  const [rows, setRows] = useState<ReportRow[]>(createInitialRows)

  const updateRow = useCallback((id: string, field: keyof ReportRow, value: string | number) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }, [])
  const addRow = useCallback(() => setRows((prev) => [...prev, createEmptyRow()]), [])
  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.length <= 1 ? prev : prev.filter((r) => r.id !== id))
  }, [])
  // 행 데이터 초기화 (행은 유지, 내용만 비움)
  const clearRow = useCallback((id: string) => {
    setRows((prev) => prev.map((r) => r.id === id ? {
      ...createEmptyRow(), id: r.id,
    } : r))
  }, [])

  // ── DB에서 불러오기 (최초 1회) ──
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/expense-reports?request_id=${requestId}`)
        if (!res.ok || cancelled) return
        const { data } = await res.json()
        if (!data || cancelled) { setLoading(false); return }

        setReportId(data.id)
        setHeader({
          projectName: data.project_name || requestTitle,
          customer: data.customer || customerName,
          customerContact: data.customer_contact || customerContact,
          team: data.team || userTeam,
          manager: data.manager || userName,
        })

        // DB 행 → 로컬 행으로 변환
        const dbRows = (data.expense_report_rows || []) as Record<string, unknown>[]
        if (dbRows.length > 0) {
          setRows(dbRows.map((r) => ({
            id: `er_${Date.now()}_${_rid++}`,
            category: (r.category as string) || "",
            supplier: (r.supplier as string) || "",
            item: (r.item as string) || "",
            spec: (r.spec as string) || "",
            quantity: Number(r.quantity) || 0,
            listPrice: Number(r.list_price) || 0,
            dcRate: Number(r.dc_rate) || 0,
            optionAmount: Number(r.option_amount) || 0,
            proposedUnit: Number(r.proposed_unit) || 0,
            gradeReb: Number(r.grade_reb) || 0,
            itemReb: Number(r.item_reb) || 0,
          })))
        }
      } catch { /* 네트워크 에러 무시 */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [requestId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 자동 저장 (header/rows 변경 시 1초 디바운스) ──
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoad = useRef(true)

  useEffect(() => {
    // 최초 로드 중에는 저장하지 않음
    if (loading) return
    if (initialLoad.current) { initialLoad.current = false; return }

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveStatus("저장 중...")
      try {
        // 행 데이터를 DB 필드명으로 변환
        const rowPayloads = rows.map((r) => ({
          category: r.category, supplier: r.supplier, item: r.item, spec: r.spec,
          quantity: r.quantity, list_price: r.listPrice, dc_rate: r.dcRate,
          option_amount: r.optionAmount, proposed_unit: r.proposedUnit,
          grade_reb: r.gradeReb, item_reb: r.itemReb,
        }))

        if (reportId) {
          // 기존 문서 수정
          await fetch("/api/expense-reports", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: reportId,
              header: {
                project_name: header.projectName,
                customer: header.customer,
                customer_contact: header.customerContact,
                team: header.team,
                manager: header.manager,
              },
              rows: rowPayloads,
            }),
          })
        } else {
          // 새로 생성
          const res = await fetch("/api/expense-reports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              request_id: requestId,
              header: {
                project_name: header.projectName,
                customer: header.customer,
                customer_contact: header.customerContact,
                team: header.team,
                manager: header.manager,
              },
              rows: rowPayloads,
            }),
          })
          const { data } = await res.json()
          if (data?.id) setReportId(data.id)
        }
        setSaveStatus("저장됨")
        setTimeout(() => setSaveStatus(""), 2000)
      } catch {
        setSaveStatus("저장 실패")
        setTimeout(() => setSaveStatus(""), 3000)
      }
    }, 1000)

    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [header, rows, reportId, requestId, loading])

  // ── 붙여넣기 (Ctrl+V) — 엑셀에서 복사한 데이터를 포커스 셀 기준으로 채움 ──
  // 입력 가능 컬럼 순서 (자동계산 열은 건너뜀)
  // col 0=구분, 1=매입처, 2=품목, 3=규격, 4=수량, 5=반출가, 6=DC율, 7=옵션물,
  // 8=매입단가(auto), 9=매입금액(auto), 10=MG율(auto), 11=제안단가,
  // 12=제안금액(auto), 13=프론트단가(auto), 14=프론트금액(auto),
  // 15=등급Reb%, 16=등급Reb금액(auto), 17=품목Reb%, 18=품목Reb금액(auto),
  // 19=장려금금액(auto), 20=전체이윤(auto)
  const EDITABLE_COLS: { col: number; field: keyof ReportRow; type: "text" | "number" }[] = [
    { col: 0, field: "category", type: "text" },
    { col: 1, field: "supplier", type: "text" },
    { col: 2, field: "item", type: "text" },
    { col: 3, field: "spec", type: "text" },
    { col: 4, field: "quantity", type: "number" },
    { col: 5, field: "listPrice", type: "number" },
    { col: 6, field: "dcRate", type: "number" },
    { col: 7, field: "optionAmount", type: "number" },
    { col: 11, field: "proposedUnit", type: "number" },
    { col: 15, field: "gradeReb", type: "number" },
    { col: 17, field: "itemReb", type: "number" },
  ]

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain")
    if (!text) return

    // 탭 또는 여러 줄이 있으면 엑셀에서 복사한 데이터
    const hasMultipleLines = text.split(/\r?\n/).filter(l => l.trim()).length > 1
    if (!text.includes("\t") && !hasMultipleLines) return

    e.preventDefault()
    e.stopPropagation()

    // 포커스된 셀의 행/열 인덱스
    const active = document.activeElement as HTMLElement | null
    const startRow = Number(active?.getAttribute("data-row") ?? 0)
    const startCol = Number(active?.getAttribute("data-col") ?? 0)

    // 클립보드 → 2차원 배열
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    const pasteData: string[][] = lines.map(line => line.split("\t"))

    setRows((prev) => {
      // 필요하면 행 추가
      let updated = [...prev]
      while (updated.length < startRow + pasteData.length) {
        updated.push(createEmptyRow())
      }

      for (let ri = 0; ri < pasteData.length; ri++) {
        const rowIdx = startRow + ri
        const rowData = pasteData[ri]
        const row = { ...updated[rowIdx] }

        for (let ci = 0; ci < rowData.length; ci++) {
          const targetCol = startCol + ci
          const colDef = EDITABLE_COLS.find(c => c.col === targetCol)
          if (!colDef) continue // 자동계산 열이면 무시

          const val = rowData[ci].trim()
          if (colDef.type === "text") {
            (row as Record<string, unknown>)[colDef.field] = val
          } else {
            // 콤마, %, 원 기호 제거 후 숫자 파싱
            (row as Record<string, unknown>)[colDef.field] = parseNum(val)
          }
        }

        updated[rowIdx] = row
      }
      return updated
    })
  }, [])

  // ── 합계 ──
  const totals = rows.reduce((acc, r) => {
    const c = calc(r)
    acc.purchaseAmt += c.purchaseAmt
    acc.proposedAmt += c.proposedAmt
    acc.frontAmt += c.frontAmt
    acc.rebateTotal += c.rebateTotal
    acc.totalProfit += c.totalProfit
    return acc
  }, { purchaseAmt: 0, proposedAmt: 0, frontAmt: 0, rebateTotal: 0, totalProfit: 0 })

  const totalMgRate = totals.proposedAmt ? (totals.frontAmt / totals.proposedAmt) : 0
  const vatAmount = Math.round(totals.proposedAmt * 1.1)

  // ══════════════════════════════════════════════════════════
  // 엑셀 내보내기 (ExcelJS — 원본 템플릿과 동일한 스타일)
  // ══════════════════════════════════════════════════════════
  const handleExport = useCallback(async () => {
    const ExcelJS = await import("exceljs")
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet("지출결의서")

    // ── 열 너비 (원본 wch 값 그대로) ──
    ws.columns = [
      { width: 9.07 },   // A: 구분
      { width: 11.36 },  // B: 매입처
      { width: 11.36 },  // C: 품목
      { width: 22.36 },  // D: 규격
      { width: 3.93 },   // E: 수량
      { width: 11.21 },  // F: 반출가
      { width: 7.07 },   // G: DC율
      { width: 5.07 },   // H: 옵션물
      { width: 10.64 },  // I: 매입단가
      { width: 12.5 },   // J: 매입금액
      { width: 10.07 },  // K: MG율
      { width: 11.64 },  // L: 제안단가
      { width: 10.64 },  // M: 제안금액
      { width: 9.5 },    // N: 프론트단가
      { width: 12.07 },  // O: 프론트금액
      { width: 5.93 },   // P: 등급Reb%
      { width: 8.5 },    // Q: 등급Reb금액
      { width: 5.64 },   // R: 품목Reb%
      { width: 8.64 },   // S: 품목Reb금액
      { width: 9.5 },    // T: 장려금금액
      { width: 11.5 },   // U: 전체이윤
    ]

    // ── 공통 스타일 (원본 템플릿에서 추출한 값) ──
    // 테두리
    const bMedium = { style: "medium" as const, color: { argb: "FF000000" } }
    const bHair = { style: "hair" as const, color: { argb: "FF000000" } }
    const bThin = { style: "thin" as const, color: { argb: "FF000000" } }
    const bDouble = { style: "double" as const, color: { argb: "FF000000" } }
    const bDotGray = { style: "dotted" as const, color: { argb: "FF999999" } }
    const bDoubleDark = { style: "double" as const, color: { argb: "FF1F497D" } }
    // 데이터 행 테두리 (점선 회색)
    const dataBorder = { left: bDotGray, right: bDotGray, bottom: bDotGray }
    // 채우기
    const headerFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFC6D9F0" }, bgColor: { argb: "FFC6D9F0" } }
    const titleFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF95B3D7" }, bgColor: { argb: "FF95B3D7" } }
    // 폰트
    const headerFont = { name: "Malgun Gothic", size: 10, bold: true, color: { theme: 1 } }
    const headerFontRed = { name: "Malgun Gothic", size: 10, bold: true, color: { argb: "FFFF0000" } }
    const dataFontDefault = { name: "Arial", size: 10, color: { argb: "FF434343" } }
    const dataFontBlue = { name: "Arial", size: 10, color: { argb: "FF1C4587" } }
    const dataFontDarkRed = { name: "Arial", size: 10, color: { argb: "FFCC0000" } }
    const dataFontRed = { name: "Arial", size: 10, color: { argb: "FFFF0000" } }
    const titleFont = { name: "Malgun Gothic", size: 10, bold: true, color: { theme: 1 } }
    // 합계 폰트 (열별 색상)
    const sumFontBlack = { name: "Malgun Gothic", size: 10, bold: true, color: { theme: 1 } }
    const sumFontBlue = { name: "Malgun Gothic", size: 10, bold: true, color: { argb: "FF366092" } }
    const sumFontDkBlue = { name: "Malgun Gothic", size: 10, bold: true, color: { argb: "FF1C4587" } }
    const sumFontDkRed = { name: "Malgun Gothic", size: 10, bold: true, color: { argb: "FFCC0000" } }
    const sumFontRed = { name: "Malgun Gothic", size: 10, bold: true, color: { argb: "FFFF0000" } }
    // 정렬
    const centerAlign = { horizontal: "center" as const, vertical: "middle" as const, wrapText: true }
    const rightAlign = { horizontal: "right" as const, vertical: "middle" as const }
    const leftAlign = { horizontal: "left" as const, vertical: "middle" as const }

    // 숫자 포맷 상수 (원본 그대로)
    const FMT_COMMA = '#,##0 ;[Red](#,##0)'
    const FMT_COMMA2 = '#,##0_ ;[Red]\\-#,##0\\ '
    const FMT_INT = '#,##0'
    const FMT_PCT = '0.00%'
    const FMT_PCT1 = '0.0%'
    const FMT_PCT0 = '0%'

    // ── 눈금선 제거 + 헤더행 고정 (원본과 동일) ──
    ws.views = [{ showGridLines: false, state: "frozen" as const, ySplit: 7 }]

    // ── Row 1: 빈 행 (높이 9.75) ──
    ws.getRow(1).height = 9.75

    // ── Row 2: 영업건명 (높이 29.25, bg 파란색, 하단 double 테두리) ──
    ws.getRow(2).height = 29.25
    ws.mergeCells("A2:J2")
    const titleCell = ws.getCell("A2")
    titleCell.value = `◎ 영업건명 : ${header.projectName}`
    titleCell.font = { ...titleFont, size: 12 }
    titleCell.fill = titleFill
    titleCell.alignment = { ...leftAlign, indent: 1 }
    // 병합된 범위: 배경 + 하단 double 테두리 (#1F497D)
    for (let c = 1; c <= 10; c++) {
      const cell = ws.getRow(2).getCell(c)
      cell.fill = titleFill
      cell.border = { bottom: bDoubleDark }
    }

    // ── Row 3: 수요처 (높이 22.5, top에 double 테두리) ──
    ws.getRow(3).height = 22.5
    ws.getCell("A3").value = `◎ 수요처 : ${header.customer}`
    ws.getCell("A3").font = titleFont
    ws.getCell("A3").alignment = { vertical: "middle" as const }
    ws.getCell("A3").border = { top: bDoubleDark }
    ws.getCell("D3").value = `◎ 수요처 담당 : ${header.customerContact}`
    ws.getCell("D3").font = titleFont
    ws.getCell("D3").alignment = { vertical: "middle" as const }

    // ── Row 4: 소속/담당 (높이 22.5) ──
    ws.getRow(4).height = 22.5
    ws.mergeCells("A4:C4")
    ws.getCell("A4").value = `◎ 멜레아 소속 : ${header.team}`
    ws.getCell("A4").font = titleFont
    ws.getCell("A4").alignment = { vertical: "middle" as const }
    ws.getCell("D4").value = `◎ 멜레아 담당 : ${header.manager}`
    ws.getCell("D4").font = titleFont
    ws.getCell("D4").alignment = { vertical: "middle" as const }
    ws.getCell("U4").value = "(부가세 별도)"
    ws.getCell("U4").font = { ...titleFont, size: 8 }
    ws.getCell("U4").alignment = rightAlign

    // ── Row 5: 빈 행 (높이 9.75) ──
    ws.getRow(5).height = 9.75

    // ── Row 6-7: 헤더 (높이 13.5) ──
    ws.getRow(6).height = 13.5
    ws.getRow(7).height = 13.5

    // 헤더 셀 작성 헬퍼
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setHdr = (addr: string, text: string, font: any = headerFont, border: any = { left: bHair, right: bHair, top: bMedium, bottom: bThin }) => {
      const cell = ws.getCell(addr)
      cell.value = text
      cell.font = font
      cell.fill = headerFill
      cell.border = border
      cell.alignment = centerAlign
    }

    // Row 6 (그룹 헤더) — rowspan 2인 것들
    // ExcelJS 병합 셀: 모든 셀에 동일한 외곽 테두리를 넣어야 끊김 없음
    // A열(좌측 외곽)은 left=medium
    ws.mergeCells("A6:A7")
    const a6Border = { left: bMedium, right: bHair, top: bMedium, bottom: bThin }
    setHdr("A6", "구분", headerFont, a6Border)
    ws.getCell("A7").fill = headerFill; ws.getCell("A7").border = a6Border

    const midCols: [string, string][] = [["B6","매입처"],["C6","품목"],["D6","규격"],["E6","수량"],["F6","반출가"],["G6","DC율"],["H6","옵션물"]]
    const midBorder = { left: bHair, right: bHair, top: bMedium, bottom: bThin }
    for (const [addr, text] of midCols) {
      const col = addr[0]
      ws.mergeCells(`${col}6:${col}7`)
      setHdr(addr, text, headerFont, midBorder)
      ws.getCell(`${col}7`).fill = headerFill; ws.getCell(`${col}7`).border = midBorder
    }

    // 매입가 (I-J, colspan 2)
    ws.mergeCells("I6:J6")
    setHdr("I6", "매입가", headerFont, { left: bHair, right: bHair, top: bMedium, bottom: bHair })
    ws.getCell("J6").fill = headerFill; ws.getCell("J6").border = { left: bHair, right: bHair, top: bMedium, bottom: bHair }
    setHdr("I7", "단가", headerFont, { left: bHair, right: bHair, top: bHair, bottom: bThin })
    setHdr("J7", "금액", headerFont, { left: bHair, right: bHair, top: bHair, bottom: bThin })

    // MG율 (K, rowspan 2)
    ws.mergeCells("K6:K7")
    setHdr("K6", "MG율\n(Reb 차감율)", headerFont, { left: bThin, right: bHair, top: bMedium, bottom: bThin })
    ws.getCell("K7").fill = headerFill; ws.getCell("K7").border = { left: bThin, right: bHair, top: bMedium, bottom: bThin }

    // 제안가 (L-M, colspan 2)
    ws.mergeCells("L6:M6")
    setHdr("L6", "제안가", headerFont, { left: bHair, right: bHair, top: bMedium, bottom: bHair })
    ws.getCell("M6").fill = headerFill; ws.getCell("M6").border = { left: bHair, right: bThin, top: bMedium, bottom: bHair }
    setHdr("L7", "단가", headerFont, { left: bHair, right: bHair, top: bHair, bottom: bThin })
    setHdr("M7", "금액", headerFont, { left: bHair, right: bThin, top: bHair, bottom: bThin })

    // 프론트 이윤 (N-O, colspan 2)
    ws.mergeCells("N6:O6")
    setHdr("N6", "프론트 이윤", headerFont, { left: bThin, right: bHair, top: bMedium, bottom: bHair })
    ws.getCell("O6").fill = headerFill; ws.getCell("O6").border = { left: bHair, right: bThin, top: bMedium, bottom: bHair }
    setHdr("N7", "단가", headerFont, { left: bThin, right: bHair, top: bHair, bottom: bThin })
    setHdr("O7", "금액", headerFont, { left: bHair, right: bThin, top: bHair, bottom: bThin })

    // 장려금 이윤 (P-T, colspan 5) — 빨간색 폰트
    ws.mergeCells("P6:T6")
    setHdr("P6", "장려금 이윤", headerFontRed, { left: bThin, right: bHair, top: bMedium, bottom: bHair })
    for (const c of ["Q6","R6","S6"]) {
      ws.getCell(c).fill = headerFill; ws.getCell(c).border = { left: bHair, right: bHair, top: bMedium, bottom: bHair }
    }
    ws.getCell("T6").fill = headerFill; ws.getCell("T6").border = { left: bHair, right: bThin, top: bMedium, bottom: bHair }
    ws.mergeCells("P7:Q7")
    setHdr("P7", "등급 Reb", headerFontRed, { left: bThin, right: bHair, top: bHair, bottom: bThin })
    ws.getCell("Q7").fill = headerFill; ws.getCell("Q7").border = { left: bHair, right: bHair, top: bHair, bottom: bThin }
    ws.mergeCells("R7:S7")
    setHdr("R7", "품목 Reb", headerFontRed, { left: bHair, right: bHair, top: bHair, bottom: bThin })
    ws.getCell("S7").fill = headerFill; ws.getCell("S7").border = { left: bHair, right: bHair, top: bHair, bottom: bThin }
    setHdr("T7", "금액", headerFontRed, { left: bHair, right: bThin, top: bHair, bottom: bThin })

    // 전체 이윤 (U, rowspan 2) — 빨간색 폰트, right=medium (외곽)
    ws.mergeCells("U6:U7")
    setHdr("U6", "전체 이윤", headerFontRed, { left: bThin, right: bMedium, top: bMedium, bottom: bThin })
    ws.getCell("U7").fill = headerFill; ws.getCell("U7").border = { left: bThin, right: bMedium, top: bMedium, bottom: bThin }

    // ── 데이터 행 ──
    // 열별 숫자 포맷 매핑 (원본 그대로)
    const colFormats: Record<number, string> = {
      6: FMT_COMMA2, 7: FMT_PCT, 8: FMT_COMMA, 9: FMT_COMMA, 10: FMT_COMMA,
      11: FMT_PCT, 12: FMT_INT, 13: FMT_COMMA, 14: FMT_INT, 15: FMT_INT,
      16: FMT_PCT1, 17: FMT_COMMA, 18: FMT_PCT0, 19: FMT_COMMA, 20: FMT_COMMA, 21: FMT_INT,
    }

    rows.forEach((r, i) => {
      const rowNum = 8 + i  // 엑셀 1-based 행 번호
      const R = rowNum
      const exRow = ws.getRow(rowNum)
      exRow.height = 18.75
      const c = calc(r)
      // A열: left=medium (외곽), 나머지 dotted
      const aBorder = { left: bMedium, right: bDotGray, bottom: bDotGray }
      // 나머지 데이터 셀: left+right+bottom dotted
      const dBorder = dataBorder

      // A~D: 텍스트 (기본 회색 #434343)
      const textVals = [r.category, r.supplier, r.item, r.spec]
      textVals.forEach((v, ci) => {
        const cell = exRow.getCell(ci + 1)
        cell.value = v || ""
        cell.font = dataFontDefault; cell.border = ci === 0 ? aBorder : dBorder
      })

      // E: 수량
      const eCell = exRow.getCell(5)
      eCell.value = r.quantity || null
      eCell.font = dataFontDefault; eCell.border = dBorder; eCell.alignment = rightAlign

      // F: 반출가
      const fCell = exRow.getCell(6)
      fCell.value = r.listPrice || null
      fCell.font = dataFontDefault; fCell.border = dBorder; fCell.alignment = rightAlign
      fCell.numFmt = FMT_COMMA2

      // G: DC율
      const gCell = exRow.getCell(7)
      gCell.value = r.dcRate ? r.dcRate / 100 : null
      gCell.font = dataFontDefault; gCell.border = dBorder; gCell.alignment = rightAlign
      gCell.numFmt = FMT_PCT

      // H: 옵션물
      const hCell = exRow.getCell(8)
      hCell.value = r.optionAmount || null
      hCell.font = dataFontDefault; hCell.border = dBorder; hCell.alignment = rightAlign
      hCell.numFmt = FMT_COMMA

      // I: 매입가 단가 (#434343)
      const iCell = exRow.getCell(9)
      iCell.value = { formula: `F${R}-(F${R}*G${R})`, result: c.purchaseUnit }
      iCell.font = dataFontDefault; iCell.border = dBorder; iCell.alignment = rightAlign
      iCell.numFmt = FMT_COMMA

      // J: 매입가 금액 (#434343)
      const jCell = exRow.getCell(10)
      jCell.value = { formula: `I${R}*E${R}`, result: c.purchaseAmt }
      jCell.font = dataFontDefault; jCell.border = dBorder; jCell.alignment = rightAlign
      jCell.numFmt = FMT_COMMA

      // K: MG율 (#434343, center)
      const kCell = exRow.getCell(11)
      kCell.value = { formula: `O${R}/M${R}`, result: c.mgRate }
      kCell.font = dataFontDefault; kCell.border = dBorder
      kCell.alignment = { horizontal: "center" as const }
      kCell.numFmt = FMT_PCT

      // L: 제안가 단가 (파란색 #1C4587)
      const lCell = exRow.getCell(12)
      lCell.value = r.proposedUnit || null
      lCell.font = dataFontBlue; lCell.border = dBorder; lCell.alignment = rightAlign
      lCell.numFmt = FMT_INT

      // M: 제안가 금액 (파란색 #1C4587)
      const mCell = exRow.getCell(13)
      mCell.value = { formula: `L${R}*E${R}`, result: c.proposedAmt }
      mCell.font = dataFontBlue; mCell.border = dBorder; mCell.alignment = rightAlign
      mCell.numFmt = FMT_COMMA

      // N: 프론트이윤 단가 (짙은빨강 #CC0000)
      const nCell = exRow.getCell(14)
      nCell.value = { formula: `L${R}-I${R}`, result: c.frontUnit }
      nCell.font = dataFontDarkRed; nCell.border = dBorder; nCell.alignment = rightAlign
      nCell.numFmt = FMT_INT

      // O: 프론트이윤 금액 (짙은빨강 #CC0000)
      const oCell = exRow.getCell(15)
      oCell.value = { formula: `N${R}*E${R}`, result: c.frontAmt }
      oCell.font = dataFontDarkRed; oCell.border = dBorder; oCell.alignment = rightAlign
      oCell.numFmt = FMT_INT

      // P: 등급 Reb % (빨강 #FF0000)
      const pCell = exRow.getCell(16)
      pCell.value = r.gradeReb ? r.gradeReb / 100 : 0
      pCell.font = dataFontRed; pCell.border = dBorder; pCell.alignment = rightAlign
      pCell.numFmt = FMT_PCT1

      // Q: 등급 Reb 금액 (빨강 #FF0000)
      const qCell = exRow.getCell(17)
      qCell.value = { formula: `P${R}*F${R}`, result: c.gradeRebAmt }
      qCell.font = dataFontRed; qCell.border = dBorder; qCell.alignment = rightAlign
      qCell.numFmt = FMT_COMMA

      // R: 품목 Reb % (빨강 #FF0000)
      const rCell = exRow.getCell(18)
      rCell.value = r.itemReb ? r.itemReb / 100 : 0
      rCell.font = dataFontRed; rCell.border = dBorder; rCell.alignment = rightAlign
      rCell.numFmt = FMT_PCT0

      // S: 품목 Reb 금액 (자동 = R*F, 빨강 #FF0000)
      const sCell = exRow.getCell(19)
      sCell.value = { formula: `R${R}*F${R}`, result: c.itemRebAmt }
      sCell.font = dataFontRed; sCell.border = dBorder; sCell.alignment = rightAlign
      sCell.numFmt = FMT_COMMA

      // T: 장려금 금액 (빨강 #FF0000)
      const tCell = exRow.getCell(20)
      tCell.value = { formula: `J${R}*P${R}+J${R}*R${R}`, result: c.rebateTotal }
      tCell.font = dataFontRed; tCell.border = dBorder; tCell.alignment = rightAlign
      tCell.numFmt = FMT_COMMA

      // U: 전체이윤 (빨강 #FF0000, right=thin 검정)
      const uCell = exRow.getCell(21)
      uCell.value = { formula: `O${R}+T${R}`, result: c.totalProfit }
      uCell.font = dataFontRed; uCell.alignment = rightAlign; uCell.numFmt = FMT_INT
      uCell.border = {
        left: bDotGray,
        right: bMedium,  // 외곽 테두리
        top: i === 0 ? bThin : bDotGray,
        bottom: bDotGray,
      }
    })

    // ── 합계 행 ──
    const sR = 8 + rows.length  // 합계 행 번호 (1-based)
    const firstR = 8
    const lastR = 7 + rows.length
    const sumRow = ws.getRow(sR)
    sumRow.height = 27.75

    // 합계 행 테두리: top=double, bottom=medium
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sumBorder = (left: any = bHair) => ({
      left, top: bDouble, bottom: bMedium
    })

    // A~G 합계 라벨 병합
    ws.mergeCells(`A${sR}:G${sR}`)
    const sumLabel = sumRow.getCell(1)
    sumLabel.value = "합계"
    sumLabel.font = sumFontBlack; sumLabel.alignment = centerAlign
    sumLabel.border = { left: bMedium, top: bDouble, bottom: bMedium }
    for (let c = 2; c <= 7; c++) { sumRow.getCell(c).border = sumBorder() }

    // H, I 빈 셀
    sumRow.getCell(8).border = sumBorder()
    sumRow.getCell(9).border = sumBorder()

    // J: 매입가 금액 합계 (검정)
    const jSum = sumRow.getCell(10)
    jSum.value = { formula: `SUM(J${firstR}:J${lastR})`, result: totals.purchaseAmt }
    jSum.font = sumFontBlack; jSum.border = sumBorder(); jSum.alignment = rightAlign
    jSum.numFmt = FMT_COMMA

    // K: 전체 MG율 (파란색 #366092)
    const kSum = sumRow.getCell(11)
    kSum.value = { formula: `N${sR}/M${sR}`, result: totalMgRate }
    kSum.font = sumFontBlue; kSum.border = sumBorder(bThin); kSum.alignment = rightAlign
    kSum.numFmt = FMT_PCT

    // L 빈 셀
    sumRow.getCell(12).border = sumBorder(); sumRow.getCell(12).numFmt = FMT_COMMA

    // M: 제안가 금액 합계 (진파랑 #1C4587)
    const mSum = sumRow.getCell(13)
    mSum.value = { formula: `SUM(M${firstR}:M${lastR})`, result: totals.proposedAmt }
    mSum.font = sumFontDkBlue; mSum.border = { right: bThin, top: bDouble, bottom: bMedium }
    mSum.alignment = rightAlign; mSum.numFmt = FMT_COMMA

    // N-O: 프론트이윤 합계 (짙은빨강 #CC0000)
    ws.mergeCells(`N${sR}:O${sR}`)
    const nSum = sumRow.getCell(14)
    nSum.value = { formula: `SUM(O${firstR}:O${lastR})`, result: totals.frontAmt }
    nSum.font = sumFontDkRed; nSum.border = sumBorder(bThin); nSum.alignment = rightAlign
    nSum.numFmt = FMT_INT
    sumRow.getCell(15).border = sumBorder()

    // P-T: 장려금 합계 (빨강 #FF0000)
    ws.mergeCells(`P${sR}:T${sR}`)
    const pSum = sumRow.getCell(16)
    pSum.value = { formula: `SUM(T${firstR}:T${lastR})`, result: totals.rebateTotal }
    pSum.font = sumFontRed; pSum.border = sumBorder(bThin); pSum.alignment = rightAlign
    pSum.numFmt = FMT_COMMA
    for (let c = 17; c <= 20; c++) { sumRow.getCell(c).border = sumBorder() }

    // U: 전체이윤 합계 (빨강, medium 4면 테두리)
    const uSum = sumRow.getCell(21)
    uSum.value = { formula: `P${sR}+N${sR}`, result: totals.totalProfit }
    uSum.font = sumFontRed; uSum.alignment = rightAlign; uSum.numFmt = FMT_COMMA
    uSum.border = { left: bMedium, right: bMedium, top: bMedium, bottom: bMedium }

    // ── VAT 포함 행 ──
    const vatR = sR + 1
    ws.getRow(vatR).height = 16.5
    const vatCell = ws.getCell(`M${vatR}`)
    vatCell.value = { formula: `M${sR}*1.1`, result: vatAmount }
    vatCell.font = { name: "Malgun Gothic", size: 9, color: { argb: "FF366092" } }
    vatCell.alignment = rightAlign
    vatCell.numFmt = FMT_COMMA

    // ── 파일 다운로드 ──
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `지출결의서_${header.projectName || "미정"}_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }, [rows, totals, totalMgRate, vatAmount, header])

  // ══════════════════════════════════════════════════════════
  // 렌더링
  // ══════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-[12px] text-gray-400">
        불러오는 중...
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* ── 상단 정보 (컴팩트) ── */}
      <div className="bg-white border border-gray-200 rounded px-2.5 py-1.5 max-w-[600px]">
        <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-2 items-center text-[11px]">
          <span className="text-gray-400 shrink-0">영업건명</span>
          <input
            type="text"
            value={header.projectName}
            onChange={(e) => setH("projectName", e.target.value)}
            className="col-span-3 border-b border-dashed border-gray-200 bg-transparent outline-none text-[11px] font-semibold text-gray-800 px-0.5 py-px focus:border-blue-400"
            placeholder="프로젝트명"
          />
          <span className="text-gray-400 shrink-0">수요처</span>
          <input
            type="text"
            value={header.customer}
            onChange={(e) => setH("customer", e.target.value)}
            className="border-b border-dashed border-gray-200 bg-transparent outline-none text-[11px] text-gray-700 px-0.5 py-px focus:border-blue-400"
            placeholder="수요처명"
          />
          <span className="text-gray-400 shrink-0">수요처 담당</span>
          <input
            type="text"
            value={header.customerContact}
            onChange={(e) => setH("customerContact", e.target.value)}
            className="border-b border-dashed border-gray-200 bg-transparent outline-none text-[11px] text-gray-700 px-0.5 py-px focus:border-blue-400"
            placeholder="담당자명"
          />
          <span className="text-gray-400 shrink-0">멜레아 소속</span>
          <input
            type="text"
            value={header.team}
            onChange={(e) => setH("team", e.target.value)}
            className="border-b border-dashed border-gray-200 bg-transparent outline-none text-[11px] text-gray-700 px-0.5 py-px focus:border-blue-400"
            placeholder="소속"
          />
          <span className="text-gray-400 shrink-0">멜레아 담당</span>
          <input
            type="text"
            value={header.manager}
            onChange={(e) => setH("manager", e.target.value)}
            className="border-b border-dashed border-gray-200 bg-transparent outline-none text-[11px] text-gray-700 px-0.5 py-px focus:border-blue-400"
            placeholder="담당자명"
          />
        </div>
      </div>

      {/* ── 엑셀 다운로드 + 행 추가 + 저장 상태 ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 text-gray-500" onClick={addRow}>
            <Plus className="h-3 w-3" />
            행 추가
          </Button>
          {saveStatus && (
            <span className={cn("text-[10px]", saveStatus === "저장 실패" ? "text-red-500" : "text-gray-400")}>
              {saveStatus}
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={handleExport}>
          <Download className="h-3 w-3" />
          엑셀 다운로드
        </Button>
      </div>

      {/* ── 스프레드시트 테이블 ── */}
      <div className="border border-gray-300 rounded overflow-x-auto bg-white" onPaste={handlePaste}>
        <table className="border-collapse text-[11px]" style={{ minWidth: 1500 }}>
          <colgroup>
            <col style={{ width: 26 }} />   {/* 지우개 */}
            {/* A~U열 — 엑셀 템플릿 wpx × 0.5 비율 */}
            <col style={{ width: 66 }} />   {/* A: 구분 */}
            <col style={{ width: 82 }} />   {/* B: 매입처 */}
            <col style={{ width: 82 }} />   {/* C: 품목 */}
            <col style={{ width: 159 }} />  {/* D: 규격 */}
            <col style={{ width: 30 }} />   {/* E: 수량 */}
            <col style={{ width: 81 }} />   {/* F: 반출가 */}
            <col style={{ width: 52 }} />   {/* G: DC율 */}
            <col style={{ width: 38 }} />   {/* H: 옵션물 */}
            <col style={{ width: 77 }} />   {/* I: 매입단가 */}
            <col style={{ width: 90 }} />   {/* J: 매입금액 */}
            <col style={{ width: 52 }} />   {/* K: MG율 */}
            <col style={{ width: 84 }} />   {/* L: 제안단가 */}
            <col style={{ width: 77 }} />   {/* M: 제안금액 */}
            <col style={{ width: 69 }} />   {/* N: 프론트단가 */}
            <col style={{ width: 87 }} />   {/* O: 프론트금액 */}
            <col style={{ width: 44 }} />   {/* P: 등급Reb % */}
            <col style={{ width: 62 }} />   {/* Q: 등급Reb 금액 */}
            <col style={{ width: 42 }} />   {/* R: 품목Reb % */}
            <col style={{ width: 63 }} />   {/* S: 품목Reb 금액 */}
            <col style={{ width: 90 }} />   {/* T: 장려금금액 ×1.3 */}
            <col style={{ width: 108 }} />  {/* U: 전체이윤 ×1.3 */}
            <col style={{ width: 26 }} />   {/* 지우개 */}
            <col style={{ width: 26 }} />   {/* 삭제 */}
          </colgroup>

          {/* ── 헤더 1행: 그룹 ── */}
          <thead>
            <tr className="bg-gray-100">
              <th rowSpan={2} className={cn(TH, "!border-0 bg-transparent")}></th>
              <th rowSpan={2} className={TH}>구분</th>
              <th rowSpan={2} className={TH}>매입처</th>
              <th rowSpan={2} className={TH}>품목</th>
              <th rowSpan={2} className={TH}>규격</th>
              <th rowSpan={2} className={TH}>수량</th>
              <th rowSpan={2} className={TH}>반출가</th>
              <th rowSpan={2} className={TH}>DC율</th>
              <th rowSpan={2} className={TH}>옵션물</th>
              <th colSpan={2} className={TH}>매입가</th>
              <th rowSpan={2} className={cn(TH, "leading-tight")}>
                MG율<br /><span className="text-[8px] text-gray-400 font-normal">(Reb차감)</span>
              </th>
              <th colSpan={2} className={TH}>제안가</th>
              <th colSpan={2} className={TH}>프론트 이윤</th>
              <th colSpan={4} className={TH}>장려금 이윤</th>
              <th rowSpan={2} className={TH}>금액</th>
              <th rowSpan={2} className={cn(TH, "bg-sky-aqua/5")}>전체<br />이윤</th>
              <th rowSpan={2} className={cn(TH, "!border-0 bg-transparent")}></th>
            </tr>
            {/* ── 헤더 2행: 서브 ── */}
            <tr className="bg-gray-50">
              <th className={TH}>단가</th>
              <th className={TH}>금액</th>
              <th className={TH}>단가</th>
              <th className={TH}>금액</th>
              <th className={TH}>단가</th>
              <th className={TH}>금액</th>
              <th className={TH}>등급Reb</th>
              <th className={TH}>금액</th>
              <th className={TH}>품목Reb</th>
              <th className={TH}>금액</th>
            </tr>
          </thead>

          <tbody>
            {/* ── 데이터 행 ── */}
            {rows.map((row, ri) => {
              const c = calc(row)
              return (
                <tr key={row.id} className="group hover:bg-blue-50/20">
                  {/* 지우개 (행 데이터 초기화) */}
                  <td className={cn(TD, "!border-0")}>
                    <button onClick={() => clearRow(row.id)} className="w-full h-full flex items-center justify-center text-gray-300 hover:text-amber-500" title="행 초기화">
                      <Eraser className="h-3 w-3" />
                    </button>
                  </td>
                  {/* A: 구분 (#434343) */}
                  <td className={TD}><CellText value={row.category} onChange={(v) => updateRow(row.id, "category", v)} row={ri} col={0} /></td>
                  {/* B: 매입처 */}
                  <td className={TD}><CellText value={row.supplier} onChange={(v) => updateRow(row.id, "supplier", v)} row={ri} col={1} /></td>
                  {/* C: 품목 */}
                  <td className={TD}><CellText value={row.item} onChange={(v) => updateRow(row.id, "item", v)} row={ri} col={2} /></td>
                  {/* D: 규격 */}
                  <td className={TD}><CellText value={row.spec} onChange={(v) => updateRow(row.id, "spec", v)} row={ri} col={3} /></td>
                  {/* E: 수량 */}
                  <td className={TD}><CellNum value={row.quantity} onChange={(v) => updateRow(row.id, "quantity", v)} row={ri} col={4} /></td>
                  {/* F: 반출가 */}
                  <td className={TD}><CellNum value={row.listPrice} onChange={(v) => updateRow(row.id, "listPrice", v)} row={ri} col={5} /></td>
                  {/* G: DC율 (%) */}
                  <td className={TD}><CellNum value={row.dcRate} onChange={(v) => updateRow(row.id, "dcRate", v)} suffix="%" row={ri} col={6} /></td>
                  {/* H: 옵션물 */}
                  <td className={TD}><CellNum value={row.optionAmount} onChange={(v) => updateRow(row.id, "optionAmount", v)} row={ri} col={7} /></td>
                  {/* I: 매입가 단가 (auto) */}
                  <td className={TD}><CellAuto>{fmt(c.purchaseUnit)}</CellAuto></td>
                  {/* J: 매입가 금액 (auto) */}
                  <td className={TD}><CellAuto>{fmt(c.purchaseAmt)}</CellAuto></td>
                  {/* K: MG율 (auto) */}
                  <td className={TD}><CellAuto>{fmtPct(c.mgRate)}</CellAuto></td>
                  {/* L: 제안가 단가 (파랑 #1C4587) */}
                  <td className={cn(TD, "[&_input]:text-[#1C4587]")}><CellNum value={row.proposedUnit} onChange={(v) => updateRow(row.id, "proposedUnit", v)} row={ri} col={11} /></td>
                  {/* M: 제안가 금액 (파랑) */}
                  <td className={TD}><div className="w-full h-full px-1 text-[11px] text-right bg-gray-100 tabular-nums text-[#1C4587] leading-[32px] select-none truncate">{fmt(c.proposedAmt)}</div></td>
                  {/* N: 프론트이윤 단가 (짙은빨강 #CC0000) */}
                  <td className={TD}><div className="w-full h-full px-1 text-[11px] text-right bg-gray-100 tabular-nums text-[#CC0000] leading-[32px] select-none truncate">{fmt(c.frontUnit)}</div></td>
                  {/* O: 프론트이윤 금액 (짙은빨강) */}
                  <td className={TD}><div className="w-full h-full px-1 text-[11px] text-right bg-gray-100 tabular-nums text-[#CC0000] leading-[32px] select-none truncate">{fmt(c.frontAmt)}</div></td>
                  {/* P: 등급 Reb % (빨강 #FF0000) */}
                  <td className={cn(TD, "[&_input]:text-red-500")}><CellNum value={row.gradeReb} onChange={(v) => updateRow(row.id, "gradeReb", v)} suffix="%" row={ri} col={15} /></td>
                  {/* Q: 등급 Reb 금액 (빨강) */}
                  <td className={TD}><div className="w-full h-full px-1 text-[11px] text-right bg-gray-100 tabular-nums text-red-500 leading-[32px] select-none truncate">{fmt(c.gradeRebAmt)}</div></td>
                  {/* R: 품목 Reb % (빨강) */}
                  <td className={cn(TD, "[&_input]:text-red-500")}><CellNum value={row.itemReb} onChange={(v) => updateRow(row.id, "itemReb", v)} suffix="%" row={ri} col={17} /></td>
                  {/* S: 품목 Reb 금액 (빨강) */}
                  <td className={TD}><div className="w-full h-full px-1 text-[11px] text-right bg-gray-100 tabular-nums text-red-500 leading-[32px] select-none truncate">{fmt(c.itemRebAmt)}</div></td>
                  {/* T: 장려금 금액 (빨강) */}
                  <td className={TD}><div className="w-full h-full px-1 text-[11px] text-right bg-gray-100 tabular-nums text-red-500 leading-[32px] select-none truncate">{fmt(c.rebateTotal)}</div></td>
                  {/* U: 전체이윤 (빨강, 강조) */}
                  <td className={cn(TD, "bg-sky-aqua/5")}><div className="w-full h-full px-1 text-[11px] text-right tabular-nums text-red-500 font-semibold leading-[32px] select-none truncate">{fmt(c.totalProfit)}</div></td>
                  {/* 휴지통 (행 삭제, 항상 표시, 빨간색) */}
                  <td className={cn(TD, "!border-0")}>
                    <button onClick={() => removeRow(row.id)} className="w-full h-full flex items-center justify-center text-red-400 hover:text-red-600" title="행 삭제">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              )
            })}

            {/* ── 합계 행 ── */}
            <tr className="bg-gray-100 font-semibold border-t-2 border-gray-400">
              <td className={cn(TD, "!border-0")} />
              <td colSpan={7} className={cn(TD, "text-center text-[11px] font-bold bg-gray-100 leading-[32px]")}>합계</td>
              <td className={cn(TD, "bg-gray-100")} />
              <td className={cn(TD, "bg-gray-100")} />
              {/* J: 매입가 금액 합계 */}
              <td className={cn(TD, "text-right px-1 text-[11px] tabular-nums bg-gray-100 leading-[32px]")}>{fmt(totals.purchaseAmt)}</td>
              {/* K: 전체 MG율 */}
              <td className={cn(TD, "text-right px-1 text-[11px] tabular-nums bg-gray-100 leading-[32px]")}>{fmtPct(totalMgRate)}</td>
              <td className={cn(TD, "bg-gray-100")} />
              {/* M: 제안가 금액 합계 */}
              <td className={cn(TD, "text-right px-1 text-[11px] tabular-nums bg-gray-100 leading-[32px]")}>{fmt(totals.proposedAmt)}</td>
              {/* N-O: 프론트이윤 합계 (2셀 병합) */}
              <td colSpan={2} className={cn(TD, "text-right px-1 text-[11px] tabular-nums bg-gray-100 leading-[32px]")}>{fmt(totals.frontAmt)}</td>
              {/* P-T: 장려금 합계 (4셀 병합) */}
              <td colSpan={4} className={cn(TD, "text-right px-1 text-[11px] tabular-nums bg-gray-100 leading-[32px]")}>{fmt(totals.rebateTotal)}</td>
              <td className={cn(TD, "bg-gray-100")} />
              {/* U: 전체이윤 합계 */}
              <td className={cn(TD, "text-right px-1 text-[11px] tabular-nums font-bold text-red-500 bg-sky-aqua/10 leading-[32px]")}>{fmt(totals.totalProfit)}</td>
              <td className={cn(TD, "!border-0")} />
            </tr>

            {/* ── VAT 포함 금액 ── */}
            <tr className="bg-gray-50/50">
              <td className={cn(TD, "!border-0")} />
              <td colSpan={12} className={cn(TD, "text-right px-1 text-[10px] text-gray-400 bg-gray-50/50 leading-[32px]")}>VAT 포함</td>
              <td className={cn(TD, "text-right px-1 text-[11px] tabular-nums font-semibold text-gray-700 bg-yellow-50 leading-[32px]")}>{fmt(vatAmount)}</td>
              <td colSpan={8} className={cn(TD, "bg-gray-50/50")} />
              <td className={cn(TD, "!border-0")} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default memo(ExpenseReportTab)
