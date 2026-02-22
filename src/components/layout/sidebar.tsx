"use client"

import React, { useState, useEffect } from "react"
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
  FileText,
  CheckSquare,
  Users,
  FileSignature,
  File,
  FileStack,
  DollarSign,
  CreditCard,
  Settings,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Briefcase,
  HandCoins,
} from "lucide-react"

// ----- 타입 정의 -----
interface MenuItem {
  label: string
  href: string
  icon: React.ElementType
}

// 아코디언 메뉴 그룹 (영업, 계약, 정산·지출)
interface AccordionGroup {
  category: string
  icon: React.ElementType       // 카테고리 아이콘
  defaultHref: string           // 카테고리 클릭 시 이동할 경로 (첫 번째 항목)
  items: MenuItem[]
}

// ----- 대시보드 (독립 메뉴) -----
const dashboardItem: MenuItem = {
  label: "대시보드",
  href: "/dashboard",
  icon: LayoutDashboard,
}

// ----- 아코디언 메뉴 구조 -----
const accordionGroups: AccordionGroup[] = [
  {
    category: "영업",
    icon: Briefcase,
    defaultHref: "/requests",
    items: [
      { label: "의뢰", href: "/requests", icon: CheckSquare },
      { label: "고객", href: "/clients", icon: Users },
      { label: "견적서", href: "/quotes", icon: FileText },
    ],
  },
  {
    category: "계약",
    icon: FileSignature,
    defaultHref: "/contracts",
    items: [
      { label: "계약", href: "/contracts", icon: FileSignature },
      { label: "계약서", href: "/contract-documents", icon: File },
      { label: "계약서 양식", href: "/contract-templates", icon: FileStack },
    ],
  },
  {
    category: "정산·지출",
    icon: HandCoins,
    defaultHref: "/settlements",
    items: [
      { label: "정산", href: "/settlements", icon: DollarSign },
      { label: "지출", href: "/expenses", icon: CreditCard },
    ],
  },
]

// ----- 하단 링크 -----
const bottomLinks: MenuItem[] = [
  { label: "가격표", href: "/price-list", icon: ClipboardList },
  { label: "비즈니스 설정", href: "/settings", icon: Settings },
]

// 현재 경로가 어떤 그룹에 속하는지 찾기
function findActiveGroup(pathname: string): string | null {
  for (const group of accordionGroups) {
    if (group.items.some((item) => pathname.startsWith(item.href))) {
      return group.category
    }
  }
  return null
}

// ===== 메인 사이드바 컴포넌트 =====
interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()

  // 열려있는 아코디언 (현재 경로에 맞는 그룹 자동 오픈)
  const [openGroup, setOpenGroup] = useState<string | null>(
    findActiveGroup(pathname)
  )

  // 경로 바뀌면 해당 그룹 자동 오픈
  useEffect(() => {
    const active = findActiveGroup(pathname)
    if (active) setOpenGroup(active)
  }, [pathname])

  // 현재 경로가 메뉴 항목과 일치하는지
  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  // 아코디언 토글 (이미 열려있으면 닫기, 닫혀있으면 열기)
  const toggleGroup = (category: string) => {
    setOpenGroup((prev) => (prev === category ? null : category))
  }


  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-full flex-col border-r bg-white transition-all duration-300",
          collapsed ? "w-[68px]" : "w-[280px]"
        )}
      >
        {/* 로고 영역 */}
        <div className="flex h-14 items-center justify-between border-b px-3">
          {!collapsed && (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 font-bold text-xl text-sky-aqua"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-aqua text-white text-sm font-bold">
                M
              </div>
              M
            </Link>
          )}
          {collapsed && (
            <Link
              href="/dashboard"
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-sky-aqua text-white text-sm font-bold"
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
            {/* 대시보드 (독립) */}
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={dashboardItem.href}
                    className={cn(
                      "flex h-9 w-full items-center justify-center rounded-md text-sm transition-colors",
                      isActive(dashboardItem.href)
                        ? "bg-sky-aqua/10 text-sky-aqua"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <dashboardItem.icon className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">대시보드</TooltipContent>
              </Tooltip>
            ) : (
              <Link
                href={dashboardItem.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-2 text-[15px] font-semibold transition-colors",
                  isActive(dashboardItem.href)
                    ? "bg-sky-aqua/10 text-sky-aqua"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <dashboardItem.icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{dashboardItem.label}</span>
              </Link>
            )}

            {/* 아코디언 메뉴 그룹들 */}
            {accordionGroups.map((group) => {
              const isOpen = openGroup === group.category
              // 이 그룹 안에 활성 항목이 있는지
              const hasActiveItem = group.items.some((item) => isActive(item.href))
              const GroupIcon = group.icon

              return (
                <div key={group.category} className="mt-1">
                  {/* 접힌 상태: 카테고리 아이콘만 (클릭 시 첫 번째 항목으로 이동) */}
                  {collapsed ? (
                    <>
                      <Separator className="my-2" />
                      {group.items.map((item) => {
                        const Icon = item.icon
                        return (
                          <Tooltip key={item.href}>
                            <TooltipTrigger asChild>
                              <Link
                                href={item.href}
                                className={cn(
                                  "flex h-9 w-full items-center justify-center rounded-md text-sm transition-colors",
                                  isActive(item.href)
                                    ? "bg-sky-aqua/10 text-sky-aqua"
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
                      })}
                    </>
                  ) : (
                    <>
                      {/* 펼친 상태: 아코디언 헤더 */}
                      <div
                        className={cn(
                          "flex h-10 w-full items-center gap-3 rounded-md px-2 text-[15px] font-semibold transition-colors mt-2 cursor-pointer",
                          hasActiveItem
                            ? "text-sky-aqua"
                            : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                        )}
                      >
                        {/* 카테고리 이름 클릭 → 기본 페이지 이동 + 열기 */}
                        <Link
                          href={group.defaultHref}
                          onClick={() => setOpenGroup(group.category)}
                          className="flex flex-1 items-center gap-3"
                        >
                          <GroupIcon className="h-5 w-5 shrink-0" />
                          <span className="truncate">{group.category}</span>
                        </Link>
                        {/* 화살표 클릭 → 아코디언 토글만 */}
                        <button
                          onClick={() => toggleGroup(group.category)}
                          className="p-1 rounded hover:bg-gray-200 transition-colors"
                        >
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 transition-transform duration-200",
                              isOpen ? "rotate-0" : "-rotate-90"
                            )}
                          />
                        </button>
                      </div>

                      {/* 아코디언 내용 (하위 메뉴) */}
                      <div
                        className={cn(
                          "overflow-hidden transition-all duration-200",
                          isOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
                        )}
                      >
                        {group.items.map((item) => {
                          const active = isActive(item.href)
                          const Icon = item.icon

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                "flex h-9 items-center gap-3 rounded-md pl-9 pr-2 text-[14px] transition-colors",
                                active
                                  ? "bg-sky-aqua/10 text-sky-aqua font-medium"
                                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                              )}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="truncate">{item.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
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
                className="flex h-10 items-center gap-3 rounded-md px-2 text-[15px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <Icon className="h-5 w-5 shrink-0" />
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
  const [openGroup, setOpenGroup] = useState<string | null>(
    findActiveGroup(pathname)
  )

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  const toggleGroup = (category: string) => {
    setOpenGroup((prev) => (prev === category ? null : category))
  }

  return (
    <nav className="flex flex-col gap-1 px-3 py-2">
      {/* 대시보드 */}
      <Link
        href={dashboardItem.href}
        onClick={onItemClick}
        className={cn(
          "flex h-9 items-center gap-3 rounded-md px-2 text-sm font-semibold transition-colors",
          isActive(dashboardItem.href)
            ? "bg-sky-aqua/10 text-sky-aqua"
            : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
        )}
      >
        <dashboardItem.icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{dashboardItem.label}</span>
      </Link>

      {/* 아코디언 그룹 */}
      {accordionGroups.map((group) => {
        const isOpen = openGroup === group.category
        const hasActiveItem = group.items.some((item) => isActive(item.href))
        const GroupIcon = group.icon

        return (
          <div key={group.category}>
            <div
              className={cn(
                "flex h-9 w-full items-center gap-3 rounded-md px-2 text-sm font-semibold transition-colors mt-2 cursor-pointer",
                hasActiveItem
                  ? "text-sky-aqua"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Link
                href={group.defaultHref}
                onClick={() => { setOpenGroup(group.category); onItemClick?.() }}
                className="flex flex-1 items-center gap-3"
              >
                <GroupIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{group.category}</span>
              </Link>
              <button
                onClick={() => toggleGroup(group.category)}
                className="p-1 rounded hover:bg-gray-200 transition-colors"
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    isOpen ? "rotate-0" : "-rotate-90"
                  )}
                />
              </button>
            </div>

            <div
              className={cn(
                "overflow-hidden transition-all duration-200",
                isOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
              )}
            >
              {group.items.map((item) => {
                const active = isActive(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onItemClick}
                    className={cn(
                      "flex h-8 items-center gap-3 rounded-md pl-9 pr-2 text-sm transition-colors",
                      active
                        ? "bg-sky-aqua/10 text-sky-aqua font-medium"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}

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
