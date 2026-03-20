// 환경변수 검증 — 서버 시작 시 필수 환경변수 누락을 즉시 감지
import { z } from "zod"

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL이 유효한 URL이 아닙니다"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10, "NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10, "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다"),
})

/**
 * 서버 환경변수 검증. 누락 시 상세 에러 메시지와 함께 즉시 실패.
 * admin.ts, server.ts 등에서 import하여 사용.
 */
export function validateEnv() {
  const result = serverEnvSchema.safeParse(process.env)
  if (!result.success) {
    const messages = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    throw new Error(
      `[환경변수 오류] 필수 환경변수가 누락되었거나 잘못되었습니다:\n${messages.join("\n")}`
    )
  }
  return result.data
}
