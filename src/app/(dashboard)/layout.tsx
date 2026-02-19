"use client"

import { useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 사이드바 접기/펼치기 상태 관리
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  // 모바일 네비게이션 열림/닫힘 상태 관리
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* 데스크탑 사이드바 (md 이상에서만 표시) */}
      <div className="hidden md:flex">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((prev) => !prev)}
        />
      </div>

      {/* 모바일 네비게이션 (Sheet) */}
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />

      {/* 메인 콘텐츠 영역 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 상단 헤더 */}
        <Header onMobileMenuToggle={() => setMobileNavOpen(true)} />

        {/* 페이지 콘텐츠 */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
