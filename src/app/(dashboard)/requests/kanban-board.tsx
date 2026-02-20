"use client"

import { useEffect, useRef, useState } from "react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { formatShortDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Building2, Calendar, Eye, EyeOff, Plus, Trash2, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

// ----- 타입 -----
interface RequestItem {
  id: string
  title: string
  inquiry_date: string | null
  status: string
  memo: string | null
  created_at: string
  customer: {
    id: string
    company_name: string
  } | null
}

interface KanbanColumn {
  status: string
  items: RequestItem[]
  count: number
}

interface CustomerOption {
  id: string
  company_name: string
}

interface Props {
  columns: KanbanColumn[]
  totalCount: number
  customers: CustomerOption[]
  hiddenItems: RequestItem[]
}

// ----- 컬럼별 색상 (커스텀 팔레트) -----
const COLUMN_STYLES: Record<string, {
  header: string
  border: string
  bg: string        // 컬럼 배경색 (연한 투명도)
  badge: string     // 건수 배지 색상
  cardBar: string   // 카드 왼쪽 컬러 바
}> = {
  "견적 문의": {
    header: "text-sky-aqua",
    border: "border-t-sky-aqua",
    bg: "bg-sky-aqua/10",
    badge: "bg-sky-aqua/20 text-sky-aqua",
    cardBar: "border-l-sky-aqua",
  },
  "영업중": {
    header: "text-tropical-teal",
    border: "border-t-tropical-teal",
    bg: "bg-tropical-teal/10",
    badge: "bg-tropical-teal/20 text-tropical-teal",
    cardBar: "border-l-tropical-teal",
  },
  "계약 성공": {
    header: "text-muted-teal",
    border: "border-t-muted-teal",
    bg: "bg-muted-teal/10",
    badge: "bg-muted-teal/20 text-muted-teal",
    cardBar: "border-l-muted-teal",
  },
  "수주 실패": {
    header: "text-soft-blush",
    border: "border-t-soft-blush",
    bg: "bg-soft-blush/10",
    badge: "bg-soft-blush/20 text-soft-blush",
    cardBar: "border-l-soft-blush",
  },
}

export function RequestKanbanBoard({ columns: initialColumns, totalCount, customers, hiddenItems: initialHiddenItems }: Props) {
  // 드래그로 카드 이동 시 화면에 바로 반영하기 위해 state로 관리
  const [columns, setColumns] = useState(initialColumns)
  // 숨긴 카드 목록
  const [hiddenItems, setHiddenItems] = useState(initialHiddenItems)
  // 숨김 패널 열림/닫힘
  const [isHiddenPanelOpen, setIsHiddenPanelOpen] = useState(false)

  // 서버에서 새 데이터가 오면 (생성/삭제 후 refresh) 화면도 바로 갱신
  // JSON 비교로 "실제 데이터"가 바뀔 때만 동기화 (드래그 중 리셋 방지)
  const prevDataRef = useRef(JSON.stringify(initialColumns))
  const prevHiddenRef = useRef(JSON.stringify(initialHiddenItems))
  useEffect(() => {
    const newData = JSON.stringify(initialColumns)
    if (prevDataRef.current !== newData) {
      prevDataRef.current = newData
      setColumns(initialColumns)
    }
    const newHidden = JSON.stringify(initialHiddenItems)
    if (prevHiddenRef.current !== newHidden) {
      prevHiddenRef.current = newHidden
      setHiddenItems(initialHiddenItems)
    }
  }, [initialColumns, initialHiddenItems])
  // 삭제 확인 다이얼로그용 state
  const [deleteTarget, setDeleteTarget] = useState<RequestItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // 상세 패널용 state
  const [selectedItem, setSelectedItem] = useState<RequestItem | null>(null)
  // 컬럼별 정렬 상태: null(기본) → "asc"(오름차순) → "desc"(내림차순) → null 순환
  const [sortOrder, setSortOrder] = useState<Record<string, "asc" | "desc" | null>>({})

  // 정렬 토글 함수
  const toggleSort = (status: string) => {
    setSortOrder((prev) => {
      const current = prev[status] || null
      // null → asc → desc → null 순환
      const next = current === null ? "asc" : current === "asc" ? "desc" : null
      return { ...prev, [status]: next }
    })
  }

  // 정렬이 적용된 컬럼 데이터 반환
  const getSortedItems = (col: KanbanColumn) => {
    const order = sortOrder[col.status]
    if (!order) return col.items

    return [...col.items].sort((a, b) => {
      // 문의 일시가 없는 항목은 맨 뒤로
      if (!a.inquiry_date && !b.inquiry_date) return 0
      if (!a.inquiry_date) return 1
      if (!b.inquiry_date) return -1

      const dateA = new Date(a.inquiry_date).getTime()
      const dateB = new Date(b.inquiry_date).getTime()
      return order === "asc" ? dateA - dateB : dateB - dateA
    })
  }

  // 의뢰 생성 다이얼로그용 state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    title: "",
    customer_id: "",
    inquiry_date: "",
    memo: "",
  })
  const router = useRouter()
  const supabase = createClient()

  // 드래그 끝났을 때 실행되는 함수
  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result

    // 드롭 영역 밖에 놓았으면 무시
    if (!destination) return
    // 같은 자리에 놓았으면 무시
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    // 현재 컬럼 복사
    const newColumns = columns.map((col) => ({
      ...col,
      items: [...col.items],
    }))

    // 출발 컬럼에서 카드 꺼내기
    const sourceCol = newColumns.find((col) => col.status === source.droppableId)!
    const [movedItem] = sourceCol.items.splice(source.index, 1)
    sourceCol.count = sourceCol.items.length

    // 도착 컬럼에 카드 넣기
    const destCol = newColumns.find((col) => col.status === destination.droppableId)!
    movedItem.status = destination.droppableId
    destCol.items.splice(destination.index, 0, movedItem)
    destCol.count = destCol.items.length

    // 화면에 바로 반영 (낙관적 업데이트)
    setColumns(newColumns)

    // DB에 상태 업데이트
    const { error } = await supabase
      .from("requests")
      .update({ status: destination.droppableId })
      .eq("id", draggableId)

    if (error) {
      // 실패 시 원래대로 되돌리기
      setColumns(initialColumns)
    } else {
      // 성공 시 서버 데이터 새로고침
      router.refresh()
    }
  }

  // 삭제 확인 버튼 클릭
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)

    // ID를 미리 저장 (다이얼로그 닫으면 deleteTarget이 null이 되니까)
    const targetId = deleteTarget.id

    // 화면에서 먼저 제거 (낙관적 업데이트)
    const newColumns = columns.map((col) => {
      const filtered = col.items.filter((item) => item.id !== targetId)
      return { ...col, items: filtered, count: filtered.length }
    })
    setColumns(newColumns)
    setDeleteTarget(null)

    // DB에서 삭제 (admin API 사용 → RLS 우회)
    try {
      const res = await fetch("/api/requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: targetId }),
      })
      const result = await res.json()

      if (!res.ok) {
        alert("삭제 실패: " + (result.error || "알 수 없는 오류"))
        setColumns(initialColumns)
      } else {
        router.refresh()
      }
    } catch (e: any) {
      alert("네트워크 오류: " + e.message)
      setColumns(initialColumns)
    }
    setIsDeleting(false)
  }

  // 카드 숨기기 핸들러
  const handleHide = async (item: RequestItem) => {
    // 화면에서 먼저 숨김 (낙관적 업데이트)
    const newColumns = columns.map((col) => {
      const filtered = col.items.filter((i) => i.id !== item.id)
      return { ...col, items: filtered, count: filtered.length }
    })
    setColumns(newColumns)
    setHiddenItems((prev) => [item, ...prev])

    try {
      const res = await fetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, hidden: true }),
      })
      if (!res.ok) {
        // 실패 시 되돌리기
        setColumns(initialColumns)
        setHiddenItems(initialHiddenItems)
      } else {
        router.refresh()
      }
    } catch {
      setColumns(initialColumns)
      setHiddenItems(initialHiddenItems)
    }
  }

  // 카드 복원 핸들러 (숨김 해제)
  const handleUnhide = async (item: RequestItem) => {
    // 화면에서 먼저 복원 (낙관적 업데이트)
    setHiddenItems((prev) => prev.filter((i) => i.id !== item.id))
    const newColumns = columns.map((col) => {
      if (col.status === item.status) {
        return { ...col, items: [item, ...col.items], count: col.count + 1 }
      }
      return col
    })
    setColumns(newColumns)

    try {
      const res = await fetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, hidden: false }),
      })
      if (!res.ok) {
        setColumns(initialColumns)
        setHiddenItems(initialHiddenItems)
      } else {
        router.refresh()
      }
    } catch {
      setColumns(initialColumns)
      setHiddenItems(initialHiddenItems)
    }
  }

  // 의뢰 생성 핸들러
  const handleCreate = async () => {
    if (!createForm.title.trim()) return
    setIsCreating(true)

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      })
      const result = await res.json()

      if (!res.ok) {
        alert("생성 실패: " + (result.error || "알 수 없는 오류"))
      } else {
        // 폼 초기화 & 다이얼로그 닫기
        setCreateForm({ title: "", customer_id: "", inquiry_date: "", memo: "" })
        setIsCreateOpen(false)
        router.refresh()
      }
    } catch (e: any) {
      alert("네트워크 오류: " + e.message)
    }
    setIsCreating(false)
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
        <h1 className="text-lg font-bold text-gray-900">의뢰</h1>
        <p className="text-sm text-gray-500">총 {totalCount}건</p>
      </div>

      {/* 칸반 보드 */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1">
          <div className="flex gap-4 p-4 min-w-max">
            {columns.map((col) => {
              const style = COLUMN_STYLES[col.status] || COLUMN_STYLES["견적 문의"]

              return (
                <div
                  key={col.status}
                  className={cn(
                    "flex flex-col w-[360px] rounded-lg border-t-4",
                    style.border,
                    style.bg
                  )}
                >
                  {/* 컬럼 헤더 */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <h2 className={cn("font-bold text-lg", style.header)}>
                      {col.status}
                    </h2>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className={cn("text-xs", style.badge)}>
                        {col.count}
                      </Badge>
                      {/* 문의 일시 기준 정렬 버튼 */}
                      <button
                        onClick={() => toggleSort(col.status)}
                        title={
                          sortOrder[col.status] === "asc" ? "오래된 순 (오름차순)"
                            : sortOrder[col.status] === "desc" ? "최신 순 (내림차순)"
                            : "정렬 없음"
                        }
                        className={cn(
                          "p-1 rounded-md transition-all",
                          sortOrder[col.status]
                            ? `${style.badge} hover:opacity-80`
                            : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        {sortOrder[col.status] === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : sortOrder[col.status] === "desc" ? (
                          <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 드롭 가능 영역 */}
                  <Droppable droppableId={col.status}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "flex flex-col gap-2 min-h-[100px] px-3 pb-3 rounded-md transition-colors",
                          snapshot.isDraggingOver && "bg-black/5"
                        )}
                      >
                          {getSortedItems(col).map((item, index) => (
                            <Draggable key={item.id} draggableId={item.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  onClick={() => setSelectedItem(item)}
                                  className={cn(
                                    "group relative bg-white rounded-lg border border-l-[3px] p-6 min-h-[130px] shadow-sm hover:shadow-md transition-shadow cursor-grab",
                                    style.cardBar,
                                    snapshot.isDragging && "shadow-lg ring-2 ring-black/10"
                                  )}
                                >
                                  {/* 숨김 버튼 (호버 시에만 표시) */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleHide(item)
                                    }}
                                    title="숨기기"
                                    className="absolute bottom-3 right-12 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all bg-gray-400 hover:bg-gray-500 text-white shadow-md hover:scale-110"
                                  >
                                    <EyeOff className="h-4 w-4" />
                                  </button>

                                  {/* 삭제 버튼 (호버 시에만 표시) */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setDeleteTarget(item)
                                    }}
                                    className="absolute bottom-3 right-3 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all bg-soft-blush hover:bg-soft-blush/80 text-white shadow-md hover:scale-110"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>

                                  {/* 제목 + 상태 배지 */}
                                  <div className="flex items-start justify-between gap-2 mb-2 pr-6">
                                    <p className="text-sm font-medium text-gray-900 truncate" title={item.title}>
                                      {item.title}
                                    </p>
                                    <Badge className={cn("text-[10px] px-1.5 py-0 shrink-0", style.badge)}>
                                      {col.status}
                                    </Badge>
                                  </div>

                                  {/* 문의 일시 */}
                                  {item.inquiry_date && (
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                                      <Calendar className="h-3 w-3" />
                                      <span>{formatShortDate(item.inquiry_date)}</span>
                                    </div>
                                  )}

                                  {/* 고객명 */}
                                  {item.customer && (
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                      <Building2 className="h-3 w-3" />
                                      <span>{item.customer.company_name}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}

                          {/* 빈 컬럼 */}
                          {col.items.length === 0 && (
                            <div className="text-center py-8 text-xs text-gray-400">
                              없음
                            </div>
                          )}
                      </div>
                    )}
                  </Droppable>

                  {/* "견적 문의" 컬럼 하단에만 의뢰 생성 버튼 */}
                  {col.status === "견적 문의" && (
                    <div className="px-3 pb-3">
                      <button
                        onClick={() => setIsCreateOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-sky-aqua/50 bg-sky-aqua/10 text-sky-aqua text-sm font-semibold hover:border-sky-aqua hover:bg-sky-aqua/20 transition-all"
                      >
                        <Plus className="h-4 w-4 stroke-[2.5]" />
                        의뢰 생성
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            {/* ===== 숨김 패널 (칸반보드 맨 우측) ===== */}
            <div className={cn(
              "flex flex-col rounded-lg border border-gray-200 bg-gray-50 transition-all shrink-0",
              isHiddenPanelOpen ? "w-[320px]" : "w-[48px]"
            )}>
              {/* 패널 토글 버튼 */}
              {!isHiddenPanelOpen ? (
                <button
                  onClick={() => setIsHiddenPanelOpen(true)}
                  className="flex flex-col items-center gap-2 py-4 px-1 text-gray-400 hover:text-gray-600 transition-colors h-full"
                >
                  <EyeOff className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium [writing-mode:vertical-rl]">
                    숨김 ({hiddenItems.length})
                  </span>
                </button>
              ) : (
                <>
                  {/* 패널 헤더 */}
                  <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <EyeOff className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-bold text-gray-700">숨김</span>
                      <Badge variant="secondary" className="text-xs bg-gray-200 text-gray-600">
                        {hiddenItems.length}
                      </Badge>
                    </div>
                    <button
                      onClick={() => setIsHiddenPanelOpen(false)}
                      className="p-1 rounded-md hover:bg-gray-200 transition-colors"
                    >
                      <X className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>

                  {/* 숨긴 카드 목록 (상태별 그룹) */}
                  <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
                    {hiddenItems.length === 0 ? (
                      <div className="text-center py-8 text-xs text-gray-400">
                        숨긴 의뢰가 없습니다
                      </div>
                    ) : (
                      // 상태별로 그룹핑해서 보여주기
                      Object.entries(
                        hiddenItems.reduce<Record<string, RequestItem[]>>((acc, item) => {
                          if (!acc[item.status]) acc[item.status] = []
                          acc[item.status].push(item)
                          return acc
                        }, {})
                      ).map(([status, items]) => {
                        const groupStyle = COLUMN_STYLES[status] || COLUMN_STYLES["견적 문의"]
                        return (
                          <div key={status}>
                            {/* 그룹 헤더 */}
                            <div className="flex items-center gap-1.5 px-1 mb-1.5">
                              <span className={cn("text-xs font-semibold", groupStyle.header)}>
                                {status}
                              </span>
                              <span className="text-[10px] text-gray-400">({items.length})</span>
                            </div>
                            {/* 그룹 내 카드들 */}
                            <div className="space-y-1.5">
                              {items.map((item) => (
                                <div
                                  key={item.id}
                                  className={cn(
                                    "group/hidden relative bg-white rounded-md border border-l-[3px] p-3 shadow-sm",
                                    groupStyle.cardBar
                                  )}
                                >
                                  <p className="text-xs font-medium text-gray-700 truncate pr-7" title={item.title}>
                                    {item.title}
                                  </p>
                                  {item.customer && (
                                    <p className="text-[11px] text-gray-400 mt-1 truncate">
                                      {item.customer.company_name}
                                    </p>
                                  )}
                                  {/* 복원 버튼 */}
                                  <button
                                    onClick={() => handleUnhide(item)}
                                    title="복원하기"
                                    className="absolute top-2.5 right-2 p-1 rounded-md opacity-0 group-hover/hidden:opacity-100 transition-all bg-gray-100 hover:bg-gray-200 text-gray-500"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </DragDropContext>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">의뢰 삭제</DialogTitle>
            <DialogDescription className="text-sm text-gray-500 pt-2">
              <span className="font-semibold text-gray-900">
                &ldquo;{deleteTarget?.title}&rdquo;
              </span>
              을(를) 삭제하시겠습니까?
              <br />
              <span className="text-red-500 font-semibold">삭제하면 되돌릴 수 없습니다.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="px-4 py-2 text-sm rounded-md bg-soft-blush text-white hover:bg-soft-blush/80 transition-colors disabled:opacity-50"
            >
              {isDeleting ? "삭제 중..." : "삭제"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 의뢰 생성 다이얼로그 */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateForm({ title: "", customer_id: "", inquiry_date: "", memo: "" })
          }
          setIsCreateOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">새 의뢰 생성</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              새로운 의뢰를 등록합니다. 제목은 필수입니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 제목 (필수) */}
            <div className="space-y-2">
              <Label htmlFor="create-title" className="text-sm font-medium">
                제목 <span className="text-soft-blush">*</span>
              </Label>
              <Input
                id="create-title"
                placeholder="예: OO빌딩 에어컨 설치 문의"
                value={createForm.title}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                autoFocus
              />
            </div>

            {/* 고객 선택 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">고객</Label>
              <Select
                value={createForm.customer_id}
                onValueChange={(v) => setCreateForm((prev) => ({ ...prev, customer_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="고객을 선택하세요 (선택사항)" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 문의 일시 */}
            <div className="space-y-2">
              <Label htmlFor="create-date" className="text-sm font-medium">문의 일시</Label>
              <Input
                id="create-date"
                type="date"
                value={createForm.inquiry_date}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, inquiry_date: e.target.value }))}
              />
            </div>

            {/* 메모 */}
            <div className="space-y-2">
              <Label htmlFor="create-memo" className="text-sm font-medium">메모</Label>
              <Textarea
                id="create-memo"
                placeholder="추가 내용을 입력하세요"
                rows={3}
                value={createForm.memo}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, memo: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => {
                setCreateForm({ title: "", customer_id: "", inquiry_date: "", memo: "" })
                setIsCreateOpen(false)
              }}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating || !createForm.title.trim()}
              className="px-4 py-2 text-sm rounded-md bg-sky-aqua text-white hover:bg-sky-aqua/80 transition-colors disabled:opacity-50"
            >
              {isCreating ? "생성 중..." : "생성"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 의뢰 상세 패널 (오른쪽 슬라이드) */}
      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[1200px] p-0 flex flex-col [&>button:first-child]:hidden">
          {selectedItem && (() => {
            const itemStyle = COLUMN_STYLES[selectedItem.status] || COLUMN_STYLES["견적 문의"]
            return (
              <>
                {/* 상단 헤더 */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setDeleteTarget(selectedItem)
                        setSelectedItem(null)
                      }}
                      className="px-3 py-1.5 text-sm rounded-md text-soft-blush hover:bg-soft-blush/10 transition-colors"
                    >
                      삭제하기
                    </button>
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                    >
                      <X className="h-5 w-5 text-gray-600" />
                    </button>
                  </div>
                </div>

                {/* 본문: 좌우 분리 */}
                <div className="flex-1 flex overflow-hidden">
                  {/* ===== 왼쪽 영역: 의뢰 상세 정보 ===== */}
                  <div className="flex-1 overflow-y-auto px-6 py-6 border-r">
                    {/* 상태 배지 + 생성일 */}
                    <div className="flex items-center gap-3 mb-4">
                      <Badge className={cn("text-xs", itemStyle.badge)}>
                        {selectedItem.status}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {formatShortDate(selectedItem.created_at)} 생성
                      </span>
                    </div>

                    {/* 제목 */}
                    <SheetHeader className="mb-6">
                      <SheetTitle className="font-heading text-2xl text-left">
                        {selectedItem.title}
                      </SheetTitle>
                      <SheetDescription className="sr-only">의뢰 상세 정보</SheetDescription>
                    </SheetHeader>

                    <Separator className="mb-6" />

                    {/* 상세 정보 */}
                    <div className="space-y-5">
                      {/* 단계 */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">단계</span>
                        <Badge className={cn("text-xs", itemStyle.badge)}>
                          {selectedItem.status}
                        </Badge>
                      </div>

                      {/* 고객 */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">고객</span>
                        <span className="text-sm text-gray-900">
                          {selectedItem.customer?.company_name || "없음"}
                        </span>
                      </div>

                      {/* 문의 일시 */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">문의 일시</span>
                        <span className="text-sm text-gray-900">
                          {selectedItem.inquiry_date
                            ? formatShortDate(selectedItem.inquiry_date)
                            : "없음"}
                        </span>
                      </div>
                    </div>

                    <Separator className="my-6" />

                    {/* 메모 */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">내용</h3>
                      <div className="rounded-lg border bg-gray-50 p-4 min-h-[120px]">
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">
                          {selectedItem.memo || "내용 없음"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ===== 오른쪽 영역: 추가 기능 영역 ===== */}
                  <div className="w-[650px] shrink-0 overflow-y-auto px-6 py-6 bg-gray-50/50">
                    <h3 className="text-sm font-semibold text-gray-400 mb-4">추가 기능</h3>
                    <p className="text-xs text-gray-400">이 영역에 기능이 추가될 예정입니다.</p>
                  </div>
                </div>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>
    </div>
  )
}
