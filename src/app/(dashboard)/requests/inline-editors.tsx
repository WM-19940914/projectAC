"use client"

// ----- 인라인 편집 컴포넌트 모음 -----
// InlineTitle, InlineSelect, InlineDate, InlineEditField, InlineEditMemo

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

// ----- 인라인 제목 편집 컴포넌트 -----
export function InlineTitle({
  value,
  onConfirm,
  compact = false,
}: {
  value: string
  onConfirm: (value: string) => void
  compact?: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempValue, setTempValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  // ref로 최신 값 추적 (언마운트 시 저장용)
  const tempRef = useRef(tempValue)
  const valueRef = useRef(value)
  const onConfirmRef = useRef(onConfirm)
  const isEditingRef = useRef(isEditing)
  tempRef.current = tempValue
  valueRef.current = value
  onConfirmRef.current = onConfirm
  isEditingRef.current = isEditing

  // 외부에서 value가 바뀌면 동기화
  useEffect(() => { setTempValue(value) }, [value])

  // 편집 중 언마운트되면 자동저장
  useEffect(() => {
    return () => {
      if (isEditingRef.current && tempRef.current.trim() && tempRef.current !== valueRef.current) {
        onConfirmRef.current(tempRef.current)
      }
    }
  }, [])

  const handleConfirm = () => {
    if (tempValue.trim() && tempValue !== value) {
      onConfirm(tempValue)
    } else {
      setTempValue(value)
    }
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleConfirm}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleConfirm()
          if (e.key === "Escape") { setTempValue(value); setIsEditing(false) }
        }}
        autoFocus
        className={cn(
          "font-sans font-semibold text-left w-full bg-transparent border-b-2 border-slate-400 focus:outline-none",
          compact ? "text-base py-0.5" : "text-2xl py-1"
        )}
      />
    )
  }

  return (
    <h2
      onClick={() => setIsEditing(true)}
      className={cn(
        "font-sans font-semibold text-left cursor-pointer rounded px-1 -mx-1 hover:bg-slate-50 transition-colors truncate",
        compact ? "text-base py-0.5" : "text-2xl py-1"
      )}
      title={value}
    >
      {value}
    </h2>
  )
}

// ----- 인라인 선택 편집 컴포넌트 (값 클릭 → 아래 팝업에 선택지 표시) -----
// badgeStyles: 옵션 value → badge 색상 클래스 매핑 (없으면 일반 텍스트)
export function InlineSelect({
  value,
  displayValue,
  placeholder,
  options,
  onConfirm,
  badgeStyles,
  align = "right",
}: {
  value: string
  displayValue: string
  placeholder: string
  options: { value: string; label: string }[]
  onConfirm: (value: string) => void
  badgeStyles?: Record<string, string>
  align?: "left" | "right"
}) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // 바깥 클릭하면 닫기
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  return (
    <div
      ref={wrapperRef}
      onClick={() => setIsOpen(true)}
      className={cn(
        "relative flex-1 cursor-pointer py-1 px-2 -mx-2",
        align === "left" ? "text-left" : "text-right",
        !displayValue && "border-b border-dashed border-gray-300"
      )}
    >
      {/* 현재 값 표시 */}
      {badgeStyles && displayValue ? (
        <Badge className={cn("text-xs", badgeStyles[value] || "")}>
          {displayValue}
        </Badge>
      ) : (
        <span className={cn("text-sm", displayValue ? "text-gray-900" : "text-gray-400")}>
          {displayValue || placeholder}
        </span>
      )}

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 min-w-[200px] max-h-[240px] overflow-y-auto",
            align === "left" ? "left-0" : "right-0"
          )}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onConfirm(opt.value)
                setIsOpen(false)
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                opt.value === value ? "bg-gray-100" : "hover:bg-gray-50"
              )}
            >
              {badgeStyles ? (
                <Badge className={cn("text-xs", badgeStyles[opt.value] || "")}>
                  {opt.label}
                </Badge>
              ) : (
                <span className={opt.value === value ? "text-slate-700 font-medium" : "text-gray-700"}>
                  {opt.label}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ----- 인라인 날짜 편집 컴포넌트 -----
export function InlineDate({
  value,
  displayValue,
  placeholder,
  onConfirm,
}: {
  value: string
  displayValue: string
  placeholder: string
  onConfirm: (value: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempValue, setTempValue] = useState(value)
  const wrapperRef = useRef<HTMLDivElement>(null)
  // ref로 최신 값 추적 (언마운트 시 저장용)
  const tempRef = useRef(tempValue)
  const valueRef = useRef(value)
  const onConfirmRef = useRef(onConfirm)
  const isEditingRef = useRef(isEditing)
  tempRef.current = tempValue
  valueRef.current = value
  onConfirmRef.current = onConfirm
  isEditingRef.current = isEditing

  useEffect(() => { setTempValue(value) }, [value])

  // 편집 중 언마운트되면 자동저장
  useEffect(() => {
    return () => {
      if (isEditingRef.current && tempRef.current !== valueRef.current) {
        onConfirmRef.current(tempRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isEditing) return
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsEditing(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isEditing])

  const handleConfirm = () => {
    if (tempValue !== value) onConfirm(tempValue)
    setIsEditing(false)
  }

  return (
    <div
      ref={wrapperRef}
      onClick={() => { setTempValue(value); setIsEditing(true) }}
      className={cn(
        "relative inline-flex cursor-pointer items-center rounded-sm py-0.5 px-1 text-right",
        !displayValue && "border-b border-dashed border-gray-300"
      )}
    >
      <span className={cn("text-xs", displayValue ? "text-gray-900" : "text-gray-400")}>
        {displayValue || placeholder}
      </span>

      {isEditing && (
        <div onClick={(e) => e.stopPropagation()} className="absolute top-full right-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 min-w-[240px]">
          <input
            type="date"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            autoFocus
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 mb-2"
          />
          <div className="flex justify-end gap-1.5">
            <button
              onClick={() => setIsEditing(false)}
              className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              className="px-3 py-1 text-xs bg-slate-700 text-white rounded hover:bg-slate-800 transition-colors font-medium"
            >
              입력완료
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ----- 인라인 텍스트 편집 (고객 상세용) -----
export function InlineEditField({
  value,
  placeholder,
  onConfirm,
  type = "text",
  textClass = "",
  align = "right",
}: {
  value: string
  placeholder: string
  onConfirm: (value: string) => void
  type?: "text" | "email"
  textClass?: string
  align?: "left" | "right"
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempValue, setTempValue] = useState(value)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const tempRef = useRef(tempValue)
  const valueRef = useRef(value)
  const onConfirmRef = useRef(onConfirm)
  const isEditingRef = useRef(isEditing)
  tempRef.current = tempValue
  valueRef.current = value
  onConfirmRef.current = onConfirm
  isEditingRef.current = isEditing

  useEffect(() => { setTempValue(value) }, [value])

  useEffect(() => {
    return () => {
      if (isEditingRef.current && tempRef.current !== valueRef.current) {
        onConfirmRef.current(tempRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isEditing) return
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onConfirm(tempValue)
        setIsEditing(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isEditing, tempValue, onConfirm])

  const handleConfirm = () => {
    onConfirm(tempValue)
    setIsEditing(false)
  }

  return (
    <div
      ref={wrapperRef}
      onClick={() => { setTempValue(value); setIsEditing(true) }}
      className={cn(
        "relative flex-1 cursor-pointer rounded hover:bg-slate-50 transition-colors py-1 px-2 -mx-2",
        align === "right" && "text-right",
        !value && "border-b border-dashed border-gray-300"
      )}
    >
      <span className={cn(value ? "text-gray-900" : "text-gray-400", textClass)}>
        {value || placeholder}
      </span>

      {isEditing && (
        <div onClick={(e) => e.stopPropagation()} className="absolute top-full right-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 min-w-[240px]">
          <input
            type={type}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 mb-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm()
              if (e.key === "Escape") setIsEditing(false)
            }}
          />
          <div className="flex justify-end gap-1.5">
            <button onClick={() => setIsEditing(false)} className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors">취소</button>
            <button onClick={handleConfirm} className="px-3 py-1 text-xs bg-slate-700 text-white rounded hover:bg-slate-800 transition-colors font-medium">입력완료</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ----- 인라인 메모 편집 (고객 상세용 textarea) -----
export function InlineEditMemo({
  value,
  placeholder,
  onConfirm,
}: {
  value: string
  placeholder: string
  onConfirm: (value: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempValue, setTempValue] = useState(value)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const tempRef = useRef(tempValue)
  const valueRef = useRef(value)
  const onConfirmRef = useRef(onConfirm)
  const isEditingRef = useRef(isEditing)
  tempRef.current = tempValue
  valueRef.current = value
  onConfirmRef.current = onConfirm
  isEditingRef.current = isEditing

  useEffect(() => { setTempValue(value) }, [value])

  useEffect(() => {
    return () => {
      if (isEditingRef.current && tempRef.current !== valueRef.current) {
        onConfirmRef.current(tempRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isEditing) return
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onConfirm(tempValue)
        setIsEditing(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isEditing, tempValue, onConfirm])

  const handleConfirm = () => {
    onConfirm(tempValue)
    setIsEditing(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div
        onClick={() => { setTempValue(value); setIsEditing(true) }}
        className={cn(
          "cursor-pointer py-1 px-1 -mx-1 rounded hover:bg-slate-50 transition-colors text-sm min-h-[60px] whitespace-pre-wrap",
          value ? "text-gray-900" : "text-gray-400 border-b border-dashed border-gray-300"
        )}
      >
        {value || placeholder}
      </div>
      {isEditing && (
        <div onClick={(e) => e.stopPropagation()} className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 min-w-[300px]">
          <textarea value={tempValue} onChange={(e) => setTempValue(e.target.value)} placeholder={placeholder} autoFocus rows={4}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 resize-none mb-2"
          />
          <div className="flex justify-end gap-1.5">
            <button onClick={() => setIsEditing(false)} className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors">취소</button>
            <button onClick={handleConfirm} className="px-3 py-1 text-xs bg-slate-700 text-white rounded hover:bg-slate-800 transition-colors font-medium">입력완료</button>
          </div>
        </div>
      )}
    </div>
  )
}
