export default function Loading() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex gap-2">
          <div className="h-8 w-16 rounded-lg bg-gray-100" />
          <div className="h-8 w-16 rounded-lg bg-gray-100" />
          <div className="h-8 w-16 rounded-lg bg-gray-100" />
        </div>
        <div className="h-8 w-24 rounded-lg bg-gray-100" />
      </div>
      {/* 칸반 영역 */}
      <div className="flex-1 flex gap-4 p-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-1 space-y-3">
            <div className="h-5 w-24 rounded bg-gray-100" />
            <div className="h-20 rounded-lg bg-gray-50 border border-gray-100" />
            <div className="h-20 rounded-lg bg-gray-50 border border-gray-100" />
          </div>
        ))}
      </div>
    </div>
  )
}
