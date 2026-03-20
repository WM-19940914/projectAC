"use client"

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <h2 className="text-lg font-semibold text-gray-900">페이지를 불러올 수 없습니다</h2>
      <p className="text-sm text-gray-500">잠시 후 다시 시도해주세요</p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 text-sm bg-sky-aqua text-white rounded-md hover:opacity-90"
      >
        다시 시도
      </button>
    </div>
  )
}
