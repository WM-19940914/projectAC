"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"

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

  /** 사용자 프로필 조회 */
  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()

      if (data) {
        setProfile(data as Profile)
      }
    },
    [supabase]
  )

  useEffect(() => {
    // 현재 사용자 확인 (getUser는 서버에서 토큰 검증 + 갱신)
    const initUser = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()

      if (currentUser) {
        setUser(currentUser)
        await fetchProfile(currentUser.id)
      }

      setLoading(false)
    }

    initUser()

    // 인증 상태 변화 리스너
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

  /** 이메일/비밀번호로 로그인 */
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { error: error.message }
    }

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
