// 대시보드 메인 페이지 (서버 컴포넌트)
// 정산·지출 현황, 매출 추이, 진행 현장, 공헌이익을 한눈에 보여줌

import { createAdminClient } from "@/lib/supabase/admin"
import { DashboardClient } from "./dashboard-client"
import type { SettlementAlert, ExpenseAlert, MonthlyRevenue, ActiveSite } from "./dashboard-types"

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

    // 7일 이내 입금예정: 예정일이 7일 이내 AND 미입금
    if (schedMs && schedMs >= todayMs && schedMs <= todayMs + sevenDaysMs && paid === 0) {
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

  // 4개 쿼리 병렬 실행
  const [requestsResult, contractsResult, metasResult, expensesResult] = await Promise.all([
    // 1. 의뢰 + 고객 조인
    supabase
      .from("requests")
      .select("id, title, status, hidden, customer_id, contract_id, created_at, customer:customers(id, company_name)")
      .neq("status", "숨김")
      .order("created_at", { ascending: false }),
    // 2. 계약
    supabase
      .from("contracts")
      .select("id, contract_amount, settlement_type, created_at, request_id")
      .is("deleted_at", null),
    // 3. 정산 메타
    supabase
      .from("contract_settlement_meta")
      .select("contract_id, stage_ratios, middle_installments, stage_scheduled_dates, settlement_status_map"),
    // 4. 지출
    supabase
      .from("expenses")
      .select("id, request_id, contract_id, expense_date, amount_excl_tax, is_paid, tax_invoice_due_date, vendor, description"),
  ])

  const requests = requestsResult.data || []
  const contracts = contractsResult.data || []
  const metas = metasResult.data || []
  const expenses = expensesResult.data || []

  // ----- 맵 구성 -----
  const metaMap = new Map(metas.map(m => [m.contract_id, m]))
  const contractMap = new Map(contracts.map(c => [c.id, c]))

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

  // ----- 3. 매출 그래프 데이터 (최근 12개월) -----
  const now = new Date()
  const monthlyMap = new Map<string, number>()
  // 12개월 초기화
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    monthlyMap.set(ym, 0)
  }
  // 계약금액 월별 집계
  for (const c of contracts) {
    if (!c.created_at) continue
    const d = new Date(c.created_at)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (monthlyMap.has(ym)) {
      monthlyMap.set(ym, (monthlyMap.get(ym) || 0) + (Number(c.contract_amount) || 0))
    }
  }
  const monthlyRevenue: MonthlyRevenue[] = Array.from(monthlyMap.entries()).map(([ym, amount]) => ({
    yearMonth: ym,
    month: `${parseInt(ym.split("-")[1])}월`,
    amount,
  }))

  // ----- 4. 진행 현장 (이번 달 기준) -----
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const activeSites: ActiveSite[] = []

  for (const r of requests) {
    if (r.hidden || r.status === "수주 실패") continue
    if (!r.contract_id) continue
    const contract = contractMap.get(r.contract_id)
    if (!contract) continue
    const contractAmount = Number(contract.contract_amount) || 0
    const customerName = Array.isArray(r.customer)
      ? (r.customer[0] as { company_name: string } | undefined)?.company_name || ""
      : (r.customer as { company_name: string } | null)?.company_name || ""

    const meta = metaMap.get(r.contract_id)

    // stage_summaries 계산 (requests/page.tsx의 calcStageSummaries와 동일 로직)
    const stages = parseSettlementType(contract.settlement_type)
    const stageRatios = (meta?.stage_ratios as Record<string, number>) || null
    const statusMap = (meta?.settlement_status_map as Record<string, unknown>) || null
    const middleInst = Number(meta?.middle_installments) || 1

    const summaries: { name: string; status: "paid" | "partial" | "unpaid" }[] = []
    if (stages.length > 0 && contractAmount > 0) {
      // 금액 모드 감지
      const amMode2 = stageRatios && typeof stageRatios === "object" && (stageRatios as Record<string, unknown>)._mode === "amount"
      const ratios: Record<string, number> = {}
      for (const stage of stages) {
        const fromMeta = Number(stageRatios?.[stage] ?? 0)
        if (amMode2) {
          ratios[stage] = Math.max(0, Math.round(fromMeta))
        } else {
          ratios[stage] = fromMeta > 0 ? Math.max(0, Math.min(100, fromMeta)) : (100 / stages.length)
        }
      }
      const safeMiddle = Math.max(1, Math.min(5, Math.round(middleInst)))
      const normalizedMap: Record<string, unknown> = {}
      if (statusMap) {
        for (const [key, value] of Object.entries(statusMap)) {
          normalizedMap[normalizeStageKey(key)] = value
        }
      }
      const safeSupply = Math.max(0, Math.round(contractAmount))
      const totalVat = Math.floor(safeSupply * 0.1)
      let usedSupply = 0
      let usedVat = 0

      stages.forEach((stage, idx) => {
        const isLast = idx === stages.length - 1
        let stageSupply: number
        let stageVat: number
        if (amMode2) {
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

        if (stage === "중도금" && safeMiddle > 1) {
          let usSplit = 0, usVat = 0
          for (let i = 1; i <= safeMiddle; i++) {
            const last = i === safeMiddle
            const ss = last ? stageSupply - usSplit : Math.round(stageSupply / safeMiddle)
            usSplit += ss
            const sv = last ? stageVat - usVat : Math.floor(ss * 0.1)
            usVat += sv
            const key = `middle-${i}`
            const planned = ss + sv
            const paid = getRowPaid(normalizedMap[key])
            const st: "paid" | "partial" | "unpaid" = paid >= planned && planned > 0 ? "paid" : paid > 0 ? "partial" : "unpaid"
            summaries.push({ name: `중도금 ${i}차`, status: st })
          }
          return
        }

        const planned = stageSupply + stageVat
        const paid = getRowPaid(normalizedMap[stage])
        const st: "paid" | "partial" | "unpaid" = paid >= planned && planned > 0 ? "paid" : paid > 0 ? "partial" : "unpaid"
        summaries.push({ name: stage, status: st })
      })
    }

    activeSites.push({
      requestId: r.id,
      title: r.title,
      customerName,
      contractAmount,
      stageSummaries: summaries,
    })
  }

  // ----- 5. 공헌이익 계산 -----
  // 월간 (이번 달 계약 기준)
  const monthlyContracts = contracts.filter(c => {
    if (!c.created_at) return false
    const d = new Date(c.created_at)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === currentYM
  })
  const monthlyRevTotal = monthlyContracts.reduce((s, c) => s + (Number(c.contract_amount) || 0), 0)
  const monthlyExpTotal = expenses.filter(e => {
    if (!e.expense_date) return false
    const d = new Date(e.expense_date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === currentYM
  }).reduce((s, e) => s + (Number(e.amount_excl_tax) || 0), 0)

  // 연간 (올해 계약 기준)
  const yearStr = String(now.getFullYear())
  const yearlyContracts = contracts.filter(c => c.created_at?.startsWith(yearStr))
  const yearlyRevTotal = yearlyContracts.reduce((s, c) => s + (Number(c.contract_amount) || 0), 0)
  const yearlyExpTotal = expenses.filter(e => e.expense_date?.startsWith(yearStr))
    .reduce((s, e) => s + (Number(e.amount_excl_tax) || 0), 0)

  return (
    <DashboardClient
      settlementAlerts={settlementAlerts}
      expenseAlerts={expenseAlerts}
      monthlyRevenue={monthlyRevenue}
      activeSites={activeSites}
      currentMonth={`${now.getFullYear()}년 ${now.getMonth() + 1}월`}
      contribution={{
        monthly: {
          revenue: monthlyRevTotal,
          expense: monthlyExpTotal,
          profit: monthlyRevTotal - monthlyExpTotal,
          rate: monthlyRevTotal > 0 ? ((monthlyRevTotal - monthlyExpTotal) / monthlyRevTotal) * 100 : 0,
        },
        yearly: {
          revenue: yearlyRevTotal,
          expense: yearlyExpTotal,
          profit: yearlyRevTotal - yearlyExpTotal,
          rate: yearlyRevTotal > 0 ? ((yearlyRevTotal - yearlyExpTotal) / yearlyRevTotal) * 100 : 0,
        },
      }}
    />
  )
}
