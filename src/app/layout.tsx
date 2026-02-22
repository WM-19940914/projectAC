import type { Metadata } from "next"
import "./globals.css"
import { AuthProvider } from "@/providers/auth-provider"
import { QueryProvider } from "@/providers/query-provider"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: "M",
  description: "M - 건설/공사 영업·계약·정산 관리 시스템",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
