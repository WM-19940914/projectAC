import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Next.js 미들웨어
 * - Supabase 세션 확인 → 비로그인 시 /login 리다이렉트
 * - API 라우트에 UTF-8 헤더 설정
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API 라우트는 인증 리다이렉트 안 함 (UTF-8 헤더만 설정)
  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next()
    if (
      !pathname.startsWith("/api/quote-template") &&
      !pathname.startsWith("/api/excel-to-pdf") &&
      !pathname.startsWith("/api/excel-to-png")
    ) {
      response.headers.set("Content-Type", "application/json; charset=utf-8")
    }
    response.headers.set("Content-Language", "ko-KR")
    response.headers.set("Cache-Control", "no-cache, must-revalidate")
    return response
  }

  // ── 페이지 라우트: Supabase 세션 확인 ──
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

  // getSession()은 로컬 JWT 검증만 → 네트워크 호출 없어서 빠름
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const isAuthPage =
    pathname === "/login" || pathname === "/signup"

  // 비로그인 + 보호된 페이지 → 로그인으로
  if (!session && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // 로그인 상태 + 인증 페이지 → 대시보드로
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // 정적 파일, _next 내부 리소스 제외
    "/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
