"use client"

import Link from "next/link"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SidebarMenu } from "@/components/layout/sidebar"

interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  // 메뉴 클릭 시 자동 닫기
  const handleItemClick = () => {
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] p-0">
        {/* 로고 영역 */}
        <SheetTitle className="sr-only">네비게이션 메뉴</SheetTitle>
        <div className="flex h-14 items-center border-b px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-bold text-lg text-blue-600"
            onClick={handleItemClick}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white text-sm font-bold">
              M
            </div>
            Melea
          </Link>
        </div>

        {/* 메뉴 목록 */}
        <ScrollArea className="h-[calc(100vh-56px)]">
          <SidebarMenu onItemClick={handleItemClick} />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
