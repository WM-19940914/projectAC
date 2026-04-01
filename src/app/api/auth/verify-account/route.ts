// ----- 본인 확인 API -----
// 아이디 + 비밀번호로 로그인 시도 → 성공 시 userId 반환

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { username, password } = body

  if (!username || !password) {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력해주세요." }, { status: 400 })
  }

  const email = `${username.toLowerCase().trim()}@m.local`
  const supabase = createAdminClient()

  // signInWithPassword로 본인 확인 (admin client에서 직접 호출 불가 → 브라우저 클라이언트 사용)
  // 대안: admin에서 사용자 조회 후 verify
  // Supabase admin은 비밀번호 검증을 직접 지원하지 않으므로, 임시 sign-in 시도
  const { createClient } = await import("@supabase/supabase-js")
  const tempClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { data, error } = await tempClient.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 })
  }

  return NextResponse.json({ userId: data.user.id })
}
