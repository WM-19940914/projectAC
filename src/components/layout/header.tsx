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

      {/* 중앙: 검색 바 */}
      <div className="hidden md:flex flex-1 justify-center px-4">
        <button className="flex h-9 w-full max-w-md items-center gap-2 rounded-md border bg-gray-50 px-3 text-sm text-gray-400 transition-colors hover:bg-gray-100">
          <Search className="h-4 w-4" />
          <span>기능 검색하기</span>
        </button>
      </div>

      {/* 모바일에서는 검색 아이콘만 표시 */}
      <div className="flex items-center md:hidden flex-1 justify-center">
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Search className="h-5 w-5 text-gray-500" />
          <span className="sr-only">검색</span>
        </Button>
      </div>

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
