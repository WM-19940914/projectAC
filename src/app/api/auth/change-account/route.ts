// ----- 계정 변경 API -----
// 본인 확인 완료된 userId로 아이디(email) 및/또는 비밀번호 변경

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, newUsername, newPassword } = body

  if (!userId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }
  if (!newUsername && !newPassword) {
    return NextResponse.json({ error: "변경할 내용을 입력해주세요." }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 변경할 데이터 구성
  const updateData: Record<string, string> = {}
  if (newUsername) {
    // 아이디 유효성 검사
    if (newUsername.length < 3) {
      return NextResponse.json({ error: "아이디는 3자 이상이어야 합니다." }, { status: 400 })
    }
    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      return NextResponse.json({ error: "아이디는 영문, 숫자, 밑줄(_)만 사용 가능합니다." }, { status: 400 })
    }

    const newEmail = `${newUsername.toLowerCase()}@m.local`

    // 중복 체크: 이미 같은 email이 있는지 확인
    const { data: existing } = await supabase.auth.admin.listUsers()
    const isDuplicate = existing?.users?.some(u => u.email === newEmail && u.id !== userId)
    if (isDuplicate) {
      return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 })
    }

    updateData.email = newEmail
  }
  if (newPassword) {
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 })
    }
    updateData.password = newPassword
  }

  // Supabase admin으로 사용자 정보 변경
  const { error } = await supabase.auth.admin.updateUserById(userId, updateData)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 아이디(email) 변경 시 profiles 테이블도 업데이트
  if (newUsername && updateData.email) {
    await supabase
      .from("profiles")
      .update({ email: updateData.email })
      .eq("id", userId)
  }

  revalidatePath("/")
  return NextResponse.json({ success: true })
}
