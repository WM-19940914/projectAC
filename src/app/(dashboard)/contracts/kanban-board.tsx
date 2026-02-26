"use client"

import { useState } from "react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { cn } from "@/lib/utils"
import { ClipboardList, Briefcase, CheckCircle2, XCircle, Search, Plus, EyeOff, Hash } from "lucide-react"
import { Input } from "@/components/ui/input"
import SalesTabNav from "@/components/layout/sales-tab-nav"
import { Contract } from "@/types"
import ContractCard from "./contract-card"
import ContractSheet from "./contract-sheet"

interface KanbanColumn {
    status: string
    items: Contract[]
    count: number
}

interface CustomerOption {
    id: string
    company_name: string
    contact_name: string | null
    phone: string | null
    email: string | null
    address: string | null
    representative: string | null
    business_number: string | null
    memo: string | null
}

interface Props {
    columns: KanbanColumn[]
    totalCount: number
    customers: CustomerOption[]
    hiddenItems: Contract[]
}

const COLUMN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    "계약 준비 중": ClipboardList,
    "계약 진행 중": Briefcase,
    "계약 종료": CheckCircle2,
    "계약 중단": XCircle,
}

const COLUMN_STYLES: Record<string, {
    header: string
    border: string
    bg: string
    badge: string
    cardBar: string
}> = {
    "계약 준비 중": {
        header: "text-sky-aqua",
        border: "border-t-sky-aqua",
        bg: "bg-gradient-to-b from-sky-aqua/10 to-transparent",
        badge: "bg-sky-aqua/20 text-sky-aqua",
        cardBar: "border-l-sky-aqua",
    },
    "계약 진행 중": {
        header: "text-tropical-teal",
        border: "border-t-tropical-teal",
        bg: "bg-gradient-to-b from-tropical-teal/10 to-transparent",
        badge: "bg-tropical-teal/20 text-tropical-teal",
        cardBar: "border-l-tropical-teal",
    },
    "계약 종료": {
        header: "text-muted-teal",
        border: "border-t-muted-teal",
        bg: "bg-gradient-to-b from-muted-teal/10 to-transparent",
        badge: "bg-muted-teal/20 text-muted-teal",
        cardBar: "border-l-muted-teal",
    },
    "계약 중단": {
        header: "text-soft-blush",
        border: "border-t-soft-blush",
        bg: "bg-gradient-to-b from-soft-blush/10 to-transparent",
        badge: "bg-soft-blush/20 text-soft-blush",
        cardBar: "border-l-soft-blush",
    },
}

export function ContractKanbanBoard({
    columns: initialColumns,
    totalCount,
    customers,
    hiddenItems,
}: Props) {
    const [columns, setColumns] = useState(initialColumns)
    const [search, setSearch] = useState("")

    const [sheetOpen, setSheetOpen] = useState(false)
    const [selectedContractId, setSelectedContractId] = useState<string | null>(null)

    const [showHidden, setShowHidden] = useState(false)

    const handleDragEnd = async (result: DropResult) => {
        if (!result.destination) return

        const { source, destination, draggableId } = result

        if (source.droppableId === destination.droppableId && source.index === destination.index) return

        // Find item
        let draggedItem: Contract | undefined
        const newColumns = [...columns]

        const sourceColIndex = newColumns.findIndex(c => c.status === source.droppableId)
        if (sourceColIndex > -1) {
            draggedItem = newColumns[sourceColIndex].items[source.index]
            newColumns[sourceColIndex].items.splice(source.index, 1)
            newColumns[sourceColIndex].count--
        }

        if (!draggedItem) return

        const destColIndex = newColumns.findIndex(c => c.status === destination.droppableId)
        if (destColIndex > -1) {
            draggedItem = { ...draggedItem, status: destination.droppableId as Contract["status"] }
            newColumns[destColIndex].items.splice(destination.index, 0, draggedItem)
            newColumns[destColIndex].count++
        }

        setColumns(newColumns)

        try {
            const res = await fetch("/api/contracts", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: draggableId, status: destination.droppableId })
            })
            if (!res.ok) throw new Error("Failed to update status")
        } catch (error) {
            console.error(error)
            setColumns(initialColumns)
        }
    }

    const handleCardClick = (id: string) => {
        setSelectedContractId(id)
        setSheetOpen(true)
    }

    const handleNewContract = () => {
        setSelectedContractId(null)
        setSheetOpen(true)
    }

    // 필터링 적용 (숨김 항목 제외 일반 컬럼)
    const filteredColumns = columns.map(c => ({
        ...c,
        items: c.items.filter(item => {
            if (!search) return true
            const s = search.toLowerCase()
            return item.name?.toLowerCase().includes(s) ||
                item.customer?.company_name?.toLowerCase().includes(s)
        })
    }))

    const filteredHiddenItems = hiddenItems.filter(item => {
        if (!search) return true
        const s = search.toLowerCase()
        return item.name?.toLowerCase().includes(s) ||
            item.customer?.company_name?.toLowerCase().includes(s)
    })

    // 선택된 계약 찾기 (숨김 포함)
    const selectedContract = selectedContractId
        ? [...columns.flatMap(c => c.items), ...hiddenItems].find(c => c.id === selectedContractId)
        : undefined

    return (
        <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] bg-gray-50 overflow-hidden">
            {/* 탭 네비게이션 */}
            <SalesTabNav />

            {/* 헤더 & 검색/액션 바 */}
            <div className="flex flex-col gap-4 p-6 pb-4 bg-white border-b border-gray-200 shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 font-heading">계약 보드</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            총 <span className="font-semibold text-gray-900">{totalCount}</span>개의 계약이 등록되어 있습니다
                        </p>
                    </div>
                    <button
                        onClick={handleNewContract}
                        className="flex items-center gap-2 px-4 py-2 bg-sky-aqua text-white rounded-lg hover:bg-sky-aqua/90 transition-colors shadow-sm font-medium"
                    >
                        <Plus className="h-4 w-4" />
                        새 계약 생성
                    </button>
                </div>

                <div className="flex items-center justify-between">
                    <div className="relative w-[320px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="계약명, 고객명 등 검색..."
                            className="pl-9 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                        />
                    </div>

                    <button
                        onClick={() => setShowHidden(!showHidden)}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-full transition-colors border",
                            showHidden
                                ? "bg-gray-100 border-gray-300 text-gray-700"
                                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                        )}
                    >
                        <EyeOff className="h-4 w-4" />
                        숨긴 항목 {showHidden ? "닫기" : "보기"} <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded-full">{hiddenItems.length}</span>
                    </button>
                </div>
            </div>

            {/* 숨긴 항목 목록 (토글 시) */}
            {showHidden && (
                <div className="bg-gray-100 border-b border-gray-200 p-6 shrink-0 max-h-[250px] overflow-y-auto">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <EyeOff className="h-4 w-4" /> 숨긴 계약 목록
                    </h3>
                    {filteredHiddenItems.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4 text-center">숨긴 계약이 없습니다.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredHiddenItems.map(item => (
                                <ContractCard key={item.id} contract={item} onClick={() => handleCardClick(item.id)} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 칸반 보드 영역 */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
                <DragDropContext onDragEnd={handleDragEnd}>
                    <div className="flex gap-6 h-full min-w-max">
                        {filteredColumns.map((col) => {
                            const style = COLUMN_STYLES[col.status] || COLUMN_STYLES["계약 준비 중"]
                            const Icon = COLUMN_ICONS[col.status] || Hash

                            return (
                                <div key={col.status} className="flex flex-col w-[320px] rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden h-full">
                                    {/* 컬럼 헤더 */}
                                    <div className={cn("p-4 border-b border-t-4", style.bg, style.border)}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Icon className={cn("h-4 w-4", style.header)} />
                                                <h3 className="font-heading font-semibold text-gray-900">{col.status}</h3>
                                            </div>
                                            <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", style.badge)}>
                                                {col.count}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 드롭 영역 */}
                                    <Droppable droppableId={col.status}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.droppableProps}
                                                className={cn(
                                                    "flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-[150px] transition-colors",
                                                    snapshot.isDraggingOver ? "bg-gray-50/80" : "bg-gray-50/40"
                                                )}
                                            >
                                                {col.items.map((item, index) => (
                                                    <Draggable key={item.id} draggableId={item.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                style={{ ...provided.draggableProps.style }}
                                                                onClick={() => handleCardClick(item.id)}
                                                            >
                                                                <ContractCard
                                                                    contract={item}
                                                                    isDragging={snapshot.isDragging}
                                                                    cardBarClass={style.cardBar}
                                                                />
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </div>
                            )
                        })}
                    </div>
                </DragDropContext>
            </div>

            {/* 계약서 슬라이드 오버 시트 (우측 서랍) */}
            <ContractSheet
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                contract={selectedContract}
                customers={customers}
            />
        </div>
    )
}
