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

/** 회원가입 폼 검증 스키마 */
const signupSchema = z
  .object({
    name: z
      .string()
      .min(1, "이름을 입력해주세요.")
      .min(2, "이름은 2자 이상이어야 합니다."),
    username: z
      .string()
      .min(1, "아이디를 입력해주세요.")
      .min(3, "아이디는 3자 이상이어야 합니다.")
      .regex(/^[a-zA-Z0-9_]+$/, "영문, 숫자, 밑줄(_)만 사용 가능합니다."),
    password: z
      .string()
      .min(1, "비밀번호를 입력해주세요.")
      .min(6, "비밀번호는 6자 이상이어야 합니다."),
    confirmPassword: z.string().min(1, "비밀번호 확인을 입력해주세요."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  })

type SignupForm = z.infer<typeof signupSchema>

/**
 * 회원가입 페이지
 * 아이디/비밀번호 + 이름으로 가입
 * 기본 역할: sales
 */
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

  /** 회원가입 처리 */
  const onSubmit = async (data: SignupForm) => {
    setServerError(null)
    // 아이디를 이메일 형태로 변환하여 Supabase에 전달
    const { error } = await signUp(toEmail(data.username), data.password, data.name)

    if (error) {
      if (error.includes("already registered")) {
        setServerError("이미 사용 중인 아이디입니다.")
      } else {
        setServerError(error)
      }
      return
    }

    // 가입 성공 → 로그인 페이지로 이동
    router.push("/login")
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-bold text-center">
          회원가입
        </CardTitle>
        <p className="text-sm text-center text-muted-foreground">
          새 계정을 만들어 시작하세요
        </p>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {serverError && (
            <div className="p-3 text-sm text-soft-blush bg-red-50 rounded-md">
              {serverError}
            </div>
          )}

          {/* 이름 */}
          <div className="space-y-2">
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              type="text"
              placeholder="홍길동"
              autoComplete="name"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-soft-blush">{errors.name.message}</p>
            )}
          </div>

          {/* 아이디 */}
          <div className="space-y-2">
            <Label htmlFor="username">아이디</Label>
            <Input
              id="username"
              type="text"
              placeholder="영문, 숫자, 밑줄 조합"
              autoComplete="username"
              {...register("username")}
            />
            {errors.username && (
              <p className="text-xs text-soft-blush">{errors.username.message}</p>
            )}
          </div>

          {/* 비밀번호 */}
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              placeholder="6자 이상 입력하세요"
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-soft-blush">{errors.password.message}</p>
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
              <p className="text-xs text-soft-blush">{errors.confirmPassword.message}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3">
          <Button
            type="submit"
            className="w-full bg-sky-aqua hover:bg-tropical-teal"
            disabled={isSubmitting}
          >
            {isSubmitting ? "가입 처리 중..." : "회원가입"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="text-sky-aqua hover:underline">
              로그인
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
