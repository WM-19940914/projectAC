"use client"

import { useState } from "react"
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
import { ArrowLeft, Building2, Calendar, Trash2, X } from "lucide-react"
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

interface Props {
  columns: KanbanColumn[]
  totalCount: number
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

export function RequestKanbanBoard({ columns: initialColumns, totalCount }: Props) {
  // 드래그로 카드 이동 시 화면에 바로 반영하기 위해 state로 관리
  const [columns, setColumns] = useState(initialColumns)
  // 삭제 확인 다이얼로그용 state
  const [deleteTarget, setDeleteTarget] = useState<RequestItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // 상세 패널용 state
  const [selectedItem, setSelectedItem] = useState<RequestItem | null>(null)
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
                    <Badge variant="secondary" className={cn("text-xs", style.badge)}>
                      {col.count}
                    </Badge>
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
                          {col.items.map((item, index) => (
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
                </div>
              )
            })}
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
