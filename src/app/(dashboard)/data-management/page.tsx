"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Download, Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react"

export default function DataManagementPage() {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{
    type: "success" | "error"
    message: string
    details?: string[]
  } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── 엑셀 내보내기 ──
  const handleExport = async () => {
    setExporting(true)
    setResult(null)
    try {
      // 1. API에서 데이터 가져오기
      const res = await fetch("/api/data-export")
      if (!res.ok) throw new Error("데이터 조회 실패")
      const { data } = await res.json()

      // 2. ExcelJS로 엑셀 생성
      const ExcelJS = await import("exceljs")
      const wb = new ExcelJS.Workbook()

      // ── 고객 시트 ──
      const csWs = wb.addWorksheet("고객")
      const cHeaders = [
        { header: "id (수정금지)", key: "id", width: 38 },
        { header: "회사명 *", key: "company_name", width: 20 },
        { header: "담당자", key: "contact_name", width: 12 },
        { header: "전화번호", key: "phone", width: 15 },
        { header: "이메일", key: "email", width: 22 },
        { header: "사업자번호", key: "business_number", width: 15 },
        { header: "대표자", key: "representative", width: 10 },
        { header: "주소", key: "address", width: 30 },
        { header: "메모", key: "memo", width: 20 },
      ]
      csWs.columns = cHeaders

      // 헤더 스타일
      const headerStyle = {
        font: { bold: true, size: 10, name: "Malgun Gothic" },
        fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFC6D9F0" } },
        border: {
          bottom: { style: "thin" as const, color: { argb: "FF000000" } },
        },
        alignment: { vertical: "middle" as const },
      }
      csWs.getRow(1).eachCell((cell) => {
        cell.font = headerStyle.font
        cell.fill = headerStyle.fill
        cell.border = headerStyle.border
        cell.alignment = headerStyle.alignment
      })
      csWs.getRow(1).height = 24

      // 데이터 채우기
      for (const c of data.customers) {
        csWs.addRow(c)
      }

      // id열 회색 배경 (수정금지 표시)
      csWs.eachRow((row, rowNum) => {
        if (rowNum <= 1) return
        const idCell = row.getCell(1)
        idCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } }
        idCell.font = { size: 8, color: { argb: "FF999999" }, name: "Malgun Gothic" }
      })

      // ── 계약 시트 ──
      const ctWs = wb.addWorksheet("계약")
      const ctHeaders = [
        { header: "id (수정금지)", key: "id", width: 38 },
        { header: "계약명 *", key: "title", width: 25 },
        { header: "계약번호", key: "contract_number", width: 15 },
        { header: "고객명 (매칭용)", key: "customer_name", width: 18 },
        { header: "customer_id (자동)", key: "customer_id", width: 38 },
        { header: "공급가액", key: "contract_amount", width: 15 },
        { header: "정산유형", key: "settlement_type", width: 18 },
        { header: "시작일", key: "start_date", width: 12 },
        { header: "종료일", key: "end_date", width: 12 },
        { header: "카테고리", key: "category", width: 10 },
        { header: "메모", key: "memo", width: 20 },
        { header: "request_id (자동)", key: "request_id", width: 38 },
      ]
      ctWs.columns = ctHeaders

      ctWs.getRow(1).eachCell((cell) => {
        cell.font = headerStyle.font
        cell.fill = headerStyle.fill
        cell.border = headerStyle.border
        cell.alignment = headerStyle.alignment
      })
      ctWs.getRow(1).height = 24

      for (const ct of data.contracts) {
        ctWs.addRow(ct)
      }

      // id, customer_id, request_id 열 회색
      ctWs.eachRow((row, rowNum) => {
        if (rowNum <= 1) return
        for (const colIdx of [1, 5, 12]) {
          const cell = row.getCell(colIdx)
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } }
          cell.font = { size: 8, color: { argb: "FF999999" }, name: "Malgun Gothic" }
        }
      })

      // ── 안내 시트 ──
      const helpWs = wb.addWorksheet("사용법")
      helpWs.getColumn(1).width = 60
      const helpData = [
        "📋 데이터 관리 엑셀 사용법",
        "",
        "1. '고객' 시트, '계약' 시트에 기존 데이터가 들어있습니다.",
        "2. 기존 데이터를 수정하려면 → 해당 행의 값을 직접 고치세요.",
        "   ⚠️ id 열은 절대 수정하지 마세요!",
        "3. 새 데이터를 추가하려면 → 맨 아래에 새 행을 추가하세요.",
        "   id 열은 비워두세요 (자동 생성됩니다).",
        "4. 계약의 '고객명' 열에 고객 시트와 동일한 회사명을 적으면 자동 매칭됩니다.",
        "5. 수정이 끝나면 저장하고, 사이트에서 '엑셀 가져오기'로 업로드하세요.",
        "",
        "⚠️ 주의사항:",
        "- 행을 삭제해도 DB에서 삭제되지 않습니다 (안전).",
        "- '*' 표시된 열은 필수입니다 (비어있으면 건너뜀).",
        "- 날짜는 YYYY-MM-DD 형식으로 입력하세요.",
      ]
      helpData.forEach((text, i) => {
        const row = helpWs.addRow([text])
        if (i === 0) row.font = { bold: true, size: 14, name: "Malgun Gothic" }
        else row.font = { size: 10, name: "Malgun Gothic" }
      })

      // 3. 다운로드
      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `M_데이터_내보내기_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)

      setResult({
        type: "success",
        message: `고객 ${data.customers.length}건, 계약 ${data.contracts.length}건 내보내기 완료`,
      })
    } catch (e) {
      setResult({ type: "error", message: e instanceof Error ? e.message : "내보내기 실패" })
    }
    setExporting(false)
  }

  // ── 엑셀 가져오기 ──
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // input 초기화 (같은 파일 다시 선택 가능)
    if (fileRef.current) fileRef.current.value = ""

    setImporting(true)
    setResult(null)
    try {
      const ExcelJS = await import("exceljs")
      const wb = new ExcelJS.Workbook()
      const buffer = await file.arrayBuffer()
      await wb.xlsx.load(buffer)

      // 고객 시트 파싱
      const csWs = wb.getWorksheet("고객")
      const customers: Record<string, unknown>[] = []
      if (csWs) {
        const headers: string[] = []
        csWs.getRow(1).eachCell((cell, colNumber) => {
          // 헤더에서 key 추출 (괄호 부분 제거)
          const raw = String(cell.value || "")
          const keyMap: Record<string, string> = {
            "id (수정금지)": "id", "회사명 *": "company_name", "담당자": "contact_name",
            "전화번호": "phone", "이메일": "email", "사업자번호": "business_number",
            "대표자": "representative", "주소": "address", "메모": "memo",
          }
          headers[colNumber] = keyMap[raw] || raw
        })
        csWs.eachRow((row, rowNum) => {
          if (rowNum <= 1) return
          const obj: Record<string, unknown> = {}
          row.eachCell((cell, colNumber) => {
            const key = headers[colNumber]
            if (key) obj[key] = cell.value ?? null
          })
          if (obj.company_name) customers.push(obj)
        })
      }

      // 계약 시트 파싱
      const ctWs = wb.getWorksheet("계약")
      const contracts: Record<string, unknown>[] = []
      if (ctWs) {
        const headers: string[] = []
        ctWs.getRow(1).eachCell((cell, colNumber) => {
          const raw = String(cell.value || "")
          const keyMap: Record<string, string> = {
            "id (수정금지)": "id", "계약명 *": "title", "계약번호": "contract_number",
            "고객명 (매칭용)": "customer_name", "customer_id (자동)": "customer_id",
            "공급가액": "contract_amount", "정산유형": "settlement_type",
            "시작일": "start_date", "종료일": "end_date",
            "카테고리": "category", "메모": "memo", "request_id (자동)": "request_id",
          }
          headers[colNumber] = keyMap[raw] || raw
        })
        ctWs.eachRow((row, rowNum) => {
          if (rowNum <= 1) return
          const obj: Record<string, unknown> = {}
          row.eachCell((cell, colNumber) => {
            const key = headers[colNumber]
            if (key) {
              // 날짜 처리
              if ((key === "start_date" || key === "end_date") && cell.value instanceof Date) {
                obj[key] = cell.value.toISOString().slice(0, 10)
              } else {
                obj[key] = cell.value ?? null
              }
            }
          })
          if (obj.title) contracts.push(obj)
        })
      }

      // API로 전송
      const res = await fetch("/api/data-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customers, contracts }),
      })

      if (!res.ok) throw new Error("가져오기 실패")
      const { data } = await res.json()

      const details: string[] = []
      if (data.customersCreated > 0) details.push(`고객 ${data.customersCreated}건 신규 생성`)
      if (data.customersUpdated > 0) details.push(`고객 ${data.customersUpdated}건 수정`)
      if (data.contractsCreated > 0) details.push(`계약 ${data.contractsCreated}건 신규 생성`)
      if (data.contractsUpdated > 0) details.push(`계약 ${data.contractsUpdated}건 수정`)
      if (data.errors?.length > 0) details.push(...data.errors)

      setResult({
        type: data.errors?.length > 0 ? "error" : "success",
        message: data.errors?.length > 0 ? "일부 오류가 있습니다" : "가져오기 완료!",
        details,
      })
    } catch (e) {
      setResult({ type: "error", message: e instanceof Error ? e.message : "가져오기 실패" })
    }
    setImporting(false)
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">데이터 관리</h1>
        <p className="text-sm text-gray-500 mt-1">고객 · 계약 데이터를 엑셀로 내보내고, 수정 후 다시 가져올 수 있어요.</p>
      </div>

      {/* 내보내기 */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">1단계: 엑셀 내보내기</h2>
        <p className="text-xs text-gray-500">현재 DB의 고객 + 계약 데이터를 엑셀로 다운로드합니다.</p>
        <Button onClick={handleExport} disabled={exporting} className="gap-2">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exporting ? "내보내는 중..." : "엑셀 내보내기"}
        </Button>
      </div>

      {/* 가져오기 */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">2단계: 엑셀 수정 후 가져오기</h2>
        <p className="text-xs text-gray-500">
          엑셀에서 데이터를 수정하거나 새 행을 추가한 뒤 업로드하세요.<br />
          <span className="text-amber-600">⚠️ id 열은 절대 수정하지 마세요.</span> 새 행은 id를 비워두면 됩니다.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleImport}
          className="hidden"
        />
        <Button
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="gap-2"
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {importing ? "처리 중..." : "엑셀 가져오기"}
        </Button>
      </div>

      {/* 결과 표시 */}
      {result && (
        <div className={`border rounded-lg p-4 ${result.type === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          <div className="flex items-center gap-2">
            {result.type === "success"
              ? <CheckCircle2 className="h-4 w-4 text-green-600" />
              : <AlertCircle className="h-4 w-4 text-red-600" />
            }
            <span className={`text-sm font-medium ${result.type === "success" ? "text-green-800" : "text-red-800"}`}>
              {result.message}
            </span>
          </div>
          {result.details && result.details.length > 0 && (
            <ul className="mt-2 ml-6 text-xs text-gray-600 space-y-0.5 list-disc">
              {result.details.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
