"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatShortDate } from "@/lib/format"
import SalesTabNav from "@/components/layout/sales-tab-nav"
import QuoteEditorSheet from "../requests/quote-editor-sheet"
import type { QuotationWithItems } from "@/types"

// 서버에서 넘어오는 견적서 목록 타입 (Supabase 조인은 배열로 반환될 수 있음)
interface QuotationRow {
  id: string
  title: string
  quotation_number: string
  quotation_date: string
  type: string
  total_amount: number
  tax_amount: number
  grand_total: number
  notes: string | null
  customer: { id: string; company_name: string } | { id: string; company_name: string }[] | null
  request: { id: string; title: string } | { id: string; title: string }[] | null
}

// 조인 결과에서 단건 추출 헬퍼
function unwrap<T>(val: T | T[] | null): T | null {
  if (!val) return null
  if (Array.isArray(val)) return val[0] ?? null
  return val
}

interface Props {
  quotations: QuotationRow[]
}

export default function QuotesList({ quotations }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")

  // 견적서 편집 Sheet state
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingQuotation, setEditingQuotation] = useState<QuotationWithItems | null>(null)

  // 검색 필터
  const filtered = quotations.filter((q) => {
    if (!search.trim()) return true
    const s = search.toLowerCase()
    const cust = unwrap(q.customer)
    const req = unwrap(q.request)
    return (
      q.title.toLowerCase().includes(s) ||
      q.quotation_number.toLowerCase().includes(s) ||
      (cust?.company_name || "").toLowerCase().includes(s) ||
      (req?.title || "").toLowerCase().includes(s)
    )
  })

  // 견적서 클릭 → 상세 데이터 fetch 후 Sheet 열기
  const handleRowClick = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/quotes?id=${id}`)
      if (res.ok) {
        const result = await res.json()
        setEditingQuotation(result.data)
        setIsSheetOpen(true)
      }
    } catch {
      alert("견적서 데이터를 불러올 수 없습니다.")
    }
  }, [])

  // 저장 후 콜백
  const handleSaved = useCallback(() => {
    setIsSheetOpen(false)
    setEditingQuotation(null)
    router.refresh()
  }, [router])

  return (
    <div className="flex flex-col h-full">
      {/* 페이지 헤더 + 탭 네비게이션 */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <SalesTabNav />
        <p className="text-sm text-gray-500">총 {quotations.length}건</p>
      </div>

      {/* 검색 바 */}
      <div className="px-6 py-3 border-b">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="제목, 견적번호, 고객명, 의뢰명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-aqua/50 focus:border-sky-aqua"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FileText className="h-10 w-10 mb-3" />
            <p className="text-sm">
              {quotations.length === 0
                ? "아직 견적서가 없습니다"
                : "검색 결과가 없습니다"}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="border-b border-gray-200">
                <th className="px-6 py-3 text-left font-semibold text-gray-500 text-xs">
                  견적번호
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-500 text-xs">
                  제목
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-500 text-xs">
                  고객
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-500 text-xs">
                  의뢰
                </th>
                <th className="px-6 py-3 text-left font-semibold text-gray-500 text-xs">
                  견적일
                </th>
                <th className="px-6 py-3 text-right font-semibold text-gray-500 text-xs">
                  합계금액
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => {
                const cust = unwrap(q.customer)
                const req = unwrap(q.request)
                return (
                  <tr
                    key={q.id}
                    onClick={() => handleRowClick(q.id)}
                    className="border-b border-gray-100 hover:bg-sky-aqua/5 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3">
                      <Badge
                        variant="secondary"
                        className="text-[11px] bg-sky-aqua/10 text-sky-aqua"
                      >
                        {q.quotation_number}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {q.title}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {cust?.company_name || "-"}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {req?.title || "-"}
                    </td>
                    <td className="px-6 py-3 text-gray-500">
                      {formatShortDate(q.quotation_date)}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-gray-900 tabular-nums">
                      {formatCurrency(q.grand_total)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 견적서 편집 Sheet */}
      {editingQuotation && (
        <QuoteEditorSheet
          open={isSheetOpen}
          onClose={() => {
            setIsSheetOpen(false)
            setEditingQuotation(null)
          }}
          requestId={editingQuotation.request_id || ""}
          customerId={editingQuotation.customer_id}
          customerName={editingQuotation.customer?.company_name}
          quotation={editingQuotation}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
