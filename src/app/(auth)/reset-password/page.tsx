"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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

/** 비밀번호 재설정 폼 검증 스키마 */
const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, "새 비밀번호를 입력해주세요.")
      .min(6, "비밀번호는 6자 이상이어야 합니다."),
    confirmPassword: z.string().min(1, "비밀번호 확인을 입력해주세요."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  })

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>

/**
 * 비밀번호 재설정 페이지
 * 이메일 링크를 클릭하면 이 페이지로 리다이렉트됨
 * Supabase가 URL 해시에 토큰을 포함하여 자동 세션 복원
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  /** 성공 후 2초 뒤 로그인 페이지로 이동 */
  useEffect(() => {
    if (!isSuccess) return
    const timer = setTimeout(() => {
      router.push("/login")
    }, 2000)
    return () => clearTimeout(timer)
  }, [isSuccess, router])

  /** 비밀번호 변경 처리 */
  const onSubmit = async (data: ResetPasswordForm) => {
    setServerError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      password: data.password,
    })

    if (error) {
      // 세션 만료 등 에러 처리
      if (error.message.includes("session")) {
        setServerError(
          "세션이 만료되었습니다. 비밀번호 찾기를 다시 시도해주세요."
        )
      } else {
        setServerError(error.message)
      }
      return
    }

    // 비밀번호 변경 성공
    setIsSuccess(true)
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-bold text-center">
          비밀번호 재설정
        </CardTitle>
        <p className="text-sm text-center text-muted-foreground">
          새로운 비밀번호를 입력해주세요
        </p>
      </CardHeader>

      {isSuccess ? (
        /* 변경 성공 안내 */
        <CardContent className="space-y-4">
          <div className="p-4 text-sm text-muted-teal bg-green-50 rounded-md text-center">
            비밀번호가 변경되었습니다
          </div>
          <p className="text-xs text-center text-muted-foreground">
            잠시 후 로그인 페이지로 이동합니다...
          </p>
        </CardContent>
      ) : (
        /* 비밀번호 재설정 폼 */
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {serverError && (
              <div className="p-3 text-sm text-soft-blush bg-red-50 rounded-md">
                {serverError}
              </div>
            )}

            {/* 새 비밀번호 */}
            <div className="space-y-2">
              <Label htmlFor="password">새 비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="6자 이상 입력하세요"
                autoComplete="new-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-soft-blush">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">비밀번호 확인</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="비밀번호를 다시 입력하세요"
                autoComplete="new-password"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-soft-blush">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3">
            <Button
              type="submit"
              className="w-full bg-sky-aqua hover:bg-tropical-teal"
              disabled={isSubmitting}
            >
              {isSubmitting ? "변경 중..." : "비밀번호 변경"}
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
