import { NextResponse, type NextRequest } from "next/server"

/**
 * Next.js 미들웨어
 * - UTF-8 인코딩 강제
 * - API 응답 헤더 설정
 * 개발 모드: 인증 우회
 */
export async function middleware(request: NextRequest) {
  // 모든 API 응답에 UTF-8 강제
  const response = NextResponse.next()

  // 요청 인코딩 강제
  response.headers.set('Content-Type', 'application/json; charset=utf-8')
  response.headers.set('Content-Language', 'ko-KR')
  response.headers.set('Accept-Charset', 'utf-8')

  // 응답 캐싱 제어
  response.headers.set('Cache-Control', 'no-cache, must-revalidate')

  // 개발 중: 인증 우회 - 모든 경로 접근 허용
  return response
}

export const config = {
  matcher: [
    // API 라우트와 페이지 라우트에 미들웨어 적용
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
