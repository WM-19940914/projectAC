import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * 서버 컴포넌트 / 서버 액션에서 사용하는 Supabase 클라이언트
 * 요청마다 새로운 인스턴스를 생성해야 함
 */
export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // 서버 컴포넌트에서 쿠키 설정 시 발생할 수 있는 에러 무시
            // 미들웨어에서 세션 갱신을 처리하므로 안전함
          }
        },
      },
    }
  )
}
