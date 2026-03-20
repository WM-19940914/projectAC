import { NextResponse, type NextRequest } from "next/server"

/**
 * Next.js 미들웨어
 * - UTF-8 인코딩 강제
 * - API 응답 헤더 설정
 * 개발 모드: 인증 우회
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // API 라우트에만 JSON UTF-8 헤더 설정 (페이지에 설정하면 HTML이 깨짐)
  // 파일 업로드/다운로드 API는 제외 (Content-Type 덮어쓰면 multipart/form-data가 깨짐)
  const p = request.nextUrl.pathname
  if (p.startsWith('/api/') && !p.startsWith('/api/quote-template') && !p.startsWith('/api/excel-to-pdf') && !p.startsWith('/api/excel-to-png')) {
    response.headers.set('Content-Type', 'application/json; charset=utf-8')
  }

  // 공통 헤더
  response.headers.set('Content-Language', 'ko-KR')
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
