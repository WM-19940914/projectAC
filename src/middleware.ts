import { NextResponse, type NextRequest } from "next/server"

/**
 * Next.js 미들웨어
 * TODO: Supabase 인증 연동 시 활성화
 * 현재는 인증 우회 (개발 모드)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function middleware(request: NextRequest) {
  // 개발 중: 인증 우회 - 모든 경로 접근 허용
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
