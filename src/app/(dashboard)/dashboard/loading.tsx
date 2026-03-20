export default function Loading() {
  return (
    <div className="space-y-6 p-6 max-w-[1150px] mx-auto animate-pulse">
      <div className="h-8 w-64 rounded-lg bg-gray-100" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-gray-50 border border-gray-100" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-gray-50 border border-gray-100" />
      <div className="h-48 rounded-xl bg-gray-50 border border-gray-100" />
    </div>
  )
}
