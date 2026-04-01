import { createAdminClient } from "@/lib/supabase/admin"
import { REQUEST_STATUSES } from "@/lib/constants"
import { RequestKanbanBoard } from "./kanban-board"

// 캐시 비활성화 → 항상 최신 데이터 불러오기
// force-dynamic만으로는 Supabase 내부 fetch의 Data Cache를 막지 못함
// fetchCache: 'force-no-store'로 모든 fetch 요청의 캐시를 완전히 비활성화
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

// ----- 정산 단계 관련 상수 & 유틸 -----
const STAGE_ORDER = ["선금", "중도금", "잔금"] as const
type Stage = typeof STAGE_ORDER[number]

// 키 정규화 — "착수금"/"선급금" 등 별칭을 "선금"으로 통일
const DEPOSIT_ALIASES = new Set(["선금", "선급금", "선수금", "착수금"])
const MIDDLE_ALIASES = new Set(["중도금"])
const FINAL_ALIASES = new Set(["잔금"])

function normalizeStageKey(rawKey: string): string {
  const key = rawKey.trim()
  if (!key) return key
  if (key.startsWith("middle-")) return key
  const compact = key.replace(/\s+/g, "")
  if (DEPOSIT_ALIASES.has(compact)) return "선금"
  if (MIDDLE_ALIASES.has(compact)) return "중도금"
  if (FINAL_ALIASES.has(compact)) return "잔금"
  return key
}

// settlement_type 파싱 — 배열, JSON 문자열, 쉼표 구분 문자열 모두 지원
function parseSettlementType(raw: unknown): Stage[] {
  if (Array.isArray(raw)) {
    return raw.filter((v): v is Stage => (STAGE_ORDER as readonly string[]).includes(v as string))
  }
  if (typeof raw === "string" && raw.trim()) {
    const trimmed = raw.trim()
    // JSON 배열 문자열 (예: '["선금","잔금"]')
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          return parsed.filter((v): v is Stage => (STAGE_ORDER as readonly string[]).includes(v as string))
        }
      } catch { /* 파싱 실패 시 쉼표 구분으로 재시도 */ }
    }
    // 쉼표 구분 문자열 (예: "선금,잔금")
    return trimmed.split(",").map(s => s.trim()).filter((v): v is Stage => (STAGE_ORDER as readonly string[]).includes(v as string))
  }
  return []
}

// ----- 단계별 입금내역에서 rowPaid 계산 -----
function getRowPaid(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0
  const obj = raw as Record<string, unknown>

  // payment_entries 배열에서 confirmed 항목만 합산
  if (Array.isArray(obj.payment_entries)) {
    let total = 0
    for (const entry of obj.payment_entries) {
      if (!entry || typeof entry !== "object") continue
      const e = entry as Record<string, unknown>
      if (e.confirmed === true) {
        total += Math.max(0, Math.round(Number(e.amount) || 0))
      }
    }
    if (obj.payment_entries.length > 0) return total
  }

  // 레거시: payment_entries 없고 actual_amount만 있는 경우 (기존 데이터 → confirmed 간주)
  const legacyAmount = Math.max(0, Math.round(Number(obj.actual_amount) || 0))
  return legacyAmount
}

// ----- stage_summaries 미리 계산 (buildSettlementRows와 동일 로직) -----
function calcStageSummaries(
  supplyAmount: number,
  settlementType: unknown,
  statusMap: Record<string, unknown> | null,
  stageRatios: Record<string, number> | null,
  middleInstallments: number
): { name: string; status: "paid" | "partial" | "unpaid" }[] {
  const stages = parseSettlementType(settlementType)
  if (stages.length === 0 || supplyAmount <= 0) return []

  // 금액 모드 감지: _mode === "amount"이면 값이 공급가액(원)
  const amMode = stageRatios && typeof stageRatios === "object" && (stageRatios as Record<string, unknown>)._mode === "amount"

  // 비율/금액 결정
  const ratios: Record<string, number> = {}
  for (const stage of stages) {
    const fromMeta = Number(stageRatios?.[stage] ?? 0)
    if (amMode) {
      // 금액 모드: 값 그대로 사용 (공급가액)
      ratios[stage] = Math.max(0, Math.round(fromMeta))
    } else {
      // 비율 모드: 0~100% 클리핑
      ratios[stage] = (fromMeta > 0 && Number.isFinite(fromMeta))
        ? Math.max(0, Math.min(100, fromMeta))
        : (100 / stages.length)
    }
  }

  const safeMiddle = Math.max(1, Math.min(5, Math.round(middleInstallments || 1)))

  // settlement_status_map 키 정규화
  const normalizedMap: Record<string, unknown> = {}
  if (statusMap) {
    for (const [key, value] of Object.entries(statusMap)) {
      const nk = normalizeStageKey(key)
      if (nk) normalizedMap[nk] = value
    }
  }

  const safeSupply = Math.max(0, Math.round(supplyAmount))
  const totalVat = Math.floor(safeSupply * 0.1)
  let usedSupply = 0
  let usedVat = 0
  const results: { name: string; status: "paid" | "partial" | "unpaid" }[] = []

  stages.forEach((stage, idx) => {
    const isLast = idx === stages.length - 1
    let stageSupply: number
    let stageVat: number
    if (amMode) {
      // 금액 모드: 저장된 값이 VAT 포함 총액 → 역산
      const stageTotal = ratios[stage]
      stageSupply = Math.round(stageTotal / 1.1)
      stageVat = stageTotal - stageSupply
    } else {
      const ratio = Math.max(0, Math.min(100, Number(ratios[stage] || 0)))
      stageSupply = isLast ? safeSupply - usedSupply : Math.round((safeSupply * ratio) / 100)
      stageVat = isLast ? totalVat - usedVat : Math.floor(stageSupply * 0.1)
    }
    usedSupply += stageSupply
    usedVat += stageVat

    // 중도금 분할 처리
    if (stage === "중도금" && safeMiddle > 1) {
      let usedSplitSupply = 0
      let usedSplitVat = 0
      for (let i = 1; i <= safeMiddle; i++) {
        const isLastInst = i === safeMiddle
        const splitSupply = isLastInst ? stageSupply - usedSplitSupply : Math.round(stageSupply / safeMiddle)
        usedSplitSupply += splitSupply
        const splitVat = isLastInst ? stageVat - usedSplitVat : Math.floor(splitSupply * 0.1)
        usedSplitVat += splitVat
        const key = `middle-${i}`
        const plannedAmount = splitSupply + splitVat
        const rowPaid = getRowPaid(normalizedMap[key])
        const status: "paid" | "partial" | "unpaid" =
          rowPaid >= plannedAmount && plannedAmount > 0 ? "paid"
          : rowPaid > 0 ? "partial"
          : "unpaid"
        results.push({ name: `중도금 ${i}차`, status })
      }
      return
    }

    const plannedAmount = stageSupply + stageVat
    const rawData = normalizedMap[stage]
    const rowPaid = getRowPaid(rawData)
    const status: "paid" | "partial" | "unpaid" =
      rowPaid >= plannedAmount && plannedAmount > 0 ? "paid"
      : rowPaid > 0 ? "partial"
      : "unpaid"
    results.push({ name: stage, status })
  })

  return results
}

// ----- settlement_status_map에서 입금 합계 + 세금계산서 요약 계산 -----
function calcSettlement(
  statusMap: Record<string, { payment_entries?: { amount: number; confirmed?: boolean }[]; tax_invoice_issued?: boolean; actual_amount?: number }> | null,
): { total_paid: number; has_upcoming: boolean; all_confirmed: boolean; tax_invoice_all_issued: boolean; tax_invoice_some_issued: boolean } {
  if (!statusMap) return { total_paid: 0, has_upcoming: false, all_confirmed: false, tax_invoice_all_issued: false, tax_invoice_some_issued: false }
  let totalPaid = 0
  let hasUpcoming = false
  let hasEntries = false
  let allConfirmed = true
  let stageCount = 0
  let issuedCount = 0
  for (const stage of Object.values(statusMap)) {
    if (!stage || typeof stage !== 'object') continue
    stageCount++
    if (stage.tax_invoice_issued === true) issuedCount++
    // payment_entries 정규화
    let entries: { amount: number; confirmed: boolean }[] = []
    if (stage.payment_entries && Array.isArray(stage.payment_entries)) {
      entries = stage.payment_entries.map((e: Record<string, unknown>) => ({
        amount: Math.max(0, Math.round(Number(e.amount) || 0)),
        confirmed: e.confirmed === true,
      }))
    }
    // 레거시: payment_entries 없고 actual_amount만 있는 경우
    if (entries.length === 0) {
      const legacyAmount = Math.max(0, Math.round(Number(stage.actual_amount) || 0))
      if (legacyAmount > 0) {
        entries = [{ amount: legacyAmount, confirmed: true }]
      }
    }
    for (const entry of entries) {
      hasEntries = true
      if (entry.confirmed) {
        totalPaid += entry.amount
      } else {
        allConfirmed = false
        if (entry.amount > 0) hasUpcoming = true
      }
    }
  }
  return {
    total_paid: totalPaid,
    has_upcoming: hasUpcoming,
    all_confirmed: hasEntries && allConfirmed,
    tax_invoice_all_issued: stageCount > 0 && issuedCount === stageCount,
    tax_invoice_some_issued: issuedCount > 0 && issuedCount < stageCount,
  }
}

// ----- Supabase 결과를 RequestItem으로 변환 -----
type SettlementInfo = {
  contract_amount: number
  settlement_type: unknown
  total_paid: number
  has_upcoming: boolean
  all_confirmed: boolean
  tax_invoice_all_issued: boolean
  tax_invoice_some_issued: boolean
  stage_summaries: { name: string; status: "paid" | "partial" | "unpaid" }[]
  start_date: string | null   // 계약 착수일
  end_date: string | null     // 계약 종료일
}

function toRequestItem(
  r: Record<string, unknown>,
  settlementMap: Map<string, SettlementInfo>
) {
  const contractId = (r.contract_id as string | null) ?? null
  const settlement = contractId ? settlementMap.get(contractId) ?? null : null

  return {
    id: r.id as string,
    title: r.title as string,
    inquiry_date: r.inquiry_date as string | null,
    status: r.status as string,
    contract_id: contractId,
    confirmed_quote_id: (r.confirmed_quote_id as string | null) ?? null,
    memo: r.memo as string | null,
    manual_incentive: Number(r.manual_incentive ?? 0),
    created_at: r.created_at as string,
    customer: Array.isArray(r.customer)
      ? (r.customer[0] as { id: string; company_name: string; deleted_at: string | null } | undefined) ?? null
      : (r.customer as { id: string; company_name: string; deleted_at: string | null } | null),
    contract: settlement
      ? {
        id: contractId!,
        contract_amount: settlement.contract_amount,
        total_paid: settlement.total_paid,
        has_upcoming: settlement.has_upcoming,
        all_confirmed: settlement.all_confirmed,
        tax_invoice_all_issued: settlement.tax_invoice_all_issued,
        tax_invoice_some_issued: settlement.tax_invoice_some_issued,
        start_date: settlement.start_date,
        end_date: settlement.end_date,
        stage_summaries: settlement.stage_summaries,
      }
      : null,
  }
}

// ----- 서버 컴포넌트: 데이터 불러오기 -----
export default async function RequestsPage() {
  const supabase = createAdminClient()

  // 모든 데이터를 한 번에 병렬 조회 (기존 2단계 → 1단계로 통합)
  const [requestsResult, hiddenResult, customersResult, contractsResult, metasResult] = await Promise.all([
    // 보이는 의뢰 (hidden = false)
    supabase
      .from("requests")
      .select(`
        id, title, inquiry_date, contract_id, confirmed_quote_id,
        status, memo, manual_incentive, created_at,
        customer:customers(id, company_name, deleted_at)
      `)
      .neq("status", "숨김")
      .eq("hidden", false)
      .order("created_at", { ascending: false }),
    // 숨긴 의뢰 (hidden = true)
    supabase
      .from("requests")
      .select(`
        id, title, inquiry_date, contract_id, confirmed_quote_id,
        status, memo, manual_incentive, created_at,
        customer:customers(id, company_name, deleted_at)
      `)
      .neq("status", "숨김")
      .eq("hidden", true)
      .order("created_at", { ascending: false }),
    // 고객 목록 (의뢰 생성 + 고객 상세 표시용, 삭제되지 않은 고객만)
    supabase
      .from("customers")
      .select("id, company_name, contact_name, phone, email, address, representative, business_number, memo")
      .is("deleted_at", null)
      .order("company_name"),
    // 계약 전체 (삭제 안 된 것만)
    supabase
      .from("contracts")
      .select("*")
      .is("deleted_at", null),
    // 정산 메타 전체
    supabase
      .from("contract_settlement_meta")
      .select("contract_id, settlement_status_map, stage_ratios, middle_installments"),
  ])

  const requests = requestsResult.data
  const hiddenRequests = hiddenResult.data
  const customers = customersResult.data

  // 모든 의뢰에서 contract_id 수집
  const allRequests = [...(requests || []), ...(hiddenRequests || [])]
  const contractIds = new Set(
    allRequests.map((r) => r.contract_id).filter((id): id is string => id != null)
  )

  // 의뢰에 연결된 계약만 필터링
  const contracts = (contractsResult.data || []).filter(c => contractIds.has(c.id))
  const metas = (metasResult.data || []).filter(m => contractIds.has(m.contract_id))

  // 계약 금액 + 정산 메타 데이터를 맵으로 구성
  const settlementMap = new Map<string, SettlementInfo>()

  if (contractIds.size > 0) {

    // contract_id별 메타 맵
    const metaMap = new Map<string, { settlement_status_map: unknown; stage_ratios: unknown; middle_installments: number }>()
    for (const meta of metas || []) {
      metaMap.set(meta.contract_id, meta)
    }

    // contract_id별 입금 합계 계산
    const paidMap = new Map<string, { total_paid: number; has_upcoming: boolean; all_confirmed: boolean; tax_invoice_all_issued: boolean; tax_invoice_some_issued: boolean }>()
    for (const meta of metas || []) {
      paidMap.set(
        meta.contract_id,
        calcSettlement(
          meta.settlement_status_map as Record<string, { payment_entries?: { amount: number; confirmed?: boolean }[]; tax_invoice_issued?: boolean; actual_amount?: number }> | null
        )
      )
    }

    for (const c of contracts || []) {
      const rc = c as Record<string, unknown>
      const paid = paidMap.get(c.id)
      const meta = metaMap.get(c.id)

      // DB 컬럼이 contract_amount 또는 amount일 수 있음 — API의 normalizeContractOutput과 동일 로직
      const contractAmount = Number(rc.contract_amount ?? rc.amount) || 0

      // stage_summaries를 서버에서 미리 계산 — 카드 클릭 후 API 계산과 동일한 결과 보장
      const stageSummaries = calcStageSummaries(
        contractAmount,
        rc.settlement_type,
        (meta?.settlement_status_map as Record<string, unknown>) || null,
        (meta?.stage_ratios as Record<string, number>) || null,
        Number(meta?.middle_installments) || 1
      )

      settlementMap.set(c.id, {
        contract_amount: contractAmount,
        settlement_type: rc.settlement_type,
        total_paid: paid?.total_paid || 0,
        has_upcoming: paid?.has_upcoming || false,
        all_confirmed: paid?.all_confirmed || false,
        tax_invoice_all_issued: paid?.tax_invoice_all_issued || false,
        tax_invoice_some_issued: paid?.tax_invoice_some_issued || false,
        stage_summaries: stageSummaries,
        start_date: (rc.start_date as string | null) ?? null,
        end_date: (rc.end_date as string | null) ?? null,
      })
    }
  }

  const allItems = (requests || []).map((r) => toRequestItem(r as Record<string, unknown>, settlementMap))
  const hiddenItems = (hiddenRequests || []).map((r) => toRequestItem(r as Record<string, unknown>, settlementMap))

  // 상태별 그룹핑 — "숨김"과 "수주 실패"는 칸반 컬럼에서 제외
  const columns = REQUEST_STATUSES
    .filter((s) => s.value !== "숨김" && s.value !== "수주 실패")
    .map((status) => {
      const items = allItems.filter((item) => item.status === status.value)
      return {
        status: status.value,
        items,
        count: items.length,
      }
    })

  // "수주 실패" 항목은 별도로 분리 (하단 접힌 리스트로 표시)
  const failedItems = allItems.filter((item) => item.status === "수주 실패")

  const totalCount = allItems.length

  return (
    <RequestKanbanBoard
      columns={columns}
      totalCount={totalCount}
      customers={(customers || []) as { id: string; company_name: string; contact_name: string | null; phone: string | null; email: string | null; address: string | null; representative: string | null; business_number: string | null; memo: string | null }[]}
      hiddenItems={hiddenItems}
      failedItems={failedItems}
    />
  )
}
