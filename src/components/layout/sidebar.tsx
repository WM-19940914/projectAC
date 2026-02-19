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
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import {
  LayoutDashboard,
  Calendar,
  FileText,
  CheckSquare,
  Users,
  Mail,
  FileSignature,
  File,
  FileStack,
  DollarSign,
  CreditCard,
  ArrowRightLeft,
  Receipt,
  Megaphone,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"

// 사이드바 메뉴 항목 타입 정의
interface MenuItem {
  label: string
  href: string
  icon: React.ElementType
}

// 메뉴 카테고리 타입 정의
interface MenuCategory {
  category?: string
  items: MenuItem[]
}

// 사이드바 메뉴 구조 정의
const menuStructure: MenuCategory[] = [
  {
    // 상단 메뉴 (카테고리 없음)
    items: [
      { label: "대시보드", href: "/dashboard", icon: LayoutDashboard },
      { label: "통합 일정", href: "/calendar", icon: Calendar },
    ],
  },
  {
    category: "관리",
    items: [
      { label: "문의 폼", href: "/inquiry-forms", icon: FileText },
    ],
  },
  {
    category: "영업",
    items: [
      { label: "의뢰", href: "/requests", icon: CheckSquare },
      { label: "고객", href: "/clients", icon: Users },
      { label: "견적서", href: "/quotes", icon: FileText },
      { label: "메일 템플릿", href: "/mail-templates", icon: Mail },
    ],
  },
  {
    category: "계약",
    items: [
      { label: "계약", href: "/contracts", icon: FileSignature },
      { label: "계약서", href: "/contract-documents", icon: File },
      { label: "계약서 양식", href: "/contract-templates", icon: FileStack },
    ],
  },
  {
    category: "정산·지출",
    items: [
      { label: "정산", href: "/settlements", icon: DollarSign },
      { label: "지출", href: "/expenses", icon: CreditCard },
      { label: "입출금내역", href: "/transactions", icon: ArrowRightLeft },
    ],
  },
  {
    // 하단 독립 메뉴
    items: [
      { label: "세금계산서", href: "/tax-invoices", icon: Receipt },
    ],
  },
]

// 하단 링크 정의
const bottomLinks: MenuItem[] = [
  { label: "업데이트 소식", href: "/updates", icon: Megaphone },
  { label: "비즈니스 설정", href: "/settings", icon: Settings },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()

  // 현재 경로가 메뉴 항목과 일치하는지 확인
  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard"
    }
    return pathname.startsWith(href)
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-full flex-col border-r bg-white transition-all duration-300",
          collapsed ? "w-[68px]" : "w-[240px]"
        )}
      >
        {/* 로고 영역 */}
        <div className="flex h-14 items-center justify-between border-b px-3">
          {!collapsed && (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 font-bold text-lg text-blue-600"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white text-sm font-bold">
                M
              </div>
              Melea
            </Link>
          )}
          {collapsed && (
            <Link
              href="/dashboard"
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white text-sm font-bold"
            >
              M
            </Link>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-gray-600"
              onClick={onToggle}
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* 접힌 상태에서 펼치기 버튼 */}
        {collapsed && (
          <div className="flex justify-center py-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-gray-600"
              onClick={onToggle}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* 메뉴 영역 */}
        <ScrollArea className="flex-1 px-3 py-2">
          <nav className="flex flex-col gap-1">
            {menuStructure.map((group, groupIndex) => (
              <div key={groupIndex}>
                {/* 카테고리 헤더 */}
                {group.category && (
                  <>
                    {!collapsed ? (
                      <div className="px-2 py-2 mt-3 mb-1">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                          {group.category}
                        </span>
                      </div>
                    ) : (
                      <Separator className="my-2" />
                    )}
                  </>
                )}

                {/* 메뉴 항목들 */}
                {group.items.map((item) => {
                  const active = isActive(item.href)
                  const Icon = item.icon

                  // 접힌 상태: 툴팁 표시
                  if (collapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex h-9 w-full items-center justify-center rounded-md text-sm transition-colors",
                              active
                                ? "bg-blue-50 text-blue-600"
                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    )
                  }

                  // 펼친 상태: 전체 표시
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex h-9 items-center gap-3 rounded-md px-2 text-sm transition-colors",
                        active
                          ? "bg-blue-50 text-blue-600 font-medium"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* 하단 링크 영역 */}
        <div className="border-t px-3 py-2">
          {bottomLinks.map((item) => {
            const Icon = item.icon

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className="flex h-9 w-full items-center justify-center rounded-md text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                    >
                      <Icon className="h-4 w-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex h-9 items-center gap-3 rounded-md px-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </aside>
    </TooltipProvider>
  )
}

// 모바일 네비게이션에서 재사용할 메뉴 컴포넌트
export function SidebarMenu({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard"
    }
    return pathname.startsWith(href)
  }

  return (
    <nav className="flex flex-col gap-1 px-3 py-2">
      {menuStructure.map((group, groupIndex) => (
        <div key={groupIndex}>
          {group.category && (
            <div className="px-2 py-2 mt-3 mb-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                {group.category}
              </span>
            </div>
          )}

          {group.items.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onItemClick}
                className={cn(
                  "flex h-9 items-center gap-3 rounded-md px-2 text-sm transition-colors",
                  active
                    ? "bg-blue-50 text-blue-600 font-medium"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      ))}

      {/* 하단 링크 */}
      <Separator className="my-2" />
      {bottomLinks.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className="flex h-9 items-center gap-3 rounded-md px-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
