"use client"

// Next.js 필수 글로벌 에러 컴포넌트
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <h2 className="text-lg font-semibold text-gray-900">문제가 발생했습니다</h2>
          <button
            onClick={() => reset()}
            className="px-4 py-2 text-sm bg-slate-700 text-white rounded-md"
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  )
}
