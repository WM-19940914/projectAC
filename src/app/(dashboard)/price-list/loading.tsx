export default function Loading() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-lg bg-gray-100" />
          <div className="h-8 w-20 rounded-lg bg-gray-100" />
        </div>
        <div className="h-9 w-72 rounded-lg bg-gray-100" />
      </div>
      {/* 테이블 */}
      <div className="flex-1 px-6 py-3 space-y-3">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-gray-50 border border-gray-100" />
        ))}
      </div>
    </div>
  )
}
