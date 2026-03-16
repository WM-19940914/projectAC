// ----- 정산 관련 유틸리티 함수 -----

import type {
  SettlementStage,
  SettlementStatusInput,
  SettlementPaymentEntry,
} from "./kanban-types"
import {
  SETTLEMENT_STAGE_ORDER,
  EMPTY_STAGE_RATIOS,
  EMPTY_STAGE_SCHEDULED_DATES,
  EMPTY_STAGE_CONDITIONS,
  DEFAULT_MIDDLE_INSTALLMENTS,
} from "./kanban-types"

// ----- 정산 상태 키 정규화 -----
export function normalizeSettlementStatusKey(rawKey: string): string {
  const key = rawKey.trim()
  if (!key) return key
  if (key.startsWith("middle-")) return key

  const compact = key.replace(/\s+/g, "")
  if (compact === "선금") return "선금"
  if (compact === "잔금") return "잔금"
  if (compact === "중도금") return "중도금"

  // "중도금 1차" → "middle-1" 등의 변환이 필요한 경우에도 호환
  const middleMatch = compact.match(/중도금(\d+)/)
  if (middleMatch) {
    return `middle-${middleMatch[1]}`
  }

  return key
}

// ----- 정산 상태 입력 정규화 -----
export function normalizeSettlementStatusInput(raw: unknown): SettlementStatusInput {
  if (!raw || typeof raw !== "object") {
    return {
      payment_confirmed: false,
      actual_amount: 0,
      received_date: "",
      tax_invoice_issued: false,
      tax_invoice_date: "",
      payment_entries: [],
      has_upcoming: false,
    }
  }

  const obj = raw as Record<string, unknown>

  // payment_entries 배열 정규화
  const rawEntries = Array.isArray(obj.payment_entries) ? obj.payment_entries : []
  const entries: SettlementPaymentEntry[] = rawEntries
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({
      id: typeof e.id === "string" && e.id.trim() ? e.id : `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      amount: Number.isFinite(Number(e.amount)) ? Math.max(0, Math.round(Number(e.amount))) : 0,
      paid_at: typeof e.paid_at === "string" ? e.paid_at : "",
      note: typeof e.note === "string" ? e.note : "",
      confirmed: typeof e.confirmed === "boolean" ? e.confirmed : false,
    }))

  // actual_amount: payment_entries 전체 합산 (confirmed 구분 없음)
  const entrySum = entries.reduce((sum, e) => sum + e.amount, 0)
  const rawActual = Number.isFinite(Number(obj.actual_amount)) ? Math.max(0, Math.round(Number(obj.actual_amount))) : 0
  const actualAmount = entries.length > 0 ? entrySum : rawActual

  // has_upcoming 제거 — confirmed 개념 없으므로 항상 false
  const hasUpcoming = false

  return {
    payment_confirmed: typeof obj.payment_confirmed === "boolean" ? obj.payment_confirmed : false,
    actual_amount: actualAmount,
    received_date: typeof obj.received_date === "string" ? obj.received_date : "",
    tax_invoice_issued: typeof obj.tax_invoice_issued === "boolean" ? obj.tax_invoice_issued : false,
    tax_invoice_date: typeof obj.tax_invoice_date === "string" ? obj.tax_invoice_date : "",
    payment_entries: entries,
    has_upcoming: hasUpcoming,
  }
}

// ----- 정산 상태 맵 전체 정리 -----
export function sanitizeSettlementStatusMap(raw: unknown): Record<string, SettlementStatusInput> {
  if (!raw || typeof raw !== "object") return {}
  const obj = raw as Record<string, unknown>
  const result: Record<string, SettlementStatusInput> = {}
  for (const [key, value] of Object.entries(obj)) {
    const normalizedKey = normalizeSettlementStatusKey(key)
    result[normalizedKey] = normalizeSettlementStatusInput(value)
  }
  return result
}

// ----- 의미 있는 정산 상태가 있는지 확인 -----
export function hasMeaningfulSettlementStatus(map: Record<string, SettlementStatusInput>): boolean {
  return Object.values(map).some((v) =>
    v.payment_confirmed ||
    v.actual_amount > 0 ||
    v.received_date ||
    v.tax_invoice_issued ||
    v.tax_invoice_date ||
    v.payment_entries.length > 0
  )
}

// ----- 정산 형태 정규화 -----
export function normalizeSettlementTypes(raw: unknown): SettlementStage[] {
  if (!raw) return []

  // 문자열 배열인 경우
  if (Array.isArray(raw)) {
    const valid = raw.filter((item): item is SettlementStage =>
      typeof item === "string" && SETTLEMENT_STAGE_ORDER.includes(item as SettlementStage)
    )
    // 순서 보장: SETTLEMENT_STAGE_ORDER에 맞춤
    return SETTLEMENT_STAGE_ORDER.filter((stage) => valid.includes(stage))
  }

  // 쉼표 구분 문자열인 경우
  if (typeof raw === "string" && raw.trim()) {
    const parts = raw.split(",").map((s) => s.trim())
    const valid = parts.filter((item): item is SettlementStage =>
      SETTLEMENT_STAGE_ORDER.includes(item as SettlementStage)
    )
    return SETTLEMENT_STAGE_ORDER.filter((stage) => valid.includes(stage))
  }

  return []
}

// ----- 균등 비율 생성 -----
export function createEvenRatios(selected: SettlementStage[]): Record<SettlementStage, number> {
  const result: Record<SettlementStage, number> = { ...EMPTY_STAGE_RATIOS }
  if (selected.length === 0) return result

  const even = Math.floor(100 / selected.length)
  const remainder = 100 - even * selected.length
  selected.forEach((stage, i) => {
    result[stage] = even + (i === selected.length - 1 ? remainder : 0)
  })
  return result
}

// ----- 비율 정규화 -----
export function normalizeRatios(
  raw: unknown,
  stages: SettlementStage[]
): Record<SettlementStage, number> {
  const result: Record<SettlementStage, number> = { ...EMPTY_STAGE_RATIOS }
  if (!raw || typeof raw !== "object") return result

  const obj = raw as Record<string, unknown>
  stages.forEach((stage) => {
    const value = Number(obj[stage] ?? 0)
    result[stage] = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0
  })
  return result
}

// ----- 중도금 회차 정규화 -----
export function normalizeMiddleInstallments(raw: unknown): number {
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 1) return DEFAULT_MIDDLE_INSTALLMENTS
  return Math.min(5, Math.max(1, Math.round(value)))
}

// ----- 단계별 예정일 정규화 -----
export function normalizeStageScheduledDates(raw: unknown): Record<SettlementStage, string> {
  if (!raw || typeof raw !== "object") return { ...EMPTY_STAGE_SCHEDULED_DATES }
  const obj = raw as Record<string, unknown>
  return {
    선금: typeof obj.선금 === "string" ? obj.선금 : "",
    중도금: typeof obj.중도금 === "string" ? obj.중도금 : "",
    잔금: typeof obj.잔금 === "string" ? obj.잔금 : "",
  }
}

// ----- 조건 정규화 -----
export function normalizeStageConditions(raw: unknown): Record<SettlementStage, string> {
  if (!raw || typeof raw !== "object") return { ...EMPTY_STAGE_CONDITIONS }
  const obj = raw as Record<string, unknown>
  return {
    선금: typeof obj.선금 === "string" ? obj.선금 : "",
    중도금: typeof obj.중도금 === "string" ? obj.중도금 : "",
    잔금: typeof obj.잔금 === "string" ? obj.잔금 : "",
  }
}

// ----- 비율 포맷 -----
export function formatStagePercent(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value)) : "0"
}

// ----- 계약 스냅샷 생성 (변경 감지용) -----
export function buildContractSnapshot(params: {
  draft: {
    id: string | null
    title: string
    customer_id: string
    contract_amount: number
    start_date: string
    end_date: string
    settlement_type: SettlementStage[]
  }
  selectedStages: SettlementStage[]
  stageRatios: Record<SettlementStage, number>
  middleInstallments: number
  stageScheduledDates: Record<SettlementStage, string>
  stageConditions?: Record<SettlementStage, string>
  settlementStatusMap: Record<string, SettlementStatusInput>
  customerId: string | null
}): string {
  const { draft, selectedStages, stageRatios, middleInstallments, stageScheduledDates, stageConditions, settlementStatusMap, customerId } = params
  return JSON.stringify({
    id: draft.id,
    title: draft.title.trim(),
    customer_id: customerId || draft.customer_id || null,
    contract_amount: Math.max(0, Math.round(Number(draft.contract_amount || 0))),
    settlement_type: selectedStages,
    start_date: draft.start_date || null,
    end_date: draft.end_date || null,
    stage_ratios: normalizeRatios(stageRatios, selectedStages),
    middle_installments: normalizeMiddleInstallments(middleInstallments),
    stage_scheduled_dates: selectedStages.reduce((acc, stage) => ({
      ...acc,
      [stage]: stageScheduledDates[stage] || "",
    }), {}),
    stage_conditions: stageConditions ? selectedStages.reduce((acc, stage) => ({
      ...acc,
      [stage]: stageConditions[stage] || "",
    }), {}) : {},
    settlement_status_map: Object.fromEntries(
      Object.entries(settlementStatusMap).map(([key, value]) => [
        normalizeSettlementStatusKey(key),
        normalizeSettlementStatusInput(value),
      ])
    ),
  })
}

// ----- stage_ratios가 금액 모드인지 확인 -----
// DB의 stage_ratios JSONB에 _mode: "amount"가 있으면 금액 모드
export function isAmountMode(rawRatios: unknown): boolean {
  if (!rawRatios || typeof rawRatios !== "object") return false
  return (rawRatios as Record<string, unknown>)._mode === "amount"
}

// ----- 금액 모드에서 stage_ratios 값 추출 (금액 그대로 반환) -----
export function getStageAmounts(rawRatios: unknown, stages: SettlementStage[]): Record<SettlementStage, number> {
  const result: Record<SettlementStage, number> = { 선금: 0, 중도금: 0, 잔금: 0 }
  if (!rawRatios || typeof rawRatios !== "object") return result
  const obj = rawRatios as Record<string, unknown>
  for (const stage of stages) {
    result[stage] = Math.max(0, Math.round(Number(obj[stage]) || 0))
  }
  return result
}

// ----- 정산 행 생성 (VAT 포함 금액 계산) -----
// amountMode=true면 stageRatios 값을 공급가액(원) 금액으로 직접 사용
export function buildSettlementRows(
  supplyAmount: number,
  selectedStages: SettlementStage[],
  stageRatios: Record<SettlementStage, number>,
  middleInstallments: number,
  amountMode?: boolean,
): Array<{ key: string; label: string; ratio: number; supply: number; vat: number; total: number }> {
  if (selectedStages.length === 0) return []

  const rows: Array<{ key: string; label: string; ratio: number; supply: number; vat: number; total: number }> = []

  // VAT 포함 총액: round(supply * 1.1)로 역산 오차 방지
  const totalWithVat = Math.round(supplyAmount * 1.1)

  selectedStages.forEach((stage) => {
    // 금액 모드: stageRatios 값이 VAT 포함 금액
    // 비율 모드: stageRatios 값이 비율(%)
    const rawValue = stageRatios[stage] || 0
    let stageSupply: number
    let stageVat: number
    let stageTotal: number

    if (amountMode) {
      // 금액 모드: 저장된 값 = VAT 포함 금액 → 역산
      stageTotal = Math.max(0, Math.round(rawValue))
      stageSupply = Math.round(stageTotal / 1.1)
      stageVat = stageTotal - stageSupply
    } else {
      stageSupply = Math.round(supplyAmount * rawValue / 100)
      stageVat = Math.floor(stageSupply * 0.1)
      stageTotal = stageSupply + stageVat
    }
    // 표시용 비율 계산
    const ratio = amountMode
      ? (totalWithVat > 0 ? Math.round(stageTotal / totalWithVat * 100) : 0)
      : rawValue

    if (stage === "중도금" && middleInstallments > 1) {
      // 중도금을 회차별로 분할
      const perTotal = Math.floor(stageTotal / middleInstallments)
      const perRatio = Math.floor(ratio / middleInstallments)
      for (let i = 1; i <= middleInstallments; i++) {
        const isLast = i === middleInstallments
        const thisTotal = isLast ? stageTotal - perTotal * (middleInstallments - 1) : perTotal
        const thisSupply = Math.round(thisTotal / 1.1)
        const thisVat = thisTotal - thisSupply
        const thisRatio = isLast ? ratio - perRatio * (middleInstallments - 1) : perRatio
        rows.push({
          key: `middle-${i}`,
          label: `중도금 ${i}차`,
          ratio: thisRatio,
          supply: amountMode ? thisSupply : (isLast ? stageSupply - Math.floor(stageSupply / middleInstallments) * (middleInstallments - 1) : Math.floor(stageSupply / middleInstallments)),
          vat: amountMode ? thisVat : Math.floor((isLast ? stageSupply - Math.floor(stageSupply / middleInstallments) * (middleInstallments - 1) : Math.floor(stageSupply / middleInstallments)) * 0.1),
          total: thisTotal,
        })
      }
    } else {
      rows.push({
        key: stage,
        label: stage,
        ratio,
        supply: stageSupply,
        vat: stageVat,
        total: stageTotal,
      })
    }
  })

  return rows
}

// ----- 칸반 카드에서 단계별 정산 요약 계산 -----
export function computeStageSummaries(
  contractAmount: number,
  settlementMeta?: {
    settlement_status_map: Record<string, unknown> | null
    stage_ratios: Record<string, number> | null
    middle_installments: number
  } | null
): Array<{ name: string; status: "paid" | "partial" | "unpaid" }> {
  if (!settlementMeta) return []
  const rawStatusMap = settlementMeta.settlement_status_map
  if (!rawStatusMap || typeof rawStatusMap !== "object") return []
  const statusMap = sanitizeSettlementStatusMap(rawStatusMap)
  if (!hasMeaningfulSettlementStatus(statusMap)) return []

  const rawRatios = settlementMeta.stage_ratios
  if (!rawRatios || typeof rawRatios !== "object") return []

  const stages = SETTLEMENT_STAGE_ORDER.filter((s) => {
    const r = Number(rawRatios[s] ?? 0)
    return Number.isFinite(r) && r > 0
  })
  if (stages.length === 0) return []

  const amMode = isAmountMode(rawRatios)
  const normalizedRatios = amMode ? getStageAmounts(rawRatios, stages) : normalizeRatios(rawRatios, stages)
  const middleCount = normalizeMiddleInstallments(settlementMeta.middle_installments)
  const rows = buildSettlementRows(contractAmount, stages, normalizedRatios, middleCount, amMode)

  return rows.map((row) => {
    const status = normalizeSettlementStatusInput(statusMap[row.key])
    const entries = status.payment_entries
    const paid = entries.reduce((sum, e) => sum + e.amount, 0)
    const plannedAmount = Math.max(0, Math.round(Number(row.total || 0)))
    const stageStatus: "paid" | "partial" | "unpaid" =
      paid >= plannedAmount && plannedAmount > 0 ? "paid"
      : paid > 0 ? "partial"
      : "unpaid"
    // 비율(%) 포함 — page.tsx 초기 렌더와 동일하게 "선금 50%" 형태로 표시
    const ratioStr = Number.isInteger(row.ratio) ? `${row.ratio}` : row.ratio.toFixed(1)
    return { name: `${row.label} ${ratioStr}%`, status: stageStatus }
  })
}

// ----- 오늘 날짜 문자열 -----
export function getTodayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// ----- 연체일 계산 -----
export function getOverdueDays(dateString: string): number {
  if (!dateString) return 0
  const scheduled = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(scheduled.getTime())) return 0
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffMs = todayStart.getTime() - scheduled.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return diffDays > 0 ? diffDays : 0
}
