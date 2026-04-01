// ----- 아이디 찾기 API -----
// 이름(full_name)으로 profiles 조회 → 아이디(email에서 추출) 반환

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim()
  if (!name) {
    return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 })
  }

  const supabase = createAdminClient()

  // profiles 테이블에서 이름으로 검색
  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("full_name", name)
    .limit(1)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "해당 이름으로 등록된 계정을 찾을 수 없습니다." }, { status: 404 })
  }

  // email에서 아이디 추출 (예: "hong@m.local" → "hong")
  const username = data.email.split("@")[0]

  return NextResponse.json({ username })
}
