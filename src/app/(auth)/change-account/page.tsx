"use client"

// ----- 계정변경 페이지 -----
// 현재 아이디/비밀번호로 본인 확인 후 아이디 또는 비밀번호 변경

import { useState } from "react"
import Link from "next/link"

const inputClass = "w-full h-[52px] px-4 bg-[#F0F0F5] border border-[#E8E8EE] rounded-xl text-[16px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#2563EB]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] transition-all"

export default function ChangeAccountPage() {
  // 1단계: 본인 확인, 2단계: 변경 폼
  const [step, setStep] = useState<1 | 2>(1)
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null)
  const [currentUsername, setCurrentUsername] = useState("")

  // 1단계: 본인 확인 폼
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  // 2단계: 변경 폼
  const [newUsername, setNewUsername] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changeError, setChangeError] = useState<string | null>(null)
  const [changing, setChanging] = useState(false)
  const [success, setSuccess] = useState(false)

  // 1단계: 본인 확인
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return

    setVerifyError(null)
    setVerifying(true)
    try {
      const res = await fetch("/api/auth/verify-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setVerifyError(data.error || "아이디 또는 비밀번호가 올바르지 않습니다.")
        return
      }
      setVerifiedUserId(data.userId)
      setCurrentUsername(username.trim())
      setNewUsername(username.trim())
      setStep(2)
    } catch {
      setVerifyError("서버 오류가 발생했습니다.")
    } finally {
      setVerifying(false)
    }
  }

  // 2단계: 계정 변경
  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!verifiedUserId) return

    // 유효성 검사
    if (newPassword && newPassword.length < 6) {
      setChangeError("비밀번호는 6자 이상이어야 합니다.")
      return
    }
    if (newPassword && newPassword !== confirmPassword) {
      setChangeError("새 비밀번호가 일치하지 않습니다.")
      return
    }
    if (newUsername && !/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      setChangeError("아이디는 영문, 숫자, 밑줄(_)만 사용 가능합니다.")
      return
    }
    if (newUsername && newUsername.length < 3) {
      setChangeError("아이디는 3자 이상이어야 합니다.")
      return
    }
    // 아무 변경도 없는 경우
    const usernameChanged = newUsername.trim() !== currentUsername
    const passwordChanged = newPassword.length > 0
    if (!usernameChanged && !passwordChanged) {
      setChangeError("변경할 내용을 입력해주세요.")
      return
    }

    setChangeError(null)
    setChanging(true)
    try {
      const res = await fetch("/api/auth/change-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: verifiedUserId,
          newUsername: usernameChanged ? newUsername.trim() : undefined,
          newPassword: passwordChanged ? newPassword : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setChangeError(data.error || "변경에 실패했습니다.")
        return
      }
      setSuccess(true)
    } catch {
      setChangeError("서버 오류가 발생했습니다.")
    } finally {
      setChanging(false)
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
          계정 변경
        </p>
        <p className="text-[13px] text-gray-400 mt-2">
          {step === 1 ? "먼저 현재 계정으로 본인 확인을 해주세요" : "아이디 또는 비밀번호를 변경할 수 있습니다"}
        </p>
      </div>

      {/* 성공 */}
      {success && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 rounded-xl text-center">
            <p className="text-[14px] text-green-700 font-semibold">계정 정보가 변경되었습니다</p>
            <p className="text-[12px] text-gray-400 mt-1">새로운 정보로 로그인해주세요</p>
          </div>
          <div className="flex items-center justify-center pt-2">
            <Link href="/login" className="text-[13px] text-[#2563EB] hover:underline font-medium">
              로그인하러 가기
            </Link>
          </div>
        </div>
      )}

      {/* 1단계: 본인 확인 */}
      {!success && step === 1 && (
        <form onSubmit={handleVerify} className="space-y-3">
          {verifyError && (
            <div className="text-[13px] text-red-500 bg-red-50 rounded-lg px-4 py-3">{verifyError}</div>
          )}

          <input
            type="text"
            placeholder="현재 아이디"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            className={inputClass}
          />
          <input
            type="password"
            placeholder="현재 비밀번호"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            className={inputClass}
          />

          <button
            type="submit"
            disabled={verifying || !username.trim() || !password}
            className="w-full h-[52px] rounded-xl bg-[#1a1a1a] text-white text-[15px] font-bold hover:bg-[#333] active:scale-[0.99] transition-all disabled:opacity-50 mt-6"
          >
            {verifying ? "확인 중..." : "본인 확인"}
          </button>
        </form>
      )}

      {/* 2단계: 변경 폼 */}
      {!success && step === 2 && (
        <form onSubmit={handleChange} className="space-y-3">
          {changeError && (
            <div className="text-[13px] text-red-500 bg-red-50 rounded-lg px-4 py-3">{changeError}</div>
          )}

          {/* 현재 아이디 표시 */}
          <div className="text-[12px] text-gray-400 px-1 mb-1">
            현재 아이디: <span className="font-semibold text-gray-600">{currentUsername}</span>
          </div>

          <input
            type="text"
            placeholder="새 아이디 (변경 안 하면 그대로)"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            autoComplete="username"
            className={inputClass}
          />

          <div className="pt-2" />

          <input
            type="password"
            placeholder="새 비밀번호 (변경 안 하면 비워두세요)"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className={inputClass}
          />
          {newPassword && (
            <input
              type="password"
              placeholder="새 비밀번호 확인"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
            />
          )}

          <button
            type="submit"
            disabled={changing}
            className="w-full h-[52px] rounded-xl bg-[#2563EB] text-white text-[15px] font-bold hover:bg-[#1d4ed8] active:scale-[0.99] transition-all disabled:opacity-50 mt-6"
          >
            {changing ? "변경 중..." : "변경하기"}
          </button>

          <button
            type="button"
            onClick={() => { setStep(1); setVerifiedUserId(null) }}
            className="w-full h-[44px] rounded-xl bg-gray-100 text-gray-500 text-[13px] font-medium hover:bg-gray-200 transition-all"
          >
            뒤로가기
          </button>
        </form>
      )}

      {/* 하단 링크 */}
      {!success && (
        <div className="flex items-center justify-center gap-5 pt-6 text-[13px] text-gray-400">
          <Link href="/login" className="hover:text-gray-600 transition-colors">로그인으로 돌아가기</Link>
        </div>
      )}
    </div>
  )
}
