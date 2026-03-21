"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

/** 비밀번호 찾기 폼 검증 스키마 */
const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "이메일을 입력해주세요.")
    .email("올바른 이메일 형식이 아닙니다."),
})

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>

/**
 * 비밀번호 찾기 페이지
 * 이메일 입력 → Supabase resetPasswordForEmail 호출 → 재설정 링크 발송
 */
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

  /** 비밀번호 재설정 이메일 발송 */
  const onSubmit = async (data: ForgotPasswordForm) => {
    setServerError(null)
    setIsSuccess(false)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setServerError(error.message)
      return
    }

    // 성공 시 안내 메시지 표시
    setIsSuccess(true)
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-bold text-center">
          비밀번호 찾기
        </CardTitle>
        <p className="text-sm text-center text-muted-foreground">
          가입한 이메일을 입력하시면 재설정 링크를 보내드립니다
        </p>
      </CardHeader>

      {isSuccess ? (
        /* 발송 성공 안내 */
        <CardContent className="space-y-4">
          <div className="p-4 text-sm text-muted-teal bg-green-50 rounded-md text-center">
            이메일을 확인해주세요. 비밀번호 재설정 링크를 보냈습니다.
          </div>
          <p className="text-xs text-center text-muted-foreground">
            이메일이 도착하지 않았다면 스팸 폴더를 확인하거나 다시 시도해주세요.
          </p>
        </CardContent>
      ) : (
        /* 이메일 입력 폼 */
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {serverError && (
              <div className="p-3 text-sm text-soft-blush bg-red-50 rounded-md">
                {serverError}
              </div>
            )}

            {/* 이메일 */}
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="가입한 이메일을 입력하세요"
                autoComplete="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-soft-blush">{errors.email.message}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3">
            <Button
              type="submit"
              className="w-full bg-sky-aqua hover:bg-tropical-teal"
              disabled={isSubmitting}
            >
              {isSubmitting ? "전송 중..." : "재설정 링크 보내기"}
            </Button>
          </CardFooter>
        </form>
      )}

      <CardFooter className="justify-center pt-0">
        <p className="text-xs text-center text-muted-foreground">
          <Link href="/login" className="text-sky-aqua hover:underline">
            로그인으로 돌아가기
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
