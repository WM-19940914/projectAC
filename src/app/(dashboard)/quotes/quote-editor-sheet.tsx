"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Plus, Trash2, PanelRightOpen, PanelRightClose,
  Package, Wrench, Pencil, Check, Loader2, Building2, PenLine,
} from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter,
} from "@/components/ui/alert-dialog"
import { formatCurrency } from "@/lib/format"
import type { QuotationWithItems } from "@/types"

// ----- 품목 행 타입 -----
interface ItemRow {
  item_name: string
  specification: string
  unit: string
  quantity: number
  unit_price: number
  amount: number
  memo: string
  retrieval_price: number
  discount_rate: number
  purchase_unit_price: number
  purchase_amount: number
  margin_rate: number
  proposed_price: number
  profit: number
  incentive_rate: number
}

// 고객 상세 정보 (수신자 자동 채우기용)
export interface CustomerInfo {
  company_name?: string | null
  business_number?: string | null
  contact_name?: string | null
  email?: string | null
  address?: string | null
  phone?: string | null
  representative?: string | null
}

interface QuoteEditorSheetProps {
  open: boolean
  onClose: () => void
  requestId?: string
  customerId?: string | null
  customerName?: string
  customerData?: CustomerInfo | null
  initialTitle?: string
  quotation?: QuotationWithItems | null
  onSaved: () => void
}

// 행 높이 상수 (좌우 동일)
const ROW_H = "h-[34px]"
const HEADER_H = "h-[30px]"

function emptyRow(): ItemRow {
  return {
    item_name: "", specification: "", unit: "",
    quantity: 1, unit_price: 0, amount: 0, memo: "",
    retrieval_price: 0, discount_rate: 0, purchase_unit_price: 0,
    purchase_amount: 0, margin_rate: 0, proposed_price: 0,
    profit: 0, incentive_rate: 0,
  }
}

function recalcPricing(row: ItemRow, roundUp = true): ItemRow {
  const next = { ...row }
  next.purchase_unit_price = Math.round(next.retrieval_price * (1 - next.discount_rate / 100))
  next.purchase_amount = next.purchase_unit_price * next.quantity
  next.proposed_price = next.margin_rate !== 100 ? Math.round(next.purchase_unit_price / (1 - next.margin_rate / 100)) : 0
  next.unit_price = roundUp ? Math.ceil(next.proposed_price / 1000) * 1000 : next.proposed_price
  next.amount = next.quantity * next.unit_price
  next.profit = next.amount - next.purchase_amount
  return next
}

export default function QuoteEditorSheet({
  open, onClose, requestId, customerId, customerName, customerData, initialTitle, quotation, onSaved,
}: QuoteEditorSheetProps) {
  const [title, setTitle] = useState("")
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split("T")[0])
  const [notes, setNotes] = useState("")
  const [equipItems, setEquipItems] = useState<ItemRow[]>([emptyRow()])
  const [installItems, setInstallItems] = useState<ItemRow[]>([emptyRow()])
  const [pricingOpen, setPricingOpen] = useState(false)
  const [roundUp, setRoundUp] = useState(true)
  const [truncationInput, setTruncationInput] = useState("")  // 단위절사 직접 입력
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const savedIdRef = useRef<string | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoadRef = useRef(true)
  // doSave의 최신 참조를 유지 (닫힐 때 stale closure 방지)
  const doSaveRef = useRef<(isAuto?: boolean) => Promise<boolean>>(() => Promise.resolve(false))
  // 공급자 모드: "company" = 우리 회사 기본값, "custom" = 직접 입력
  const [supplierMode, setSupplierMode] = useState<"company" | "custom">("company")
  // 견적 담당 모드: "default" = 주 사용자(business_settings), "custom" = 직접 입력
  const [managerMode, setManagerMode] = useState<"default" | "custom">("default")
  // 우리 회사 기본 정보 (business_settings에서 로드)
  const [businessSettings, setBusinessSettings] = useState({
    companyName: "", bizNumber: "", ceoName: "",
    email: "", address: "", manager: "", managerPhone: "", managerEmail: "",
  })
  const [businessSettingsLoaded, setBusinessSettingsLoaded] = useState(false)
  // "다음에도 사용하기" 체크박스 (dialog 열릴 때마다 기본 체크)
  const [supplierSaveAsDefault, setSupplierSaveAsDefault] = useState(true)
  const [managerSaveAsDefault, setManagerSaveAsDefault] = useState(true)
  // 공급자 정보
  const [supplier, setSupplier] = useState({
    companyName: "", bizNumber: "", ceoName: "",
    email: "", address: "", manager: "", managerPhone: "", managerEmail: "",
  })
  // 수신자 정보
  const [receiver, setReceiver] = useState({
    companyName: "", bizNumber: "", recipientName: "",
    email: "", address: "", phone: "",
  })
  // Dialog 상태
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)
  const [receiverDialogOpen, setReceiverDialogOpen] = useState(false)
  const [managerDialogOpen, setManagerDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  // 견적서 뷰 탭 (네비게이션 전용, autoSave 트리거 안 함)
  const [activeTab, setActiveTab] = useState<"simple" | "cover" | "equipment" | "installation">("simple")
  const activeTabRef = useRef<"simple" | "cover" | "equipment" | "installation">("simple")
  // 견적서 공식 타입 (체크로 설정, DB 저장, autoSave 트리거)
  const [quoteType, setQuoteType] = useState<"simple" | "detailed">("simple")

  // 우리 회사 기본 정보 로드
  const loadBusinessSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings")
      if (!res.ok) return
      const { data } = await res.json()
      if (data) {
        const settings = {
          companyName: data.company_name || "",
          bizNumber: data.biz_number || "",
          ceoName: data.ceo_name || "",
          email: data.email || "",
          address: data.address || "",
          manager: data.manager || "",
          managerPhone: data.manager_phone || "",
          managerEmail: data.manager_email || "",
        }
        setBusinessSettings(settings)
        setBusinessSettingsLoaded(true)
        return settings
      }
    } catch { /* 무시 */ }
    return null
  }, [])

  useEffect(() => {
    if (open) {
      initialLoadRef.current = true

      // 우리 회사 기본 정보 로드
      loadBusinessSettings().then((settings) => {
        if (quotation) {
          savedIdRef.current = quotation.id
          setTitle(quotation.title)
          setQuotationDate(quotation.quotation_date)
          setNotes(quotation.notes || "")

          // 견적서 타입 + 탭 복원 (체크된 타입으로 기본 열기)
          const savedType: "simple" | "detailed" = quotation.type === "상세" ? "detailed" : "simple"
          setQuoteType(savedType)
          const restoredTab: "simple" | "cover" = savedType === "detailed" ? "cover" : "simple"
          activeTabRef.current = restoredTab
          setActiveTab(restoredTab)

          // 단위절사 복원: supply_amount = grand_total - tax_amount, truncation_abs = total_amount - supply_amount
          const storedTotal = quotation.total_amount || 0
          const storedGrand = quotation.grand_total || 0
          const storedTax = quotation.tax_amount || 0
          const storedSupply = storedGrand - storedTax
          const impliedTruncation = storedTotal - storedSupply
          setTruncationInput(impliedTruncation > 0 ? impliedTruncation.toLocaleString() : "")

          // 공급자 정보: DB에 저장된 값이 있으면 직접입력 모드, 없으면 우리 회사 기본값
          const q = quotation as unknown as Record<string, unknown>
          // 견적 담당: per-quote 값 있으면 사용, 없으면 business_settings (체크박스 unchecked/checked)
          const hasPerQuoteManager = !!q.supplier_manager
          setManagerMode(hasPerQuoteManager ? "custom" : "default")
          const managerVal = (q.supplier_manager as string) || settings?.manager || ""
          const managerPhoneVal = (q.supplier_manager_phone as string) || settings?.managerPhone || ""
          const managerEmailVal = (q.supplier_manager_email as string) || settings?.managerEmail || ""

          if (q.supplier_company_name) {
            // 직접입력 모드: DB에 저장된 값 사용
            setSupplierMode("custom")
            setSupplier({
              companyName: (q.supplier_company_name as string) || "",
              bizNumber: (q.supplier_biz_number as string) || "",
              ceoName: (q.supplier_ceo_name as string) || "",
              email: (q.supplier_email as string) || "",
              address: (q.supplier_address as string) || "",
              manager: managerVal,
              managerPhone: managerPhoneVal,
              managerEmail: managerEmailVal,
            })
          } else {
            // 우리 회사 모드: business_settings에서 로드 (manager는 별도 처리)
            setSupplierMode("company")
            if (settings) setSupplier({ ...settings, manager: managerVal, managerPhone: managerPhoneVal, managerEmail: managerEmailVal })
          }

          // 수신자 정보 매핑 (DB 저장값 우선 → 없으면 고객 정보 fallback)
          setReceiver({
            companyName: (q.receiver_company_name as string) || customerData?.company_name || customerName || "",
            bizNumber: (q.receiver_biz_number as string) || customerData?.business_number || "",
            recipientName: quotation.recipient || quotation.contact_person || customerData?.contact_name || "",
            email: (q.receiver_email as string) || customerData?.email || "",
            address: (q.receiver_address as string) || quotation.site_name || customerData?.address || "",
            phone: quotation.contact_phone || customerData?.phone || "",
          })

          const equip: ItemRow[] = []
          const install: ItemRow[] = []
          for (const item of quotation.items || []) {
            const row: ItemRow = {
              item_name: item.item_name, specification: item.specification || "",
              unit: item.unit || "", quantity: item.quantity,
              unit_price: item.unit_price, amount: item.amount, memo: item.memo || "",
              retrieval_price: item.retrieval_price || 0, discount_rate: item.discount_rate || 0,
              purchase_unit_price: item.purchase_unit_price || 0, purchase_amount: item.purchase_amount || 0,
              margin_rate: item.margin_rate || 0, proposed_price: item.proposed_price || 0,
              profit: item.profit || 0, incentive_rate: item.incentive_rate || 0,
            }
            if (item.category === "설치비") install.push(row)
            else equip.push(row)
          }
          setEquipItems(equip.length > 0 ? equip : [emptyRow()])
          setInstallItems(install.length > 0 ? install : [emptyRow()])
          setPricingOpen([...equip, ...install].some((r) => r.retrieval_price > 0))
          // 비동기 로드 후 상태 변경이 autoSave 트리거하지 않도록 가드 재설정
          initialLoadRef.current = true
        } else {
          savedIdRef.current = null
          setTitle(initialTitle || ""); setQuotationDate(new Date().toISOString().split("T")[0])
          setNotes(""); setEquipItems([emptyRow()]); setInstallItems([emptyRow()])
          setPricingOpen(false)
          setQuoteType("simple")
          activeTabRef.current = "simple"
          setActiveTab("simple")
          setSupplierMode("company")
          setManagerMode("default")
          // 우리 회사 기본값으로 공급자 세팅
          if (settings) {
            setSupplier({ ...settings })
          } else {
            setSupplier({ companyName: "", bizNumber: "", ceoName: "", email: "", address: "", manager: "", managerPhone: "", managerEmail: "" })
          }
          // 고객 데이터로 수신자 자동 채우기
          setReceiver({
            companyName: customerData?.company_name || customerName || "",
            bizNumber: customerData?.business_number || "",
            recipientName: customerData?.contact_name || "",
            email: customerData?.email || "",
            address: customerData?.address || "",
            phone: customerData?.phone || "",
          })
          // 비동기 로드 후 상태 변경이 autoSave 트리거하지 않도록 가드 재설정
          initialLoadRef.current = true
        }
      })

      setSaveError(""); setAutoSaveStatus("idle")
    } else {
      // Sheet 닫힐 때: 대기 중인 타이머만 정리 (저장은 onOpenChange에서 단 한 번만 실행)
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
    }
  }, [open, quotation, customerName, customerData, initialTitle, loadBusinessSettings])

  // roundUp 토글 시 전체 행 재계산
  useEffect(() => {
    setEquipItems((prev) => prev.map((row) => row.retrieval_price > 0 ? recalcPricing(row, roundUp) : row))
    setInstallItems((prev) => prev.map((row) => row.retrieval_price > 0 ? recalcPricing(row, roundUp) : row))
  }, [roundUp])

  const updateItem = useCallback(
    (setItems: React.Dispatch<React.SetStateAction<ItemRow[]>>, index: number, field: keyof ItemRow, value: string | number) => {
      setItems((prev) => {
        const next = [...prev]
        const row = { ...next[index] }
        if (field === "quantity" || field === "unit_price" || field === "retrieval_price" || field === "discount_rate" || field === "margin_rate" || field === "incentive_rate") {
          ;(row[field] as number) = Number(value) || 0
        } else { ;(row[field] as string) = value as string }
        if (field === "retrieval_price" || field === "discount_rate" || field === "margin_rate" || field === "quantity") {
          next[index] = recalcPricing(row, roundUp)
        } else if (field === "unit_price") { row.amount = row.quantity * row.unit_price; next[index] = row }
        else { next[index] = row }
        return next
      })
    }, [roundUp]
  )

  const addRow = useCallback((s: React.Dispatch<React.SetStateAction<ItemRow[]>>) => s((p) => [...p, emptyRow()]), [])
  const removeRow = useCallback((s: React.Dispatch<React.SetStateAction<ItemRow[]>>, items: ItemRow[], i: number) => {
    if (items.length <= 1) return; s((p) => p.filter((_, j) => j !== i))
  }, [])

  const equipTotal = equipItems.reduce((s, r) => s + r.quantity * r.unit_price, 0)
  const installTotal = installItems.reduce((s, r) => s + r.quantity * r.unit_price, 0)
  const totalAmount = equipTotal + installTotal
  // 단위절사: 직접 입력 (음수로 적용)
  const truncation = -(Number(truncationInput.replace(/[^0-9]/g, "")) || 0)
  const supplyAmount = totalAmount + truncation   // 공급가액
  const taxAmount = Math.floor(supplyAmount * 0.1)  // VAT (절사)
  const grandTotal = supplyAmount + taxAmount      // 최종 견적
  const equipPurchaseTotal = equipItems.reduce((s, r) => s + r.purchase_amount, 0)
  const installPurchaseTotal = installItems.reduce((s, r) => s + r.purchase_amount, 0)
  const totalPurchase = equipPurchaseTotal + installPurchaseTotal
  const totalProfit = equipItems.reduce((s, r) => s + r.profit, 0) + installItems.reduce((s, r) => s + r.profit, 0)

  // 핵심 저장 로직 (자동저장 / 수동저장 공용)
  // 저장 payload 생성 (isUpdate=true면 기존 견적서 → 품목 없어도 헤더만 저장 허용)
  const buildPayload = useCallback((isUpdate = false) => {
    // 품목명 없어도 단가·수량·규격 중 하나라도 입력된 행은 유효 처리
    const hasData = (i: ItemRow) =>
      i.item_name.trim() || i.unit_price > 0 || i.quantity !== 1 || i.specification.trim() || i.retrieval_price > 0
    const validEquip = equipItems.filter(hasData)
    const validInstall = installItems.filter(hasData)
    if (!title.trim()) return null
    // 신규 생성은 품목 필수, 기존 수정은 품목 없어도 헤더 업데이트 허용
    if (!isUpdate && validEquip.length === 0 && validInstall.length === 0) return null
    const allItems = [
      ...validEquip.map((item) => ({ ...item, category: "장비" })),
      ...validInstall.map((item) => ({ ...item, category: "설치비" })),
    ].map((item) => ({
      category: item.category, item_name: item.item_name.trim(),
      specification: item.specification || null, unit: item.unit || null,
      quantity: item.quantity, unit_price: item.unit_price, memo: item.memo || null,
      retrieval_price: item.retrieval_price || 0, discount_rate: item.discount_rate || 0,
      purchase_unit_price: item.purchase_unit_price || 0, purchase_amount: item.purchase_amount || 0,
      margin_rate: item.margin_rate || 0, proposed_price: item.proposed_price || 0,
      profit: item.profit || 0, incentive_rate: item.incentive_rate || 0,
    }))
    return {
      title: title.trim(), quotation_date: quotationDate,
      request_id: requestId || null, customer_id: customerId || null,
      site_name: receiver.address || null,
      recipient: receiver.recipientName || null,
      contact_person: receiver.recipientName || null,
      contact_phone: receiver.phone || null,
      // 공급자/견적담당: 모드 관계없이 현재 값을 항상 DB에 스냅샷 저장
      // (settings 변경이 기존 견적서에 영향 안 주도록)
      supplier_company_name: supplier.companyName || null,
      supplier_biz_number:   supplier.bizNumber || null,
      supplier_ceo_name:     supplier.ceoName || null,
      supplier_email:        supplier.email || null,
      supplier_address:      supplier.address || null,
      supplier_manager:       supplier.manager || null,
      supplier_manager_phone: supplier.managerPhone || null,
      supplier_manager_email: supplier.managerEmail || null,
      // 수신자 확장
      receiver_company_name: receiver.companyName || null,
      receiver_biz_number: receiver.bizNumber || null,
      receiver_email: receiver.email || null,
      receiver_address: receiver.address || null,
      notes: notes || null, items: allItems,
      // 뷰 타입 저장 (간이/상세) - ref 사용으로 뷰 전환 시 autoSave 트리거 방지
      type: quoteType === "detailed" ? "상세" : "간이",
      // 단위절사 반영된 최종 금액을 직접 전달 (API 재계산 덮어쓰기 방지)
      grand_total: grandTotal,
      tax_amount: taxAmount,
    }
  }, [title, quotationDate, requestId, customerId, receiver, supplier, supplierMode, notes, equipItems, installItems, grandTotal, taxAmount, quoteType])

  const doSave = useCallback(async (isAuto = false): Promise<boolean> => {
    const isUpdate = !!savedIdRef.current
    const payload = buildPayload(isUpdate)
    if (!payload) {
      if (!isAuto) setSaveError(!title.trim() ? "견적서 제목을 입력해주세요" : "최소 1개의 품목을 입력해주세요")
      return false
    }
    const finalPayload = isUpdate ? { id: savedIdRef.current, ...payload } : payload

    // 자동저장(PATCH)은 백그라운드로 처리 → UI 블로킹 없음
    if (isAuto && isUpdate) {
      setAutoSaveStatus("saving")
      fetch("/api/quotes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPayload),
      }).then((res) => {
        if (res.ok) {
          setAutoSaveStatus("saved")
          onSaved()
        } else {
          setAutoSaveStatus("error")
        }
      }).catch(() => setAutoSaveStatus("error"))
      return true
    }

    // 수동 저장 또는 첫 생성(POST)은 await 필요 (ID 받아야 함)
    if (isAuto) setAutoSaveStatus("saving")
    else { setIsSaving(true); setSaveError("") }
    try {
      const res = await fetch("/api/quotes", {
        method: isUpdate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPayload),
      })
      if (!res.ok) {
        const r = await res.json()
        if (isAuto) setAutoSaveStatus("error")
        else setSaveError(r.error || "저장 실패")
        return false
      }
      // 새 생성 시 ID 저장 (이후 자동저장은 PATCH)
      if (!isUpdate) {
        const r = await res.json()
        if (r.data?.id) savedIdRef.current = r.data.id
      }
      if (isAuto) {
        setAutoSaveStatus("saved")
        onSaved()
      }
      return true
    } catch (e: unknown) {
      if (isAuto) setAutoSaveStatus("error")
      else setSaveError("네트워크 오류: " + (e instanceof Error ? e.message : "알 수 없는 오류"))
      return false
    } finally { if (!isAuto) setIsSaving(false) }
  }, [buildPayload, title, onSaved])

  // doSave ref 항상 최신으로 유지
  useEffect(() => { doSaveRef.current = doSave }, [doSave])

  // 수동 저장 (닫기 포함)
  const handleSave = async () => {
    const ok = await doSave(false)
    if (ok) { onSaved(); onClose() }
  }

  // 자동저장: 데이터 변경 시 2초 디바운스
  // - doSave는 deps에서 제외 (doSaveRef 사용) → 콜백 참조 변경으로 인한 불필요한 트리거 방지
  // - quoteType은 deps에서 제외 → 탭 전환만으로 autoSave 트리거 안 함 (닫을 때 flush로 저장)
  useEffect(() => {
    // 초기 로드 시에는 자동저장 스킵
    if (initialLoadRef.current) {
      initialLoadRef.current = false
      return
    }
    if (!open) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => { doSaveRef.current(true) }, 2000)
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, quotationDate, notes, equipItems, installItems, receiver, supplier, supplierMode, open])

  const handleDelete = async () => {
    const id = quotation?.id || savedIdRef.current
    if (!id) return
    setIsDeleting(true)
    try {
      const res = await fetch("/api/quotes", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) { const r = await res.json(); setDeleteDialogOpen(false); return console.error("삭제 실패:", r.error) }
      setDeleteDialogOpen(false)
      onSaved(); onClose()
    } catch (e: unknown) {
      console.error("삭제 오류:", e)
    } finally { setIsDeleting(false) }
  }

  // Sheet 너비: 내부 단가 보이면 우측으로 확장 (엑셀 열 숨기기/보이기)
  // A4 용지 폭 기준: 794px (210mm @ 96DPI) + 패딩 px-6*2(48px) = 842px
  const sheetW = pricingOpen ? "w-[1530px] !max-w-[1530px]" : "w-[842px] !max-w-[842px]"
  // 좌측 콘텐츠 폭 고정 (A4 = 794px) → 단가 열어도 좌측은 변화 없음
  const leftW = pricingOpen ? "w-[794px] shrink-0" : "w-full"

  return (
    <Sheet open={open} onOpenChange={(v) => {
        if (!v) {
          // 대기 중인 autoSave 타이머 취소
          if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current)
            autoSaveTimerRef.current = null
          }
          // 기존 견적서면 닫기 직전 최종 상태 저장 (단 한 번만)
          if (savedIdRef.current) {
            doSaveRef.current(true)
          }
          onClose()
        }
      }}>
      <SheetContent
        side="left"
        className={`${sheetW} p-0 flex flex-col transition-all duration-300`}
        onInteractOutside={(e) => {
          // Dialog가 열려있으면 Sheet 닫기 방지 (Dialog는 Portal로 Sheet 밖에 렌더링됨)
          if (supplierDialogOpen || receiverDialogOpen || managerDialogOpen || deleteDialogOpen) {
            e.preventDefault()
            return
          }
          onClose()
        }}
      >
        {/* 헤더 */}
        <SheetHeader className={`px-6 pt-6 ${activeTab === "simple" ? "pb-4" : "pb-0"} border-b shrink-0`}>
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="sr-only">견적서 편집</SheetTitle>
              <SheetDescription className="sr-only">견적서 편집</SheetDescription>
              {/* 간이 / 상세 메인 토글 (클릭 = 타입 설정 + 뷰 이동) */}
              <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
                {/* 간이 견적서 */}
                <button
                  type="button"
                  onClick={() => {
                    setQuoteType("simple")
                    activeTabRef.current = "simple"
                    setActiveTab("simple")
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer select-none ${
                    activeTab === "simple"
                      ? "bg-white shadow-sm"
                      : "hover:bg-white/50"
                  }`}
                >
                  <span className={`text-xs font-medium transition-all ${
                    activeTab === "simple" ? "text-sky-aqua" : "text-gray-400"
                  }`}>
                    간이 견적서
                  </span>
                  {quoteType === "simple" && (
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-sky-aqua">
                      <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                    </span>
                  )}
                </button>
                {/* 상세 견적서 */}
                <button
                  type="button"
                  onClick={() => {
                    setQuoteType("detailed")
                    activeTabRef.current = "cover"
                    setActiveTab("cover")
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer select-none ${
                    activeTab !== "simple"
                      ? "bg-white shadow-sm"
                      : "hover:bg-white/50"
                  }`}
                >
                  <span className={`text-xs font-medium transition-all ${
                    activeTab !== "simple" ? "text-sky-aqua" : "text-gray-400"
                  }`}>
                    상세 견적서
                  </span>
                  {quoteType === "detailed" && (
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-sky-aqua">
                      <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                    </span>
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mr-6">
              {(quotation || savedIdRef.current) && (
                <button
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isDeleting}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg text-soft-blush hover:text-[#c4807e] hover:bg-soft-blush/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  삭제하기
                </button>
              )}
              <button
                onClick={() => setPricingOpen(!pricingOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  pricingOpen
                    ? "bg-sky-aqua border-sky-aqua text-white"
                    : "bg-white border-gray-300 text-gray-500 hover:border-sky-aqua/50 hover:text-sky-aqua"
                }`}
              >
                {pricingOpen
                  ? <><PanelRightClose className="h-3.5 w-3.5" /> 원가 분석 닫기</>
                  : <><PanelRightOpen className="h-3.5 w-3.5" /> 원가 분석</>
                }
              </button>
            </div>
          </div>
          {/* 상세 견적서 서브 탭 (갑지 · 장비 내역서 · 설치비 내역서) */}
          {activeTab !== "simple" && (
            <div className="flex items-center mt-3 -mx-6 px-6">
              <button type="button"
                onClick={() => { activeTabRef.current = "cover"; setActiveTab("cover") }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
                  activeTab === "cover"
                    ? "border-sky-aqua text-sky-aqua"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}>
                갑지
              </button>
              <button type="button"
                onClick={() => { activeTabRef.current = "equipment"; setActiveTab("equipment") }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
                  activeTab === "equipment"
                    ? "border-sky-aqua text-sky-aqua"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}>
                <Package className="h-3 w-3" />
                장비 내역서
              </button>
              <button type="button"
                onClick={() => { activeTabRef.current = "installation"; setActiveTab("installation") }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
                  activeTab === "installation"
                    ? "border-sky-aqua text-sky-aqua"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}>
                <Wrench className="h-3 w-3" />
                설치비 내역서
              </button>
            </div>
          )}
        </SheetHeader>

        {/* 스크롤 본문 - 가로/세로 스크롤 모두 가능 */}
        <div className="flex-1 overflow-auto relative">
          {/* 원가 분석 패널 토글 버튼 */}
          {pricingOpen ? (
            // 열린 상태: 견적서와 원가 분석 사이 중앙에 원형 버튼
            <button
              onClick={() => setPricingOpen(false)}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 w-7 h-7 bg-white hover:bg-sky-aqua/10 border border-sky-aqua/30 rounded-full transition-all flex items-center justify-center shadow-sm"
              style={{ left: 24 + 794 + 6 }}
            >
              <svg className="h-3.5 w-3.5 text-sky-aqua" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          ) : (
            // 닫힌 상태: 우측 가장자리 반원
            <button
              onClick={() => setPricingOpen(true)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-5 h-14 bg-sky-aqua/10 hover:bg-sky-aqua/20 border border-r-0 border-sky-aqua/30 rounded-l-full transition-all flex items-center justify-center"
            >
              <svg className="h-4 w-4 text-sky-aqua -mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          )}
          <div className="px-6 py-4 space-y-2">

            {/* ===== 간이 견적서 뷰 ===== */}
            {activeTab === "simple" && (
              <>
                {/* 기본 정보 */}
                <div className={leftW}>
                  <div className="border border-gray-200 rounded-lg">
                    <div className="px-4 py-3 bg-gray-50/50">
                      <span className="font-sans font-semibold text-sm">기본 정보</span>
                    </div>
                    <div className="px-4 pb-4">
                      <div className="pt-2 space-y-3">
                        {/* 견적서 제목 */}
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                          placeholder="견적서 제목을 입력하세요 *"
                          className="w-full text-xl font-bold bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-gray-400 focus:outline-none px-0 py-1 placeholder:text-gray-200" />

                        {/* 견적일 / 견적번호 / 견적담당 / 연락처 */}
                        <div className="flex items-center gap-2 text-[10px] whitespace-nowrap">
                          <span className="text-gray-400 shrink-0">견적일</span>
                          <input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)}
                            className="text-[10px] text-gray-600 bg-transparent border-0 focus:outline-none shrink-0" />
                          <span className="text-gray-300 shrink-0">|</span>
                          <span className="text-gray-400 shrink-0">견적번호</span>
                          <span className="text-gray-600 shrink-0">{quotation?.quotation_number || ""}</span>
                          <span className="flex-1" />
                          <span className="text-gray-400 shrink-0">견적 담당</span>
                          <span className="text-gray-600 shrink-0">{supplier.manager || ""}</span>
                          <span className="text-gray-300 shrink-0">|</span>
                          <span className="text-gray-400 shrink-0">연락처</span>
                          <span className="text-gray-600 shrink-0">{supplier.managerPhone || ""}</span>
                          <span className="text-gray-300 shrink-0">|</span>
                          <span className="text-gray-400 shrink-0">이메일</span>
                          <span className="text-gray-600 shrink-0">{supplier.managerEmail || ""}</span>
                          <button onClick={() => setManagerDialogOpen(true)} type="button" className="shrink-0">
                            <Pencil className="h-2.5 w-2.5 text-gray-300 hover:text-gray-500 transition-colors" />
                          </button>
                        </div>

                        {/* 공급자 / 수신자 2단 */}
                        <div className="grid grid-cols-2 gap-8 border-t border-gray-100 pt-3">
                          {/* 공급자 */}
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <p className="text-[11px] text-gray-400">공급자</p>
                              <button onClick={() => setSupplierDialogOpen(true)} type="button">
                                <Pencil className="h-3 w-3 text-gray-300 hover:text-gray-500 transition-colors" />
                              </button>
                            </div>
                            <p className="font-sans font-semibold text-sm text-gray-900 mb-2.5">
                              {supplier.companyName || ""}
                            </p>
                            <div className="space-y-1.5">
                              <InfoPair label="사업자" value={supplier.bizNumber || ""} />
                              <InfoPair label="대표자" value={supplier.ceoName || ""} />
                              <InfoPair label="이메일" value={supplier.email || ""} />
                              <InfoPair label="주소" value={supplier.address || ""} wrap />
                            </div>
                          </div>
                          {/* 수신자 */}
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <p className="text-[11px] text-gray-400">수신자</p>
                              <button onClick={() => setReceiverDialogOpen(true)} type="button">
                                <Pencil className="h-3 w-3 text-gray-300 hover:text-gray-500 transition-colors" />
                              </button>
                            </div>
                            <p className="font-sans font-semibold text-sm text-gray-900 mb-2.5">
                              {receiver.companyName || customerName || "미연결"}
                            </p>
                            <div className="space-y-1.5">
                              <InfoPair label="사업자" value={receiver.bizNumber || ""} />
                              <InfoPair label="수신자" value={receiver.recipientName || ""} />
                              <InfoPair label="이메일" value={receiver.email || ""} />
                              <InfoPair label="주소" value={receiver.address || ""} wrap />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 장비 내역 */}
                <div className="flex gap-3">
                  <div className={`${leftW} border border-gray-200 rounded-lg`}>
                    <div className="px-4 py-3 bg-gray-50/50">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-sky-aqua" />
                        <span className="font-sans font-semibold text-sm text-gray-900">장비 내역</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${equipTotal > 0 ? "bg-sky-aqua/10 text-sky-aqua" : "bg-gray-100 text-gray-400"}`}>
                          {equipTotal > 0 ? formatCurrency(equipTotal) : "0원"}
                        </span>
                      </div>
                    </div>
                    <ItemsTable items={equipItems}
                      updateItem={(i, f, v) => updateItem(setEquipItems, i, f, v)}
                      addRow={() => addRow(setEquipItems)}
                      removeRow={(i) => removeRow(setEquipItems, equipItems, i)} />
                  </div>

                  {pricingOpen && (
                    <div className="flex-1 min-w-0 border border-gray-200 rounded-lg self-start bg-gray-50">
                      <div className="px-4 py-3 bg-gray-100/60 flex items-center gap-2">
                        <Package className="h-4 w-4 text-sky-aqua" />
                        <span className="font-sans font-semibold text-sm text-gray-900">장비 단가</span>
                      </div>
                      <PricingRows items={equipItems}
                        updateItem={(i, f, v) => updateItem(setEquipItems, i, f, v)}
                        roundUp={roundUp} onToggleRoundUp={() => setRoundUp(!roundUp)} />
                    </div>
                  )}
                </div>

                {/* 설치비 내역 */}
                <div className="flex gap-3">
                  <div className={`${leftW} border border-gray-200 rounded-lg`}>
                    <div className="px-4 py-3 bg-gray-50/50">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-tropical-teal" />
                        <span className="font-sans font-semibold text-sm text-gray-900">설치비 내역</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${installTotal > 0 ? "bg-tropical-teal/10 text-tropical-teal" : "bg-gray-100 text-gray-400"}`}>
                          {installTotal > 0 ? formatCurrency(installTotal) : "0원"}
                        </span>
                      </div>
                    </div>
                    <ItemsTable items={installItems}
                      updateItem={(i, f, v) => updateItem(setInstallItems, i, f, v)}
                      addRow={() => addRow(setInstallItems)}
                      removeRow={(i) => removeRow(setInstallItems, installItems, i)} />
                  </div>

                  {pricingOpen && (
                    <div className="flex-1 min-w-0 border border-gray-200 rounded-lg self-start bg-gray-50">
                      <div className="px-4 py-3 bg-gray-100/60 flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-tropical-teal" />
                        <span className="font-sans font-semibold text-sm text-gray-900">설치비 단가</span>
                      </div>
                      <PricingRows items={installItems}
                        updateItem={(i, f, v) => updateItem(setInstallItems, i, f, v)}
                        roundUp={roundUp} onToggleRoundUp={() => setRoundUp(!roundUp)} />
                    </div>
                  )}
                </div>

                {/* 비고 & 합계 */}
                <div className="flex gap-3">
                  <div className={`${leftW} border border-gray-200 rounded-lg`}>
                    <div className="px-4 py-3 bg-gray-50/50">
                      <span className="font-sans font-semibold text-sm">비고 / 합계</span>
                    </div>
                    <div className="px-4 pb-4">
                      <div className="space-y-4 pt-2">
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block">비고 / 특이사항</label>
                          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                            placeholder="견적 관련 특이사항을 입력하세요" rows={3}
                            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 resize-none" />
                        </div>
                        <div className="flex justify-end">
                          <div className="w-[300px] space-y-3 border border-gray-200 rounded-lg p-5 bg-gray-50/30">
                            <SummaryRow label="총 합계" value={totalAmount} bold />
                            {/* 단위절사: 직접 입력, 빨간색 표시 */}
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-soft-blush font-medium">단위절사</span>
                              <div className="flex items-center gap-0.5 text-soft-blush font-semibold">
                                <span>-</span>
                                <input
                                  type="text" inputMode="numeric"
                                  value={truncationInput}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/[^0-9]/g, "")
                                    setTruncationInput(raw ? Number(raw).toLocaleString() : "")
                                  }}
                                  placeholder="0"
                                  className="w-[90px] text-right bg-transparent border-0 border-b border-soft-blush/60 focus:outline-none focus:border-soft-blush text-soft-blush font-semibold placeholder:text-soft-blush/30 tabular-nums text-xs px-0"
                                />
                              </div>
                            </div>
                            <SummaryRow label="공급가액" value={supplyAmount} />
                            <SummaryRow label="VAT (10%)" value={taxAmount} />
                            <div className="-mx-5 px-5 py-3 bg-sky-aqua/10 border-t border-sky-aqua/20 flex justify-between items-center mt-1">
                              <span className="text-sm font-semibold text-gray-900">최종 견적</span>
                              <span className="text-sm font-bold text-gray-900 tabular-nums">{formatCurrency(grandTotal)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {pricingOpen && (
                    <div className="flex-1 min-w-0 border border-gray-200 rounded-lg p-3 self-start bg-gray-50">
                      <p className="font-sans font-semibold text-xs text-gray-500 mb-2">매입/이윤 요약</p>
                      <div className="space-y-1.5">
                        <MiniRow label="총 매입" value={totalPurchase} />
                        <MiniRow label="총 제안" value={totalAmount} />
                        <div className="border-t border-gray-100 pt-1.5">
                          <MiniRow label="총 이윤" value={totalProfit} highlight />
                        </div>
                        {totalAmount > 0 && (
                          <MiniRow label="이윤율" value={0} percent={((totalProfit / totalAmount) * 100).toFixed(1)} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ===== 갑지 탭 ===== */}
            {activeTab === "cover" && (
              <div className="flex gap-3">
                <div className={`${leftW} border border-gray-200 rounded-lg shadow-sm overflow-hidden`}>
                  <div className="px-6 py-5 space-y-5">
                    {/* 제목 영역 */}
                    <div className="text-center space-y-2 pb-4 border-b border-gray-100">
                      <p className="text-[11px] text-gray-400 tracking-[0.3em]">견 적 서</p>
                      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                        placeholder="견적서 제목을 입력하세요 *"
                        className="w-full text-center text-lg font-bold bg-transparent border-0 focus:outline-none px-0 py-1 placeholder:text-gray-200" />
                      <div className="flex items-center justify-center gap-4 text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400">견적일</span>
                          <input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)}
                            className="text-[10px] text-gray-600 bg-transparent border-0 focus:outline-none" />
                        </div>
                        <span className="text-gray-200">|</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400">견적번호</span>
                          <span className="text-gray-600">{quotation?.quotation_number || ""}</span>
                        </div>
                      </div>
                    </div>

                    {/* 공급자 / 수신자 */}
                    <div className="grid grid-cols-2 gap-5">
                      {/* 공급자 */}
                      <div className="border border-gray-100 rounded-lg p-4">
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <p className="text-[11px] font-semibold text-gray-500">공급자</p>
                          <button onClick={() => setSupplierDialogOpen(true)} type="button">
                            <Pencil className="h-2.5 w-2.5 text-gray-300 hover:text-gray-500 transition-colors" />
                          </button>
                        </div>
                        <p className="font-sans font-semibold text-sm text-gray-900 mb-2">
                          {supplier.companyName || ""}
                        </p>
                        <div className="space-y-1.5">
                          <InfoPair label="사업자" value={supplier.bizNumber || ""} />
                          <InfoPair label="대표자" value={supplier.ceoName || ""} />
                          <InfoPair label="이메일" value={supplier.email || ""} />
                          <InfoPair label="주소" value={supplier.address || ""} wrap />
                        </div>
                      </div>
                      {/* 수신자 */}
                      <div className="border border-gray-100 rounded-lg p-4">
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <p className="text-[11px] font-semibold text-gray-500">수신자</p>
                          <button onClick={() => setReceiverDialogOpen(true)} type="button">
                            <Pencil className="h-2.5 w-2.5 text-gray-300 hover:text-gray-500 transition-colors" />
                          </button>
                        </div>
                        <p className="font-sans font-semibold text-sm text-gray-900 mb-2">
                          {receiver.companyName || customerName || "미연결"}
                        </p>
                        <div className="space-y-1.5">
                          <InfoPair label="사업자" value={receiver.bizNumber || ""} />
                          <InfoPair label="수신자" value={receiver.recipientName || ""} />
                          <InfoPair label="이메일" value={receiver.email || ""} />
                          <InfoPair label="주소" value={receiver.address || ""} wrap />
                        </div>
                      </div>
                    </div>

                    {/* 금액 요약 테이블 */}
                    <div className="flex justify-center">
                      <div className="w-[400px] border border-gray-200 rounded-lg overflow-hidden">
                        <div className="grid grid-cols-[140px_1fr] text-xs">
                          <div className="px-3 py-2 bg-gray-50 border-b border-r border-gray-200 font-medium text-gray-500">장비</div>
                          <div className="px-3 py-2 border-b border-gray-200 text-right tabular-nums text-gray-700">{formatCurrency(equipTotal)}</div>
                          <div className="px-3 py-2 bg-gray-50 border-b border-r border-gray-200 font-medium text-gray-500">설치비</div>
                          <div className="px-3 py-2 border-b border-gray-200 text-right tabular-nums text-gray-700">{formatCurrency(installTotal)}</div>
                          <div className="px-3 py-2 bg-gray-50 border-b border-r border-gray-200 font-semibold text-gray-700">합계</div>
                          <div className="px-3 py-2 border-b border-gray-200 text-right tabular-nums font-semibold text-gray-900">{formatCurrency(totalAmount)}</div>
                          <div className="px-3 py-2 bg-gray-50 border-b border-r border-gray-200 font-medium text-soft-blush">단위절사</div>
                          <div className="px-3 py-2 border-b border-gray-200 text-right">
                            <div className="flex items-center justify-end gap-0.5 text-soft-blush font-semibold text-xs">
                              <span>-</span>
                              <input
                                type="text" inputMode="numeric"
                                value={truncationInput}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/[^0-9]/g, "")
                                  setTruncationInput(raw ? Number(raw).toLocaleString() : "")
                                }}
                                placeholder="0"
                                className="w-[90px] text-right bg-transparent border-0 border-b border-soft-blush/60 focus:outline-none focus:border-soft-blush text-soft-blush font-semibold placeholder:text-soft-blush/30 tabular-nums text-xs px-0"
                              />
                            </div>
                          </div>
                          <div className="px-3 py-2 bg-gray-50 border-b border-r border-gray-200 font-medium text-gray-500">공급가액</div>
                          <div className="px-3 py-2 border-b border-gray-200 text-right tabular-nums text-gray-700">{formatCurrency(supplyAmount)}</div>
                          <div className="px-3 py-2 bg-gray-50 border-b border-r border-gray-200 font-medium text-gray-500">부가세 (10%)</div>
                          <div className="px-3 py-2 border-b border-gray-200 text-right tabular-nums text-gray-700">{formatCurrency(taxAmount)}</div>
                          <div className="px-3 py-2.5 bg-sky-aqua/10 border-r border-gray-200 font-semibold text-gray-900">최종 견적</div>
                          <div className="px-3 py-2.5 bg-sky-aqua/10 text-right tabular-nums font-bold text-gray-900">{formatCurrency(grandTotal)}</div>
                        </div>
                      </div>
                    </div>

                    {/* 견적 담당 */}
                    <div className="flex items-center justify-center gap-4 text-[10px] pt-2">
                      <span className="text-gray-400">견적 담당</span>
                      <span className="text-gray-600 font-medium">{supplier.manager || ""}</span>
                      <span className="text-gray-200">|</span>
                      <span className="text-gray-400">연락처</span>
                      <span className="text-gray-600">{supplier.managerPhone || ""}</span>
                      <span className="text-gray-200">|</span>
                      <span className="text-gray-400">이메일</span>
                      <span className="text-gray-600">{supplier.managerEmail || ""}</span>
                      <button onClick={() => setManagerDialogOpen(true)} type="button">
                        <Pencil className="h-2.5 w-2.5 text-gray-300 hover:text-gray-500 transition-colors" />
                      </button>
                    </div>

                    {/* 비고 */}
                    <div className="border-t border-gray-100 pt-4">
                      <label className="text-xs font-medium text-gray-500 mb-1 block">비고 / 특이사항</label>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                        placeholder="견적 관련 특이사항을 입력하세요" rows={3}
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 resize-none" />
                    </div>
                  </div>
                </div>

                {/* 매입/이윤 요약 (갑지 옆) */}
                {pricingOpen && (
                  <div className="flex-1 min-w-0 border border-gray-200 rounded-lg p-3 self-start bg-gray-50">
                    <p className="font-sans font-semibold text-xs text-gray-500 mb-2">매입/이윤 요약</p>
                    <div className="space-y-1.5">
                      <MiniRow label="총 매입" value={totalPurchase} />
                      <MiniRow label="총 제안" value={totalAmount} />
                      <div className="border-t border-gray-100 pt-1.5">
                        <MiniRow label="총 이윤" value={totalProfit} highlight />
                      </div>
                      {totalAmount > 0 && (
                        <MiniRow label="이윤율" value={0} percent={((totalProfit / totalAmount) * 100).toFixed(1)} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== 장비 내역서 탭 ===== */}
            {activeTab === "equipment" && (
              <div className="flex gap-3">
                <div className={`${leftW} border border-gray-200 rounded-lg shadow-sm overflow-hidden`}>
                  <div className="px-4 py-3 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-sky-aqua" />
                      <span className="font-sans font-semibold text-sm text-gray-900">장비 내역</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${equipTotal > 0 ? "bg-sky-aqua/10 text-sky-aqua" : "bg-gray-100 text-gray-400"}`}>
                        {equipTotal > 0 ? formatCurrency(equipTotal) : "0원"}
                      </span>
                    </div>
                  </div>
                  <ItemsTable items={equipItems}
                    updateItem={(i, f, v) => updateItem(setEquipItems, i, f, v)}
                    addRow={() => addRow(setEquipItems)}
                    removeRow={(i) => removeRow(setEquipItems, equipItems, i)} />
                  {/* 장비 소계 */}
                  <div className="px-4 py-2.5 bg-gray-50/30 border-t border-gray-200">
                    <div className="flex justify-end items-center gap-3 text-xs">
                      <span className="text-gray-500 font-medium">장비 소계</span>
                      <span className="font-semibold text-gray-900 tabular-nums">{formatCurrency(equipTotal)}</span>
                    </div>
                  </div>
                </div>

                {pricingOpen && (
                  <div className="flex-1 min-w-0 border border-gray-200 rounded-lg self-start bg-gray-50">
                    <div className="px-4 py-3 bg-gray-100/60 flex items-center gap-2">
                      <Package className="h-4 w-4 text-sky-aqua" />
                      <span className="font-sans font-semibold text-sm text-gray-900">장비 단가</span>
                    </div>
                    <PricingRows items={equipItems}
                      updateItem={(i, f, v) => updateItem(setEquipItems, i, f, v)}
                      roundUp={roundUp} onToggleRoundUp={() => setRoundUp(!roundUp)} />
                  </div>
                )}
              </div>
            )}

            {/* ===== 설치비 내역서 탭 ===== */}
            {activeTab === "installation" && (
              <div className="flex gap-3">
                <div className={`${leftW} border border-gray-200 rounded-lg shadow-sm overflow-hidden`}>
                  <div className="px-4 py-3 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-tropical-teal" />
                      <span className="font-sans font-semibold text-sm text-gray-900">설치비 내역</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${installTotal > 0 ? "bg-tropical-teal/10 text-tropical-teal" : "bg-gray-100 text-gray-400"}`}>
                        {installTotal > 0 ? formatCurrency(installTotal) : "0원"}
                      </span>
                    </div>
                  </div>
                  <ItemsTable items={installItems}
                    updateItem={(i, f, v) => updateItem(setInstallItems, i, f, v)}
                    addRow={() => addRow(setInstallItems)}
                    removeRow={(i) => removeRow(setInstallItems, installItems, i)} />
                  {/* 설치비 소계 */}
                  <div className="px-4 py-2.5 bg-gray-50/30 border-t border-gray-200">
                    <div className="flex justify-end items-center gap-3 text-xs">
                      <span className="text-gray-500 font-medium">설치비 소계</span>
                      <span className="font-semibold text-gray-900 tabular-nums">{formatCurrency(installTotal)}</span>
                    </div>
                  </div>
                </div>

                {pricingOpen && (
                  <div className="flex-1 min-w-0 border border-gray-200 rounded-lg self-start bg-gray-50">
                    <div className="px-4 py-3 bg-gray-100/60 flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-tropical-teal" />
                      <span className="font-sans font-semibold text-sm text-gray-900">설치비 단가</span>
                    </div>
                    <PricingRows items={installItems}
                      updateItem={(i, f, v) => updateItem(setInstallItems, i, f, v)}
                      roundUp={roundUp} onToggleRoundUp={() => setRoundUp(!roundUp)} />
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* 하단 액션 바 */}
        <div className="px-6 py-2.5 border-t bg-white shrink-0 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-2.5">
            {/* 자동저장 상태 표시 */}
            {autoSaveStatus === "saving" && (
              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                <Loader2 className="h-2.5 w-2.5 animate-spin" /> 저장 중...
              </span>
            )}
            {autoSaveStatus === "saved" && (
              <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-muted-teal bg-muted-teal/10 rounded-full">
                <Check className="h-3 w-3" /> 저장됨
              </span>
            )}
            {autoSaveStatus === "error" && (
              <span className="text-[10px] text-soft-blush">자동저장 실패</span>
            )}
            {saveError && <span className="text-[10px] text-soft-blush">{saveError}</span>}
            <button onClick={handleSave} disabled={isSaving}
              className="px-2.5 py-1 text-[11px] rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1">
{isSaving ? "저장..." : "바로 저장"}
            </button>
          </div>
        </div>
      </SheetContent>

      {/* 공급자 정보 Dialog */}
      <Dialog open={supplierDialogOpen} onOpenChange={(v) => { setSupplierDialogOpen(v); if (v) setSupplierSaveAsDefault(true) }}>
        <DialogContent className="sm:max-w-[380px] p-5 gap-3" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="space-y-0.5">
            <DialogTitle className="font-sans text-sm font-semibold">공급자 정보</DialogTitle>
            <DialogDescription className="text-[11px] text-gray-400">
              {supplierMode === "company" ? "우리 회사 기본 정보가 모든 견적서에 적용됩니다" : "이 견적서에만 적용되는 공급자 정보입니다"}
            </DialogDescription>
          </DialogHeader>
          {/* 모드 토글 */}
          <div className="flex gap-1.5 p-1 bg-gray-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setSupplierMode("company")
                // 우리 회사 기본값으로 복원
                setSupplier({ ...businessSettings })
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                supplierMode === "company"
                  ? "bg-white text-sky-aqua shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Building2 className="h-3 w-3" />
              우리 회사
            </button>
            <button
              type="button"
              onClick={() => {
                setSupplierMode("custom")
                // 직접입력 전환 시 모든 필드 공란으로 초기화
                setSupplier({ companyName: "", bizNumber: "", ceoName: "", email: "", address: "", manager: "", managerPhone: "", managerEmail: "" })
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                supplierMode === "custom"
                  ? "bg-white text-sky-aqua shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <PenLine className="h-3 w-3" />
              직접 입력
            </button>
          </div>
          <div className="space-y-2.5">
            <DialogField label="회사명" required value={supplier.companyName}
              onChange={(v) => setSupplier((s) => ({ ...s, companyName: v }))} />
            <DialogField label="사업자 번호" value={supplier.bizNumber}
              onChange={(v) => setSupplier((s) => ({ ...s, bizNumber: v }))} />
            <DialogField label="대표자" value={supplier.ceoName}
              onChange={(v) => setSupplier((s) => ({ ...s, ceoName: v }))} />
            <DialogField label="이메일" value={supplier.email}
              onChange={(v) => setSupplier((s) => ({ ...s, email: v }))} />
            <DialogField label="소재지" value={supplier.address}
              onChange={(v) => setSupplier((s) => ({ ...s, address: v }))} multiline />
          </div>
          <div className="space-y-2.5 mt-1">
            {/* "다음에도 사용하기" 체크박스: 우리 회사 탭에서만 표시 */}
            {supplierMode === "company" && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={supplierSaveAsDefault}
                  onChange={(e) => setSupplierSaveAsDefault(e.target.checked)}
                  className="h-3.5 w-3.5 accent-sky-aqua rounded"
                />
                <span className="text-[11px] text-gray-500">다음 견적서에도 이 정보 사용하기</span>
              </label>
            )}
            <button
              onClick={async () => {
                setSupplierDialogOpen(false)
                // 1. "우리 회사" 탭 + 체크 ON → settings 업데이트 (다음 신규 견적에 반영)
                if (supplierMode === "company" && supplierSaveAsDefault) {
                  try {
                    await fetch("/api/settings", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        company_name: supplier.companyName,
                        biz_number: supplier.bizNumber,
                        ceo_name: supplier.ceoName,
                        email: supplier.email,
                        address: supplier.address,
                      }),
                    })
                    setBusinessSettings((s) => ({
                      ...s,
                      companyName: supplier.companyName,
                      bizNumber: supplier.bizNumber,
                      ceoName: supplier.ceoName,
                      email: supplier.email,
                      address: supplier.address,
                    }))
                  } catch { /* 무시 */ }
                }
                // 2. 모드/체크 관계없이 현재 값을 항상 이 견적서에 스냅샷 저장
                if (savedIdRef.current) {
                  fetch("/api/quotes", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: savedIdRef.current,
                      supplier_company_name: supplier.companyName || null,
                      supplier_biz_number: supplier.bizNumber || null,
                      supplier_ceo_name: supplier.ceoName || null,
                      supplier_email: supplier.email || null,
                      supplier_address: supplier.address || null,
                      supplier_manager: supplier.manager || null,
                      supplier_manager_phone: supplier.managerPhone || null,
                    }),
                  }).then((res) => { if (res.ok) onSaved() })
                }
              }}
              type="button"
              className="w-full py-2 text-xs font-medium rounded-lg bg-sky-aqua text-white hover:bg-sky-aqua/80 transition-colors"
            >
              확인
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 수신자 정보 Dialog */}
      <Dialog open={receiverDialogOpen} onOpenChange={setReceiverDialogOpen}>
        <DialogContent className="sm:max-w-[360px] p-5 gap-3" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="space-y-0.5">
            <div className="flex items-center justify-between">
              <DialogTitle className="font-sans text-sm font-semibold">수신자 정보</DialogTitle>
              {/* 고객 정보 불러오기 버튼 (고객이 연결된 경우에만 표시) */}
              {customerData && (
                <button
                  type="button"
                  onClick={() => setReceiver({
                    companyName: customerData.company_name || "",
                    bizNumber: customerData.business_number || "",
                    recipientName: customerData.contact_name || "",
                    email: customerData.email || "",
                    address: customerData.address || "",
                    phone: customerData.phone || "",
                  })}
                  className="flex items-center gap-1 text-[10px] text-sky-aqua hover:text-sky-aqua/80 transition-colors"
                >
                  <Building2 className="h-3 w-3" />
                  고객 정보 불러오기
                </button>
              )}
            </div>
            <DialogDescription className="text-[11px] text-gray-400">수신자 정보를 입력하세요</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            <DialogField label="회사명" required value={receiver.companyName}
              onChange={(v) => setReceiver((s) => ({ ...s, companyName: v }))} />
            <DialogField label="사업자 번호" value={receiver.bizNumber}
              onChange={(v) => setReceiver((s) => ({ ...s, bizNumber: v }))} />
            <DialogField label="수신자" value={receiver.recipientName}
              onChange={(v) => setReceiver((s) => ({ ...s, recipientName: v }))} />
            <DialogField label="이메일" value={receiver.email}
              onChange={(v) => setReceiver((s) => ({ ...s, email: v }))} />
            <DialogField label="소재지" value={receiver.address}
              onChange={(v) => setReceiver((s) => ({ ...s, address: v }))} multiline />
            <DialogField label="연락처" value={receiver.phone}
              onChange={(v) => setReceiver((s) => ({ ...s, phone: v }))} placeholder="010-0000-0000" />
          </div>
          <button onClick={() => setReceiverDialogOpen(false)} type="button"
            className="w-full mt-1 py-2 text-xs font-medium rounded-lg bg-sky-aqua text-white hover:bg-sky-aqua/80 transition-colors">
            확인
          </button>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 AlertDialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[360px] p-6">
          <AlertDialogHeader className="space-y-2">
            <div className="flex items-center justify-center w-11 h-11 rounded-full bg-soft-blush/20 mx-auto mb-1">
              <Trash2 className="h-5 w-5 text-soft-blush" />
            </div>
            <AlertDialogTitle className="font-sans text-center text-base font-semibold">
              견적서를 삭제하시겠어요?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-[12px] text-gray-400">
              삭제된 견적서는 복구할 수 없습니다.<br />
              {quotation?.quotation_number && (
                <span className="font-medium text-gray-500">{quotation.quotation_number}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 mt-4 sm:flex-row">
            <button
              onClick={() => setDeleteDialogOpen(false)}
              className="flex-1 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 py-2 text-xs font-medium rounded-lg bg-soft-blush text-white hover:bg-[#e8b8b7] transition-colors disabled:opacity-50"
            >
              {isDeleting ? "삭제 중..." : "삭제하기"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 견적 담당 Dialog */}
      <Dialog open={managerDialogOpen} onOpenChange={(v) => { setManagerDialogOpen(v); if (v) setManagerSaveAsDefault(true) }}>
        <DialogContent className="sm:max-w-[360px] p-5 gap-3" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="space-y-0.5">
            <DialogTitle className="font-sans text-sm font-semibold">견적 담당</DialogTitle>
            <DialogDescription className="text-[11px] text-gray-400">
              {managerMode === "default" ? "주 사용자 정보가 모든 견적서에 적용됩니다" : "이 견적서에만 적용되는 담당자 정보입니다"}
            </DialogDescription>
          </DialogHeader>
          {/* 모드 토글 */}
          <div className="flex gap-1.5 p-1 bg-gray-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setManagerMode("default")
                setSupplier((s) => ({ ...s, manager: businessSettings.manager, managerPhone: businessSettings.managerPhone }))
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                managerMode === "default"
                  ? "bg-white text-sky-aqua shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Building2 className="h-3 w-3" />
              주 사용자
            </button>
            <button
              type="button"
              onClick={() => {
                setManagerMode("custom")
                setSupplier((s) => ({ ...s, manager: "", managerPhone: "", managerEmail: "" }))
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                managerMode === "custom"
                  ? "bg-white text-sky-aqua shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <PenLine className="h-3 w-3" />
              직접 입력
            </button>
          </div>
          <div className="space-y-2.5">
            <DialogField label="담당자" value={supplier.manager}
              onChange={(v) => setSupplier((s) => ({ ...s, manager: v }))} />
            <DialogField label="연락처" value={supplier.managerPhone}
              onChange={(v) => setSupplier((s) => ({ ...s, managerPhone: v }))} placeholder="010-0000-0000" />
            <DialogField label="이메일" value={supplier.managerEmail}
              onChange={(v) => setSupplier((s) => ({ ...s, managerEmail: v }))} placeholder="example@email.com" />
          </div>
          <div className="space-y-2.5 mt-1">
            {/* "다음에도 사용하기" 체크박스: 주 사용자 탭에서만 표시 */}
            {managerMode === "default" && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={managerSaveAsDefault}
                  onChange={(e) => setManagerSaveAsDefault(e.target.checked)}
                  className="h-3.5 w-3.5 accent-sky-aqua rounded"
                />
                <span className="text-[11px] text-gray-500">다음 견적서에도 이 정보 사용하기</span>
              </label>
            )}
            <button
              onClick={async () => {
                setManagerDialogOpen(false)
                // 1. "주 사용자" 탭 + 체크 ON → settings 업데이트 (다음 신규 견적에 반영)
                if (managerMode === "default" && managerSaveAsDefault) {
                  try {
                    await fetch("/api/settings", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ manager: supplier.manager, manager_phone: supplier.managerPhone, manager_email: supplier.managerEmail }),
                    })
                    setBusinessSettings((s) => ({ ...s, manager: supplier.manager, managerPhone: supplier.managerPhone, managerEmail: supplier.managerEmail }))
                  } catch { /* 무시 */ }
                }
                // 2. 모드/체크 관계없이 현재 값을 항상 이 견적서에 스냅샷 저장
                if (savedIdRef.current) {
                  fetch("/api/quotes", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: savedIdRef.current,
                      supplier_manager: supplier.manager || null,
                      supplier_manager_phone: supplier.managerPhone || null,
                      supplier_manager_email: supplier.managerEmail || null,
                    }),
                  }).then((res) => { if (res.ok) onSaved() })
                }
              }}
              type="button"
              className="w-full py-2 text-xs font-medium rounded-lg bg-sky-aqua text-white hover:bg-sky-aqua/80 transition-colors"
            >
              확인
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}

// ===================================================
// 좌측: 품목 테이블
// ===================================================
function ItemsTable({ items, updateItem, addRow, removeRow }: {
  items: ItemRow[]
  updateItem: (index: number, field: keyof ItemRow, value: string | number) => void
  addRow: () => void
  removeRow: (index: number) => void
}) {
  return (
    <div>
      {/* 헤더 */}
      <div className={`grid grid-cols-[30px_190px_180px_42px_50px_120px_128px_54px] bg-sky-aqua/10 border-y border-sky-aqua/20 ${HEADER_H}`}>
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">#</div>
        <div className="px-2 flex items-center justify-center text-[11px] font-medium text-gray-600">품목명</div>
        <div className="px-2 flex items-center justify-center text-[11px] font-medium text-gray-600">규격</div>
        <div className="px-2 flex items-center justify-center text-[11px] font-medium text-gray-600">단위</div>
        <div className="px-2 flex items-center justify-end text-[11px] font-medium text-gray-600">수량</div>
        <div className="px-2 flex items-center justify-end text-[11px] font-medium text-gray-600">단가</div>
        <div className="px-2 flex items-center justify-end text-[11px] font-medium text-gray-600">금액</div>
        <div />
      </div>
      {/* 행 */}
      {items.map((item, idx) => (
        <div key={idx} className={`grid grid-cols-[30px_190px_180px_42px_50px_120px_128px_54px] border-b border-gray-100 hover:bg-gray-50 transition-colors ${ROW_H}`}>
          <div className="flex items-center justify-center text-xs text-gray-500">{idx + 1}</div>
          <CellInput value={item.item_name} onChange={(v) => updateItem(idx, "item_name", v)} placeholder="품목명 *" center />
          <CellInput value={item.specification} onChange={(v) => updateItem(idx, "specification", v)} placeholder="규격" center />
          <CellInput value={item.unit} onChange={(v) => updateItem(idx, "unit", v)} placeholder="식" center />
          <CellNumber value={item.quantity} onChange={(v) => updateItem(idx, "quantity", v)} />
          <div className="flex items-center justify-end px-2 text-xs text-gray-900 tabular-nums bg-gray-50">
            {item.unit_price.toLocaleString()}
          </div>
          <div className="flex items-center justify-end px-2 text-xs text-gray-900 tabular-nums bg-gray-50">
            {(item.quantity * item.unit_price).toLocaleString()}
          </div>
          <div className="flex items-center justify-center">
            <button onClick={() => removeRow(idx)} disabled={items.length <= 1}
              className="p-0.5 rounded text-gray-300 hover:text-soft-blush hover:bg-soft-blush/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      ))}
      <div className="px-4 py-2">
        <button onClick={addRow}
          className="w-full py-2 flex items-center justify-center gap-1.5 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg hover:border-sky-aqua/50 hover:text-sky-aqua hover:bg-sky-aqua/5 transition-all">
          <Plus className="h-4 w-4" /> 행 추가
        </button>
      </div>
    </div>
  )
}

// ===================================================
// 우측: 내부 단가 행 (# + 단가 컬럼)
// ===================================================
// 내부 단가 그리드 템플릿: #/반출가/DC율/매입단가/매입금액/MG율/제안가/이윤/장려금/장려금액
// 금액 열은 넓게(76px), 율 열은 좁게(48px)
const PRICING_COLS = "grid-cols-[24px_92px_48px_76px_80px_48px_76px_76px_48px_80px]"

function PricingRows({ items, updateItem, roundUp, onToggleRoundUp }: {
  items: ItemRow[]
  updateItem: (index: number, field: keyof ItemRow, value: string | number) => void
  roundUp?: boolean
  onToggleRoundUp?: () => void
}) {
  return (
    <div>
      {/* 헤더 - 10개 열 */}
      <div className={`relative grid ${PRICING_COLS} bg-sky-aqua/10 border-y border-sky-aqua/20 ${HEADER_H}`}>
        {/* 제안가 열 가운데 위에 단위↑ 토글 (absolute로 행 높이에 영향 없음) */}
        {onToggleRoundUp && (
          <button onClick={onToggleRoundUp}
            className={`absolute -top-[13px] z-10 text-[9px] leading-none px-1.5 py-[2px] rounded-sm transition-all ${
              roundUp
                ? "bg-sky-aqua/15 text-sky-aqua"
                : "bg-gray-100 text-gray-400"
            }`}
            style={{ left: 352, width: 76, textAlign: "center" }}>
            {roundUp ? "단위↑ ON" : "단위↑ OFF"}
          </button>
        )}
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">#</div>
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">반출가</div>
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">DC율</div>
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">매입단가</div>
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">매입금액</div>
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">MG율</div>
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">제안가</div>
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">이윤</div>
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">장려금</div>
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">장려금액</div>
      </div>
      {/* 데이터 행 */}
      {items.map((item, idx) => {
        const incentiveAmount = Math.round(item.purchase_amount * item.incentive_rate / 100)
        return (
          <div key={idx} className={`grid ${PRICING_COLS} border-b border-gray-100 hover:bg-white/50 transition-colors ${ROW_H}`}>
            <div className="flex items-center justify-center text-xs text-gray-500">{idx + 1}</div>
            <CellNumber value={item.retrieval_price} onChange={(v) => updateItem(idx, "retrieval_price", v)} />
            <CellPercent value={item.discount_rate} onChange={(v) => updateItem(idx, "discount_rate", v)} />
            <div className="flex items-center justify-end px-1 text-xs text-gray-900 tabular-nums bg-gray-100/60">{item.purchase_unit_price.toLocaleString()}</div>
            <div className="flex items-center justify-end px-1 text-xs text-gray-900 tabular-nums bg-gray-100/60">{item.purchase_amount.toLocaleString()}</div>
            <CellPercent value={item.margin_rate} onChange={(v) => updateItem(idx, "margin_rate", v)} />
            <div className="flex items-center justify-end px-1 text-xs text-gray-900 tabular-nums bg-gray-100/60">{item.unit_price.toLocaleString()}</div>
            <div className={`flex items-center justify-end px-1 text-xs font-semibold tabular-nums bg-gray-100/60 ${item.profit < 0 ? "text-soft-blush" : "text-muted-teal"}`}>{item.profit.toLocaleString()}</div>
            <CellPercent value={item.incentive_rate} onChange={(v) => updateItem(idx, "incentive_rate", v)} colorClass="text-muted-teal" />
            <div className="flex items-center justify-end px-1 text-xs font-semibold text-muted-teal tabular-nums bg-gray-100/60">{incentiveAmount.toLocaleString()}</div>
          </div>
        )
      })}
      {/* 자동계산 요약 행 */}
      {items.some((r) => r.retrieval_price > 0) && (
        <div className="px-2 py-1.5 bg-white/50 border-t border-gray-200">
          {items.filter((r) => r.item_name.trim()).map((item, idx) => (
            <div key={idx} className="flex justify-between text-[10px] py-0.5">
              <span className="text-gray-500 truncate max-w-[80px]">{idx + 1}. {item.item_name}</span>
              <span className="text-gray-500 tabular-nums">
                매입 <span className="font-medium text-gray-900">{item.purchase_unit_price.toLocaleString()}</span>
                {" → "}
                제안 <span className="font-semibold text-gray-900">{item.unit_price.toLocaleString()}</span>
                {" "}
                (<span className="font-medium text-muted-teal">+{item.profit.toLocaleString()}</span>)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ===================================================
// 공용 서브 컴포넌트
// ===================================================
function InfoPair({ label, value, wrap }: { label: string; value: string; wrap?: boolean }) {
  return (
    <div className={`flex gap-3 text-xs ${wrap ? "items-start" : "items-center"}`}>
      <span className="text-gray-400 w-[56px] shrink-0">{label}</span>
      <span className="text-gray-700 break-words">{value}</span>
    </div>
  )
}

function DialogField({ label, value, onChange, required, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void
  required?: boolean; placeholder?: string; multiline?: boolean
}) {
  return (
    <div className={`flex gap-3 ${multiline ? "items-start" : "items-center"}`}>
      <label className={`text-[11px] text-gray-400 w-[60px] shrink-0 ${multiline ? "pt-1.5" : ""}`}>
        {label}{required && <span className="text-soft-blush ml-0.5">*</span>}
      </label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || ""} rows={2}
          className="flex-1 text-xs text-gray-700 bg-transparent border-0 border-b border-gray-100 px-0 py-1.5 focus:outline-none focus:border-gray-400 transition-colors placeholder:text-gray-300 resize-none leading-relaxed" />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || ""}
          className="flex-1 text-xs text-gray-700 bg-transparent border-0 border-b border-gray-100 px-0 py-1.5 focus:outline-none focus:border-gray-400 transition-colors placeholder:text-gray-300" />
      )}
    </div>
  )
}

function SummaryRow({ label, value, bold, dimmed }: { label: string; value: number; bold?: boolean; dimmed?: boolean }) {
  // 단위절사 등 특수 행: 음수면 "-₩XXX", 0이면 "-"
  const display = dimmed
    ? value < 0 ? `-${formatCurrency(-value)}` : value === 0 ? "-" : formatCurrency(value)
    : formatCurrency(value)
  return (
    <div className="flex justify-between text-xs">
      <span className={dimmed ? "text-gray-400" : "text-gray-500"}>{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold text-gray-900" : dimmed ? "text-gray-400" : "font-medium"}`}>{display}</span>
    </div>
  )
}

function MiniRow({ label, value, highlight, percent }: { label: string; value: number; highlight?: boolean; percent?: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className={`tabular-nums ${highlight ? "font-bold text-muted-teal" : "font-medium text-gray-700"}`}>
        {percent ? `${percent}%` : formatCurrency(value)}
      </span>
    </div>
  )
}

function CellInput({ value, onChange, placeholder, center }: {
  value: string; onChange: (v: string) => void; placeholder?: string; center?: boolean
}) {
  return (
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full h-full px-2 text-xs bg-white border-0 focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder:text-gray-300 ${center ? "text-center" : ""}`} />
  )
}

function CellNumber({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [displayVal, setDisplayVal] = useState(value > 0 ? value.toLocaleString() : "")
  useEffect(() => { setDisplayVal(value > 0 ? value.toLocaleString() : "") }, [value])
  return (
    <input ref={ref} type="text" inputMode="numeric"
      value={displayVal}
      onChange={(e) => {
        // 숫자 외 문자 제거 후 쉼표 포맷팅 실시간 적용
        const raw = e.target.value.replace(/[^0-9]/g, "")
        const formatted = raw ? Number(raw).toLocaleString() : ""
        setDisplayVal(formatted)
        onChange(Number(raw) || 0)
      }}
      onFocus={() => { setTimeout(() => ref.current?.select(), 0) }}
      className="w-full h-full px-2 text-xs text-right bg-white border-0 focus:outline-none focus:ring-1 focus:ring-gray-300 tabular-nums" />
  )
}

function CellPercent({ value, onChange, colorClass }: { value: number; onChange: (v: number) => void; colorClass?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [edit, setEdit] = useState(String(value))
  useEffect(() => { if (!focused) setEdit(String(value)) }, [value, focused])
  return (
    <input ref={ref} type="text" inputMode="numeric"
      value={focused ? edit : (value ? `${value}%` : "")}
      onChange={(e) => { const r = e.target.value.replace(/[^0-9.\-]/g, ""); setEdit(r); onChange(Number(r) || 0) }}
      onFocus={() => { setFocused(true); setEdit(String(value)); setTimeout(() => ref.current?.select(), 0) }}
      onBlur={() => setFocused(false)} placeholder="%"
      className={`w-full h-full px-2 text-xs text-right bg-white border-0 focus:outline-none focus:ring-1 focus:ring-gray-300 tabular-nums placeholder:text-gray-300 ${colorClass || ""}`} />
  )
}
