import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Next.js 미들웨어
 * - API 라우트: 인증 필수 (401 반환) + UTF-8 헤더
 * - 페이지 라우트: 비로그인 시 /login 리다이렉트
 * - Supabase 세션 갱신 (토큰 리프레시) 자동 처리
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApiRoute = pathname.startsWith("/api/")

  // ── Supabase 세션 관리 (API + 페이지 공통) ──
  // 세션 갱신 시 쿠키를 자동으로 갱신하기 위해 API/페이지 모두 동일한 클라이언트 사용
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // 요청 쿠키에 새 값 반영 (다운스트림 라우트에서도 최신 세션 사용)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser()로 세션 갱신 + 토큰 리프레시 (Vercel 배포 시 필수)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── API 라우트: 인증 필수 + UTF-8 헤더 ──
  if (isApiRoute) {
    // 인증되지 않은 요청 차단
    if (!user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      )
    }

    // UTF-8 헤더 설정 (바이너리 응답 엔드포인트는 제외)
    if (
      !pathname.startsWith("/api/quote-template") &&
      !pathname.startsWith("/api/excel-to-pdf") &&
      !pathname.startsWith("/api/excel-to-png") &&
      !pathname.startsWith("/api/attachments")
    ) {
      supabaseResponse.headers.set("Content-Type", "application/json; charset=utf-8")
    }
    supabaseResponse.headers.set("Content-Language", "ko-KR")
    supabaseResponse.headers.set("Cache-Control", "no-cache, must-revalidate")
    return supabaseResponse
  }

  // ── 페이지 라우트: Supabase 세션 기반 리다이렉트 ──

  // 인증 콜백 경로 — 세션 유무와 무관하게 항상 통과
  if (pathname.startsWith("/auth/callback")) {
    return supabaseResponse
  }

  // 로그인 불필요 페이지 (로그인, 회원가입, 비밀번호 찾기)
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password"

  // 비밀번호 재설정 페이지 — 이메일 링크를 통해 세션이 생성된 후 접근하므로
  // 로그인 상태여도 대시보드로 리다이렉트하지 않음
  const isResetPasswordPage = pathname === "/reset-password"

  // 비로그인 + 보호된 페이지 → 로그인으로
  if (!user && !isAuthPage && !isResetPasswordPage) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // 로그인 상태 + 인증 페이지 → 대시보드로 (비밀번호 재설정은 제외)
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // 정적 파일, _next 내부 리소스 제외
    "/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|mp3|woff|woff2|ttf|ico)$).*)",
  ],
}
