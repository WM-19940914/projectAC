"use client"

// ----- 아이디 찾기 페이지 -----
// 이름(full_name)을 입력하면 해당 사용자의 아이디를 보여줌

import { useState } from "react"
import Link from "next/link"

const inputClass = "w-full h-[52px] px-4 bg-[#F0F0F5] border border-[#E8E8EE] rounded-xl text-[16px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#2563EB]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] transition-all"

export default function FindIdPage() {
  const [name, setName] = useState("")
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setError(null)
    setResult(null)
    setIsLoading(true)

    try {
      const res = await fetch(`/api/auth/find-id?name=${encodeURIComponent(name.trim())}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "아이디를 찾을 수 없습니다.")
        return
      }
      setResult(data.username)
    } catch {
      setError("서버 오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
    }
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
          아이디 찾기
        </p>
        <p className="text-[13px] text-gray-400 mt-2">
          가입할 때 등록한 이름을 입력해주세요
        </p>
      </div>

      {/* 결과 표시 */}
      {result && (
        <div className="mb-6 p-4 bg-blue-50 rounded-xl text-center">
          <p className="text-[13px] text-gray-500 mb-1">회원님의 아이디는</p>
          <p className="text-[20px] font-bold text-[#2563EB]">{result}</p>
          <p className="text-[13px] text-gray-500 mt-1">입니다</p>
        </div>
      )}

      {/* 폼 */}
      {!result && (
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="text-[13px] text-red-500 bg-red-50 rounded-lg px-4 py-3">{error}</div>
          )}

          <input
            type="text"
            placeholder="이름을 입력하세요"
            value={name}
            onChange={e => setName(e.target.value)}
            className={inputClass}
          />

          <button
            type="submit"
            disabled={isLoading || !name.trim()}
            className="w-full h-[52px] rounded-xl bg-[#1a1a1a] text-white text-[15px] font-bold hover:bg-[#333] active:scale-[0.99] transition-all disabled:opacity-50 mt-6"
          >
            {isLoading ? "찾는 중..." : "아이디 찾기"}
          </button>
        </form>
      )}

      {/* 하단 링크 */}
      <div className="flex items-center justify-center gap-5 pt-6 text-[13px] text-gray-400">
        <Link href="/login" className="hover:text-gray-600 transition-colors">로그인으로 돌아가기</Link>
        {result && (
          <>
            <span className="text-gray-200">·</span>
            <Link href="/forgot-password" className="hover:text-gray-600 transition-colors">비밀번호 찾기</Link>
          </>
        )}
      </div>
    </div>
  )
}
