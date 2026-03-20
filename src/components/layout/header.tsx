"use client"

import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"

interface HeaderProps {
  onMobileMenuToggle: () => void
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  return (
    <header className="flex h-12 items-center border-b bg-white px-4">
      {/* 모바일 메뉴 버튼 (md 이하에서만 표시) */}
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
    </header>
  )
}
