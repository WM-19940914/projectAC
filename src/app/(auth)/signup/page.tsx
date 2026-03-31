"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAuth } from "@/providers/auth-provider"

const toEmail = (username: string) => `${username.toLowerCase().trim()}@m.local`

const signupSchema = z
  .object({
    name: z.string().min(1, "이름을 입력해주세요.").min(2, "이름은 2자 이상이어야 합니다."),
    username: z.string().min(1, "아이디를 입력해주세요.").min(3, "아이디는 3자 이상이어야 합니다.")
      .regex(/^[a-zA-Z0-9_]+$/, "영문, 숫자, 밑줄(_)만 사용 가능합니다."),
    password: z.string().min(1, "비밀번호를 입력해주세요.").min(6, "비밀번호는 6자 이상이어야 합니다."),
    confirmPassword: z.string().min(1, "비밀번호 확인을 입력해주세요."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  })

type SignupForm = z.infer<typeof signupSchema>

const inputClass = "w-full h-[52px] px-4 bg-[#F0F0F5] border border-[#E8E8EE] rounded-xl text-[16px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#2563EB]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] transition-all"

export default function SignupPage() {
  const { signUp } = useAuth()
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", username: "", password: "", confirmPassword: "" },
  })

  const onSubmit = async (data: SignupForm) => {
    setServerError(null)
    const { error } = await signUp(toEmail(data.username), data.password, data.name)
    if (error) {
      setServerError(error.includes("already registered") ? "이미 사용 중인 아이디입니다." : error)
      return
    }
    router.push("/login")
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
      <div className="text-center mb-10">
        <p className="text-[24px] text-gray-900 leading-snug font-extrabold tracking-tight">
          새 계정 만들기
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {serverError && (
          <div className="text-[13px] text-red-500 bg-red-50 rounded-lg px-4 py-3">{serverError}</div>
        )}

        <input id="name" type="text" placeholder="이름" autoComplete="name" className={inputClass} {...register("name")} />
        {errors.name && <p className="text-[11px] text-red-500 pl-1">{errors.name.message}</p>}

        <input id="username" type="text" placeholder="아이디 (영문, 숫자, 밑줄)" autoComplete="username" className={inputClass} {...register("username")} />
        {errors.username && <p className="text-[11px] text-red-500 pl-1">{errors.username.message}</p>}

        <input id="password" type="password" placeholder="비밀번호 (6자 이상)" autoComplete="new-password" className={inputClass} {...register("password")} />
        {errors.password && <p className="text-[11px] text-red-500 pl-1">{errors.password.message}</p>}

        <input id="confirmPassword" type="password" placeholder="비밀번호 확인" autoComplete="new-password" className={inputClass} {...register("confirmPassword")} />
        {errors.confirmPassword && <p className="text-[11px] text-red-500 pl-1">{errors.confirmPassword.message}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-[52px] rounded-xl bg-[#1a1a1a] text-white text-[15px] font-bold hover:bg-[#333] active:scale-[0.99] transition-all disabled:opacity-50 mt-6"
        >
          {isSubmitting ? "가입 처리 중..." : "회원가입"}
        </button>

        <div className="flex items-center justify-center gap-5 pt-4 text-[13px] text-gray-400">
          <Link href="/login" className="hover:text-gray-600 transition-colors">로그인으로 돌아가기</Link>
        </div>
      </form>
    </div>
  )
}
