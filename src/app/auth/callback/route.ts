import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import { NextRequest } from "next/server"

/**
 * Supabase Auth 콜백 핸들러
 * 이메일 링크 클릭 시 code를 세션으로 교환
 * - 비밀번호 재설정: /reset-password로 리다이렉트
 * - 기타: /dashboard로 리다이렉트
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") || "/dashboard"

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll(cookiesToSet) {
            // 응답에서 쿠키를 설정하기 위해 여기서는 빈 구현
            // 아래 response에서 실제 쿠키 설정 처리
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // 세션 교환 성공 → 쿠키를 포함한 리다이렉트 응답 생성
      const response = NextResponse.redirect(new URL(next, req.url))

      // Supabase 세션 쿠키를 응답에 복사
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        // createServerClient가 내부적으로 쿠키를 관리하므로
        // 요청 쿠키를 응답에 전달
        req.cookies.getAll().forEach((cookie) => {
          response.cookies.set(cookie.name, cookie.value)
        })
      }

      return response
    }
  }

  // 코드가 없거나 교환 실패 → 로그인으로 리다이렉트
  return NextResponse.redirect(new URL("/login", req.url))
}
