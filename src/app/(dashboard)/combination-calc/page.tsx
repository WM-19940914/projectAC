"use client"

import { Calculator } from "lucide-react"

export default function CombinationCalcPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
        <Calculator className="h-7 w-7 text-gray-400" />
      </div>
      <h2 className="text-lg font-semibold text-gray-700">조합비 계산</h2>
      <p className="text-sm text-gray-400">추후 구현 예정입니다</p>
    </div>
  )
}
