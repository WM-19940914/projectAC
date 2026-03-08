"use client"

import { memo } from "react"
import { Contract } from "@/types"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatShortDate } from "@/lib/format"
import { Building2, Calendar, Edit3 } from "lucide-react"

// settlement_type 문자열 → 배열 파싱 (DB에 "선금,잔금" 또는 '["선금"]' 형태 가능)
function parseSettlementType(value: unknown): string[] {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string' || !value) return []
  const trimmed = value.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
    } catch { /* 폴백 */ }
  }
  return trimmed.split(',').map(s => s.trim()).filter(Boolean)
}

interface ContractCardProps {
    contract: Contract
    isDragging?: boolean
    onClick?: () => void
    cardBarClass?: string
}

function ContractCard({ contract, isDragging, onClick, cardBarClass = "border-l-gray-300" }: ContractCardProps) {
    // 정산 형태 표시
    const renderSettlementTypes = () => {
        if (!contract.settlement_type) return null
        
        // 문자열인 경우와 배열인 경우 모두 대응 (추후 스키마 변경 대비)
        const types = parseSettlementType(contract.settlement_type)
                
        if (types.length === 0) return null

        return (
            <div className="flex flex-wrap gap-1 mt-2">
                {types.map((type, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-600 hover:bg-gray-200">
                        {type}
                    </Badge>
                ))}
            </div>
        )
    }

    return (
        <div
            onClick={onClick}
            className={cn(
                "group relative bg-white flex flex-col p-3 rounded-lg border border-gray-200 shadow-sm cursor-pointer transition-all hover:border-gray-300 hover:shadow-md border-l-4",
                cardBarClass,
                isDragging && "opacity-90 shadow-lg scale-105 rotate-2 z-50 cursor-grabbing ring-2 ring-sky-aqua/50"
            )}
        >
            {/* Edit icon appears on hover */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="p-1 rounded-md bg-gray-50 text-gray-400 hover:text-sky-aqua hover:bg-sky-aqua/10">
                    <Edit3 className="h-4 w-4" />
                </div>
            </div>

            <div className="pr-6">
                {/* 계약명 (title로 변경) */}
                <h4 className="font-heading font-bold text-gray-900 text-sm mb-1 leading-snug">
                    {contract.title}
                </h4>

                {/* 고객사명 */}
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{contract.customer?.company_name || "고객 미지정"}</span>
                </div>
            </div>

            <div className="mt-auto space-y-2">
                {/* 계약 금액 (contract_amount로 변경) */}
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sky-aqua tabular-nums">
                            {formatCurrency(contract.contract_amount)}
                        </span>
                        <span className={cn(
                            "text-[10px] px-1 py-0.5 rounded",
                            contract.vat_inclusive ? "bg-muted-teal/10 text-muted-teal" : "bg-gray-100 text-gray-500"
                        )}>
                            {contract.vat_inclusive ? "VAT 포함" : "VAT 별도"}
                        </span>
                    </div>
                </div>

                {/* 계약 기간 */}
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span>
                        {contract.start_date ? formatShortDate(contract.start_date) : "미정"}
                        {" ~ "}
                        {contract.end_date ? formatShortDate(contract.end_date) : "미정"}
                    </span>
                </div>

                {/* 정산 형태 뱃지들 */}
                {renderSettlementTypes()}
            </div>
        </div>
    )
}

export default memo(ContractCard)
