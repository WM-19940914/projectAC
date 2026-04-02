"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"

// ── 세션 타임아웃 설정 ──
// 로그인 후 이 시간이 지나면 자동 로그아웃 (밀리초)
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000 // 1일 (24시간)
// 세션 만료 여부를 확인하는 주기 (밀리초)
const SESSION_CHECK_INTERVAL_MS = 5 * 60 * 1000 // 5분마다 체크
// localStorage에 로그인 시각을 저장하는 키 이름
// (localStorage는 브라우저를 닫아도 유지됨 → 컴퓨터 껐다 켜도 1일 안이면 로그인 유지)
const SESSION_LOGIN_TIME_KEY = "m_login_timestamp"

/** 사용자 프로필 타입 */
interface Profile {
  id: string
  full_name: string
  email: string
  role: "admin" | "sales" | "viewer"
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/** 인증 컨텍스트 타입 */
interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    name: string
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * 인증 상태를 관리하는 Provider
 * 사용자 정보, 프로필, 인증 메서드를 하위 컴포넌트에 제공
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  // supabase 인스턴스를 한 번만 생성 (매 렌더마다 재생성 방지)
  const supabase = useMemo(() => createClient(), [])

  /** 사용자 프로필 조회 — /api/auth/me (admin 클라이언트, RLS 우회) 우선 사용 */
  const fetchProfile = useCallback(
    async (userId: string, fallbackUser?: User | null) => {
      // 1차: API 라우트로 프로필 조회 (admin 클라이언트 → RLS 우회)
      try {
        const res = await fetch("/api/auth/me")
        if (res.ok) {
          const json = await res.json()
          if (json.data?.profile) {
            setProfile(json.data.profile as Profile)
            return
          }
        }
      } catch { /* API 실패 시 아래 폴백으로 */ }

      // 2차: 브라우저 클라이언트로 직접 조회 (RLS 적용)
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single()

        if (data && !error) {
          setProfile(data as Profile)
          return
        }
      } catch { /* 무시 */ }

      // 3차: user_metadata 폴백
      if (fallbackUser?.user_metadata) {
        setProfile({
          id: userId,
          full_name: fallbackUser.user_metadata.full_name || fallbackUser.email?.split("@")[0] || "사용자",
          email: fallbackUser.email || "",
          role: fallbackUser.user_metadata.role || "sales",
          phone: null,
          avatar_url: null,
          is_active: true,
          created_at: fallbackUser.created_at || "",
          updated_at: "",
        })
      }
    },
    [supabase]
  )

  // ── 세션 만료 시 강제 로그아웃하는 함수 ──
  // (signOut과 별도로 분리 — signOut은 사용자가 직접 누를 때 사용)
  const forceLogout = useCallback(async () => {
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))
      ])
    } catch { /* 타임아웃이든 에러든 무시 */ }
    setUser(null)
    setProfile(null)
    localStorage.removeItem(SESSION_LOGIN_TIME_KEY)
    // localStorage에 남은 supabase 토큰도 제거
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("sb-")) localStorage.removeItem(key)
    })
    document.cookie.split(";").forEach((c) => {
      const name = c.trim().split("=")[0]
      if (name.startsWith("sb-")) {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
      }
    })
    window.location.href = "/login"
  }, [supabase])

  // ── 세션 타임아웃 체크 (1분마다) ──
  const sessionCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /** 로그인 시각을 확인해서 1일이 지났으면 true 반환 */
  const isSessionExpired = useCallback(() => {
    const loginTime = localStorage.getItem(SESSION_LOGIN_TIME_KEY)
    if (!loginTime) return true // 로그인 시각이 없으면 만료 취급
    const elapsed = Date.now() - parseInt(loginTime, 10)
    return elapsed >= SESSION_TIMEOUT_MS
  }, [])

  useEffect(() => {
    // 현재 사용자 확인 (getUser는 서버에서 토큰 검증 + 갱신)
    const initUser = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()

      if (currentUser) {
        // ── 세션 만료 체크 ──
        // Supabase에 토큰이 남아있어도, localStorage의 로그인 시각이
        // 없거나 1일이 지났으면 → 자동 로그아웃
        if (isSessionExpired()) {
          await forceLogout()
          return
        }

        setUser(currentUser)
        await fetchProfile(currentUser.id, currentUser)
      }

      setLoading(false)
    }

    initUser()

    // ── 5분마다 세션 만료 여부 체크하는 타이머 ──
    // 비유: 놀이공원 팔찌에 유효시간이 적혀있어서, 직원이 5분마다 확인하는 것
    sessionCheckRef.current = setInterval(() => {
      const loginTime = localStorage.getItem(SESSION_LOGIN_TIME_KEY)
      if (loginTime && isSessionExpired()) {
        forceLogout()
      }
    }, SESSION_CHECK_INTERVAL_MS)

    // 인증 상태 변화 리스너
    // SIGNED_OUT일 때만 프로필 초기화 (INITIAL_SESSION의 null 세션으로 프로필이 지워지는 것 방지)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id, session.user)
      } else if (event === "SIGNED_OUT") {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
      // 타이머 정리
      if (sessionCheckRef.current) {
        clearInterval(sessionCheckRef.current)
      }
    }
  }, [supabase, fetchProfile, isSessionExpired, forceLogout])

  /** 이메일/비밀번호로 로그인 */
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { error: error.message }
    }

    // 로그인 성공 시 현재 시각을 localStorage에 기록
    // (localStorage는 브라우저를 닫아도 유지됨 → 1일 안이면 다시 로그인 불필요)
    localStorage.setItem(SESSION_LOGIN_TIME_KEY, Date.now().toString())

    router.refresh()
    return { error: null }
  }

  /** 회원가입 (기본 역할: sales) */
  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role: "sales",
        },
      },
    })

    if (error) {
      return { error: error.message }
    }

    router.refresh()
    return { error: null }
  }

  /** 프로필 새로고침 (아바타 변경 등) */
  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }

  /** 로그아웃 — 세션 없어도 안전하게 로그인 페이지로 이동 */
  const signOut = async () => {
    // supabase signOut이 Lock 때문에 멈출 수 있어서 3초 제한
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))
      ])
    } catch {
      // 타임아웃이든 에러든 무시하고 진행
    }
    setUser(null)
    setProfile(null)
    // 세션 타임아웃 타이머 정리
    if (sessionCheckRef.current) {
      clearInterval(sessionCheckRef.current)
    }
    // 로그인 시각 기록 제거
    localStorage.removeItem(SESSION_LOGIN_TIME_KEY)
    // localStorage에 남은 supabase 토큰 제거
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("sb-")) localStorage.removeItem(key)
    })
    // 쿠키에 남은 supabase 세션도 제거 (미들웨어가 세션 있다고 판단하는 것 방지)
    document.cookie.split(";").forEach((c) => {
      const name = c.trim().split("=")[0]
      if (name.startsWith("sb-")) {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
      }
    })
    window.location.href = "/login"
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/**
 * 인증 컨텍스트를 사용하는 커스텀 훅
 * AuthProvider 내부에서만 사용 가능
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth는 AuthProvider 내부에서 사용해야 합니다.")
  }
  return context
}
