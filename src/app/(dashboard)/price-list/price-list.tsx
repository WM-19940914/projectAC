"use client"

import { useState, useMemo } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/format"

// 가격표 아이템 타입
interface PriceItem {
  id: string
  category: string
  product_name: string
  specification: string | null
  unit: string | null
  unit_price: number
  tags: string | null
  notes: string | null
}

interface PriceListProps {
  items: PriceItem[]
}

const TABS = ["장비", "설치비"] as const

export default function PriceList({ items }: PriceListProps) {
  const [activeTab, setActiveTab] = useState<string>("장비")
  const [search, setSearch] = useState("")

  // 탭별 데이터 필터링 + 검색
  const filteredItems = useMemo(() => {
    const tabItems = items.filter((item) => item.category === activeTab)

    if (!search.trim()) return tabItems

    const query = search.trim().toLowerCase()
    return tabItems.filter(
      (item) =>
        item.product_name.toLowerCase().includes(query) ||
        (item.specification && item.specification.toLowerCase().includes(query)) ||
        (item.tags && item.tags.toLowerCase().includes(query)) ||
        (item.notes && item.notes.toLowerCase().includes(query))
    )
  }, [items, activeTab, search])

  // 탭별 전체 개수
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const tab of TABS) {
      counts[tab] = items.filter((item) => item.category === tab).length
    }
    return counts
  }, [items])

  // 태그 클릭 → 검색어로 설정
  const handleTagClick = (tag: string) => {
    setSearch(tag.trim())
  }

  // 태그 문자열을 개별 태그 배열로 분리
  const parseTags = (tags: string | null): string[] => {
    if (!tags) return []
    return tags
      .split("#")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => `#${t}`)
  }

  return (
    <div className="flex flex-col h-full -m-6 bg-white">
      {/* 헤더: 탭 + 검색 */}
      <div className="flex items-center justify-between px-6 py-3 border-b">
        {/* 탭 */}
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
                setSearch("")
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-sky-aqua/10 text-sky-aqua"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              {tab}
              <span className="ml-1.5 text-xs opacity-70">
                {tabCounts[tab]}
              </span>
            </button>
          ))}
        </div>

        {/* 검색 */}
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="상품명, 규격, 태그 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* 검색 결과 카운트 */}
      {search && (
        <div className="px-6 py-2 bg-gray-50 border-b text-sm text-gray-500">
          검색 결과: <span className="font-medium text-gray-700">{filteredItems.length}</span>건
        </div>
      )}

      {/* 테이블 */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 border-b z-10">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-gray-500 w-12">#</th>
              <th className="text-left px-3 py-3 font-medium text-gray-500">상품명</th>
              <th className="text-left px-3 py-3 font-medium text-gray-500">규격</th>
              <th className="text-left px-3 py-3 font-medium text-gray-500 w-16">단위</th>
              <th className="text-right px-3 py-3 font-medium text-gray-500 w-32">단가</th>
              {activeTab === "설치비" && (
                <th className="text-left px-3 py-3 font-medium text-gray-500">비고</th>
              )}
              <th className="text-left px-3 py-3 font-medium text-gray-500 pr-6">태그</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredItems.length === 0 ? (
              <tr>
                <td
                  colSpan={activeTab === "설치비" ? 7 : 6}
                  className="text-center py-16 text-gray-400"
                >
                  {search
                    ? "검색 결과가 없습니다"
                    : "데이터가 없습니다"}
                </td>
              </tr>
            ) : (
              filteredItems.map((item, idx) => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-3 text-gray-400 tabular-nums">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-3 font-medium text-gray-900">
                    {item.product_name}
                  </td>
                  <td className="px-3 py-3 text-gray-600">
                    {item.specification || "-"}
                  </td>
                  <td className="px-3 py-3 text-gray-600">
                    {item.unit || "-"}
                  </td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums text-gray-900">
                    {formatCurrency(item.unit_price)}
                  </td>
                  {activeTab === "설치비" && (
                    <td className="px-3 py-3 text-gray-500 text-xs">
                      {item.notes || "-"}
                    </td>
                  )}
                  <td className="px-3 py-3 pr-6">
                    <div className="flex flex-wrap gap-1">
                      {parseTags(item.tags).map((tag) => (
                        <button
                          key={tag}
                          onClick={() => handleTagClick(tag)}
                          className="inline-block px-2 py-0.5 rounded-full text-xs bg-sky-aqua/10 text-sky-aqua hover:bg-sky-aqua/20 transition-colors cursor-pointer"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
