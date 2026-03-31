"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/lib/supabase/client"

const forgotPasswordSchema = z.object({
  email: z.string().min(1, "이메일을 입력해주세요.").email("올바른 이메일 형식이 아닙니다."),
})

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>

const inputClass = "w-full h-[52px] px-4 bg-[#F0F0F5] border border-[#E8E8EE] rounded-xl text-[16px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#2563EB]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] transition-all"

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  const onSubmit = async (data: ForgotPasswordForm) => {
    setServerError(null)
    setIsSuccess(false)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) { setServerError(error.message); return }
    setIsSuccess(true)
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
          비밀번호 찾기
        </p>
        <p className="text-[13px] text-gray-400 mt-2">
          가입한 이메일을 입력하시면 재설정 링크를 보내드립니다
        </p>
      </div>

      {isSuccess ? (
        <div className="space-y-4">
          <div className="p-4 text-[14px] text-green-700 bg-green-50 rounded-xl text-center font-semibold">
            이메일을 확인해주세요. 비밀번호 재설정 링크를 보냈습니다.
          </div>
          <p className="text-[12px] text-center text-gray-400">
            이메일이 도착하지 않았다면 스팸 폴더를 확인하거나 다시 시도해주세요.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {serverError && (
            <div className="text-[13px] text-red-500 bg-red-50 rounded-lg px-4 py-3">{serverError}</div>
          )}

          <input
            id="email"
            type="email"
            placeholder="가입한 이메일을 입력하세요"
            autoComplete="email"
            className={inputClass}
            {...register("email")}
          />
          {errors.email && <p className="text-[11px] text-red-500 pl-1">{errors.email.message}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-[52px] rounded-xl bg-[#1a1a1a] text-white text-[15px] font-bold hover:bg-[#333] active:scale-[0.99] transition-all disabled:opacity-50 mt-6"
          >
            {isSubmitting ? "전송 중..." : "재설정 링크 보내기"}
          </button>
        </form>
      )}

      <div className="flex items-center justify-center gap-5 pt-6 text-[13px] text-gray-400">
        <Link href="/login" className="hover:text-gray-600 transition-colors">로그인으로 돌아가기</Link>
      </div>
    </div>
  )
}
