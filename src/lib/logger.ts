// API 라우트용 로거 — 프로덕션에서 상세 에러 노출 방지
// 개발 환경에서는 전체 에러를 출력하고, 프로덕션에서는 라벨만 기록한다.

/**
 * API 라우트에서 console.error 대신 사용하는 로거.
 * 프로덕션 환경에서는 에러 상세(스택 트레이스, DB 쿼리 등)를 숨긴다.
 */
export function logError(label: string, error?: unknown) {
  if (process.env.NODE_ENV === "production") {
    // 프로덕션: 라벨만 기록 (민감한 DB 에러 상세 숨김)
    console.error(label)
  } else {
    // 개발: 전체 에러 출력
    console.error(label, error)
  }
}
