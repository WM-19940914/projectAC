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
  Package, Wrench, Pencil, Check, Loader2,
} from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
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
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const savedIdRef = useRef<string | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoadRef = useRef(true)
  // doSave의 최신 참조를 유지 (닫힐 때 stale closure 방지)
  const doSaveRef = useRef<(isAuto?: boolean) => Promise<boolean>>(() => Promise.resolve(false))
  // 공급자 정보
  const [supplier, setSupplier] = useState({
    companyName: "", bizNumber: "", ceoName: "",
    email: "", address: "", manager: "", managerPhone: "",
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

  useEffect(() => {
    if (open) {
      initialLoadRef.current = true
      if (quotation) {
        savedIdRef.current = quotation.id
        setTitle(quotation.title)
        setQuotationDate(quotation.quotation_date)
        setNotes(quotation.notes || "")
        // 수신자 정보 매핑
        setReceiver({
          companyName: customerName || "",
          bizNumber: "",
          recipientName: quotation.recipient || quotation.contact_person || "",
          email: "",
          address: quotation.site_name || "",
          phone: quotation.contact_phone || "",
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
      } else {
        savedIdRef.current = null
        setTitle(initialTitle || ""); setQuotationDate(new Date().toISOString().split("T")[0])
        setNotes(""); setEquipItems([emptyRow()]); setInstallItems([emptyRow()])
        setPricingOpen(false)
        setSupplier({ companyName: "", bizNumber: "", ceoName: "", email: "", address: "", manager: "", managerPhone: "" })
        // 고객 데이터로 수신자 자동 채우기
        setReceiver({
          companyName: customerData?.company_name || customerName || "",
          bizNumber: customerData?.business_number || "",
          recipientName: customerData?.contact_name || "",
          email: customerData?.email || "",
          address: customerData?.address || "",
          phone: customerData?.phone || "",
        })
      }
      setSaveError(""); setAutoSaveStatus("idle")
    } else {
      // Sheet 닫힐 때: 대기 중인 자동저장이 있으면 즉시 실행
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
        // 저장된 견적이 있을 때만 마지막 변경분 저장 (ref로 최신 상태 사용)
        if (savedIdRef.current) {
          doSaveRef.current(true)
        }
      }
    }
  }, [open, quotation, customerName, customerData, initialTitle])

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
  const taxAmount = Math.round(totalAmount * 0.1)
  const grandTotal = totalAmount + taxAmount
  const equipPurchaseTotal = equipItems.reduce((s, r) => s + r.purchase_amount, 0)
  const installPurchaseTotal = installItems.reduce((s, r) => s + r.purchase_amount, 0)
  const totalPurchase = equipPurchaseTotal + installPurchaseTotal
  const totalProfit = equipItems.reduce((s, r) => s + r.profit, 0) + installItems.reduce((s, r) => s + r.profit, 0)

  // 핵심 저장 로직 (자동저장 / 수동저장 공용)
  // 저장 payload 생성
  const buildPayload = useCallback(() => {
    const validEquip = equipItems.filter((i) => i.item_name.trim())
    const validInstall = installItems.filter((i) => i.item_name.trim())
    if (!title.trim() || (validEquip.length === 0 && validInstall.length === 0)) return null
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
      notes: notes || null, items: allItems,
    }
  }, [title, quotationDate, requestId, customerId, receiver, notes, equipItems, installItems])

  const doSave = useCallback(async (isAuto = false): Promise<boolean> => {
    const payload = buildPayload()
    if (!payload) {
      if (!isAuto) setSaveError(!title.trim() ? "견적서 제목을 입력해주세요" : "최소 1개의 품목을 입력해주세요")
      return false
    }
    const isUpdate = !!savedIdRef.current
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
  useEffect(() => {
    // 초기 로드 시에는 자동저장 스킵
    if (initialLoadRef.current) {
      initialLoadRef.current = false
      return
    }
    if (!open) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => { doSave(true) }, 2000)
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current) }
  }, [title, quotationDate, notes, equipItems, installItems, receiver, supplier, open, doSave])

  const handleDelete = async () => {
    if (!quotation) return
    if (!confirm("이 견적서를 삭제하시겠습니까?")) return
    setIsDeleting(true)
    try {
      const res = await fetch("/api/quotes", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quotation.id }),
      })
      if (!res.ok) { const r = await res.json(); alert("삭제 실패: " + (r.error || "")); return }
      onSaved(); onClose()
    } catch (e: unknown) {
      alert("네트워크 오류: " + (e instanceof Error ? e.message : "알 수 없는 오류"))
    } finally { setIsDeleting(false) }
  }

  // Sheet 너비: 내부 단가 보이면 우측으로 확장 (엑셀 열 숨기기/보이기)
  // A4 용지 폭 기준: 794px (210mm @ 96DPI) + 패딩 px-6*2(48px) = 842px
  const sheetW = pricingOpen ? "w-[1500px] !max-w-[1500px]" : "w-[842px] !max-w-[842px]"
  // 좌측 콘텐츠 폭 고정 (A4 = 794px) → 단가 열어도 좌측은 변화 없음
  const leftW = pricingOpen ? "w-[794px] shrink-0" : "w-full"

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="left"
        className={`${sheetW} p-0 flex flex-col transition-all duration-300`}
        onInteractOutside={() => onClose()}
      >
        {/* 헤더 */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="font-sans text-lg">
                {quotation ? "견적서 수정" : "새 견적서"}
              </SheetTitle>
              <SheetDescription className="text-xs text-gray-400">
                품목을 입력하고 저장하세요. Tab/Enter로 셀 이동 가능
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2 mr-6">
              {(quotation || savedIdRef.current) && (
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg text-soft-blush hover:text-[#c4807e] hover:bg-soft-blush/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isDeleting ? "삭제 중..." : "삭제하기"}
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

            {/* 기본 정보 */}
            <div className={leftW}>
              <div className="border border-gray-200 rounded-lg">
                <div className="px-4 py-3 bg-gray-50/50">
                  <span className="font-sans font-semibold text-sm">기본 정보</span>
                </div>
                <div className="px-4 pb-4">
                  <div className="pt-2 space-y-3">
                    {/* 견적서 제목 + 견적일 + 견적번호 */}
                    <div className="flex items-center gap-3">
                      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                        placeholder="견적서 제목을 입력하세요 *"
                        className="flex-1 text-sm font-semibold bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-gray-400 focus:outline-none px-0 py-1 placeholder:text-gray-300" />
                      <input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)}
                        className="text-xs text-gray-500 bg-transparent border-0 focus:outline-none shrink-0" />
                      {quotation && (
                        <span className="text-[10px] text-gray-400 shrink-0">No. {quotation.quotation_number}</span>
                      )}
                    </div>

                    {/* 견적 담당 / 연락처 - 읽기전용 + 연필 */}
                    <div className="flex items-center gap-3 text-[11px] text-gray-400">
                      <span>견적 담당</span>
                      <span className="text-gray-600">{supplier.manager || "-"}</span>
                      <span>연락처</span>
                      <span className="text-gray-600">{supplier.managerPhone || "-"}</span>
                      <button onClick={() => setManagerDialogOpen(true)} type="button">
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
                          {supplier.companyName || "-"}
                        </p>
                        <div className="space-y-1.5">
                          <InfoPair label="사업자" value={supplier.bizNumber || "-"} />
                          <InfoPair label="대표자" value={supplier.ceoName || "-"} />
                          <InfoPair label="이메일" value={supplier.email || "-"} />
                          <InfoPair label="주소" value={supplier.address || "-"} />
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
                          <InfoPair label="사업자" value={receiver.bizNumber || "-"} />
                          <InfoPair label="수신자" value={receiver.recipientName || "-"} />
                          <InfoPair label="이메일" value={receiver.email || "-"} />
                          <InfoPair label="주소" value={receiver.address || "-"} />
                          <InfoPair label="연락처" value={receiver.phone || "-"} />
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
                    <span className="text-xs text-gray-400 font-normal">({equipItems.filter((i) => i.item_name.trim()).length}건)</span>
                    {equipTotal > 0 && <span className="text-xs text-sky-aqua font-semibold ml-auto mr-2">{formatCurrency(equipTotal)}</span>}
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
                    <span className="text-xs text-gray-400 font-normal">({installItems.filter((i) => i.item_name.trim()).length}건)</span>
                    {installTotal > 0 && <span className="text-xs text-tropical-teal font-semibold ml-auto mr-2">{formatCurrency(installTotal)}</span>}
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
                      <div className="w-[300px] space-y-2 border border-gray-200 rounded-lg p-4 bg-gray-50/30">
                        <SummaryRow label="장비 소계" value={equipTotal} />
                        <SummaryRow label="설치비 소계" value={installTotal} />
                        <div className="border-t border-gray-200 pt-2"><SummaryRow label="합계" value={totalAmount} bold /></div>
                        <SummaryRow label="VAT (10%)" value={taxAmount} />
                        <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
                          <span className="font-semibold text-gray-900">최종견적</span>
                          <span className="font-bold text-sky-aqua tabular-nums">{formatCurrency(grandTotal)}</span>
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
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent className="sm:max-w-[360px] p-5 gap-3">
          <DialogHeader className="space-y-0.5">
            <DialogTitle className="font-sans text-sm font-semibold">공급자 정보</DialogTitle>
            <DialogDescription className="text-[11px] text-gray-400">우리 회사 정보를 입력하세요</DialogDescription>
          </DialogHeader>
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
              onChange={(v) => setSupplier((s) => ({ ...s, address: v }))} />
          </div>
          <button onClick={() => setSupplierDialogOpen(false)} type="button"
            className="w-full mt-1 py-2 text-xs font-medium rounded-lg bg-sky-aqua text-white hover:bg-sky-aqua/80 transition-colors">
            확인
          </button>
        </DialogContent>
      </Dialog>

      {/* 수신자 정보 Dialog */}
      <Dialog open={receiverDialogOpen} onOpenChange={setReceiverDialogOpen}>
        <DialogContent className="sm:max-w-[360px] p-5 gap-3">
          <DialogHeader className="space-y-0.5">
            <DialogTitle className="font-sans text-sm font-semibold">수신자 정보</DialogTitle>
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
              onChange={(v) => setReceiver((s) => ({ ...s, address: v }))} />
            <DialogField label="연락처" value={receiver.phone}
              onChange={(v) => setReceiver((s) => ({ ...s, phone: v }))} placeholder="010-0000-0000" />
          </div>
          <button onClick={() => setReceiverDialogOpen(false)} type="button"
            className="w-full mt-1 py-2 text-xs font-medium rounded-lg bg-sky-aqua text-white hover:bg-sky-aqua/80 transition-colors">
            확인
          </button>
        </DialogContent>
      </Dialog>

      {/* 견적 담당 Dialog */}
      <Dialog open={managerDialogOpen} onOpenChange={setManagerDialogOpen}>
        <DialogContent className="sm:max-w-[360px] p-5 gap-3">
          <DialogHeader className="space-y-0.5">
            <DialogTitle className="font-sans text-sm font-semibold">견적 담당</DialogTitle>
            <DialogDescription className="text-[11px] text-gray-400">견적 담당자 정보를 입력하세요</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            <DialogField label="담당자" value={supplier.manager}
              onChange={(v) => setSupplier((s) => ({ ...s, manager: v }))} />
            <DialogField label="연락처" value={supplier.managerPhone}
              onChange={(v) => setSupplier((s) => ({ ...s, managerPhone: v }))} placeholder="010-0000-0000" />
          </div>
          <button onClick={() => setManagerDialogOpen(false)} type="button"
            className="w-full mt-1 py-2 text-xs font-medium rounded-lg bg-sky-aqua text-white hover:bg-sky-aqua/80 transition-colors">
            확인
          </button>
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
          <CellNumber value={item.unit_price} onChange={(v) => updateItem(idx, "unit_price", v)} />
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
const PRICING_COLS = "grid-cols-[24px_76px_48px_76px_80px_48px_76px_76px_48px_80px]"

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
            <div className="flex items-center justify-end px-1 text-xs text-gray-900 tabular-nums bg-gray-100/60">{item.proposed_price.toLocaleString()}</div>
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
                제안 <span className="font-semibold text-gray-900">{item.proposed_price.toLocaleString()}</span>
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
function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-gray-400 w-[56px] shrink-0">{label}</span>
      <span className="text-gray-700">{value}</span>
    </div>
  )
}

function DialogField({ label, value, onChange, required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  required?: boolean; placeholder?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-[11px] text-gray-400 w-[60px] shrink-0">
        {label}{required && <span className="text-soft-blush ml-0.5">*</span>}
      </label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "-"}
        className="flex-1 text-xs text-gray-700 bg-transparent border-0 border-b border-gray-100 px-0 py-1.5 focus:outline-none focus:border-gray-400 transition-colors placeholder:text-gray-300" />
    </div>
  )
}

function SummaryRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold" : "font-medium"}`}>{formatCurrency(value)}</span>
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
  const [focused, setFocused] = useState(false)
  const [edit, setEdit] = useState(String(value))
  useEffect(() => { if (!focused) setEdit(String(value)) }, [value, focused])
  return (
    <input ref={ref} type="text" inputMode="numeric"
      value={focused ? edit : value.toLocaleString()}
      onChange={(e) => { const r = e.target.value.replace(/[^0-9.]/g, ""); setEdit(r); onChange(Number(r) || 0) }}
      onFocus={() => { setFocused(true); setEdit(String(value)); setTimeout(() => ref.current?.select(), 0) }}
      onBlur={() => setFocused(false)}
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
