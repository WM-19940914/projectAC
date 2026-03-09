// 관리자용 Supabase 클라이언트 (RLS 무시)
// ⚠️ 서버 사이드에서만 사용! 클라이언트에 노출 금지!

import { createClient } from "@supabase/supabase-js"

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
