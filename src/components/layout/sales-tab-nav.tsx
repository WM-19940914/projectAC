"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CheckSquare, Users, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

// 영업 메뉴 탭 (의뢰, 고객, 견적서)
const SALES_TABS = [
  { label: "의뢰", href: "/requests", icon: CheckSquare },
  { label: "고객", href: "/clients", icon: Users },
  { label: "견적서", href: "/quotes", icon: FileText },
] as const

export default function SalesTabNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-6">
      {SALES_TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "flex items-center gap-1.5 text-lg font-bold transition-colors",
            pathname === tab.href
              ? "text-gray-900"
              : "text-gray-300 hover:text-gray-500"
          )}
        >
          <tab.icon className="h-5 w-5" />
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
