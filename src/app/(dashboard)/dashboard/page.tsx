// 대시보드 메인 페이지 (서버 컴포넌트)
// 정산·지출 현황, 매출 추이, 진행 현장, 공헌이익을 한눈에 보여줌

import { createAdminClient } from "@/lib/supabase/admin"
import { DashboardClient } from "./dashboard-client"
import type { SettlementAlert, ExpenseAlert, TaxInvoiceAlert, MonthlyRevenue, MonthlyProgressRevenue, RevenueDetail, ContractContribution, DashboardRequestInfo, DashboardKPI, CustomerVolume } from "./dashboard-types"

// 캐시 비활성화 — 항상 최신 데이터
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

// ----- 정산 단계 키 정규화 (requests/page.tsx와 동일) -----
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

// ----- settlement_type 파싱 -----
type Stage = "선금" | "중도금" | "잔금"
const STAGE_ORDER: Stage[] = ["선금", "중도금", "잔금"]

function parseSettlementType(raw: unknown): Stage[] {
  if (Array.isArray(raw)) {
    return raw.filter((v): v is Stage => STAGE_ORDER.includes(v as Stage))
  }
  if (typeof raw === "string" && raw.trim()) {
    const trimmed = raw.trim()
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          return parsed.filter((v): v is Stage => STAGE_ORDER.includes(v as Stage))
        }
      } catch { /* fallback */ }
    }
    return trimmed.split(",").map(s => s.trim()).filter((v): v is Stage => STAGE_ORDER.includes(v as Stage))
  }
  return []
}

// ----- 단계별 confirmed 입금액 계산 -----
function getRowPaid(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0
  const obj = raw as Record<string, unknown>
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
  return Math.max(0, Math.round(Number(obj.actual_amount) || 0))
}

// ----- 계약 전체 confirmed 입금 합계 (VAT포함) -----
function getContractTotalPaid(statusMap: Record<string, unknown> | null): number {
  if (!statusMap || typeof statusMap !== "object") return 0
  let total = 0
  for (const value of Object.values(statusMap)) {
    total += getRowPaid(value)
  }
  return total
}

// ----- 정산 지연/부분/예정 판정 -----

function calcSettlementAlerts(
  requestId: string,
  requestTitle: string,
  customerName: string,
  contractId: string,
  contractAmount: number,
  settlementType: unknown,
  statusMap: Record<string, unknown> | null,
  stageRatios: Record<string, number> | null,
  middleInstallments: number,
  stageScheduledDates: Record<string, string> | null,
): SettlementAlert[] {
  const stages = parseSettlementType(settlementType)
  if (stages.length === 0 || contractAmount <= 0) return []

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

  // 금액 모드 감지
  const amMode = stageRatios && typeof stageRatios === "object" && (stageRatios as Record<string, unknown>)._mode === "amount"

  // 비율/금액 결정
  const ratios: Record<string, number> = {}
  for (const stage of stages) {
    const fromMeta = Number(stageRatios?.[stage] ?? 0)
    if (amMode) {
      ratios[stage] = Math.max(0, Math.round(fromMeta))
    } else {
      ratios[stage] = fromMeta > 0 ? Math.max(0, Math.min(100, fromMeta)) : (100 / stages.length)
    }
  }

  const safeMiddle = Math.max(1, Math.min(5, Math.round(middleInstallments || 1)))

  // 키 정규화
  const normalizedMap: Record<string, unknown> = {}
  if (statusMap) {
    for (const [key, value] of Object.entries(statusMap)) {
      normalizedMap[normalizeStageKey(key)] = value
    }
  }

  // 예정일 맵 정규화
  const normalizedDates: Record<string, string> = {}
  if (stageScheduledDates) {
    for (const [key, value] of Object.entries(stageScheduledDates)) {
      normalizedDates[normalizeStageKey(key)] = value
    }
  }

  const safeSupply = Math.max(0, Math.round(contractAmount))
  const totalVat = Math.floor(safeSupply * 0.1)
  let usedSupply = 0
  let usedVat = 0
  const alerts: SettlementAlert[] = []

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
      let usedSplit = 0
      let usedSplitVat = 0
      for (let i = 1; i <= safeMiddle; i++) {
        const isLastInst = i === safeMiddle
        const splitSupply = isLastInst ? stageSupply - usedSplit : Math.round(stageSupply / safeMiddle)
        usedSplit += splitSupply
        const splitVat = isLastInst ? stageVat - usedSplitVat : Math.floor(splitSupply * 0.1)
        usedSplitVat += splitVat
        const key = `middle-${i}`
        const plannedAmount = splitSupply + splitVat
        const rowPaid = getRowPaid(normalizedMap[key])
        const scheduledDate = normalizedDates[key] || normalizedDates["중도금"] || ""
        checkAndPush(key, `중도금 ${i}차`, plannedAmount, rowPaid, scheduledDate)
      }
      return
    }

    const plannedAmount = stageSupply + stageVat
    const rowPaid = getRowPaid(normalizedMap[stage])
    const scheduledDate = normalizedDates[stage] || ""
    checkAndPush(stage, stage, plannedAmount, rowPaid, scheduledDate)
  })

  function checkAndPush(key: string, name: string, planned: number, paid: number, scheduled: string) {
    if (paid >= planned && planned > 0) return // 완납 → 스킵

    const schedDate = scheduled ? new Date(`${scheduled}T00:00:00`) : null
    const schedMs = schedDate && !isNaN(schedDate.getTime()) ? schedDate.getTime() : null

    // 지연: 예정일 < 오늘 AND 미완납
    if (schedMs && schedMs < todayMs) {
      const overdueDays = Math.floor((todayMs - schedMs) / (1000 * 60 * 60 * 24))
      alerts.push({
        type: "overdue",
        requestId, requestTitle, customerName, contractId,
        stageName: name, plannedAmount: planned, paidAmount: paid,
        scheduledDate: scheduled, overdueDays,
      })
      return
    }

    // 부분입금: 0 < paid < planned
    if (paid > 0 && paid < planned) {
      alerts.push({
        type: "partial",
        requestId, requestTitle, customerName, contractId,
        stageName: name, plannedAmount: planned, paidAmount: paid,
        scheduledDate: scheduled,
      })
      return
    }

    // 입금예정: 예정일이 미래이고 미입금인 모든 건 (제한 없음)
    if (schedMs && schedMs >= todayMs && paid === 0) {
      alerts.push({
        type: "upcoming",
        requestId, requestTitle, customerName, contractId,
        stageName: name, plannedAmount: planned, paidAmount: paid,
        scheduledDate: scheduled,
      })
    }
  }

  return alerts
}

// ----- 서버 컴포넌트: 데이터 조회 + 가공 -----
export default async function DashboardPage() {
  const supabase = createAdminClient()

  // 5개 쿼리 병렬 실행
  const [requestsResult, contractsResult, metasResult, expensesResult, quoteItemsResult] = await Promise.all([
    // 1. 의뢰 + 고객 조인
    supabase
      .from("requests")
      .select("id, title, status, hidden, customer_id, contract_id, confirmed_quote_id, inquiry_date, memo, manual_incentive, created_at, customer:customers(id, company_name, deleted_at)")
      .neq("status", "숨김")
      .order("created_at", { ascending: false }),
    // 2. 계약
    supabase
      .from("contracts")
      .select("id, title, contract_amount, settlement_type, created_at, start_date, end_date, request_id")
      .is("deleted_at", null),
    // 3. 정산 메타
    supabase
      .from("contract_settlement_meta")
      .select("contract_id, stage_ratios, middle_installments, stage_scheduled_dates, settlement_status_map"),
    // 4. 지출
    supabase
      .from("expenses")
      .select("id, request_id, contract_id, expense_date, amount_excl_tax, is_paid, tax_invoice_due_date, vendor, description"),
    // 5. 견적서 아이템 (장려금 계산용)
    supabase
      .from("quotation_items")
      .select("quotation_id, purchase_amount, incentive_rate"),
  ])

  const requests = requestsResult.data || []
  const contracts = contractsResult.data || []
  const metas = metasResult.data || []
  const expenses = expensesResult.data || []
  const quoteItems = quoteItemsResult.data || []

  // ----- 맵 구성 -----
  const metaMap = new Map(metas.map(m => [m.contract_id, m]))
  const contractMap = new Map(contracts.map(c => [c.id, c]))

  // 견적서별 장려금 합계 (VAT별도): quotation_id → incentive amount
  const quoteIncentiveMap = new Map<string, number>()
  for (const item of quoteItems) {
    const purchaseAmount = Number(item.purchase_amount) || 0
    const incentiveRate = Number(item.incentive_rate) || 0
    if (purchaseAmount > 0 && incentiveRate > 0) {
      const incentiveExclTax = Math.round(purchaseAmount * incentiveRate / 100)
      const qid = item.quotation_id as string
      quoteIncentiveMap.set(qid, (quoteIncentiveMap.get(qid) || 0) + incentiveExclTax)
    }
  }

  // request_id → contract 매핑
  const requestContractMap = new Map<string, typeof contracts[0]>()
  for (const c of contracts) {
    if (c.request_id) requestContractMap.set(c.request_id, c)
  }

  // contract_id → request 매핑
  const contractRequestMap = new Map<string, typeof requests[0]>()
  for (const r of requests) {
    if (r.contract_id) contractRequestMap.set(r.contract_id, r)
  }

  // ----- 1. 정산 알림 계산 -----
  const settlementAlerts: SettlementAlert[] = []
  for (const r of requests) {
    if (r.hidden || r.status === "수주 실패") continue
    if (!r.contract_id) continue
    const contract = contractMap.get(r.contract_id)
    if (!contract) continue
    const meta = metaMap.get(r.contract_id)
    const contractAmount = Number(contract.contract_amount) || 0
    const customerName = Array.isArray(r.customer)
      ? (r.customer[0] as { company_name: string } | undefined)?.company_name || ""
      : (r.customer as { company_name: string } | null)?.company_name || ""

    const alerts = calcSettlementAlerts(
      r.id,
      r.title,
      customerName,
      r.contract_id,
      contractAmount,
      contract.settlement_type,
      (meta?.settlement_status_map as Record<string, unknown>) || null,
      (meta?.stage_ratios as Record<string, number>) || null,
      Number(meta?.middle_installments) || 1,
      (meta?.stage_scheduled_dates as Record<string, string>) || null,
    )
    settlementAlerts.push(...alerts)
  }

  // ----- 2. 지출 알림 계산 -----
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

  const expenseAlerts: ExpenseAlert[] = []
  for (const exp of expenses) {
    // request 찾기 (contract_id → request 매핑)
    const req = exp.contract_id ? contractRequestMap.get(exp.contract_id) : null
    const customerName = req
      ? (Array.isArray(req.customer)
          ? (req.customer[0] as { company_name: string } | undefined)?.company_name || ""
          : (req.customer as { company_name: string } | null)?.company_name || "")
      : ""

    // 미지급 지출
    if (exp.is_paid === false) {
      expenseAlerts.push({
        type: "unpaid",
        requestId: req?.id || "",
        requestTitle: req?.title || "",
        customerName,
        expenseId: exp.id,
        vendor: exp.vendor || "",
        description: exp.description || "",
        amount: Number(exp.amount_excl_tax) || 0,
      })
    }

    // 세금계산서 예정 (7일 이내)
    if (exp.tax_invoice_due_date) {
      const dueDate = new Date(`${exp.tax_invoice_due_date}T00:00:00`)
      if (!isNaN(dueDate.getTime())) {
        const dueMs = dueDate.getTime()
        if (dueMs >= todayMs && dueMs <= todayMs + sevenDaysMs) {
          expenseAlerts.push({
            type: "tax_invoice_due",
            requestId: req?.id || "",
            requestTitle: req?.title || "",
            customerName,
            expenseId: exp.id,
            vendor: exp.vendor || "",
            description: exp.description || "",
            amount: Number(exp.amount_excl_tax) || 0,
            dueDate: exp.tax_invoice_due_date,
          })
        }
      }
    }
  }

  // ----- 3. 세금계산서 미발행 알림 (입금 있으나 발행 안 된 단계) -----
  const taxInvoiceAlerts: TaxInvoiceAlert[] = []
  for (const c of contracts) {
    const contractAmount = Number(c.contract_amount) || 0
    if (contractAmount <= 0) continue
    const meta = metaMap.get(c.id)
    const statusMap = (meta?.settlement_status_map as Record<string, unknown>) || null
    if (!statusMap) continue
    const stages = parseSettlementType(c.settlement_type)
    const stageRatios = (meta?.stage_ratios as Record<string, number>) || null
    const middleInst = Number(meta?.middle_installments) || 1
    const amMode = stageRatios && typeof stageRatios === "object" && (stageRatios as Record<string, unknown>)._mode === "amount"
    const ratios: Record<string, number> = {}
    for (const stage of stages) {
      const fromMeta = Number(stageRatios?.[stage] ?? 0)
      if (amMode) {
        ratios[stage] = Math.max(0, Math.round(fromMeta))
      } else {
        ratios[stage] = fromMeta > 0 ? Math.max(0, Math.min(100, fromMeta)) : (100 / stages.length)
      }
    }
    const safeSupply = Math.max(0, Math.round(contractAmount))
    const totalVat = Math.floor(safeSupply * 0.1)
    let usedSupply = 0, usedVat = 0

    // 의뢰 정보
    const req = contractRequestMap.get(c.id)
    const reqTitle = (c as Record<string, unknown>).title as string || req?.title || "제목 없음"

    // 단계별 체크
    const stageEntries: { key: string; stageName: string; amount: number }[] = []
    stages.forEach((stage, idx) => {
      const isLast = idx === stages.length - 1
      let stageSupply: number, stageVat: number
      if (amMode) {
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
      if (stage === "중도금" && Math.max(1, Math.min(5, Math.round(middleInst))) > 1) {
        const safeMiddle = Math.max(1, Math.min(5, Math.round(middleInst)))
        let usSplit = 0, usVatSplit = 0
        for (let i = 1; i <= safeMiddle; i++) {
          const last = i === safeMiddle
          const ss = last ? stageSupply - usSplit : Math.round(stageSupply / safeMiddle)
          usSplit += ss
          const sv = last ? stageVat - usVatSplit : Math.floor(ss * 0.1)
          usVatSplit += sv
          stageEntries.push({ key: `middle-${i}`, stageName: `중도금 ${i}차`, amount: ss + sv })
        }
      } else {
        stageEntries.push({ key: stage, stageName: stage, amount: stageSupply + stageVat })
      }
    })

    // 정규화된 statusMap
    const normalizedStatusMap: Record<string, Record<string, unknown>> = {}
    for (const [key, value] of Object.entries(statusMap)) {
      if (value && typeof value === "object") {
        normalizedStatusMap[normalizeStageKey(key)] = value as Record<string, unknown>
      }
    }

    // 입금이 있으나 세금계산서 미발행인 단계 찾기
    for (const { key, stageName, amount } of stageEntries) {
      const stageData = normalizedStatusMap[key]
      if (!stageData) continue
      const paid = getRowPaid(stageData)
      if (paid <= 0) continue // 입금 없으면 스킵
      // 세금계산서 발행 여부 체크
      const taxInvoiceIssued = stageData.tax_invoice_issued === true
      const taxInvoiceDate = stageData.tax_invoice_date as string | undefined
      if (!taxInvoiceIssued && !taxInvoiceDate) {
        taxInvoiceAlerts.push({
          requestId: req?.id || "",
          requestTitle: reqTitle,
          contractId: c.id,
          stageName,
          amount,
          paidAmount: paid,
        })
      }
    }
  }

  // ----- 4. 매출 그래프 데이터 (계산서 발행일 기준, 연도별) -----
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1~12

  // 연도별 → 월별 { amount, count } 집계 맵: "YYYY-MM" → { amount, count }
  const revenueMap = new Map<string, { amount: number; count: number }>()
  // 상세 데이터: "YYYY-MM" → RevenueDetail[]
  const revenueDetailMap = new Map<string, RevenueDetail[]>()

  // 계산서 발행일 = settlement_status_map 각 단계의 tax_invoice_date
  // 해당 단계의 금액(stageSupply + stageVat)을 발행일 월에 집계
  for (const c of contracts) {
    const contractAmount = Number(c.contract_amount) || 0
    if (contractAmount <= 0) continue
    const meta = metaMap.get(c.id)
    const statusMap = (meta?.settlement_status_map as Record<string, unknown>) || null
    if (!statusMap) continue
    const stages = parseSettlementType(c.settlement_type)
    const stageRatios = (meta?.stage_ratios as Record<string, number>) || null
    const middleInst = Number(meta?.middle_installments) || 1
    const amMode = stageRatios && typeof stageRatios === "object" && (stageRatios as Record<string, unknown>)._mode === "amount"
    const ratios: Record<string, number> = {}
    for (const stage of stages) {
      const fromMeta = Number(stageRatios?.[stage] ?? 0)
      if (amMode) {
        ratios[stage] = Math.max(0, Math.round(fromMeta))
      } else {
        ratios[stage] = fromMeta > 0 ? Math.max(0, Math.min(100, fromMeta)) : (100 / stages.length)
      }
    }
    const safeSupply = Math.max(0, Math.round(contractAmount))
    const totalVat = Math.floor(safeSupply * 0.1)
    let usedSupply = 0, usedVat = 0

    // 계약에 연결된 의뢰 정보 (제목, 고객명)
    const req = contractRequestMap.get(c.id)
    const cTitle = (c as Record<string, unknown>).title as string || req?.title || "제목 없음"
    const cCustomer = req
      ? (Array.isArray(req.customer)
          ? (req.customer[0] as { company_name: string } | undefined)?.company_name || ""
          : (req.customer as { company_name: string } | null)?.company_name || "")
      : ""

    // 각 단계별 금액과 발행일 추출
    const stageAmounts: { key: string; stageName: string; amount: number }[] = []
    stages.forEach((stage, idx) => {
      const isLast = idx === stages.length - 1
      let stageSupply: number, stageVat: number
      if (amMode) {
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

      if (stage === "중도금" && Math.max(1, Math.min(5, Math.round(middleInst))) > 1) {
        const safeMiddle = Math.max(1, Math.min(5, Math.round(middleInst)))
        let usSplit = 0, usVatSplit = 0
        for (let i = 1; i <= safeMiddle; i++) {
          const last = i === safeMiddle
          const ss = last ? stageSupply - usSplit : Math.round(stageSupply / safeMiddle)
          usSplit += ss
          const sv = last ? stageVat - usVatSplit : Math.floor(ss * 0.1)
          usVatSplit += sv
          stageAmounts.push({ key: `middle-${i}`, stageName: `중도금 ${i}차`, amount: ss + sv })
        }
      } else {
        stageAmounts.push({ key: stage, stageName: stage, amount: stageSupply + stageVat })
      }
    })

    // 정규화된 statusMap
    const normalizedMap: Record<string, Record<string, unknown>> = {}
    for (const [key, value] of Object.entries(statusMap)) {
      if (value && typeof value === "object") {
        normalizedMap[normalizeStageKey(key)] = value as Record<string, unknown>
      }
    }

    // 발행일이 있는 단계만 집계 + 상세 데이터 수집
    for (const { key, stageName, amount } of stageAmounts) {
      const stageData = normalizedMap[key]
      if (!stageData) continue
      const invoiceDate = stageData.tax_invoice_date as string | undefined
      if (!invoiceDate) continue
      const d = new Date(invoiceDate)
      if (isNaN(d.getTime())) continue
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const prev = revenueMap.get(ym) || { amount: 0, count: 0 }
      revenueMap.set(ym, { amount: prev.amount + amount, count: prev.count + 1 })
      // 상세 데이터 추가
      const details = revenueDetailMap.get(ym) || []
      details.push({
        contractId: c.id,
        requestId: c.request_id || req?.id || null,
        title: cTitle,
        customerName: cCustomer,
        stageName,
        amount,
        invoiceDate,
      })
      revenueDetailMap.set(ym, details)
    }
  }

  // 사용 가능한 연도 목록 추출 (데이터가 있는 연도 + 현재 연도)
  const revenueYears = new Set<number>()
  revenueYears.add(currentYear)
  revenueMap.forEach((_, ym) => {
    revenueYears.add(parseInt(ym.split("-")[0]))
  })
  const availableYears = Array.from(revenueYears).sort((a, b) => b - a)

  // 현재 연도의 월별 데이터 생성 (클라이언트에서 연도 전환 시 전체 맵도 전달)
  const allRevenueData: Record<number, MonthlyRevenue[]> = {}
  for (const yr of availableYears) {
    const months: MonthlyRevenue[] = []
    for (let m = 1; m <= 12; m++) {
      const ym = `${yr}-${String(m).padStart(2, "0")}`
      const data = revenueMap.get(ym)
      months.push({
        month: m,
        label: `${m}월`,
        amount: data?.amount || 0,
        count: data?.count || 0,
      })
    }
    allRevenueData[yr] = months
  }

  // 상세 데이터를 "YYYY-MM" 키로 직렬화
  const revenueDetails: Record<string, RevenueDetail[]> = {}
  revenueDetailMap.forEach((details, ym) => {
    revenueDetails[ym] = details
  })

  // ----- 4. 의뢰 정보 맵 (Sheet 패널에서 사용) -----
  const requestInfoMap: Record<string, DashboardRequestInfo> = {}
  for (const r of requests) {
    const cust = Array.isArray(r.customer)
      ? (r.customer[0] as { id: string; company_name: string; deleted_at: string | null } | undefined) || null
      : (r.customer as { id: string; company_name: string; deleted_at: string | null } | null)
    requestInfoMap[r.id] = {
      id: r.id,
      title: r.title,
      status: r.status,
      contract_id: r.contract_id,
      confirmed_quote_id: (r as Record<string, unknown>).confirmed_quote_id as string | null,
      inquiry_date: (r as Record<string, unknown>).inquiry_date as string | null,
      memo: (r as Record<string, unknown>).memo as string | null,
      manual_incentive: Number((r as Record<string, unknown>).manual_incentive) || 0,
      created_at: r.created_at,
      customer: cust,
    }
  }

  // ----- 6. 공헌이익: 계약별 기여 데이터 -----
  // 계약별 지출 합산 — VAT별도 (공급가액 그대로)
  const contractExpenseMap = new Map<string, number>()
  for (const e of expenses) {
    let cid = e.contract_id
    if (!cid && e.request_id) {
      const c = requestContractMap.get(e.request_id)
      if (c) cid = c.id
    }
    if (cid) {
      const amountExcl = Math.round(Number(e.amount_excl_tax) || 0)
      contractExpenseMap.set(cid, (contractExpenseMap.get(cid) || 0) + amountExcl)
    }
  }

  // ----- 6. 진행 매출 데이터 (계약기간 안분 기준) -----
  const progressByYearMonth: Record<string, { amount: number; contracts: Set<string> }> = {}
  for (const c of contracts) {
    const contractAmount = Number(c.contract_amount) || 0
    if (contractAmount <= 0) continue
    // VAT 포함 금액으로 안분
    const contractAmountVat = contractAmount + Math.floor(contractAmount * 0.1)
    const startStr = (c as Record<string, unknown>).start_date as string | null
    const endStr = (c as Record<string, unknown>).end_date as string | null
    if (!startStr || !endStr) continue
    const startDate = new Date(startStr + "T00:00:00")
    const endDate = new Date(endStr + "T00:00:00")
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) continue
    // 총 일수 (착수일~종료일 포함)
    const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1)
    const dailyRevenue = contractAmountVat / totalDays

    // 착수월 ~ 종료월까지 순회하며 해당 월 포함 일수 계산
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
    while (cursor <= endMonth) {
      const y = cursor.getFullYear()
      const m = cursor.getMonth() // 0-based
      // 해당 월 시작/끝
      const monthStart = new Date(y, m, 1)
      const monthEnd = new Date(y, m + 1, 0) // 해당 월 말일
      // 계약 기간과 교차하는 구간
      const overlapStart = startDate > monthStart ? startDate : monthStart
      const overlapEnd = endDate < monthEnd ? endDate : monthEnd
      const days = Math.max(0, Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) + 1)
      if (days > 0) {
        const key = `${y}-${m + 1}`
        if (!progressByYearMonth[key]) progressByYearMonth[key] = { amount: 0, contracts: new Set() }
        progressByYearMonth[key].amount += Math.round(dailyRevenue * days)
        progressByYearMonth[key].contracts.add(c.id)
      }
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }

  // 연도별 12개월 배열로 정리
  const progressYearsSet = new Set<number>()
  for (const key of Object.keys(progressByYearMonth)) {
    progressYearsSet.add(Number(key.split("-")[0]))
  }
  for (const y of availableYears) progressYearsSet.add(y)
  const progressYearsArr = Array.from(progressYearsSet)

  const allProgressData: Record<number, MonthlyProgressRevenue[]> = {}
  for (const y of progressYearsArr) {
    allProgressData[y] = Array.from({ length: 12 }, (_, i) => {
      const key = `${y}-${i + 1}`
      const entry = progressByYearMonth[key]
      return {
        month: i + 1,
        label: `${i + 1}월`,
        amount: entry ? entry.amount : 0,
        contractCount: entry ? entry.contracts.size : 0,
      }
    })
  }
  const progressAvailableYears = progressYearsArr.sort()

  // 계약별 공헌이익 항목 생성 (end_date 기준 월 필터링)
  // 모든 금액 VAT별도 (공급가액 기준) — 칸반보드 수익성 요약과 동일
  const contractContributions: ContractContribution[] = contracts
    .filter(c => (Number(c.contract_amount) || 0) > 0)
    .map(c => {
      const contractAmount = Math.round(Number(c.contract_amount) || 0) // 공급가액 (VAT별도)
      // 입금 합계: payment_entries 합산 후 VAT 역산 (입금은 VAT포함이므로 /1.1)
      const meta = metaMap.get(c.id)
      const totalPaidVatIncl = getContractTotalPaid(
        (meta?.settlement_status_map as Record<string, unknown>) || null
      )
      const totalPaid = Math.round(totalPaidVatIncl / 1.1) // VAT별도로 변환
      // 지출 합계 (VAT별도)
      const expense = contractExpenseMap.get(c.id) || 0
      const profit = totalPaid - expense
      // 장려금: 확정 견적서 있으면 견적서 장려금, 없으면 수동 장려금 (VAT별도)
      const req = contractRequestMap.get(c.id)
      const confirmedQuoteId = (req as Record<string, unknown> | undefined)?.confirmed_quote_id as string | null
      const manualIncentiveRaw = Number((req as Record<string, unknown> | undefined)?.manual_incentive) || 0
      // 수동 장려금은 이미 VAT별도 값 → 그대로 사용
      const incentiveTotal = confirmedQuoteId
        ? (quoteIncentiveMap.get(confirmedQuoteId) || 0)
        : manualIncentiveRaw
      // end_date(계약 종료일) 기준, 없으면 created_at 폴백
      const dateStr = (c as Record<string, unknown>).end_date as string || c.created_at
      const d = dateStr ? new Date(dateStr) : new Date(c.created_at!)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      // 제목: 계약 title → 연결된 의뢰 title → 기본값
      const title = (c as Record<string, unknown>).title as string || req?.title || "제목 없음"
      // 연결된 의뢰 ID: contract의 request_id 또는 역매핑
      const requestId = c.request_id || req?.id || null
      // 고객명: 연결된 의뢰의 customer에서 추출
      const customerName = req
        ? (Array.isArray(req.customer)
            ? (req.customer[0] as { company_name: string } | undefined)?.company_name || ""
            : (req.customer as { company_name: string } | null)?.company_name || "")
        : ""
      return {
        contractId: c.id,
        requestId,
        title,
        customerName,
        contractAmount,
        totalPaid,
        totalExpense: expense,
        incentiveTotal,
        netProfit: profit,
        profitRate: contractAmount > 0 ? (profit / contractAmount) * 100 : 0,
        yearMonth: ym,
      }
    })

  // ----- KPI 계산 -----

  // 1. 정산 연체 총액 + 회수율: 모든 계약의 전체 예정 vs 입금 집계
  let kpiTotalExpected = 0
  let kpiTotalCollected = 0
  let kpiOverdueTotal = 0

  for (const c of contracts) {
    const contractAmount = Number(c.contract_amount) || 0
    if (contractAmount <= 0) continue
    const meta = metaMap.get(c.id)
    const statusMap = (meta?.settlement_status_map as Record<string, unknown>) || null
    const stageRatios = (meta?.stage_ratios as Record<string, number>) || null
    const stages = parseSettlementType(c.settlement_type)
    if (stages.length === 0) continue

    const safeSupply = Math.max(0, Math.round(contractAmount))
    const amMode = stageRatios && typeof stageRatios === "object" && (stageRatios as Record<string, unknown>)._mode === "amount"
    const middleInst = Math.max(1, Math.min(5, Math.round(Number(meta?.middle_installments) || 1)))

    // 비율/금액 결정
    const ratios: Record<string, number> = {}
    for (const stage of stages) {
      const fromMeta = Number(stageRatios?.[stage] ?? 0)
      if (amMode) {
        ratios[stage] = Math.max(0, Math.round(fromMeta))
      } else {
        ratios[stage] = fromMeta > 0 ? Math.max(0, Math.min(100, fromMeta)) : (100 / stages.length)
      }
    }

    const totalVat = Math.floor(safeSupply * 0.1)
    let usedS = 0, usedV = 0

    // 정규화된 statusMap
    const normalizedSM: Record<string, unknown> = {}
    if (statusMap) {
      for (const [key, value] of Object.entries(statusMap)) {
        normalizedSM[normalizeStageKey(key)] = value
      }
    }

    // 예정일 맵
    const scheduledDates = (meta?.stage_scheduled_dates as Record<string, string>) || {}
    const normalizedSD: Record<string, string> = {}
    for (const [key, value] of Object.entries(scheduledDates)) {
      normalizedSD[normalizeStageKey(key)] = value
    }

    stages.forEach((stage, idx) => {
      const isLast = idx === stages.length - 1
      let ss: number, sv: number
      if (amMode) {
        const total = ratios[stage]
        ss = Math.round(total / 1.1)
        sv = total - ss
      } else {
        const ratio = Math.max(0, Math.min(100, Number(ratios[stage] || 0)))
        ss = isLast ? safeSupply - usedS : Math.round((safeSupply * ratio) / 100)
        sv = isLast ? totalVat - usedV : Math.floor(ss * 0.1)
      }
      usedS += ss
      usedV += sv

      const processStage = (key: string, supply: number, vat: number) => {
        const planned = supply + vat
        const paid = getRowPaid(normalizedSM[key])
        kpiTotalExpected += planned
        kpiTotalCollected += Math.min(paid, planned)
        // 연체: 예정일 < 오늘 & 미완납
        const sched = normalizedSD[key] || normalizedSD[stage] || ""
        if (sched && paid < planned) {
          const schedDate = new Date(`${sched}T00:00:00`)
          if (!isNaN(schedDate.getTime()) && schedDate.getTime() < todayMs) {
            kpiOverdueTotal += planned - paid
          }
        }
      }

      if (stage === "중도금" && middleInst > 1) {
        let usSplit = 0, usVatSplit = 0
        for (let i = 1; i <= middleInst; i++) {
          const last = i === middleInst
          const splitS = last ? ss - usSplit : Math.round(ss / middleInst)
          usSplit += splitS
          const splitV = last ? sv - usVatSplit : Math.floor(splitS * 0.1)
          usVatSplit += splitV
          processStage(`middle-${i}`, splitS, splitV)
        }
      } else {
        processStage(stage, ss, sv)
      }
    })
  }

  const kpiCollectionRate = kpiTotalExpected > 0 ? (kpiTotalCollected / kpiTotalExpected) * 100 : 0

  // 2. 고객별 누적 거래액 (VAT별도)
  const customerVolumeMap = new Map<string, CustomerVolume>()
  for (const c of contracts) {
    const contractAmount = Number(c.contract_amount) || 0
    if (contractAmount <= 0) continue
    const supplyAmount = Math.round(contractAmount) // VAT별도 공급가액
    // 연결된 의뢰에서 고객 정보 찾기
    const req = contractRequestMap.get(c.id)
    if (!req?.customer_id) continue
    const customerData = req.customer
    const customerId = req.customer_id
    const customerName = Array.isArray(customerData)
      ? (customerData[0] as { company_name: string } | undefined)?.company_name || ""
      : (customerData as { company_name: string } | null)?.company_name || ""
    if (!customerName) continue

    const existing = customerVolumeMap.get(customerId)
    if (existing) {
      existing.totalContractAmount += supplyAmount
      existing.contractCount += 1
    } else {
      customerVolumeMap.set(customerId, {
        customerId,
        customerName,
        totalContractAmount: supplyAmount,
        contractCount: 1,
      })
    }
  }
  const topCustomers = Array.from(customerVolumeMap.values())
    .sort((a, b) => b.totalContractAmount - a.totalContractAmount)
    .slice(0, 10)

  const dashboardKPI: DashboardKPI = {
    overdueTotal: kpiOverdueTotal,
    collectionRate: kpiCollectionRate,
    totalExpected: kpiTotalExpected,
    totalCollected: kpiTotalCollected,
    topCustomers,
  }

  return (
    <DashboardClient
      settlementAlerts={settlementAlerts}
      expenseAlerts={expenseAlerts}
      taxInvoiceAlerts={taxInvoiceAlerts}
      kpi={dashboardKPI}
      allRevenueData={allRevenueData}
      revenueDetails={revenueDetails}
      availableYears={availableYears}
      currentYear={currentYear}
      currentMonth={currentMonth}
      contractContributions={contractContributions}
      requestInfoMap={requestInfoMap}
      initialYear={currentYear}
      initialMonth={currentMonth}
      allProgressData={allProgressData}
      progressAvailableYears={progressAvailableYears}
    />
  )
}
