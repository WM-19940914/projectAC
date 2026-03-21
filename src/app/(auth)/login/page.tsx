"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAuth } from "@/providers/auth-provider"
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

/** 내부적으로 아이디를 이메일 형태로 변환 (Supabase Auth 호환) */
const toEmail = (username: string) => `${username.toLowerCase().trim()}@m.local`

/** 로그인 폼 검증 스키마 */
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

/**
 * 로그인 페이지
 * 아이디/비밀번호 로그인 (내부적으로 Supabase 이메일 인증 사용)
 */
export default function LoginPage() {
  const { signIn } = useAuth()
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  })

  /** 로그인 처리 */
  const onSubmit = async (data: LoginForm) => {
    setServerError(null)
    // 아이디를 이메일 형태로 변환하여 Supabase에 전달
    const { error } = await signIn(toEmail(data.username), data.password)

    if (error) {
      if (error.includes("Invalid login credentials")) {
        setServerError("아이디 또는 비밀번호가 올바르지 않습니다.")
      } else {
        setServerError(error)
      }
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-bold text-center">
          M
        </CardTitle>
        <p className="text-sm text-center text-muted-foreground">
          영업·계약·정산 관리 시스템
        </p>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {serverError && (
            <div className="p-3 text-sm text-soft-blush bg-red-50 rounded-md">
              {serverError}
            </div>
          )}

          {/* 아이디 */}
          <div className="space-y-2">
            <Label htmlFor="username">아이디</Label>
            <Input
              id="username"
              type="text"
              placeholder="아이디를 입력하세요"
              autoComplete="username"
              {...register("username")}
            />
            {errors.username && (
              <p className="text-xs text-soft-blush">{errors.username.message}</p>
            )}
          </div>

          {/* 비밀번호 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">비밀번호</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-sky-aqua hover:underline"
              >
                비밀번호를 잊으셨나요?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="비밀번호를 입력하세요"
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-soft-blush">{errors.password.message}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3">
          <Button
            type="submit"
            className="w-full bg-sky-aqua hover:bg-tropical-teal"
            disabled={isSubmitting}
          >
            {isSubmitting ? "로그인 중..." : "로그인"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            계정이 없으신가요?{" "}
            <Link href="/signup" className="text-sky-aqua hover:underline">
              회원가입
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
