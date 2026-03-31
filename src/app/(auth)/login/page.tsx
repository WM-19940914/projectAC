"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAuth } from "@/providers/auth-provider"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

const toEmail = (username: string) => `${username.toLowerCase().trim()}@m.local`
const REMEMBER_KEY = "m_remember_username"

const loginSchema = z.object({
  username: z
    .string()
    .min(1, "아이디를 입력해주세요.")
    .min(3, "아이디는 3자 이상이어야 합니다.")
    .regex(/^[a-zA-Z0-9_]+$/, "영문, 숫자, 밑줄(_)만 사용 가능합니다."),
  password: z
    .string()
    .min(1, "비밀번호를 입력해주세요.")
    .min(6, "비밀번호는 6자 이상이어야 합니다."),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { signIn } = useAuth()
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [rememberMe, setRememberMe] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  })

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY)
    if (saved) { setValue("username", saved); setRememberMe(true) }
  }, [setValue])

  const onSubmit = async (data: LoginForm) => {
    setServerError(null)
    if (rememberMe) localStorage.setItem(REMEMBER_KEY, data.username)
    else localStorage.removeItem(REMEMBER_KEY)

    const { error } = await signIn(toEmail(data.username), data.password)
    if (error) {
      setServerError(error.includes("Invalid login credentials") ? "아이디 또는 비밀번호가 올바르지 않습니다." : error)
      return
    }
    // 세션 쿠키 반영 대기 후 이동
    setTimeout(() => { window.location.href = "/dashboard" }, 300)
  }

  return (
    <div>
      {/* 로고 */}
      <div className="flex justify-center mb-4">
        <span className="text-[48px] text-[#2563EB]" style={{ fontFamily: "'Pacifico', cursive" }}>
          Mooov
        </span>
      </div>

      {/* 타이틀 */}
      <div className="text-center mb-14">
        <p className="text-[24px] text-gray-900 leading-snug font-extrabold tracking-tight">
          흩어진 B2B 운영<br />
          업무를 연결하고, 성장을 움직이다
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {serverError && (
          <div className="text-[13px] text-red-500 bg-red-50 rounded-lg px-4 py-3">
            {serverError}
          </div>
        )}

        {/* 아이디 */}
        <input
          id="username"
          type="text"
          placeholder="아이디"
          autoComplete="username"
          className="w-full h-[52px] px-4 bg-[#F0F0F5] border border-[#E8E8EE] rounded-xl text-[16px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#2563EB]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] transition-all"
          {...register("username")}
        />
        {errors.username && <p className="text-[11px] text-red-500 pl-1">{errors.username.message}</p>}

        {/* 비밀번호 */}
        <input
          id="password"
          type="password"
          placeholder="비밀번호"
          autoComplete="current-password"
          className="w-full h-[52px] px-4 bg-[#F0F0F5] border border-[#E8E8EE] rounded-xl text-[16px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#2563EB]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] transition-all"
          {...register("password")}
        />
        {errors.password && <p className="text-[11px] text-red-500 pl-1">{errors.password.message}</p>}

        {/* 아이디 기억하기 */}
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="remember"
            checked={rememberMe}
            onCheckedChange={(c) => setRememberMe(c === true)}
            className="h-4 w-4 rounded border-gray-300 data-[state=checked]:bg-[#2563EB] data-[state=checked]:border-[#2563EB]"
          />
          <Label htmlFor="remember" className="text-[12px] text-gray-400 cursor-pointer">
            아이디 기억하기
          </Label>
        </div>

        {/* 로그인 버튼 */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-[52px] rounded-xl bg-[#1a1a1a] text-white text-[15px] font-bold hover:bg-[#333] active:scale-[0.99] transition-all disabled:opacity-50 mt-6"
        >
          {isSubmitting ? "로그인 중..." : "로그인"}
        </button>

        {/* 하단 링크 */}
        <div className="flex items-center justify-center gap-5 pt-4 text-[13px] text-gray-400">
          <Link href="/signup" className="hover:text-gray-600 transition-colors">회원가입</Link>
          <span className="text-gray-200">·</span>
          <Link href="/forgot-password" className="hover:text-gray-600 transition-colors">비밀번호 찾기</Link>
        </div>
      </form>
    </div>
  )
}
