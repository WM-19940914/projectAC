import type { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex relative">
      {/* 좌측 — 파란 브랜딩 영역 */}
      <div className="hidden lg:flex lg:w-[70%] bg-[#2563EB] relative overflow-hidden items-center p-14">
        {/* 화살표 + 텍스트 */}
        <div className="relative z-10 flex items-center ml-0 pl-[230px]">
          <span className="fixed left-0 text-white text-[200px] leading-none animate-bounce-gentle">&#10132;</span>
          <div>
            <h2 className="text-white text-[50px] font-extrabold leading-[1.3] tracking-tight">
              <span className="inline-block animate-slide-up" style={{ fontFamily: "'Pacifico', cursive" }}>Mooov</span><br />
              <span className="inline-block animate-slide-up animation-delay-200">Your Business</span><br />
              <span className="inline-block animate-slide-up animation-delay-400">Forward</span>
            </h2>
            <p className="text-white/70 text-[16px] mt-6 leading-[1.8] animate-slide-up animation-delay-600">
              견적부터 계약, 지출, 고객관리까지<br />
              회사의 핵심 업무를 하나로 연결해<br />
              실행이 자연스럽게 움직이도록 만드는 플랫폼, 무브.
            </p>
          </div>
        </div>
      </div>

      {/* 우측 — 로그인 폼 */}
      <div className="flex-1 flex items-start justify-center bg-[#F8FAFC] px-6 pt-[12vh]">
        <div className="w-full max-w-[360px] animate-slide-up animation-delay-800">
          {children}
        </div>
      </div>

      {/* 업무 흐름 장식 — 파란+흰 영역 위에 가로질러 배치 */}
      <div className="hidden lg:flex absolute items-start opacity-40" style={{ left: "38%", right: "31%", top: "48%" }}>
        {/* 원 중심을 지나는 가로선 */}
        <div className="absolute top-[9px] left-[9px] right-[9px] h-[2px] bg-white" />
        {/* 원 + 라벨 */}
        <div className="relative flex items-start justify-between w-full">
          {["영업", "견적", "계약", "지출", "정산"].map((label) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <div className="w-[18px] h-[18px] rounded-full bg-white flex items-center justify-center">
                <div className="w-[8px] h-[8px] rounded-full bg-[#2563EB]" />
              </div>
              <span className="text-white text-[9px] font-semibold">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
