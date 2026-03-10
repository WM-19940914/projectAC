"use client"

import { Button } from "@/components/ui/button"
import { UserNav } from "@/components/layout/user-nav"
import { Search, Bell, Menu } from "lucide-react"

interface HeaderProps {
  onMobileMenuToggle: () => void
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-4">
      {/* 좌측: 모바일 메뉴 버튼 */}
      <div className="flex items-center md:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={onMobileMenuToggle}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">메뉴 열기</span>
        </Button>
      </div>

      {/* 중앙 여백 */}
      <div className="flex-1" />

      {/* 우측: 알림 + 사용자 메뉴 */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-gray-500 hover:text-gray-900"
        >
          <Bell className="h-5 w-5" />
          <span className="sr-only">알림</span>
        </Button>
        <UserNav />
      </div>
    </header>
  )
}
