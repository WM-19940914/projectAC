"use client"

import React, { useRef, useState } from "react"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
  Briefcase,
  Camera,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
} from "lucide-react"
import { useAuth } from "@/providers/auth-provider"
import { createClient } from "@/lib/supabase/client"

interface MenuItem {
  label: string
  href: string
  icon: React.ElementType
}

const menuItems: MenuItem[] = [
  { label: "대시보드", href: "/dashboard", icon: LayoutDashboard },
  { label: "프로젝트", href: "/requests", icon: Briefcase },
  { label: "고객", href: "/clients", icon: Users },
  { label: "견적서", href: "/quotes", icon: FileText },
  { label: "가격표", href: "/price-list", icon: ClipboardList },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "relative z-20 flex h-full flex-col border-r border-slate-200 bg-white transition-all duration-300",
          collapsed ? "w-[56px]" : "w-[224px]"
        )}
      >
        {/* 로고 영역 — Mooov (서비스 브랜드) */}
        <div className="flex h-12 items-center justify-between px-3">
          {!collapsed ? (
            <Link href="/dashboard" className="flex items-center">
              <span className="text-[28px] text-[#2563EB]" style={{ fontFamily: "'Pacifico', cursive" }}>Mooov</span>
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="mx-auto flex items-center justify-center"
            >
              <span className="text-[16px] text-[#2563EB]" style={{ fontFamily: "'Pacifico', cursive" }}>M</span>
            </Link>
          )}

          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400 hover:text-gray-600"
              onClick={onToggle}
              aria-label="사이드바 접기"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {collapsed && (
          <div className="flex justify-center py-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-gray-600"
              onClick={onToggle}
              aria-label="사이드바 펼치기"
            >
              <PanelLeftOpen className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <ScrollArea className="flex-1 px-2 py-1">
          <nav className="flex flex-col gap-0.5">
            {menuItems.map((item) => {
              const active = isActive(item.href)
              const Icon = item.icon

              return collapsed ? (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex h-8 w-full items-center justify-center rounded-md text-sm transition-colors",
                        active
                          ? "bg-indigo-50 text-indigo-600"
                          : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-indigo-50 text-indigo-600"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </ScrollArea>

        {/* 하단: 유저 프로필 (회사정보 포함) */}
        <SidebarUserProfile collapsed={collapsed} />
      </aside>
    </TooltipProvider>
  )
}

// ----- 이미지 리사이즈 (최대 200x200, JPEG 변환) -----
function resizeImage(file: File, maxSize = 200): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement("canvas")
      // 정사각형 크롭 (중앙 기준)
      const min = Math.min(img.width, img.height)
      const sx = (img.width - min) / 2
      const sy = (img.height - min) / 2
      canvas.width = maxSize
      canvas.height = maxSize
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, sx, sy, min, min, 0, 0, maxSize, maxSize)
      canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.85)
    }
    img.src = url
  })
}

// ----- 프로필 사진 업로드 처리 -----
async function uploadAvatar(file: File, userId: string): Promise<string | null> {
  const supabase = createClient()

  // 이미지 리사이즈 (200x200 JPEG)
  const resized = await resizeImage(file)
  const filePath = `${userId}.jpg`

  // 기존 파일 덮어쓰기 (upsert)
  const { error } = await supabase.storage
    .from("avatars")
    .upload(filePath, resized, {
      upsert: true,
      contentType: "image/jpeg",
    })

  if (error) {
    console.error("아바타 업로드 실패:", error.message)
    toast({ title: "오류", description: "사진 업로드에 실패했습니다: " + error.message, variant: "destructive" })
    return null
  }

  // public URL 가져오기
  const { data } = supabase.storage.from("avatars").getPublicUrl(filePath)
  // 캐시 무효화용 타임스탬프 추가
  return `${data.publicUrl}?t=${Date.now()}`
}

// ----- 하단 유저 프로필 영역 -----
function SidebarUserProfile({ collapsed }: { collapsed: boolean }) {
  const { profile, signOut, refreshProfile } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 이름 첫 글자 (아바타용)
  const initial = profile?.full_name?.charAt(0)?.toUpperCase() || "U"
  const displayName = profile?.full_name || "사용자"
  // 이메일에서 @m.local 제거하여 아이디만 표시
  const displayId = profile?.email?.replace(/@.*$/, "") || ""
  // 역할 표시 (admin → Master, 나머지 → User)
  const roleLabel = profile?.role === "admin" ? "Master" : "User"

  /** 프로필 사진 변경 핸들러 */
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile?.id) return

    const url = await uploadAvatar(file, profile.id)
    if (!url) return

    // profiles 테이블에 avatar_url 업데이트
    const supabase = createClient()
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", profile.id)

    // 프로필 새로고침
    refreshProfile()
  }

  // 숨겨진 파일 input
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp"
      className="hidden"
      onChange={handleAvatarChange}
    />
  )

  /** 사이드바용 아바타 */
  const renderSmallAvatar = (size: "sm" | "md") => {
    const sizeClass = size === "sm" ? "h-8 w-8" : "h-10 w-10"
    const textSize = size === "sm" ? "text-[11px]" : "text-[14px]"

    return profile?.avatar_url ? (
      <img src={profile.avatar_url} alt="" className={`${sizeClass} rounded-full object-cover`} />
    ) : (
      <div className={`flex ${sizeClass} items-center justify-center rounded-full bg-slate-200 ${textSize} font-semibold text-slate-600`}>
        {initial}
      </div>
    )
  }

  /** 팝오버 안 큰 프로필 카드 */
  const profilePopoverContent = (
    <div className="flex flex-col items-center gap-3 p-2">
      {fileInput}
      {/* 큰 프로필 사진 (클릭 시 변경) */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="relative group"
        title="사진 변경"
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 text-2xl font-bold text-slate-500">
            {initial}
          </div>
        )}
        <div className="absolute inset-0 h-20 w-20 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Camera className="h-5 w-5 text-white" />
        </div>
      </button>
      {/* 이름 + 권한 + 아이디 */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5">
          <p className="text-sm font-semibold text-slate-800">{displayName}</p>
          <span className={cn(
            "px-1.5 py-0.5 rounded text-[9px] font-bold leading-none",
            roleLabel === "Master"
              ? "bg-sky-aqua/10 text-sky-aqua"
              : "bg-gray-100 text-gray-500"
          )}>{roleLabel}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">{displayId}</p>
      </div>
      <Separator />
      {/* 로그아웃 */}
      <button
        onClick={(e) => { e.stopPropagation(); signOut(); }}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        로그아웃
      </button>
    </div>
  )

  if (collapsed) {
    return (
      <div className="border-t border-slate-100 px-2 py-2">
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex h-8 w-full items-center justify-center rounded-md hover:bg-gray-50 transition-colors" aria-label="프로필 메뉴 열기">
              {renderSmallAvatar("sm")}
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" align="end" className="w-52">
            {profilePopoverContent}
          </PopoverContent>
        </Popover>
      </div>
    )
  }

  return (
    <div className="border-t border-slate-100 px-2 py-3">
      {/* 회사 정보 — 프로필 바로 위 */}
      {!collapsed && (
        <div className="flex items-center justify-between px-3 mb-2">
          <img src="/logo-melea-full.png" alt="MELEA" className="h-6 object-contain" />
          <span className="text-[11px] text-gray-500 font-semibold">주식회사 멜레아</span>
        </div>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 hover:bg-gray-50 transition-colors text-left">
            {renderSmallAvatar("md")}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-semibold text-slate-700 truncate leading-tight">{displayName}</p>
                <span className={cn(
                  "shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold leading-none",
                  roleLabel === "Master"
                    ? "bg-sky-aqua/10 text-sky-aqua"
                    : "bg-gray-100 text-gray-500"
                )}>{roleLabel}</span>
              </div>
              <p className="text-[11px] text-gray-400 truncate leading-tight mt-1">{displayId}</p>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-52">
          {profilePopoverContent}
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function SidebarMenu({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  return (
    <nav className="flex flex-col gap-0.5 px-2 py-2">
      {menuItems.map((item) => {
        const active = isActive(item.href)
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={cn(
              "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-indigo-50 text-indigo-600"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        )
      })}

      {/* 모바일 유저 프로필 */}
      <Separator className="my-2" />
      <MobileUserProfile onItemClick={onItemClick} />
    </nav>
  )
}

// ----- 모바일 유저 프로필 -----
function MobileUserProfile({ onItemClick }: { onItemClick?: () => void }) {
  const { profile, signOut } = useAuth()
  const initial = profile?.full_name?.charAt(0)?.toUpperCase() || "U"
  const displayName = profile?.full_name || "사용자"
  const displayId = profile?.email?.replace(/@.*$/, "") || ""

  return (
    <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
      ) : (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600 shrink-0">
          {initial}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-slate-700 truncate leading-tight">{displayName}</p>
        <p className="text-[11px] text-gray-400 truncate leading-tight">{displayId}</p>
      </div>
      <button
        onClick={() => { signOut(); onItemClick?.() }}
        className="shrink-0 p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
        aria-label="로그아웃"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
