// API 라우트에서 인증된 사용자 정보를 추출하는 유틸리티
// 미들웨어에서 이미 세션 유효성을 확인했으므로, 여기서는 사용자 ID 추출용
import { createServerClient } from "@supabase/ssr"
import { NextRequest } from "next/server"

/**
 * 요청 쿠키에서 인증된 사용자 ID를 추출한다.
 * 미들웨어가 이미 세션 검증을 마쳤으므로, 세션이 없으면 null 반환.
 */
export async function getApiUserId(req: NextRequest): Promise<string | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll() {
          // 미들웨어에서 쿠키 갱신을 처리하므로 여기서는 불필요
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id ?? null
}
