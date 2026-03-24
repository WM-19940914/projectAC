// 현재 로그인한 사용자의 프로필 반환
// 미들웨어가 인증을 보장하므로, 여기서는 프로필만 조회

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(req: NextRequest) {
  try {
    // 요청 쿠키에서 현재 사용자 확인 (서버 사이드 — Vercel에서도 정상 동작)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll() },
          setAll() { /* 읽기 전용 */ },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ data: null })
    }

    // admin 클라이언트로 프로필 조회 (RLS 우회)
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()

    return NextResponse.json({
      data: {
        user: { id: user.id, email: user.email },
        profile: profile || {
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "사용자",
          email: user.email || "",
          role: user.user_metadata?.role || "sales",
          phone: null,
          avatar_url: null,
          is_active: true,
          created_at: user.created_at,
          updated_at: "",
        },
      },
    })
  } catch {
    return NextResponse.json({ data: null })
  }
}
