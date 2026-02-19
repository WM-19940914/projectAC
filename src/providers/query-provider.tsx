"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"

/**
 * TanStack Query Provider
 * 클라이언트 사이드 데이터 페칭 및 캐싱을 관리
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 윈도우 포커스 시 자동 refetch 방지
            refetchOnWindowFocus: false,
            // 기본 stale time 설정 (5분)
            staleTime: 5 * 60 * 1000,
            // 재시도 횟수
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
