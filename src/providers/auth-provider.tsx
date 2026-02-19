"use client"

import {
  createContext,
  useContext,
  useEffect,
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
  name: string
  email: string
  role: "admin" | "sales" | "viewer"
  created_at: string
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
  const supabase = createClient()

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
    // 현재 세션 확인
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      }

      setLoading(false)
    }

    getSession()

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
          name,
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

  /** 로그아웃 */
  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    router.push("/login")
    router.refresh()
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signUp, signOut }}
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
