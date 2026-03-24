"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Paperclip, Upload, Trash2, Download, FileText, FileSpreadsheet, Image, File, X } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import type { Attachment } from "@/types"

// 파일 타입별 아이콘 + 색상
function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return { icon: Image, color: "text-blue-500", bg: "bg-blue-50" }
  if (fileType.includes("pdf")) return { icon: FileText, color: "text-red-500", bg: "bg-red-50" }
  if (fileType.includes("sheet") || fileType.includes("excel") || fileType.includes("csv"))
    return { icon: FileSpreadsheet, color: "text-green-600", bg: "bg-green-50" }
  if (fileType.includes("word") || fileType.includes("document"))
    return { icon: FileText, color: "text-blue-600", bg: "bg-blue-50" }
  return { icon: File, color: "text-gray-500", bg: "bg-gray-50" }
}

// 파일 크기 포맷 (KB/MB)
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

// 날짜 포맷 (3.24 14:30)
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}.${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
}

export default function AttachmentPanel({ requestId }: { requestId: string }) {
  const [files, setFiles] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // toast는 직접 호출 (훅 아님)

  // 첨부파일 목록 조회
  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/attachments?entity_type=request&entity_id=${requestId}`)
      const json = await res.json()
      setFiles(json.data || [])
    } catch {
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  // 파일 업로드
  const uploadFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "오류", description: "파일 크기는 20MB 이하만 가능합니다", variant: "destructive" })
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("entity_type", "request")
      formData.append("entity_id", requestId)

      const res = await fetch("/api/attachments", { method: "POST", body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "업로드 실패")
      }
      await fetchFiles()
      toast({ title: "완료", description: `${file.name} 업로드 완료` })
    } catch (e) {
      toast({ title: "오류", description: e instanceof Error ? e.message : "업로드 실패", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  // 복수 파일 업로드
  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return
    Array.from(fileList).forEach(uploadFile)
  }

  // 드래그앤드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  // 파일 다운로드
  const downloadFile = async (attachment: Attachment) => {
    try {
      const res = await fetch("/api/attachments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: attachment.id }),
      })
      const json = await res.json()
      if (json.url) {
        const a = document.createElement("a")
        a.href = json.url
        a.download = json.fileName || attachment.file_name
        a.target = "_blank"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    } catch {
      toast({ title: "오류", description: "다운로드 실패", variant: "destructive" })
    }
  }

  // 파일 삭제
  const deleteFile = async (attachment: Attachment) => {
    if (!confirm(`"${attachment.file_name}" 삭제하시겠습니까?`)) return
    try {
      const res = await fetch(`/api/attachments?id=${attachment.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      await fetchFiles()
      toast({ title: "완료", description: "삭제되었습니다" })
    } catch {
      toast({ title: "오류", description: "삭제 실패", variant: "destructive" })
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white h-full flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">첨부파일</span>
          {files.length > 0 && (
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">{files.length}</span>
          )}
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 text-xs text-sky-aqua hover:text-tropical-teal transition-colors disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          추가
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = "" }}
        />
      </div>

      {/* 드래그앤드롭 영역 + 파일 목록 */}
      <div
        className={`flex-1 overflow-y-auto min-h-0 ${dragOver ? "bg-sky-aqua/5 ring-2 ring-sky-aqua/30 ring-inset" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full text-xs text-gray-400">불러오는 중...</div>
        ) : files.length === 0 ? (
          /* 빈 상태: 드래그앤드롭 안내 */
          <div
            className="flex flex-col items-center justify-center h-full gap-2 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${dragOver ? "bg-sky-aqua/10" : "bg-gray-50"} transition-colors`}>
              <Upload className={`h-5 w-5 ${dragOver ? "text-sky-aqua" : "text-gray-300"}`} />
            </div>
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              파일을 드래그하거나<br />클릭하여 업로드
            </p>
            <p className="text-[10px] text-gray-300">최대 20MB</p>
          </div>
        ) : (
          /* 파일 목록 */
          <div className="divide-y divide-gray-50">
            {files.map((f) => {
              const { icon: FileIcon, color, bg } = getFileIcon(f.file_type)
              return (
                <div
                  key={f.id}
                  className="group flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  {/* 아이콘 */}
                  <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                    <FileIcon className={`h-4 w-4 ${color}`} />
                  </div>

                  {/* 파일 정보 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{f.file_name}</p>
                    <p className="text-[10px] text-gray-400">{formatSize(f.file_size)} · {formatDate(f.created_at)}</p>
                  </div>

                  {/* 액션 버튼 (호버 시 표시) */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => downloadFile(f)}
                      className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                      title="다운로드"
                    >
                      <Download className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                    <button
                      onClick={() => deleteFile(f)}
                      className="p-1.5 rounded-md hover:bg-red-50 transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              )
            })}

            {/* 하단 업로드 버튼 (파일 있을 때도 드래그앤드롭 가능) */}
            <div
              className="flex items-center justify-center py-3 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="text-[11px] text-gray-300 hover:text-gray-400">+ 파일 추가</span>
            </div>
          </div>
        )}

        {/* 업로드 중 오버레이 */}
        {uploading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-sky-aqua" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-gray-500">업로드 중...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
