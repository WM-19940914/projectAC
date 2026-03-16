"use client"

// ----- 섹션1: 정산/지출 한눈에보기 -----
// 좌측: 정산 알림 (지연, 부분입금, 7일 이내 예정)
// 우측: 지출 알림 (미지급, 세금계산서 예정)

import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Clock, CreditCard, Receipt } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import type { SettlementAlert, ExpenseAlert } from "./dashboard-types"

interface Props {
  settlementAlerts: SettlementAlert[]
  expenseAlerts: ExpenseAlert[]
}

export function SettlementExpenseSection({ settlementAlerts, expenseAlerts }: Props) {
  const router = useRouter()

  // 정산 알림을 타입별로 그룹화
  const overdueAlerts = settlementAlerts.filter(a => a.type === "overdue")
  const partialAlerts = settlementAlerts.filter(a => a.type === "partial")
  const upcomingAlerts = settlementAlerts.filter(a => a.type === "upcoming")

  // 지출 알림을 타입별로 그룹화
  const unpaidExpenses = expenseAlerts.filter(a => a.type === "unpaid")
  const taxDueExpenses = expenseAlerts.filter(a => a.type === "tax_invoice_due")

  const hasSettlementAlerts = settlementAlerts.length > 0
  const hasExpenseAlerts = expenseAlerts.length > 0

  // 클릭 시 의뢰 칸반으로 이동
  function handleClick(requestId: string) {
    if (!requestId) return
    router.push(`/requests?open=${requestId}`)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-tropical-teal" />
          정산 · 지출 한눈에보기
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 좌측: 정산 현황 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">정산 현황</h3>

            {!hasSettlementAlerts && (
              <p className="text-sm text-gray-400 py-4 text-center">알림 없음</p>
            )}

            {/* 지연 */}
            {overdueAlerts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="bg-soft-blush/20 text-soft-blush border-soft-blush/30 text-xs">
                    지연 {overdueAlerts.length}건
                  </Badge>
                </div>
                {overdueAlerts.map((alert, i) => (
                  <AlertRow
                    key={`overdue-${i}`}
                    alert={alert}
                    onClick={() => handleClick(alert.requestId)}
                    badgeClass="bg-soft-blush/10 text-soft-blush"
                    badgeLabel={`D+${alert.overdueDays}`}
                  />
                ))}
              </div>
            )}

            {/* 부분입금 */}
            {partialAlerts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="bg-vanilla-custard/20 text-yellow-700 border-vanilla-custard/30 text-xs">
                    부분입금 {partialAlerts.length}건
                  </Badge>
                </div>
                {partialAlerts.map((alert, i) => (
                  <AlertRow
                    key={`partial-${i}`}
                    alert={alert}
                    onClick={() => handleClick(alert.requestId)}
                    badgeClass="bg-vanilla-custard/10 text-yellow-700"
                    badgeLabel="부분"
                  />
                ))}
              </div>
            )}

            {/* 7일 이내 예정 */}
            {upcomingAlerts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="bg-sky-aqua/10 text-sky-aqua border-sky-aqua/20 text-xs">
                    7일 이내 예정 {upcomingAlerts.length}건
                  </Badge>
                </div>
                {upcomingAlerts.map((alert, i) => (
                  <AlertRow
                    key={`upcoming-${i}`}
                    alert={alert}
                    onClick={() => handleClick(alert.requestId)}
                    badgeClass="bg-sky-aqua/10 text-sky-aqua"
                    badgeLabel="예정"
                  />
                ))}
              </div>
            )}
          </div>

          {/* 우측: 지출 현황 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">지출 현황</h3>

            {!hasExpenseAlerts && (
              <p className="text-sm text-gray-400 py-4 text-center">알림 없음</p>
            )}

            {/* 미지급 */}
            {unpaidExpenses.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="bg-soft-blush/20 text-soft-blush border-soft-blush/30 text-xs">
                    <CreditCard className="h-3 w-3 mr-1" />
                    미지급 {unpaidExpenses.length}건
                  </Badge>
                </div>
                {unpaidExpenses.map((alert, i) => (
                  <div
                    key={`unpaid-${i}`}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors text-sm"
                    onClick={() => handleClick(alert.requestId)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">
                        {alert.vendor || alert.description || "거래처 미입력"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {alert.requestTitle} · {alert.customerName}
                      </p>
                    </div>
                    <span className="text-soft-blush font-medium ml-2 whitespace-nowrap">
                      {formatCurrency(alert.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 세금계산서 예정 */}
            {taxDueExpenses.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="bg-vanilla-custard/20 text-yellow-700 border-vanilla-custard/30 text-xs">
                    <Receipt className="h-3 w-3 mr-1" />
                    세금계산서 예정 {taxDueExpenses.length}건
                  </Badge>
                </div>
                {taxDueExpenses.map((alert, i) => (
                  <div
                    key={`tax-${i}`}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors text-sm"
                    onClick={() => handleClick(alert.requestId)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">
                        {alert.vendor || alert.description || "거래처 미입력"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        마감일: {alert.dueDate}
                      </p>
                    </div>
                    <span className="text-yellow-700 font-medium ml-2 whitespace-nowrap">
                      {formatCurrency(alert.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ----- 정산 알림 행 (공통) -----
function AlertRow({
  alert,
  onClick,
  badgeClass,
  badgeLabel,
}: {
  alert: SettlementAlert
  onClick: () => void
  badgeClass: string
  badgeLabel: string
}) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors text-sm"
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900 truncate">
          {alert.requestTitle}
          <span className="text-gray-400 mx-1">·</span>
          <span className="text-gray-500">{alert.customerName}</span>
        </p>
        <p className="text-xs text-gray-500">
          {alert.stageName}
          {alert.scheduledDate && (
            <span className="ml-1 text-gray-400">({alert.scheduledDate})</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 ml-2">
        <span className="font-medium text-gray-700 whitespace-nowrap">
          {formatCurrency(alert.plannedAmount)}
        </span>
        <Badge variant="outline" className={`${badgeClass} text-xs whitespace-nowrap`}>
          {badgeLabel}
        </Badge>
      </div>
    </div>
  )
}
