"use client"

import { useState, useMemo } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/format"

// 가격표 아이템 타입
interface PriceItem {
  id: string
  category: string
  sub_category: string | null
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
  const [subFilter, setSubFilter] = useState<string>("전체")
  const [search, setSearch] = useState("")

  // 장비 탭의 소분류 목록 (고정 순서)
  const EQUIP_SUB_ORDER = ["전체", "실외기", "실내기", "판넬", "분지관", "제어기기", "싱글", "HOME", "ETC", "미분류"]
  // 설치비 탭의 소분류 목록 (고정 순서)
  const INSTALL_SUB_ORDER = ["전체", "냉매배관", "보온재", "드레인", "덕트", "전기/배선", "받침대", "공사비", "미분류"]

  const subCategories = useMemo(() => {
    const targetCategory = activeTab
    const order = activeTab === "장비" ? EQUIP_SUB_ORDER : INSTALL_SUB_ORDER

    const existing = new Set<string>()
    let hasNull = false
    items.forEach((item) => {
      if (item.category === targetCategory) {
        if (item.sub_category) existing.add(item.sub_category)
        else hasNull = true
      }
    })
    const result = order.filter((s) => s === "전체" || existing.has(s))
    if (hasNull) result.push("미분류")
    return result
  }, [items, activeTab])

  // 탭별 데이터 필터링 + 소분류 + 검색
  const filteredItems = useMemo(() => {
    let tabItems = items.filter((item) => item.category === activeTab)

    // 소분류 필터 (장비·설치비 모두 적용)
    if (subFilter !== "전체") {
      if (subFilter === "미분류") {
        tabItems = tabItems.filter((item) => !item.sub_category)
      } else {
        tabItems = tabItems.filter((item) => item.sub_category === subFilter)
      }
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase()
      tabItems = tabItems.filter(
        (item) =>
          item.product_name.toLowerCase().includes(query) ||
          (item.specification && item.specification.toLowerCase().includes(query))
      )
    }

    // 소분류 순서 기준 정렬
    const subOrder = activeTab === "장비" ? EQUIP_SUB_ORDER : INSTALL_SUB_ORDER

    // 규격 문자열에서 첫 번째 숫자 추출 (예: "6.35mm" → 6.35, "20A" → 20)
    const getSpecNum = (spec: string | null): number => {
      if (!spec) return 9999
      // 소형/중형/대형 → 1/2/3
      if (spec.includes("소형")) return 1
      if (spec.includes("중형")) return 2
      if (spec.includes("대형")) return 3
      const match = spec.match(/(\d+\.?\d*)/)
      return match ? parseFloat(match[1]) : 9999
    }

    tabItems.sort((a, b) => {
      // 1) 소분류 순서
      const ai = subOrder.indexOf(a.sub_category || "")
      const bi = subOrder.indexOf(b.sub_category || "")
      const orderA = ai === -1 ? 999 : ai
      const orderB = bi === -1 ? 999 : bi
      if (orderA !== orderB) return orderA - orderB

      // 2) 장비 탭: 제품 타입 → 용량 순 정렬
      if (activeTab === "장비") {
        const getType = (name: string) => name.replace(/[\d.]+\s*(HP|평|마력)/g, "").replace(/\(.*?\)/g, "").trim()
        const typeCmp = getType(a.product_name).localeCompare(getType(b.product_name))
        if (typeCmp !== 0) return typeCmp
        const getNum = (name: string) => Number(name.match(/(\d+)\s*(HP|평|마력)/)?.[1] || "0")
        const numDiff = getNum(a.product_name) - getNum(b.product_name)
        if (numDiff !== 0) return numDiff
      }

      // 3) 설치비 탭: 같은 상품끼리 묶고, 규격 사이즈 오름차순
      if (activeTab === "설치비") {
        const nameCmp = a.product_name.localeCompare(b.product_name)
        if (nameCmp !== 0) return nameCmp
        // 같은 상품명이면 규격 숫자 오름차순
        const specDiff = getSpecNum(a.specification) - getSpecNum(b.specification)
        if (specDiff !== 0) return specDiff
        // 숫자도 같으면 규격 문자열 가나다순
        return (a.specification || "").localeCompare(b.specification || "")
      }

      // 4) 기본: 상품명 가나다순
      return a.product_name.localeCompare(b.product_name)
    })

    return tabItems
  }, [items, activeTab, subFilter, search])

  // 탭별 전체 개수
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const tab of TABS) {
      counts[tab] = items.filter((item) => item.category === tab).length
    }
    return counts
  }, [items])


  return (
    <div className="flex flex-col h-full -m-6 bg-gray-50/30">
      {/* 헤더: 탭 + 검색 */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b">
        {/* 탭 */}
        <div className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
                setSubFilter("전체")
                setSearch("")
              }}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === tab
                  ? "bg-sky-aqua text-white shadow-sm"
                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              }`}
            >
              {tab}
              <span className={`ml-1.5 text-xs ${activeTab === tab ? "text-white/70" : "opacity-50"}`}>
                {tabCounts[tab]}
              </span>
            </button>
          ))}
        </div>

        {/* 검색 */}
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="상품명, 규격 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm rounded-xl border-gray-200 focus:border-sky-aqua focus:ring-sky-aqua/20"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* 소분류 필터 (장비·설치비 모두) */}
      <div className="flex items-center gap-2 px-6 py-3 bg-white border-b overflow-x-auto">
          {subCategories.map((sub) => {
            const count = sub === "전체"
              ? items.filter((i) => i.category === activeTab).length
              : sub === "미분류"
                ? items.filter((i) => i.category === activeTab && !i.sub_category).length
                : items.filter((i) => i.category === activeTab && i.sub_category === sub).length
            return (
              <button
                key={sub}
                onClick={() => setSubFilter(sub)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  subFilter === sub
                    ? "bg-sky-aqua/10 text-sky-aqua border border-sky-aqua/30"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50 border border-transparent"
                }`}
              >
                {sub}
                <span className={`ml-1 text-[11px] ${subFilter === sub ? "text-sky-aqua/60" : "opacity-40"}`}>{count}</span>
              </button>
            )
          })}
      </div>

      {/* 검색 결과 카운트 */}
      {search && (
        <div className="px-6 py-2.5 bg-white border-b text-sm text-gray-500">
          검색 결과: <span className="font-semibold text-sky-aqua">{filteredItems.length}</span>건
        </div>
      )}

      {/* 리스트 */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {filteredItems.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
            {search ? "검색 결과가 없습니다" : "데이터가 없습니다"}
          </div>
        ) : (
          <div className="space-y-1">
            {/* 헤더 */}
            <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-2 text-[11px] font-semibold text-gray-500 w-fit bg-gray-50/95 backdrop-blur-sm rounded-lg">
              <span className="shrink-0 w-[64px] text-center">분류</span>
              <span className="shrink-0 w-[260px] text-center">상품명</span>
              <span className="shrink-0 w-[180px] text-center">규격</span>
              <span className="shrink-0 w-[40px] text-center">단위</span>
              <span className="shrink-0 w-[100px] text-center">단가</span>
            </div>
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="group flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl hover:shadow-sm hover:bg-sky-aqua/[0.02] transition-all cursor-default w-fit"
              >
                {/* 분류 배지 */}
                <span className="shrink-0 w-[64px] text-center text-[10px] font-medium text-gray-400 bg-gray-100 rounded-md py-0.5">
                  {item.sub_category || "-"}
                </span>

                {/* 상품명 */}
                <span className="shrink-0 w-[260px] text-[13px] font-semibold text-gray-800 text-center truncate">
                  {item.product_name}
                </span>

                {/* 규격 */}
                <span className="shrink-0 w-[180px] text-[12px] text-gray-700 text-center truncate">
                  {item.specification || "-"}
                </span>

                {/* 단위 */}
                <span className="shrink-0 w-[40px] text-center text-[11px] text-gray-400">
                  {item.unit || "-"}
                </span>

                {/* 단가 */}
                <span className="shrink-0 w-[100px] text-center text-[13px] font-semibold tabular-nums text-gray-900">
                  {formatCurrency(item.unit_price)}
                </span>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
