"use client"

// ----- 섹션1: 업무 노트(좌) + 정산·지출·세금계산서 3탭(우) -----

import { useState, useEffect, useRef, useCallback } from "react"
import { useAuth } from "@/providers/auth-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CreditCard, Receipt, FileText, ClipboardList, Plus, Trash2, Loader2 } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { RequestDetailSheet } from "./request-detail-sheet"
import type { SettlementAlert, ExpenseAlert, TaxInvoiceAlert, DashboardRequestInfo } from "./dashboard-types"

interface Props {
  settlementAlerts: SettlementAlert[]
  expenseAlerts: ExpenseAlert[]
  taxInvoiceAlerts: TaxInvoiceAlert[]
  requestInfoMap: Record<string, DashboardRequestInfo>
}

// 스크롤 영역 최대 높이 (약 5행)
const MAX_LIST_HEIGHT = 260

// ═══════════════════════════════════════
// 업무 노트 (체크리스트 미니 앱, Supabase DB 저장)
// ═══════════════════════════════════════
interface TodoItem {
  id: string
  text: string
  done: boolean
  done_at: string | null
  created_at: string
}

function WorkNotes() {
  const { user, loading: authLoading } = useAuth()
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  const userId = user?.id || "default"

  // DB에서 로드 (auth 로딩 완료 후)
  useEffect(() => {
    if (authLoading) return
    setLoading(true)
    fetch(`/api/work-notes?user_id=${userId}`)
      .then(r => r.json())
      .then(res => {
        if (res.data) {
          // 미완료 먼저, 완료는 아래로 정렬
          const sorted = (res.data as TodoItem[]).sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          })
          setTodos(sorted)
        }
      })
      .finally(() => setLoading(false))
  }, [userId, authLoading])

  // 추가
  const handleAdd = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed) return
    setInput("")
    inputRef.current?.focus()
    // 낙관적 UI: 임시 항목 추가
    const tempId = `temp-${Date.now()}`
    const tempItem: TodoItem = { id: tempId, text: trimmed, done: false, done_at: null, created_at: new Date().toISOString() }
    setTodos(prev => [tempItem, ...prev])
    // DB 저장
    const res = await fetch("/api/work-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, text: trimmed }),
    }).then(r => r.json())
    if (res.data) {
      // 임시 항목을 실제 데이터로 교체
      setTodos(prev => prev.map(t => t.id === tempId ? res.data : t))
    }
  }, [input, user?.id])

  // 체크 토글
  const handleToggle = useCallback(async (id: string, currentDone: boolean) => {
    const newDone = !currentDone
    // 낙관적 UI
    setTodos(prev => {
      const updated = prev.map(t =>
        t.id === id ? { ...t, done: newDone, done_at: newDone ? new Date().toISOString() : null } : t
      )
      return updated.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1
        return 0
      })
    })
    // DB 업데이트
    await fetch("/api/work-notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, done: newDone }),
    })
  }, [])

  // 삭제
  const handleDelete = useCallback(async (id: string) => {
    // 낙관적 UI
    setTodos(prev => prev.filter(t => t.id !== id))
    // DB 삭제
    await fetch(`/api/work-notes?id=${id}`, { method: "DELETE" })
  }, [])

  // Enter 키로 추가
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleAdd()
    }
  }, [handleAdd])

  const activeCount = todos.filter(t => !t.done).length
  const doneCount = todos.filter(t => t.done).length

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-vanilla-custard" />
            업무 노트
            {activeCount > 0 && (
              <span className="text-xs font-normal text-gray-400">{activeCount}건</span>
            )}
          </CardTitle>
          {doneCount > 0 && (
            <span className="text-[10px] text-muted-teal">완료 {doneCount}건 (24h 후 자동삭제)</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-0 flex flex-col gap-2">
        {/* 입력창 */}
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="할 일을 입력하고 Enter..."
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-vanilla-custard/50 focus:border-vanilla-custard/50 transition-colors"
          />
          <button
            onClick={handleAdd}
            disabled={!input.trim()}
            className="shrink-0 p-2 rounded-lg bg-tropical-teal/10 text-tropical-teal hover:bg-tropical-teal/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* 리스트 */}
        <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ maxHeight: 210 }}>
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 text-gray-300 animate-spin" />
            </div>
          )}
          {!loading && todos.length === 0 && (
            <p className="text-sm text-gray-300 py-8 text-center">메모가 없습니다</p>
          )}
          <div className="space-y-1">
            {todos.map(t => (
              <div
                key={t.id}
                className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors ${
                  t.done ? "bg-gray-50/50" : "bg-gray-50 hover:bg-gray-100"
                }`}
              >
                {/* 체크박스 */}
                <button
                  onClick={() => handleToggle(t.id, t.done)}
                  className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    t.done
                      ? "bg-muted-teal border-muted-teal"
                      : "border-gray-300 hover:border-tropical-teal"
                  }`}
                >
                  {t.done && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                {/* 텍스트 */}
                <span className={`flex-1 text-xs leading-snug ${
                  t.done ? "line-through text-gray-400" : "text-gray-700"
                }`}>
                  {t.text}
                </span>
                {/* 삭제 버튼 (호버 시 표시) */}
                <button
                  onClick={() => handleDelete(t.id)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-soft-blush transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════
// 정산·지출·세금계산서 3탭 (컴팩트)
// ═══════════════════════════════════════
type TabType = "정산" | "지출" | "계산서"

function AlertsPanel({ settlementAlerts, expenseAlerts, taxInvoiceAlerts, requestInfoMap }: Props) {
  const [tab, setTab] = useState<TabType>("정산")
  // 우측 Sheet 패널용: 선택된 의뢰 정보
  const [selectedRequestInfo, setSelectedRequestInfo] = useState<DashboardRequestInfo | null>(null)

  // 정산
  const overdueAlerts = settlementAlerts.filter(a => a.type === "overdue")
  const partialAlerts = settlementAlerts.filter(a => a.type === "partial")
  const upcomingAlerts = settlementAlerts.filter(a => a.type === "upcoming")

  // 지출
  const unpaidExpenses = expenseAlerts.filter(a => a.type === "unpaid")
  const taxDueExpenses = expenseAlerts.filter(a => a.type === "tax_invoice_due")

  const settlementCount = settlementAlerts.length
  const expenseCount = expenseAlerts.length
  const taxInvoiceCount = taxInvoiceAlerts.length

  function handleClick(requestId: string) {
    if (!requestId) return
    const info = requestInfoMap[requestId]
    if (info) {
      setSelectedRequestInfo(info)
    }
  }

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: "정산", label: "정산", count: settlementCount },
    { key: "지출", label: "지출", count: expenseCount },
    { key: "계산서", label: "계산서", count: taxInvoiceCount },
  ]

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-tropical-teal" />
            알림
          </CardTitle>
          {/* 3탭 토글 */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  tab === t.key
                    ? "bg-white shadow-sm font-semibold text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
                {t.count > 0 && <span className="text-soft-blush ml-0.5">{t.count}</span>}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {/* 스크롤 리스트 */}
        <div
          className="space-y-2 overflow-y-auto scrollbar-thin"
          style={{ maxHeight: MAX_LIST_HEIGHT }}
        >
          {/* ===== 정산 탭 ===== */}
          {tab === "정산" && (
            <>
              <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">
                입금예정일 초과 시 <span className="text-rose-400 font-medium">지연</span>, 일부만 입금 시 <span className="text-yellow-600 font-medium">부분입금</span>, 7일 이내 예정 시 <span className="text-sky-aqua font-medium">예정</span> 표시
              </p>
              {settlementCount === 0 && (
                <p className="text-sm text-gray-400 py-6 text-center">알림 없음</p>
              )}

              {overdueAlerts.length > 0 && (
                <div className="space-y-1">
                  <Badge variant="outline" className="bg-soft-blush/20 text-soft-blush border-soft-blush/30 text-[10px]">
                    지연 {overdueAlerts.length}건
                  </Badge>
                  {overdueAlerts.map((a, i) => (
                    <SettlementRow key={`o-${i}`} alert={a} onClick={() => handleClick(a.requestId)}
                      badgeClass="bg-soft-blush/10 text-soft-blush" badgeLabel={`D+${a.overdueDays}`} />
                  ))}
                </div>
              )}

              {partialAlerts.length > 0 && (
                <div className="space-y-1">
                  <Badge variant="outline" className="bg-vanilla-custard/20 text-yellow-700 border-vanilla-custard/30 text-[10px]">
                    부분입금 {partialAlerts.length}건
                  </Badge>
                  {partialAlerts.map((a, i) => (
                    <SettlementRow key={`p-${i}`} alert={a} onClick={() => handleClick(a.requestId)}
                      badgeClass="bg-vanilla-custard/10 text-yellow-700" badgeLabel="부분" />
                  ))}
                </div>
              )}

              {upcomingAlerts.length > 0 && (
                <div className="space-y-1">
                  <Badge variant="outline" className="bg-sky-aqua/10 text-sky-aqua border-sky-aqua/20 text-[10px]">
                    7일 이내 {upcomingAlerts.length}건
                  </Badge>
                  {upcomingAlerts.map((a, i) => (
                    <SettlementRow key={`u-${i}`} alert={a} onClick={() => handleClick(a.requestId)}
                      badgeClass="bg-sky-aqua/10 text-sky-aqua" badgeLabel="예정" />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ===== 지출 탭 ===== */}
          {tab === "지출" && (
            <>
              <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">
                <span className="text-rose-400 font-medium">미지급</span> 지출 내역과 <span className="text-yellow-600 font-medium">세금계산서</span> 마감 7일 이내 건을 표시합니다
              </p>
              {expenseCount === 0 && (
                <p className="text-sm text-gray-400 py-6 text-center">알림 없음</p>
              )}

              {unpaidExpenses.length > 0 && (
                <div className="space-y-1">
                  <Badge variant="outline" className="bg-soft-blush/20 text-soft-blush border-soft-blush/30 text-[10px]">
                    <CreditCard className="h-3 w-3 mr-1" />
                    미지급 {unpaidExpenses.length}건
                  </Badge>
                  {unpaidExpenses.map((a, i) => (
                    <button
                      key={`up-${i}`}
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors text-sm text-left"
                      onClick={() => handleClick(a.requestId)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate text-xs">
                          {a.vendor || a.description || "거래처 미입력"}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">{a.requestTitle}</p>
                      </div>
                      <span className="text-soft-blush font-medium ml-2 whitespace-nowrap text-xs">
                        {formatCurrency(a.amount)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {taxDueExpenses.length > 0 && (
                <div className="space-y-1">
                  <Badge variant="outline" className="bg-vanilla-custard/20 text-yellow-700 border-vanilla-custard/30 text-[10px]">
                    <Receipt className="h-3 w-3 mr-1" />
                    세금계산서 예정 {taxDueExpenses.length}건
                  </Badge>
                  {taxDueExpenses.map((a, i) => (
                    <button
                      key={`tx-${i}`}
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors text-sm text-left"
                      onClick={() => handleClick(a.requestId)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate text-xs">
                          {a.vendor || a.description || "거래처 미입력"}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">마감: {a.dueDate}</p>
                      </div>
                      <span className="text-yellow-700 font-medium ml-2 whitespace-nowrap text-xs">
                        {formatCurrency(a.amount)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ===== 세금계산서 탭 (미발행) ===== */}
          {tab === "계산서" && (
            <>
              <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">
                입금이 확인되었으나 <span className="text-rose-400 font-medium">세금계산서 미발행</span> 상태인 정산 단계를 표시합니다
              </p>
              {taxInvoiceCount === 0 && (
                <p className="text-sm text-gray-400 py-6 text-center">미발행 건 없음</p>
              )}

              {taxInvoiceCount > 0 && (
                <div className="space-y-1">
                  <Badge variant="outline" className="bg-vanilla-custard/20 text-yellow-700 border-vanilla-custard/30 text-[10px]">
                    <FileText className="h-3 w-3 mr-1" />
                    미발행 {taxInvoiceCount}건
                  </Badge>
                  {taxInvoiceAlerts.map((a, i) => (
                    <button
                      key={`ti-${i}`}
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors text-sm text-left"
                      onClick={() => handleClick(a.requestId)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate text-xs">
                          {a.requestTitle}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">
                          {a.stageName} · 입금 {formatCurrency(a.paidAmount)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <span className="text-yellow-700 font-medium whitespace-nowrap text-xs">
                          {formatCurrency(a.amount)}
                        </span>
                        <Badge variant="outline" className="bg-vanilla-custard/10 text-yellow-700 text-[10px] whitespace-nowrap px-1.5 py-0">
                          미발행
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>

      {/* 우측 Sheet 패널: 의뢰 상세 */}
      <RequestDetailSheet
        requestInfo={selectedRequestInfo}
        onClose={() => setSelectedRequestInfo(null)}
      />
    </Card>
  )
}

// ═══════════════════════════════════════
// 메인 섹션: 알림 패널 (전체 너비)
// ═══════════════════════════════════════
export function SettlementExpenseSection({ settlementAlerts, expenseAlerts, taxInvoiceAlerts, requestInfoMap }: Props) {
  return (
    <AlertsPanel settlementAlerts={settlementAlerts} expenseAlerts={expenseAlerts} taxInvoiceAlerts={taxInvoiceAlerts} requestInfoMap={requestInfoMap} />
  )
}

// ----- 정산 알림 행 (컴팩트: 현장명 + 단계 + 예정일 + 금액 + 뱃지) -----
function SettlementRow({
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
    <button
      type="button"
      className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors text-left"
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900 truncate text-xs">{alert.requestTitle}</p>
        <p className="text-[10px] text-gray-500">{alert.stageName}</p>
      </div>
      <div className="flex items-center gap-2 ml-2 shrink-0">
        {alert.scheduledDate && (
          <span className="text-[10px] text-gray-400 whitespace-nowrap">{alert.scheduledDate}</span>
        )}
        <span className="font-medium text-gray-700 whitespace-nowrap text-xs">
          {formatCurrency(alert.plannedAmount)}
        </span>
        <Badge variant="outline" className={`${badgeClass} text-[10px] whitespace-nowrap px-1.5 py-0`}>
          {badgeLabel}
        </Badge>
      </div>
    </button>
  )
}
