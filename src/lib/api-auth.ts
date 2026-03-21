// API 라우트에서 인증된 사용자 정보 및 역할을 추출하는 유틸리티
// 미들웨어에서 이미 세션 유효성을 확인했으므로, 여기서는 사용자 ID/역할 추출용
import { createServerClient } from "@supabase/ssr"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

type Role = "admin" | "sales" | "viewer"

export interface AuthProfile {
  userId: string
  role: Role
}

/**
 * 요청 쿠키에서 인증된 사용자 ID를 추출한다.
 * 미들웨어가 이미 세션 검증을 마쳤으므로, 세션이 없으면 null 반환.
 */
export async function getApiUserId(req: NextRequest): Promise<string | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll() {
          // 미들웨어에서 쿠키 갱신을 처리하므로 여기서는 불필요
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id ?? null
}

/**
 * 인증된 사용자의 ID + 역할(role)을 함께 조회한다.
 * profiles 테이블에서 role을 가져오며, 없으면 null 반환.
 */
export async function getAuthProfile(req: NextRequest): Promise<AuthProfile | null> {
  const userId = await getApiUserId(req)
  if (!userId) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single()

  if (!data) return null

  return {
    userId,
    role: (data.role as Role) || "viewer",
  }
}

/**
 * 특정 역할 이상인지 확인하는 가드.
 * 허용되지 않으면 403 응답을 반환한다.
 *
 * 사용 예:
 *   const denied = await requireRole(req, ["admin", "sales"])
 *   if (denied) return denied
 */
export async function requireRole(
  req: NextRequest,
  allowedRoles: Role[]
): Promise<NextResponse | null> {
  const profile = await getAuthProfile(req)

  if (!profile) {
    return NextResponse.json(
      { error: "인증이 필요합니다" },
      { status: 401 }
    )
  }

  if (!allowedRoles.includes(profile.role)) {
    return NextResponse.json(
      { error: "권한이 없습니다" },
      { status: 403 }
    )
  }

  // 통과 — null 반환
  return null
}

/**
 * admin 역할만 허용하는 가드 (설정 변경, 삭제 등)
 */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  return requireRole(req, ["admin"])
}

/**
 * admin 또는 sales 역할만 허용하는 가드 (데이터 변경)
 */
export async function requireAdminOrSales(req: NextRequest): Promise<NextResponse | null> {
  return requireRole(req, ["admin", "sales"])
}
