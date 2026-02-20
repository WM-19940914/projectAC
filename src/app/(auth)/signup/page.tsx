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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

/** 회원가입 폼 유효성 검사 스키마 */
const signupSchema = z.object({
  name: z
    .string()
    .min(1, "이름을 입력해주세요.")
    .min(2, "이름은 2자 이상이어야 합니다."),
  email: z
    .string()
    .min(1, "이메일을 입력해주세요.")
    .email("올바른 이메일 형식이 아닙니다."),
  password: z
    .string()
    .min(1, "비밀번호를 입력해주세요.")
    .min(6, "비밀번호는 6자 이상이어야 합니다."),
})

type SignupFormValues = z.infer<typeof signupSchema>

/**
 * 회원가입 페이지
 * 이름, 이메일, 비밀번호를 사용한 회원가입 처리
 * 기본 역할: sales
 */
export default function SignupPage() {
  const { signUp } = useAuth()
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  })

  /** 회원가입 폼 제출 핸들러 */
  const onSubmit = async (data: SignupFormValues) => {
    setServerError(null)

    const { error } = await signUp(data.email, data.password, data.name)

    if (error) {
      setServerError(error)
      return
    }

    // 회원가입 성공
    setSuccess(true)
  }

  // 회원가입 성공 화면
  if (success) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            회원가입 완료
          </CardTitle>
          <CardDescription className="text-center">
            이메일 인증 후 로그인할 수 있습니다.
            <br />
            이메일을 확인해주세요.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            className="w-full"
            onClick={() => router.push("/login")}
          >
            로그인 페이지로 이동
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          회원가입
        </CardTitle>
        <CardDescription className="text-center">
          새 계정을 만들어 시작하세요
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {/* 서버 에러 메시지 */}
          {serverError && (
            <div className="p-3 text-sm text-soft-blush bg-soft-blush/30 rounded-md">
              {serverError}
            </div>
          )}

          {/* 이름 입력 */}
          <div className="space-y-2">
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              type="text"
              placeholder="홍길동"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-soft-blush">{errors.name.message}</p>
            )}
          </div>

          {/* 이메일 입력 */}
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-soft-blush">{errors.email.message}</p>
            )}
          </div>

          {/* 비밀번호 입력 */}
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              placeholder="6자 이상 입력하세요"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-soft-blush">{errors.password.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "가입 처리 중..." : "회원가입"}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            이미 계정이 있으신가요?{" "}
            <Link
              href="/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              로그인
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
