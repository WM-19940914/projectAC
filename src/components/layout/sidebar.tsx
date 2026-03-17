"use client"

import React from "react"
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
import { Separator } from "@/components/ui/separator"
import {
  Briefcase,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
} from "lucide-react"
import { useAuth } from "@/providers/auth-provider"

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
        {/* 로고 영역 */}
        <div className="flex h-12 items-center justify-between px-3">
          {!collapsed ? (
            <Link href="/dashboard" className="flex items-center">
              <img src="/logo-melea-full.png" alt="MELEA" className="h-7" />
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="mx-auto flex items-center justify-center"
            >
              <img src="/logo-melea.png" alt="M" className="h-7 w-7 object-contain" />
            </Link>
          )}

          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400 hover:text-gray-600"
              onClick={onToggle}
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

        {/* 하단 유저 프로필 */}
        <SidebarUserProfile collapsed={collapsed} />
      </aside>
    </TooltipProvider>
  )
}

// ----- 하단 유저 프로필 영역 -----
function SidebarUserProfile({ collapsed }: { collapsed: boolean }) {
  const { profile, signOut } = useAuth()

  // 이름 첫 글자 (아바타용)
  const initial = profile?.name?.charAt(0)?.toUpperCase() || "U"
  const displayName = profile?.name || "사용자"
  const displayEmail = profile?.email || "user@example.com"

  if (collapsed) {
    return (
      <div className="border-t border-slate-100 px-2 py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={signOut}
              className="flex h-8 w-full items-center justify-center rounded-md text-sm text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-800"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600">
                {initial}
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{displayName}</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="border-t border-slate-100 px-2 py-3">
      <div className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-gray-50">
        {/* 아바타 */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[12px] font-semibold text-slate-600 shrink-0">
          {initial}
        </div>
        {/* 이름 + 이메일 */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-slate-700 truncate leading-tight">{displayName}</p>
          <p className="text-[11px] text-gray-400 truncate leading-tight mt-0.5">{displayEmail}</p>
        </div>
        {/* 로그아웃 */}
        <button
          onClick={signOut}
          className="shrink-0 p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="로그아웃"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
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
  const initial = profile?.name?.charAt(0)?.toUpperCase() || "U"
  const displayName = profile?.name || "사용자"
  const displayEmail = profile?.email || "user@example.com"

  return (
    <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600 shrink-0">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-slate-700 truncate leading-tight">{displayName}</p>
        <p className="text-[11px] text-gray-400 truncate leading-tight">{displayEmail}</p>
      </div>
      <button
        onClick={() => { signOut(); onItemClick?.() }}
        className="shrink-0 p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
        title="로그아웃"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
