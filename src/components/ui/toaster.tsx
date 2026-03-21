"use client"

import { useToast } from "@/hooks/use-toast"
import { CheckCircle2, AlertCircle } from "lucide-react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        // 성공(default) → 체크 아이콘, 오류(destructive) → 경고 아이콘
        const isError = variant === "destructive"
        const Icon = isError ? AlertCircle : CheckCircle2

        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-center gap-3">
              <Icon className={`h-5 w-5 shrink-0 ${isError ? "text-red-200" : "text-green-400"}`} />
              <div className="grid gap-0.5">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription className={isError ? "text-red-100" : "text-slate-300"}>
                    {description}
                  </ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose className={isError ? "text-red-200 hover:text-white" : "text-slate-400 hover:text-white"} />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
