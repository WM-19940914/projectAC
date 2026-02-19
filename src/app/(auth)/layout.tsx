import type { ReactNode } from "react"

/**
 * 인증 페이지 레이아웃
 * 로그인, 회원가입 페이지에 적용되는 가운데 정렬 레이아웃
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
