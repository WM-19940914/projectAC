"use client"

import React, { useEffect, useState } from "react"
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
  CheckSquare,
  ChevronDown,
  ClipboardList,
  FileText,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
} from "lucide-react"

interface MenuItem {
  label: string
  href: string
  icon: React.ElementType
}

interface AccordionGroup {
  category: string
  icon: React.ElementType
  defaultHref: string
  items: MenuItem[]
}

const dashboardItem: MenuItem = {
  label: "대시보드",
  href: "/dashboard",
  icon: LayoutDashboard,
}

const accordionGroups: AccordionGroup[] = [
  {
    category: "프로젝트",
    icon: Briefcase,
    defaultHref: "/requests",
    items: [
      { label: "현장관리", href: "/requests", icon: CheckSquare },
      { label: "고객", href: "/clients", icon: Users },
      { label: "견적서", href: "/quotes", icon: FileText },
    ],
  },
]

const bottomLinks: MenuItem[] = [
  { label: "가격표", href: "/price-list", icon: ClipboardList },
  { label: "비즈니스 설정", href: "/settings", icon: Settings },
]

function findActiveGroup(pathname: string): string | null {
  for (const group of accordionGroups) {
    if (group.items.some((item) => pathname.startsWith(item.href))) {
      return group.category
    }
  }
  return null
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const [openGroup, setOpenGroup] = useState<string | null>(findActiveGroup(pathname))

  useEffect(() => {
    const active = findActiveGroup(pathname)
    if (active) setOpenGroup(active)
  }, [pathname])

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  const toggleGroup = (category: string) => {
    setOpenGroup((prev) => (prev === category ? null : category))
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "relative z-20 flex h-full flex-col border-r border-gray-100 bg-white/60 shadow-[4px_0_24px_rgba(0,0,0,0.02)] backdrop-blur-xl transition-all duration-300",
          collapsed ? "w-[68px]" : "w-[280px]"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-3">
          {!collapsed ? (
            <Link href="/dashboard" className="flex items-center gap-2 text-xl font-bold text-sky-aqua">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-aqua to-tropical-teal text-sm font-bold text-white shadow-md shadow-sky-aqua/20">
                M
              </div>
              M
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-sky-aqua text-sm font-bold text-white"
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

        <ScrollArea className="flex-1 px-3 py-2">
          <nav className="flex flex-col gap-1">
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
                <TooltipContent side="right">{dashboardItem.label}</TooltipContent>
              </Tooltip>
            ) : (
              <Link
                href={dashboardItem.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-all duration-200 active:scale-95 hover:translate-x-1",
                  isActive(dashboardItem.href)
                    ? "bg-sky-aqua/10 text-sky-aqua shadow-sm"
                    : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
                )}
              >
                <dashboardItem.icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{dashboardItem.label}</span>
              </Link>
            )}

            {accordionGroups.map((group) => {
              const isOpen = openGroup === group.category
              const hasActiveItem = group.items.some((item) => isActive(item.href))
              const GroupIcon = group.icon

              return (
                <div key={group.category} className="mt-1">
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
                            <TooltipContent side="right">{item.label}</TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </>
                  ) : (
                    <>
                      <div
                        className={cn(
                          "mt-2 flex h-10 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-all duration-200 active:scale-[0.98] hover:translate-x-1",
                          hasActiveItem
                            ? "bg-sky-aqua/5 text-sky-aqua shadow-sm"
                            : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
                        )}
                      >
                        <Link
                          href={group.defaultHref}
                          onClick={() => setOpenGroup(group.category)}
                          className="flex flex-1 items-center gap-3"
                        >
                          <GroupIcon className="h-5 w-5 shrink-0" />
                          <span className="truncate">{group.category}</span>
                        </Link>
                        <button
                          onClick={() => toggleGroup(group.category)}
                          className="rounded p-1 transition-colors hover:bg-gray-200"
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
                              className={cn(
                                "mt-1 flex h-9 items-center gap-3 rounded-lg pl-9 pr-3 text-[14px] transition-all duration-200 active:scale-[0.98] hover:translate-x-1",
                                active
                                  ? "bg-sky-aqua/10 font-semibold text-sky-aqua shadow-sm"
                                  : "text-gray-500 hover:bg-gray-100/80 hover:text-gray-900"
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
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className="mt-1 flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] text-gray-500 transition-all duration-200 active:scale-[0.98] hover:translate-x-1 hover:bg-gray-100/80 hover:text-gray-900"
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

export function SidebarMenu({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname()
  const [openGroup, setOpenGroup] = useState<string | null>(findActiveGroup(pathname))

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  const toggleGroup = (category: string) => {
    setOpenGroup((prev) => (prev === category ? null : category))
  }

  return (
    <nav className="flex flex-col gap-1 px-3 py-2">
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

      {accordionGroups.map((group) => {
        const isOpen = openGroup === group.category
        const hasActiveItem = group.items.some((item) => isActive(item.href))
        const GroupIcon = group.icon

        return (
          <div key={group.category}>
            <div
              className={cn(
                "mt-2 flex h-9 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-sm font-semibold transition-colors",
                hasActiveItem ? "text-sky-aqua" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Link
                href={group.defaultHref}
                onClick={() => {
                  setOpenGroup(group.category)
                  onItemClick?.()
                }}
                className="flex flex-1 items-center gap-3"
              >
                <GroupIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{group.category}</span>
              </Link>
              <button
                onClick={() => toggleGroup(group.category)}
                className="rounded p-1 transition-colors hover:bg-gray-200"
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
                        ? "bg-sky-aqua/10 font-medium text-sky-aqua"
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
