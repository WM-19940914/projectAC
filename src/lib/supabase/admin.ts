// 관리자용 Supabase 클라이언트 (RLS 무시)
// ⚠️ 서버 사이드에서만 사용! 클라이언트에 노출 금지!

import { createClient } from "@supabase/supabase-js"
import { validateEnv } from "@/lib/env"

// 첫 호출 시 환경변수 검증 (누락 시 즉시 에러)
let _validated = false

export function createAdminClient() {
  if (!_validated) {
    validateEnv()
    _validated = true
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
