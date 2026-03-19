"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Plus, Trash2, PanelRightOpen, PanelRightClose,
  Package, Wrench, Pencil, Check, Loader2, Building2, PenLine, ImageIcon,
  Search, List, Eraser, X as XIcon, FileText, Download, FileSpreadsheet,
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
import { exportQuotePDF, exportQuoteExcel, type QuoteExportData } from "@/lib/quote-export"
import type { QuotationWithItems, QuotationItem } from "@/types"
import { Input } from "@/components/ui/input"

// ----- 가격표 아이템 타입 -----
interface PriceItem {
  id: string
  category: string
  sub_category: string | null
  product_name: string
  specification: string | null
  unit: string | null
  unit_price: number
  tags: string | null
  notes: string | null
}

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

/** 숫자 → 한글 금액 (일이삼...만억) — 엑셀 NUMBERSTRING 대응 */
function numberToKorean(n: number): string {
  if (n === 0) return "영"
  const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"]
  const units = ["", "십", "백", "천"]
  const bigs = ["", "만", "억", "조"]
  const abs = Math.abs(Math.floor(n))
  const str = String(abs)
  const len = str.length
  let result = ""
  for (let i = 0; i < len; i++) {
    const d = Number(str[i])
    const pos = len - 1 - i
    const unitIdx = pos % 4
    const bigIdx = Math.floor(pos / 4)
    if (d > 0) {
      result += (d === 1 && unitIdx > 0 ? "" : digits[d]) + units[unitIdx]
    }
    if (unitIdx === 0 && result.length > 0) result += bigs[bigIdx]
  }
  return (n < 0 ? "마이너스" : "") + result
}

function emptyRow(): ItemRow {
  return {
    item_name: "", specification: "", unit: "",
    quantity: 0, unit_price: 0, amount: 0, memo: "",
    retrieval_price: 0, discount_rate: 0, purchase_unit_price: 0,
    purchase_amount: 0, margin_rate: 0, proposed_price: 0,
    profit: 0, incentive_rate: 0,
  }
}

function recalcPricing(row: ItemRow, roundUp = true): ItemRow {
  const next = { ...row }
  next.purchase_unit_price = Math.round(next.retrieval_price * (1 - next.discount_rate / 100))
  next.purchase_amount = next.purchase_unit_price * next.quantity
  // 제안가 = 매입단가 + (매입단가 × MG율%) — 엑셀 템플릿 기준
  next.proposed_price = Math.round(next.purchase_unit_price + (next.purchase_unit_price * next.margin_rate / 100))
  next.unit_price = roundUp ? Math.ceil(next.proposed_price / 1000) * 1000 : next.proposed_price
  next.amount = next.quantity * next.unit_price
  next.profit = next.amount - next.purchase_amount
  return next
}

export default function QuoteEditorSheet({
  open, onClose, requestId, customerId, customerName, customerData, initialTitle, quotation, onSaved,
}: QuoteEditorSheetProps) {
  const [title, setTitle] = useState("")
  const [quotationDate, setQuotationDate] = useState(new Date().toLocaleDateString("sv-SE"))
  const [notes, setNotes] = useState("")
  // 기본 10행씩 (A4 1페이지 기준, 행 추가로 최대 20행까지 가능)
  const [equipItems, setEquipItems] = useState<ItemRow[]>(Array.from({ length: 10 }, () => emptyRow()))
  const [installItems, setInstallItems] = useState<ItemRow[]>(Array.from({ length: 10 }, () => emptyRow()))
  const [coverItems, setCoverItems] = useState<ItemRow[]>([])
  // 갑지 고정행 구분/내용 수정용 상태
  const [coverEquipLabel, setCoverEquipLabel] = useState({ name: "에어컨", desc: "장비 내역" })
  const [coverInstallLabel, setCoverInstallLabel] = useState({ name: "설치비", desc: "설치비 내역" })
  // 사용자 추가 내역서 탭 (최대 5개)
  const [customSheets, setCustomSheets] = useState<{ id: string; name: string; items: ItemRow[] }[]>([])
  const [addingSheet, setAddingSheet] = useState(false)
  const [newSheetName, setNewSheetName] = useState("")
  const [pricingOpen, setPricingOpen] = useState(false)
  const [roundUp, setRoundUp] = useState(true)
  const [truncationInput, setTruncationInput] = useState("")  // 단위절사 직접 입력
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [pdfExporting, setPdfExporting] = useState(false)
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
  // 회사 로고
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  // 회사 도장
  const [stampUrl, setStampUrl] = useState<string | null>(null)
  const [stampUploading, setStampUploading] = useState(false)
  const stampInputRef = useRef<HTMLInputElement>(null)
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
  // 가격표 피커 상태
  const [pricePickerOpen, setPricePickerOpen] = useState(false)
  const [pricePickerTarget, setPricePickerTarget] = useState<string>("equip")
  const [priceItems, setPriceItems] = useState<PriceItem[]>([])
  const [priceLoaded, setPriceLoaded] = useState(false)
  // 가격표 매칭 실시간 비교 (품목명+규격+반출가가 가격표와 일치하는지)
  const priceMatchSet = useMemo(() => {
    const set = new Set<string>()
    for (const item of priceItems) {
      set.add(`${item.product_name}||${item.specification || ""}||${item.unit_price}`)
    }
    return set
  }, [priceItems])
  const isRowMatched = useCallback((row: ItemRow) => {
    if (!row.item_name.trim() || !priceLoaded) return false
    return priceMatchSet.has(`${row.item_name}||${row.specification}||${row.retrieval_price}`)
  }, [priceMatchSet, priceLoaded])
  // 납기/결제 정보 (갑지용)
  const [deliveryDate, setDeliveryDate] = useState("협의 일정")
  const [deliveryPlace, setDeliveryPlace] = useState("협의 장소")
  const [paymentCondition, setPaymentCondition] = useState("협의 조건")
  const [validUntil, setValidUntil] = useState("견적 후 7일")
  const [faxNumber, setFaxNumber] = useState("02) 711-7807")
  // 견적서 뷰 탭 (네비게이션 전용, autoSave 트리거 안 함)
  const [activeTab, setActiveTab] = useState<string>("simple")
  const activeTabRef = useRef<string>("simple")
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
        // 회사 로고 URL 로드
        if (data.logo_url) setLogoUrl(data.logo_url)
        // 도장 URL 로드
        if (data.stamp_url) setStampUrl(data.stamp_url)
        return settings
      }
    } catch { /* 무시 */ }
    return null
  }, [])

  // 가격표 데이터 로드 (1회만)
  const loadPriceItems = useCallback(async () => {
    if (priceLoaded) return
    try {
      const res = await fetch("/api/price-list")
      if (!res.ok) return
      const { data } = await res.json()
      if (data) {
        setPriceItems(data)
        setPriceLoaded(true)
      }
    } catch { /* 무시 */ }
  }, [priceLoaded])

  useEffect(() => {
    if (open) {
      initialLoadRef.current = true
      // 가격표 데이터 로드 (매칭 비교용)
      loadPriceItems()

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

          // 단위절사 복원: total_amount = 공급가액(단위절사 반영), rawTotal = 아이템 합산
          // 단위절사 = rawTotal - total_amount
          const storedSupply = quotation.total_amount || 0
          const rawTotal = (quotation.items || []).reduce(
            (sum: number, item: QuotationItem) =>
              sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0
          )
          const impliedTruncation = rawTotal - storedSupply
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

          // 납기/결제 정보 복원
          setDeliveryDate((q.delivery_date as string) || "협의 일정")
          setDeliveryPlace((q.delivery_place as string) || "협의 장소")
          setPaymentCondition((q.payment_condition as string) || "협의 조건")
          setValidUntil((q.terms as string) || "견적 후 7일")
          setFaxNumber((q.fax_number as string) || "02) 711-7807")

          const equip: ItemRow[] = []
          const install: ItemRow[] = []
          const cover: ItemRow[] = []
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
            else if (item.category === "갑지") cover.push(row)
            else equip.push(row)
          }
          // 최소 10행 보장 (데이터가 있으면 그 뒤에 빈 행 채움)
          const padRows = (rows: ItemRow[], min = 10) => {
            if (rows.length >= min) return rows
            return [...rows, ...Array.from({ length: min - rows.length }, () => emptyRow())]
          }
          setEquipItems(padRows(equip.length > 0 ? equip : []))
          setInstallItems(padRows(install.length > 0 ? install : []))
          setCoverItems(cover)
          setCustomSheets([])
          setPricingOpen([...equip, ...install].some((r) => r.retrieval_price > 0))
          // 비동기 로드 후 상태 변경이 autoSave 트리거하지 않도록 가드 재설정
          initialLoadRef.current = true
        } else {
          savedIdRef.current = null
          setTitle(initialTitle || ""); setQuotationDate(new Date().toLocaleDateString("sv-SE"))
          setNotes(""); setEquipItems(Array.from({ length: 10 }, () => emptyRow())); setInstallItems(Array.from({ length: 10 }, () => emptyRow())); setCoverItems([]); setCustomSheets([])
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
          // 납기/결제 기본값
          setDeliveryDate("협의 일정"); setDeliveryPlace("협의 장소"); setPaymentCondition("협의 조건")
          setValidUntil("견적 후 7일"); setFaxNumber("02) 711-7807")
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
  }, [open, quotation, customerName, customerData, initialTitle, loadBusinessSettings, loadPriceItems])

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
          ; (row[field] as number) = Number(value) || 0
        } else { ; (row[field] as string) = value as string }
        if (field === "retrieval_price" || field === "discount_rate" || field === "margin_rate" || field === "quantity") {
          next[index] = recalcPricing(row, roundUp)
        } else if (field === "unit_price") { row.amount = row.quantity * row.unit_price; next[index] = row }
        else { next[index] = row }
        return next
      })
    }, [roundUp]
  )

  // 가격표에서 아이템 선택 시 첫 번째 빈 행에 자동 입력
  const applyPriceItem = useCallback((item: PriceItem) => {
    const setItems = pricePickerTarget === "equip" ? setEquipItems : setInstallItems

    setItems((prev) => {
      let emptyIdx = prev.findIndex((r) => !r.item_name.trim())
      if (emptyIdx === -1) {
        emptyIdx = prev.length
        prev = [...prev, emptyRow()]
      }
      const next = [...prev]
      const row = { ...next[emptyIdx] }
      row.item_name = item.product_name
      row.specification = item.specification || ""
      row.unit = item.unit || ""
      row.retrieval_price = item.unit_price
      next[emptyIdx] = recalcPricing(row, roundUp)
      return next
    })
  }, [pricePickerTarget, roundUp])

  // 가격표 피커 열기
  const openPricePicker = useCallback((target: string) => {
    setPricePickerTarget(target)
    setPricePickerOpen(true)
    loadPriceItems()
  }, [loadPriceItems])

  const addRow = useCallback((s: React.Dispatch<React.SetStateAction<ItemRow[]>>) => s((p) => [...p, emptyRow()]), [])

  // 행 초기화: 품목명/규격/단위/반출가 + 계산 필드 전부 리셋 (행 자체는 유지)
  const clearItemRow = useCallback((setItems: React.Dispatch<React.SetStateAction<ItemRow[]>>, index: number) => {
    setItems((prev) => {
      const next = [...prev]
      next[index] = emptyRow()
      return next
    })
  }, [])
  const removeRow = useCallback((s: React.Dispatch<React.SetStateAction<ItemRow[]>>, items: ItemRow[], i: number) => {
    if (items.length <= 1) return; s((p) => p.filter((_, j) => j !== i))
  }, [])

  // 엑셀 붙여넣기: 포커스된 셀 위치 기준으로 클립보드 데이터를 채움
  // colFields: 편집 가능한 열 순서 (품목명=0, 규격=1, 단위=2, 수량=3)
  const PASTE_COL_FIELDS: (keyof ItemRow)[] = ["item_name", "specification", "unit", "quantity"]

  const handlePasteCells = useCallback((
    setItems: React.Dispatch<React.SetStateAction<ItemRow[]>>,
    startRow: number,
    startCol: number,
    data: string[][]  // 2차원 배열: [행][열]
  ) => {
    setItems((prev) => {
      const next = [...prev]
      for (let r = 0; r < data.length; r++) {
        const targetRow = startRow + r
        // 행이 부족하면 추가
        while (targetRow >= next.length) {
          next.push(emptyRow())
        }
        const row = { ...next[targetRow] }
        for (let c = 0; c < data[r].length; c++) {
          const targetCol = startCol + c
          if (targetCol >= PASTE_COL_FIELDS.length) break
          const field = PASTE_COL_FIELDS[targetCol]
          const val = data[r][c].trim()
          if (field === "quantity") {
            // 숫자 필드: 콤마/공백 제거 후 숫자 변환
            ; (row as Record<string, string | number>)[field] = Number(val.replace(/[^0-9.-]/g, "")) || 0
          } else {
            ; (row as Record<string, string | number>)[field] = val
          }
        }
        next[targetRow] = row
      }
      return next
    })
  }, [])

  // 우측 단가 패널 붙여넣기: 반출가 열만 세로로 채움
  const handlePasteRetrieval = useCallback((
    setItems: React.Dispatch<React.SetStateAction<ItemRow[]>>,
    startRow: number,
    data: string[][]
  ) => {
    setItems((prev) => {
      const next = [...prev]
      for (let r = 0; r < data.length; r++) {
        const targetRow = startRow + r
        if (targetRow >= next.length) break
        const row = { ...next[targetRow] }
        // 각 행의 첫 번째 값만 반출가로 사용
        const val = data[r][0]?.trim() || ""
        row.retrieval_price = Number(val.replace(/[^0-9.-]/g, "")) || 0
        next[targetRow] = row
      }
      return next
    })
  }, [])

  const equipTotal = equipItems.reduce((s, r) => s + r.quantity * r.unit_price, 0)
  const installTotal = installItems.reduce((s, r) => s + r.quantity * r.unit_price, 0)
  const coverTotal = coverItems.reduce((s, r) => s + r.quantity * r.unit_price, 0)
  const totalAmount = equipTotal + installTotal + coverTotal
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
      i.item_name.trim() ||
      i.specification.trim() ||
      i.unit.trim() ||
      i.memo.trim() ||
      i.quantity > 0 ||
      i.unit_price > 0 ||
      i.retrieval_price > 0
    const validEquip = equipItems.filter(hasData)
    const validInstall = installItems.filter(hasData)
    const validCover = coverItems.filter(hasData)
    if (!title.trim()) return null
    // 신규 생성은 최소 1행 이상 입력 필요
    if (!isUpdate && validEquip.length === 0 && validInstall.length === 0 && validCover.length === 0) return null
    // DB에는 실제 입력된 행만 저장
    const saveEquip = validEquip
    const saveInstall = validInstall
    const saveCover = validCover

    const allItems = [
      ...saveEquip.map((item) => ({ ...item, category: "장비" })),
      ...saveInstall.map((item) => ({ ...item, category: "설치비" })),
      ...saveCover.map((item) => ({ ...item, category: "갑지" })),
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
      supplier_biz_number: supplier.bizNumber || null,
      supplier_ceo_name: supplier.ceoName || null,
      supplier_email: supplier.email || null,
      supplier_address: supplier.address || null,
      supplier_manager: supplier.manager || null,
      supplier_manager_phone: supplier.managerPhone || null,
      supplier_manager_email: supplier.managerEmail || null,
      // 납기/결제 정보
      delivery_date: deliveryDate || null,
      delivery_place: deliveryPlace || null,
      payment_condition: paymentCondition || null,
      terms: validUntil || null,
      // 수신자 확장
      receiver_company_name: receiver.companyName || null,
      receiver_biz_number: receiver.bizNumber || null,
      receiver_email: receiver.email || null,
      receiver_address: receiver.address || null,
      notes: notes || null, items: allItems,
      // 뷰 타입 저장 (간이/상세) - ref 사용으로 뷰 전환 시 autoSave 트리거 방지
      type: quoteType === "detailed" ? "상세" : "간이",
      // 단위절사 반영된 최종 금액을 직접 전달 (API 재계산 덮어쓰기 방지)
      total_amount: supplyAmount,
      grand_total: grandTotal,
      tax_amount: taxAmount,
    }
  }, [title, quotationDate, requestId, customerId, receiver, supplier, supplierMode, notes, equipItems, installItems, coverItems, supplyAmount, grandTotal, taxAmount, quoteType, deliveryDate, deliveryPlace, paymentCondition, validUntil])

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

  // PDF/Excel 내보내기용 데이터 조립
  const buildExportData = useCallback((): QuoteExportData | null => {
    if (!title.trim()) return null
    return {
      title, quotationNumber: quotation?.quotation_number || "", quotationDate, quoteType, notes,
      supplier, receiver,
      deliveryDate, deliveryPlace, paymentCondition, validUntil,
      equipItems, installItems, coverItems,
      coverEquipLabel, coverInstallLabel,
      equipTotal, installTotal, totalAmount,
      truncationAmount: Number(truncationInput.replace(/[^0-9]/g, "")) || 0,
      supplyAmount, taxAmount, grandTotal,
      totalPurchase, totalProfit,
      logoUrl, stampUrl,
    }
  }, [
    title, quotation, quotationDate, quoteType, notes, supplier, receiver,
    deliveryDate, deliveryPlace, paymentCondition, validUntil,
    equipItems, installItems, coverItems, coverEquipLabel, coverInstallLabel,
    equipTotal, installTotal, totalAmount, truncationInput,
    supplyAmount, taxAmount, grandTotal, totalPurchase, totalProfit,
    logoUrl, stampUrl,
  ])

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
  }, [title, quotationDate, notes, equipItems, installItems, receiver, supplier, supplierMode, truncationInput, open])

  // 회사 로고 업로드
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/settings/logo", { method: "POST", body: formData })
      const result = await res.json()
      if (res.ok && result.logo_url) {
        setLogoUrl(result.logo_url)
      } else {
        console.error("로고 업로드 실패:", result.error)
      }
    } catch (err) {
      console.error("로고 업로드 오류:", err)
    } finally {
      setLogoUploading(false)
      // input 초기화 (같은 파일 재업로드 가능하도록)
      if (logoInputRef.current) logoInputRef.current.value = ""
    }
  }

  // 회사 로고 삭제
  const handleLogoDelete = async () => {
    try {
      await fetch("/api/settings/logo", { method: "DELETE" })
      setLogoUrl(null)
    } catch (err) {
      console.error("로고 삭제 오류:", err)
    }
  }

  // 회사 도장 업로드
  const handleStampUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setStampUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/settings/stamp", { method: "POST", body: formData })
      const result = await res.json()
      if (res.ok && result.stamp_url) {
        setStampUrl(result.stamp_url)
      } else {
        console.error("도장 업로드 실패:", result.error)
      }
    } catch (err) {
      console.error("도장 업로드 오류:", err)
    } finally {
      setStampUploading(false)
      if (stampInputRef.current) stampInputRef.current.value = ""
    }
  }

  // 회사 도장 삭제
  const handleStampDelete = async () => {
    try {
      await fetch("/api/settings/stamp", { method: "DELETE" })
      setStampUrl(null)
    } catch (err) {
      console.error("도장 삭제 오류:", err)
    }
  }

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
          if (supplierDialogOpen || receiverDialogOpen || managerDialogOpen || deleteDialogOpen || pricePickerOpen) {
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer select-none ${activeTab === "simple"
                    ? "bg-white shadow-sm"
                    : "hover:bg-white/50"
                    }`}
                >
                  <span className={`text-xs font-medium transition-all ${activeTab === "simple" ? "text-slate-700" : "text-gray-400"
                    }`}>
                    간이 견적서
                  </span>
                  {quoteType === "simple" && (
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-slate-700">
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer select-none ${activeTab !== "simple"
                    ? "bg-white shadow-sm"
                    : "hover:bg-white/50"
                    }`}
                >
                  <span className={`text-xs font-medium transition-all ${activeTab !== "simple" ? "text-slate-700" : "text-gray-400"
                    }`}>
                    상세 견적서
                  </span>
                  {quoteType === "detailed" && (
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-slate-700">
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
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg text-red-500 hover:text-[#c4807e] hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  삭제하기
                </button>
              )}
              <button
                onClick={() => setPricingOpen(!pricingOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all ${pricingOpen
                  ? "bg-slate-700 border-slate-400 text-white"
                  : "bg-white border-gray-300 text-gray-500 hover:border-slate-400 hover:text-slate-700"
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
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${activeTab === "cover"
                  ? "border-slate-400 text-slate-700"
                  : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}>
                갑지
              </button>
              <button type="button"
                onClick={() => { activeTabRef.current = "equipment"; setActiveTab("equipment") }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${activeTab === "equipment"
                  ? "border-slate-400 text-slate-700"
                  : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}>
                <Package className="h-3 w-3" />
                장비 내역서
              </button>
              <button type="button"
                onClick={() => { activeTabRef.current = "installation"; setActiveTab("installation") }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${activeTab === "installation"
                  ? "border-slate-400 text-slate-700"
                  : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}>
                <Wrench className="h-3 w-3" />
                설치비 내역서
              </button>
              {/* 사용자 추가 내역서 탭들 */}
              {customSheets.map((sheet) => (
                <div key={sheet.id} className="relative group flex items-center">
                  <button type="button"
                    onClick={() => { activeTabRef.current = sheet.id; setActiveTab(sheet.id) }}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${activeTab === sheet.id
                      ? "border-slate-400 text-slate-700"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                      }`}>
                    {sheet.name}
                  </button>
                  <button type="button" onClick={() => setCustomSheets(prev => prev.filter(s => s.id !== sheet.id))}
                    className="opacity-0 group-hover:opacity-100 -ml-2 mr-1 p-0.5 text-gray-300 hover:text-red-500 transition-all">
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              {/* +추가 버튼 (최대 5개) */}
              {customSheets.length < 5 && (
                addingSheet ? (
                  <div className="flex items-center gap-1 ml-1">
                    <input
                      type="text"
                      value={newSheetName}
                      onChange={(e) => setNewSheetName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newSheetName.trim()) {
                          const id = `custom-${Date.now()}`
                          setCustomSheets(prev => [...prev, { id, name: newSheetName.trim(), items: Array.from({ length: 10 }, () => emptyRow()) }])
                          setNewSheetName("")
                          setAddingSheet(false)
                          activeTabRef.current = id
                          setActiveTab(id)
                        }
                        if (e.key === "Escape") { setAddingSheet(false); setNewSheetName("") }
                      }}
                      placeholder="내역서명을 적어주세요"
                      autoFocus
                      className="w-[140px] px-2 py-1.5 text-xs border border-slate-400 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-300 bg-slate-50 placeholder:text-gray-400"
                    />
                    <button type="button" onClick={() => {
                      if (newSheetName.trim()) {
                        const id = `custom-${Date.now()}`
                        setCustomSheets(prev => [...prev, { id, name: newSheetName.trim(), items: Array.from({ length: 10 }, () => emptyRow()) }])
                        setNewSheetName("")
                        setAddingSheet(false)
                        activeTabRef.current = id
                        setActiveTab(id)
                      }
                    }} className="p-1.5 text-slate-700 hover:bg-slate-100 rounded transition-colors">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => { setAddingSheet(false); setNewSheetName("") }}
                      className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors">
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAddingSheet(true)}
                    className="flex items-center gap-1 ml-2 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-100 rounded-md transition-colors">
                    <Plus className="h-3 w-3" /> 추가
                  </button>
                )
              )}
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
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 w-7 h-7 bg-white hover:bg-slate-100 border border-slate-300 rounded-full transition-all flex items-center justify-center shadow-sm"
              style={{ left: 24 + 794 + 6 }}
            >
              <svg className="h-3.5 w-3.5 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          ) : (
            // 닫힌 상태: 우측 가장자리 반원
            <button
              onClick={() => setPricingOpen(true)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-5 h-14 bg-slate-100 hover:bg-slate-100 border border-r-0 border-slate-300 rounded-l-full transition-all flex items-center justify-center"
            >
              <svg className="h-4 w-4 text-slate-700 -mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          )}
          <div className="px-6 py-4 space-y-2">

            {/* ===== 간이 견적서 뷰 ===== */}
            {activeTab === "simple" && (
              <>
                {/* ── 見積書 헤더 (엑셀 템플릿 100% 재현) ── */}
                <div className={leftW}>
                  <div className="bg-white border border-gray-300">
                    {/* 제목 입력 (내부 참조용, 프린트 안됨) */}
                    <div className="px-4 pt-1">
                      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                        placeholder="견적서 제목 (내부 참조용)"
                        className="w-full text-[10px] text-gray-400 bg-transparent border-0 focus:outline-none px-0 placeholder:text-gray-300" />
                    </div>

                    {/* Row 1-2: 見積書 대제목 + 굵은 밑줄 */}
                    <div className="text-center pt-3 pb-2 mx-6 border-b-[3px] border-gray-900">
                      <h1 className="text-[28px] font-bold tracking-[1em] text-gray-900 font-serif">見　積　書</h1>
                    </div>

                    {/* Row 3-5: 로고+회사명(우측) + 도장(우측 끝) — 엑셀과 동일 배치 */}
                    <div className="relative flex items-center py-3 px-6">
                      {/* 좌측 여백 (엑셀 A~I열 영역 = 약 45%) */}
                      <div className="w-[45%]" />
                      {/* 우측: 로고 + 회사명 (엑셀 J~Q열 영역) */}
                      <div className="flex-1 flex items-center gap-2">
                        <div className="shrink-0">
                          {logoUrl ? (
                            <div className="group relative">
                              <img src={logoUrl} alt="로고" className="h-9 max-w-[120px] object-contain" />
                              <div className="absolute inset-0 bg-black/40 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                <button onClick={() => logoInputRef.current?.click()} className="px-1 py-0.5 bg-white rounded text-[8px]">변경</button>
                                <button onClick={handleLogoDelete} className="px-1 py-0.5 bg-white rounded text-[8px] text-red-500">삭제</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => logoInputRef.current?.click()}
                              className="h-9 px-3 border border-dashed border-gray-300 rounded text-[10px] text-gray-400 hover:border-gray-500 hover:text-gray-600 transition-colors">
                              {logoUploading ? "업로드..." : "로고"}
                            </button>
                          )}
                        </div>
                        <span className="text-base font-bold text-gray-900">{supplier.companyName || "회사명"}</span>
                      </div>
                      {/* 도장 (엑셀 R열 = 우측 끝, 성명·(인) 위에 겹침) */}
                      <div className="absolute right-6 top-1/2 -translate-y-1/2">
                        {stampUrl ? (
                          <div className="group relative">
                            <img src={stampUrl} alt="도장" className="h-14 w-14 object-contain opacity-80" />
                            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                              <button onClick={() => stampInputRef.current?.click()} className="px-1 py-0.5 bg-white rounded text-[7px]">변경</button>
                              <button onClick={handleStampDelete} className="px-1 py-0.5 bg-white rounded text-[7px] text-red-500">삭제</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => stampInputRef.current?.click()}
                            className="h-14 w-14 border border-dashed border-gray-300 rounded-full text-[9px] text-gray-400 hover:border-gray-500 hover:text-gray-600 transition-colors flex items-center justify-center">
                            {stampUploading ? "..." : "도장"}
                          </button>
                        )}
                      </div>
                      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                      <input ref={stampInputRef} type="file" accept="image/png,image/webp,image/gif" className="hidden" onChange={handleStampUpload} />
                    </div>

                    {/* Row 6: 수신처 귀하 + 수신자 편집 */}
                    <div className="px-6 pb-1.5 flex items-end gap-1.5">
                      <button onClick={() => setReceiverDialogOpen(true)} type="button"
                        className="text-[13px] font-bold text-gray-900 border-b border-gray-900 pb-0.5 hover:text-gray-600 transition-colors">
                        {receiver.companyName || customerName || "(수신처)"}{" "}귀하
                      </button>
                      <button onClick={() => setReceiverDialogOpen(true)} type="button"
                        className="text-[9px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5 mb-0.5 opacity-60 hover:opacity-100 transition-opacity">
                        <Pencil className="h-2.5 w-2.5" /> 수신자
                      </button>
                    </div>

                    {/* Row 7-11: 엑셀 동일 레이아웃 — 좌측(수신자) / 우측(공급자) */}
                    <div className="px-6 py-1 text-[11px] text-gray-900 leading-[22px]">
                      {/* Row 7: 담당자 / 등록번호·성명·(인) + 공급자 편집 */}
                      <div className="flex">
                        <div className="w-[45%] flex">
                          <span className="text-gray-500 w-[100px] shrink-0 tracking-[0.2em] font-bold">담 당 자 :</span>
                          <span className="bg-yellow-100 px-0.5">{receiver.recipientName || ""}</span>
                        </div>
                        <div className="w-[55%] flex items-center">
                          <span className="text-gray-500 tracking-[0.15em] font-bold w-[88px] shrink-0">등 록 번 호</span>
                          <span className="w-[110px] bg-yellow-100 px-0.5">{supplier.bizNumber || ""}</span>
                          <span className="text-gray-500 tracking-[0.25em] font-bold w-[56px] shrink-0">성　명</span>
                          <span className="bg-yellow-100 px-0.5">{supplier.ceoName || ""}</span>
                          <span className="ml-1 text-gray-400">(인)</span>
                          <button onClick={() => setSupplierDialogOpen(true)} type="button"
                            className="ml-2 text-[9px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5 opacity-60 hover:opacity-100 transition-opacity">
                            <Pencil className="h-2.5 w-2.5" /> 공급자
                          </button>
                        </div>
                      </div>
                      {/* Row 8: 납기/장소 / 사업장주소 */}
                      <div className="flex">
                        <div className="w-[45%] flex">
                          <span className="text-gray-500 w-[100px] shrink-0 tracking-[0.12em] font-bold">납 기/장 소 :</span>
                          <input type="text" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}
                            className="w-[72px] bg-transparent border-0 focus:outline-none text-[11px] p-0" placeholder="협의 일정" />
                          <span className="text-gray-400 mx-0.5">/</span>
                          <input type="text" value={deliveryPlace} onChange={(e) => setDeliveryPlace(e.target.value)}
                            className="flex-1 min-w-0 bg-transparent border-0 focus:outline-none text-[11px] p-0" placeholder="협의 장소" />
                        </div>
                        <div className="w-[55%] flex items-center">
                          <span className="text-gray-500 tracking-[0.1em] font-bold w-[88px] shrink-0">사업장주소</span>
                          <span className="truncate bg-yellow-100 px-0.5">{supplier.address || ""}</span>
                        </div>
                      </div>
                      {/* Row 9: 결제조건 / 전화번호·팩스번호 */}
                      <div className="flex">
                        <div className="w-[45%] flex">
                          <span className="text-gray-500 w-[100px] shrink-0 tracking-[0.12em] font-bold">결 제 조 건 :</span>
                          <input type="text" value={paymentCondition} onChange={(e) => setPaymentCondition(e.target.value)}
                            className="flex-1 min-w-0 bg-transparent border-0 focus:outline-none text-[11px] p-0" placeholder="협의 조건" />
                        </div>
                        <div className="w-[55%] flex items-center">
                          <span className="text-gray-500 tracking-[0.15em] font-bold w-[88px] shrink-0">전 화 번 호</span>
                          <span className="w-[110px] bg-yellow-100 px-0.5">{supplier.managerPhone || ""}</span>
                          <span className="text-gray-500 tracking-[0.15em] font-bold w-[56px] shrink-0">팩스번호</span>
                          <input type="text" value={faxNumber} onChange={(e) => setFaxNumber(e.target.value)}
                            className="bg-transparent border-0 focus:outline-none text-[11px] p-0 w-[100px]" />
                        </div>
                      </div>
                      {/* Row 10: 견적일자 */}
                      <div className="flex">
                        <div className="w-[45%] flex">
                          <span className="text-gray-500 w-[100px] shrink-0 tracking-[0.12em] font-bold">견 적 일 자 :</span>
                          <input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)}
                            className="bg-transparent border-0 focus:outline-none text-[11px] p-0" />
                        </div>
                      </div>
                      {/* Row 11: 유효기간 / 견적담당·Mobile */}
                      <div className="flex">
                        <div className="w-[45%] flex">
                          <span className="text-gray-500 w-[100px] shrink-0 tracking-[0.12em] font-bold">유 효 기 간 :</span>
                          <input type="text" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
                            className="bg-transparent border-0 focus:outline-none text-[11px] p-0 w-[80px]" />
                        </div>
                        <div className="w-[55%] flex items-center">
                          <span className="text-gray-500 tracking-[0.15em] font-bold w-[88px] shrink-0">견 적 담 당</span>
                          <span className="w-[110px] bg-yellow-100 px-0.5">{supplier.manager || ""}</span>
                          <span className="text-gray-500 tracking-[0.12em] font-bold w-[56px] shrink-0">Mobile</span>
                          <span className="bg-yellow-100 px-0.5">{supplier.managerPhone || ""}</span>
                          <button onClick={() => setManagerDialogOpen(true)} type="button"
                            className="ml-2 text-[9px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5 opacity-60 hover:opacity-100 transition-opacity">
                            <Pencil className="h-2.5 w-2.5" /> 담당자
                          </button>
                        </div>
                      </div>
                    </div>


                    {/* Row 12: "아래와 같이 견적합니다." */}
                    <div className="px-6 pt-0.5 pb-2">
                      <span className="text-[11px] text-gray-900 border-b border-gray-400 pb-0.5">아래와 같이 견적합니다.</span>
                    </div>

                    {/* Row 13: 합계금액 바 — 엑셀 동일 레이아웃 */}
                    <div className="mx-5 mb-3 grid grid-cols-[100px_1fr_auto] border border-gray-400">
                      <div className="px-2 py-2.5 bg-gray-50 text-center border-r border-gray-400 leading-tight">
                        <span className="text-xs font-bold text-gray-900">합계금액</span><br />
                        <span className="text-[9px] text-gray-500">(공급가+부가세)</span>
                      </div>
                      <div className="px-4 py-2.5 flex items-center justify-end text-sm text-gray-900 font-bold">
                        {grandTotal > 0 ? `${numberToKorean(grandTotal)} 원整` : "영 원整"}
                      </div>
                      <div className="px-4 py-2.5 flex items-center gap-1.5 text-sm">
                        <span className="text-gray-500">(₩</span>
                        <span className="font-bold text-gray-900 min-w-[120px] text-right">{grandTotal > 0 ? grandTotal.toLocaleString() : ""}</span>
                        <span className="text-gray-500">)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 장비 내역 */}
                <div className="flex gap-3">
                  <div className={`${leftW} border border-gray-200 rounded-lg`}>
                    <div className="px-4 py-3 bg-gray-50/50">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-slate-700" />
                        <span className="font-sans font-semibold text-sm text-gray-900">장비 내역</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${equipTotal > 0 ? "bg-sky-aqua/15 text-sky-aqua" : "bg-gray-100 text-gray-400"}`}>
                          {equipTotal > 0 ? formatCurrency(equipTotal) : "0원"}
                        </span>
                      </div>
                    </div>
                    <ItemsTable items={equipItems}
                      updateItem={(i, f, v) => updateItem(setEquipItems, i, f, v)}
                      addRow={() => addRow(setEquipItems)}
                      removeRow={(i) => removeRow(setEquipItems, equipItems, i)}
                      blankIdx={null}
                      onToggleBlank={() => {}}
                      isRowMatched={isRowMatched}
                      clearRow={(i) => clearItemRow(setEquipItems, i)}
                      onPasteCells={(startRow, startCol, data) => handlePasteCells(setEquipItems, startRow, startCol, data)} />
                  </div>

                  {pricingOpen && (
                    <div className="flex-1 min-w-0 border border-gray-200 rounded-lg self-start bg-gray-50">
                      <div className="px-4 py-3 bg-gray-100/60 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-slate-700" />
                          <span className="font-sans font-semibold text-sm text-gray-900">장비 단가</span>
                        </div>
                        <button onClick={() => openPricePicker("equip")} type="button"
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-100 rounded-md transition-colors">
                          <List className="h-3 w-3" /> 가격표
                        </button>
                      </div>
                      <PricingRows items={equipItems}
                        updateItem={(i, f, v) => updateItem(setEquipItems, i, f, v)}
                        roundUp={roundUp} onToggleRoundUp={() => setRoundUp(!roundUp)}
                        isRowMatched={isRowMatched}
                        onPasteRetrieval={(startRow, data) => handlePasteRetrieval(setEquipItems, startRow, data)} />
                    </div>
                  )}
                </div>

                {/* 설치비 내역 */}
                <div className="flex gap-3">
                  <div className={`${leftW} border border-gray-200 rounded-lg`}>
                    <div className="px-4 py-3 bg-gray-50/50">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-slate-500" />
                        <span className="font-sans font-semibold text-sm text-gray-900">설치비 내역</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${installTotal > 0 ? "bg-tropical-teal/15 text-tropical-teal" : "bg-gray-100 text-gray-400"}`}>
                          {installTotal > 0 ? formatCurrency(installTotal) : "0원"}
                        </span>
                      </div>
                    </div>
                    <ItemsTable items={installItems}
                      updateItem={(i, f, v) => updateItem(setInstallItems, i, f, v)}
                      addRow={() => addRow(setInstallItems)}
                      removeRow={(i) => removeRow(setInstallItems, installItems, i)}
                      blankIdx={null}
                      onToggleBlank={() => {}}
                      isRowMatched={isRowMatched}
                      clearRow={(i) => clearItemRow(setInstallItems, i)}
                      onPasteCells={(startRow, startCol, data) => handlePasteCells(setInstallItems, startRow, startCol, data)} />
                  </div>

                  {pricingOpen && (
                    <div className="flex-1 min-w-0 border border-gray-200 rounded-lg self-start bg-gray-50">
                      <div className="px-4 py-3 bg-gray-100/60 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-slate-500" />
                          <span className="font-sans font-semibold text-sm text-gray-900">설치비 단가</span>
                        </div>
                        <button onClick={() => openPricePicker("install")} type="button"
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors">
                          <List className="h-3 w-3" /> 가격표
                        </button>
                      </div>
                      <PricingRows items={installItems}
                        updateItem={(i, f, v) => updateItem(setInstallItems, i, f, v)}
                        roundUp={roundUp} onToggleRoundUp={() => setRoundUp(!roundUp)}
                        isRowMatched={isRowMatched}
                        onPasteRetrieval={(startRow, data) => handlePasteRetrieval(setInstallItems, startRow, data)} />
                    </div>
                  )}
                </div>

                {/* 합계 / 부가세 / 총계 — 엑셀 템플릿 기준 */}
                <div className="flex gap-3">
                  <div className={leftW}>
                    <div className="border border-gray-300">
                      {/* 합계 */}
                      <div className="grid grid-cols-2 border-b border-gray-300">
                        <div className="px-4 py-2.5 bg-gray-50 text-sm font-bold text-gray-900 text-center border-r border-gray-300">합     계</div>
                        <div className="px-4 py-2.5 text-sm font-bold text-gray-900 text-right tabular-nums">{formatCurrency(totalAmount)}</div>
                      </div>
                      {/* 부가세 */}
                      <div className="grid grid-cols-2 border-b border-gray-300">
                        <div className="px-4 py-2.5 bg-gray-50 text-sm font-bold text-gray-900 text-center border-r border-gray-300">부 가 세</div>
                        <div className="px-4 py-2.5 text-sm font-bold text-gray-900 text-right tabular-nums">{formatCurrency(taxAmount)}</div>
                      </div>
                      {/* 총계 */}
                      <div className="grid grid-cols-2">
                        <div className="px-4 py-3 bg-slate-100 text-sm font-bold text-gray-900 text-center border-r border-gray-300">총     계</div>
                        <div className="px-4 py-3 bg-slate-50 text-base font-bold text-gray-900 text-right tabular-nums">{formatCurrency(grandTotal)}</div>
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

                {/* ※ 특이사항 */}
                <div className={leftW}>
                  <div className="border border-gray-300">
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-300 text-xs font-bold text-gray-700">※ 특 이 사 항</div>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder="특이사항을 입력하세요"
                      rows={4}
                      className="w-full px-4 py-3 text-xs border-0 focus:outline-none resize-none" />
                  </div>
                </div>
              </>
            )}

            {/* ===== 갑지 탭 ===== */}
            {activeTab === "cover" && (
              <div className="flex gap-3">
                <div className="w-[794px] shrink-0 bg-white border border-gray-300 shadow-md">
                  {/* ── 제목 영역 ── */}
                  <div className="border-b-2 border-gray-800 px-8 pt-8 pb-5">
                    <h1 className="font-sans text-3xl font-bold text-center tracking-[0.5em] text-gray-900">
                      견 적 서
                    </h1>
                    <p className="text-center text-xs text-gray-400 mt-1 tracking-widest">Quotation</p>
                  </div>

                  {/* ── 회사 정보 ── */}
                  <div className="flex items-center gap-4 py-4 border-b border-gray-200 px-8">
                    {/* 로고 */}
                    <div className="shrink-0">
                      {logoUrl ? (
                        <div className="group relative w-fit">
                          <img src={logoUrl} alt="회사 로고" className="h-9 max-w-[120px] object-contain" />
                          <div className="absolute inset-0 bg-black/40 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                            <button onClick={() => logoInputRef.current?.click()} className="px-1.5 py-0.5 bg-white rounded text-[9px] text-gray-700 hover:bg-gray-100">변경</button>
                            <button onClick={handleLogoDelete} className="px-1.5 py-0.5 bg-white rounded text-[9px] text-red-500 hover:bg-red-50">삭제</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => logoInputRef.current?.click()} className="h-9 px-3 border border-dashed border-gray-300 rounded-lg flex items-center gap-1.5 text-[10px] text-gray-400 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all">
                          {logoUploading ? <span className="animate-pulse">업로드 중...</span> : <><ImageIcon className="h-3.5 w-3.5" /> 로고</>}
                        </button>
                      )}
                    </div>
                    {/* 회사 정보 */}
                    <div className="text-left">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-sm font-bold text-gray-900">{supplier.companyName || "회사명 미입력"}</p>
                        <button onClick={() => setSupplierDialogOpen(true)} type="button">
                          <Pencil className="h-2.5 w-2.5 text-gray-300 hover:text-gray-500 transition-colors" />
                        </button>
                      </div>
                      <div className="space-y-0.5 text-[10px] text-gray-500 leading-relaxed">
                        {supplier.address && <p>A. {supplier.address}</p>}
                        {supplier.email && <p>E. {supplier.email}</p>}
                        {(!supplier.address && !supplier.email) && <p>주소 / 이메일 정보를 입력하세요</p>}
                      </div>
                    </div>
                    {/* 도장 - 우측 정렬 */}
                    <div className="ml-auto shrink-0">
                      {stampUrl ? (
                        <div className="group relative">
                          <img src={stampUrl} alt="도장" className="h-16 w-16 object-contain" />
                          <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                            <button onClick={() => stampInputRef.current?.click()} className="px-1 py-0.5 bg-white rounded text-[8px] text-gray-700 hover:bg-gray-100">변경</button>
                            <button onClick={handleStampDelete} className="px-1 py-0.5 bg-white rounded text-[8px] text-red-500 hover:bg-red-50">삭제</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => stampInputRef.current?.click()} className="h-16 w-16 border border-dashed border-gray-300 rounded-full flex flex-col items-center justify-center gap-0.5 text-[8px] text-gray-400 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all">
                          {stampUploading ? <span className="animate-pulse">업로드...</span> : <><ImageIcon className="h-3 w-3" /><span>도장</span></>}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── 3단 정보 영역 ── */}
                  <div className="grid grid-cols-3 border-b border-gray-300">
                    {/* 받는분 정보 */}
                    <div className="border-r border-gray-300 px-4 py-3">
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-[10px] font-bold text-gray-700">◾ 받는분 정보</span>
                        <button onClick={() => setReceiverDialogOpen(true)} type="button">
                          <Pencil className="h-2.5 w-2.5 text-gray-300 hover:text-gray-500 transition-colors" />
                        </button>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex gap-2">
                          <span className="text-gray-500 w-[52px] shrink-0">수 신 처</span>
                          <span className="text-gray-900 font-medium">{receiver.companyName || customerName || "-"}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-gray-500 w-[52px] shrink-0">담 당 자</span>
                          <span className="text-gray-900">{receiver.recipientName || "-"}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-gray-500 w-[52px] shrink-0">연 락 처</span>
                          <span className="text-gray-900">{receiver.phone || "-"}</span>
                        </div>
                      </div>
                    </div>

                    {/* 견적 정보 */}
                    <div className="border-r border-gray-300 px-4 py-3">
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-[10px] font-bold text-gray-700">◾ 견 적 정 보</span>
                        <button onClick={() => setManagerDialogOpen(true)} type="button">
                          <Pencil className="h-2.5 w-2.5 text-gray-300 hover:text-gray-500 transition-colors" />
                        </button>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex gap-2">
                          <span className="text-gray-500 w-[52px] shrink-0">견 적 일</span>
                          <input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)}
                            className="text-xs text-gray-900 bg-transparent border-0 border-b border-gray-200 focus:outline-none focus:border-gray-400 px-0 py-0" />
                        </div>
                        <div className="flex gap-2">
                          <span className="text-gray-500 w-[52px] shrink-0">담 당 자</span>
                          <span className="text-gray-900">{supplier.manager || "-"}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-gray-500 w-[52px] shrink-0">연 락 처</span>
                          <span className="text-gray-900">{supplier.managerPhone || "-"}</span>
                        </div>
                      </div>
                    </div>

                    {/* 납기 / 결제 정보 */}
                    <div className="px-4 py-3">
                      <p className="text-[10px] font-bold text-gray-700 mb-3">◾ 납 기 / 결 제 정 보</p>
                      <div className="space-y-2 text-xs">
                        <div className="flex gap-2">
                          <span className="text-gray-500 w-[52px] shrink-0">납기일자</span>
                          <input type="text" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}
                            className="flex-1 text-xs text-gray-900 bg-transparent border-0 border-b border-gray-200 focus:outline-none focus:border-gray-400 px-0 py-0" />
                        </div>
                        <div className="flex gap-2">
                          <span className="text-gray-500 w-[52px] shrink-0">납기장소</span>
                          <input type="text" value={deliveryPlace} onChange={(e) => setDeliveryPlace(e.target.value)}
                            className="flex-1 text-xs text-gray-900 bg-transparent border-0 border-b border-gray-200 focus:outline-none focus:border-gray-400 px-0 py-0" />
                        </div>
                        <div className="flex gap-2">
                          <span className="text-gray-500 w-[52px] shrink-0">결제조건</span>
                          <input type="text" value={paymentCondition} onChange={(e) => setPaymentCondition(e.target.value)}
                            className="flex-1 text-xs text-gray-900 bg-transparent border-0 border-b border-gray-200 focus:outline-none focus:border-gray-400 px-0 py-0" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── 견적서 제목 입력 ── */}
                  <div className="px-8 py-3 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                        placeholder="견적서 제목을 입력하세요 *"
                        className="flex-1 text-base font-bold bg-transparent border-0 border-b border-gray-200 focus:outline-none focus:border-gray-400 px-0 py-1 placeholder:text-gray-300" />
                    </div>
                  </div>

                  {/* ── 품목 테이블 ── */}
                  <div className="border-b border-gray-300">
                    {/* 테이블 헤더 */}
                    <div className="grid grid-cols-[40px_80px_1fr_50px_50px_120px_130px_80px] bg-gray-100 border-b border-gray-400 text-[11px] font-semibold text-gray-700">
                      <div className="px-2 py-2.5 text-center border-r border-gray-300">순번</div>
                      <div className="px-2 py-2.5 text-center border-r border-gray-300">구 분</div>
                      <div className="px-2 py-2.5 text-center border-r border-gray-300">내 용</div>
                      <div className="px-2 py-2.5 text-center border-r border-gray-300">단위</div>
                      <div className="px-2 py-2.5 text-center border-r border-gray-300">수량</div>
                      <div className="px-2 py-2.5 text-center border-r border-gray-300">단 가</div>
                      <div className="px-2 py-2.5 text-center border-r border-gray-300">공 급 가</div>
                      <div className="px-2 py-2.5 text-center">비 고</div>
                    </div>
                    {/* 장비 행 (구분/내용 수정 가능) */}
                    <div className="grid grid-cols-[40px_80px_1fr_50px_50px_120px_130px_80px] border-b border-gray-200 text-xs bg-gray-50/50">
                      <div className="px-2 py-2.5 text-center border-r border-gray-200 text-gray-400">1</div>
                      <div className="px-1 border-r border-gray-200 flex items-center">
                        <input type="text" value={coverEquipLabel.name} onChange={(e) => setCoverEquipLabel(p => ({ ...p, name: e.target.value }))} className="w-full text-center bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-slate-300 rounded px-1 py-1 font-medium text-gray-700" />
                      </div>
                      <div className="px-1 border-r border-gray-200 flex items-center">
                        <input type="text" value={coverEquipLabel.desc} onChange={(e) => setCoverEquipLabel(p => ({ ...p, desc: e.target.value }))} className="w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-slate-300 rounded px-1 py-1 text-gray-500" />
                      </div>
                      <div className="px-2 py-2.5 text-center border-r border-gray-200 text-gray-500">식</div>
                      <div className="px-2 py-2.5 text-center border-r border-gray-200 text-gray-500">1</div>
                      <div className="px-2 py-2.5 text-right border-r border-gray-200 tabular-nums text-gray-500 bg-gray-100/50">{formatCurrency(equipTotal)}</div>
                      <div className="px-2 py-2.5 text-right border-r border-gray-200 tabular-nums font-medium text-gray-600 bg-gray-100/50">{formatCurrency(equipTotal)}</div>
                      <div className="px-2 py-2.5 text-center text-gray-500"></div>
                    </div>
                    {/* 설치비 행 (구분/내용 수정 가능) */}
                    <div className="grid grid-cols-[40px_80px_1fr_50px_50px_120px_130px_80px] border-b border-gray-200 text-xs bg-gray-50/50">
                      <div className="px-2 py-2.5 text-center border-r border-gray-200 text-gray-400">2</div>
                      <div className="px-1 border-r border-gray-200 flex items-center">
                        <input type="text" value={coverInstallLabel.name} onChange={(e) => setCoverInstallLabel(p => ({ ...p, name: e.target.value }))} className="w-full text-center bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-slate-300 rounded px-1 py-1 font-medium text-gray-700" />
                      </div>
                      <div className="px-1 border-r border-gray-200 flex items-center">
                        <input type="text" value={coverInstallLabel.desc} onChange={(e) => setCoverInstallLabel(p => ({ ...p, desc: e.target.value }))} className="w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-slate-300 rounded px-1 py-1 text-gray-500" />
                      </div>
                      <div className="px-2 py-2.5 text-center border-r border-gray-200 text-gray-500">식</div>
                      <div className="px-2 py-2.5 text-center border-r border-gray-200 text-gray-500">1</div>
                      <div className="px-2 py-2.5 text-right border-r border-gray-200 tabular-nums text-gray-500 bg-gray-100/50">{formatCurrency(installTotal)}</div>
                      <div className="px-2 py-2.5 text-right border-r border-gray-200 tabular-nums font-medium text-gray-600 bg-gray-100/50">{formatCurrency(installTotal)}</div>
                      <div className="px-2 py-2.5 text-center text-gray-500"></div>
                    </div>

                    {/* 추가 행들 (coverItems) */}
                    {coverItems.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-[40px_80px_1fr_50px_50px_120px_130px_80px] border-b border-gray-200 text-xs group hover:bg-slate-50 transition-colors">
                        <div className="px-2 py-2.5 text-center border-r border-gray-200 text-gray-700">{idx + 3}</div>
                        <div className="px-1 border-r border-gray-200 flex items-center">
                          <input type="text" value={row.item_name} onChange={(e) => updateItem(setCoverItems, idx, "item_name", e.target.value)} className="w-full text-center bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-slate-300 rounded px-1 py-1 font-medium text-gray-900" placeholder="항목명" />
                        </div>
                        <div className="px-1 border-r border-gray-200 flex items-center">
                          <input type="text" value={row.specification} onChange={(e) => updateItem(setCoverItems, idx, "specification", e.target.value)} className="w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-slate-300 rounded px-1 py-1 text-gray-700" placeholder="내용" />
                        </div>
                        <div className="px-1 border-r border-gray-200 flex items-center">
                          <input type="text" value={row.unit} onChange={(e) => updateItem(setCoverItems, idx, "unit", e.target.value)} className="w-full text-center bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-slate-300 rounded px-1 py-1 text-gray-700" placeholder="단위" />
                        </div>
                        <div className="px-1 border-r border-gray-200 flex items-center">
                          <input type="text" inputMode="numeric" value={row.quantity || ""} onChange={(e) => updateItem(setCoverItems, idx, "quantity", e.target.value)} className="w-full text-center bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-slate-300 rounded px-1 py-1 text-gray-700 tabular-nums" placeholder="0" />
                        </div>
                        <div className="px-1 border-r border-gray-200 flex items-center">
                          <input type="text" inputMode="numeric" value={row.unit_price || ""} onChange={(e) => updateItem(setCoverItems, idx, "unit_price", e.target.value)} className="w-full text-right bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-slate-300 rounded px-1 py-1 text-gray-900 tabular-nums" placeholder="0" />
                        </div>
                        <div className="px-2 py-2.5 text-right border-r border-gray-200 tabular-nums font-medium text-gray-900 bg-gray-50/30">
                          {formatCurrency(row.amount)}
                        </div>
                        <div className="flex justify-center items-center">
                          <button onClick={() => setCoverItems(prev => prev.filter((_, j) => j !== idx))} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* 빈 행 (여유 공간) */}
                    {Array.from({ length: Math.max(0, 8 - coverItems.length) }).map((_, i) => (
                      <div key={`empty-${i}`} className="grid grid-cols-[40px_80px_1fr_50px_50px_120px_130px_80px] border-b border-gray-100 text-xs">
                        <div className="px-2 py-2.5 text-center border-r border-gray-100 text-gray-300">{i + 3 + coverItems.length}</div>
                        <div className="px-2 py-2.5 border-r border-gray-100"></div>
                        <div className="px-2 py-2.5 border-r border-gray-100"></div>
                        <div className="px-2 py-2.5 border-r border-gray-100"></div>
                        <div className="px-2 py-2.5 border-r border-gray-100"></div>
                        <div className="px-2 py-2.5 border-r border-gray-100"></div>
                        <div className="px-2 py-2.5 border-r border-gray-100"></div>
                        <div className="px-2 py-2.5"></div>
                      </div>
                    ))
                    }
                    {/* 행 추가 버튼 */}
                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex justify-center">
                      <button onClick={() => setCoverItems(p => [...p, emptyRow()])} type="button" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-slate-50 hover:text-slate-700 hover:border-slate-400 transition-colors">
                        <Plus className="h-3.5 w-3.5" /> 행 추가
                      </button>
                    </div>
                  </div>

                  {/* ── 하단: 비고(좌) + 금액 요약(우) ── */}
                  <div className="grid grid-cols-[1fr_250px] border-b border-gray-300">
                    {/* 비고 영역 (좌) */}
                    <div className="border-r border-gray-300 px-4 py-3">
                      <p className="text-xs font-bold text-gray-700 mb-2">※ 비 고</p>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                        placeholder="견적 관련 특이사항을 입력하세요"
                        rows={8}
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-gray-400 resize-none bg-gray-50/50" />
                    </div>

                    {/* 금액 요약 (우) */}
                    <div className="text-xs">
                      <div className="grid grid-cols-[90px_1fr] border-b border-gray-200">
                        <div className="px-3 py-2.5 bg-gray-50 border-r border-gray-200 font-medium text-gray-600">합 계</div>
                        <div className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-900">{formatCurrency(totalAmount)}</div>
                      </div>
                      <div className="grid grid-cols-[90px_1fr] border-b border-gray-200">
                        <div className="px-3 py-2.5 bg-gray-50 border-r border-gray-200 font-medium text-red-500">단위절사</div>
                        <div className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-0.5 text-red-500 font-semibold text-xs">
                            <span>-</span>
                            <input
                              type="text" inputMode="numeric"
                              value={truncationInput}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9]/g, "")
                                setTruncationInput(raw ? Number(raw).toLocaleString() : "")
                              }}
                              placeholder="0"
                              className="w-[80px] text-right bg-transparent border-0 border-b border-red-300 focus:outline-none focus:border-red-300 text-red-500 font-semibold placeholder:text-red-500/30 tabular-nums text-xs px-0"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-[90px_1fr] border-b border-gray-200">
                        <div className="px-3 py-2.5 bg-gray-50 border-r border-gray-200 font-medium text-gray-600">견적금액</div>
                        <div className="px-3 py-2.5 text-right tabular-nums text-gray-900">{formatCurrency(supplyAmount)}</div>
                      </div>
                      <div className="grid grid-cols-[90px_1fr] border-b border-gray-300">
                        <div className="px-3 py-2.5 bg-gray-50 border-r border-gray-200 font-medium text-gray-600">부 가 세</div>
                        <div className="px-3 py-2.5 text-right tabular-nums text-gray-900">{formatCurrency(taxAmount)}</div>
                      </div>
                      <div className="grid grid-cols-[90px_1fr]">
                        <div className="px-3 py-3 bg-slate-100 border-r border-slate-300 font-bold text-gray-900 text-xs flex items-center">최종견적</div>
                        <div className="px-3 py-3 bg-slate-100 text-right tabular-nums font-bold text-slate-700 text-sm tracking-tight">{formatCurrency(grandTotal)}</div>
                      </div>
                    </div>
                  </div>

                  {/* 하단 여백 */}
                  <div className="py-5" />
                </div>

                {/* 우측 영역 (추후 구현용) */}
                {pricingOpen && (
                  <div className="flex-1 min-w-0 border border-gray-200 rounded-lg p-3 self-start bg-gray-50">
                    <p className="text-xs text-gray-400 text-center py-4">추후 구현 예정</p>
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
                      <Package className="h-4 w-4 text-slate-700" />
                      <span className="font-sans font-semibold text-sm text-gray-900">장비 내역</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${equipTotal > 0 ? "bg-sky-aqua/15 text-sky-aqua" : "bg-gray-100 text-gray-400"}`}>
                        {equipTotal > 0 ? formatCurrency(equipTotal) : "0원"}
                      </span>
                    </div>
                  </div>
                  <ItemsTable items={equipItems}
                    updateItem={(i, f, v) => updateItem(setEquipItems, i, f, v)}
                    addRow={() => addRow(setEquipItems)}
                    removeRow={(i) => removeRow(setEquipItems, equipItems, i)}
                    blankIdx={null}
                    onToggleBlank={() => {}}
                    isRowMatched={isRowMatched}
                    clearRow={(i) => clearItemRow(setEquipItems, i)}
                    onPasteCells={(startRow, startCol, data) => handlePasteCells(setEquipItems, startRow, startCol, data)} />
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
                    <div className="px-4 py-3 bg-gray-100/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-slate-700" />
                        <span className="font-sans font-semibold text-sm text-gray-900">장비 단가</span>
                      </div>
                      <button onClick={() => openPricePicker("equip")} type="button"
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-100 rounded-md transition-colors">
                        <List className="h-3 w-3" /> 가격표
                      </button>
                    </div>
                    <PricingRows items={equipItems}
                      updateItem={(i, f, v) => updateItem(setEquipItems, i, f, v)}
                      roundUp={roundUp} onToggleRoundUp={() => setRoundUp(!roundUp)}
                      isRowMatched={isRowMatched}
                      onPasteRetrieval={(startRow, data) => handlePasteRetrieval(setEquipItems, startRow, data)} />
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
                      <Wrench className="h-4 w-4 text-slate-500" />
                      <span className="font-sans font-semibold text-sm text-gray-900">설치비 내역</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${installTotal > 0 ? "bg-tropical-teal/15 text-tropical-teal" : "bg-gray-100 text-gray-400"}`}>
                        {installTotal > 0 ? formatCurrency(installTotal) : "0원"}
                      </span>
                    </div>
                  </div>
                  <ItemsTable items={installItems}
                    updateItem={(i, f, v) => updateItem(setInstallItems, i, f, v)}
                    addRow={() => addRow(setInstallItems)}
                    removeRow={(i) => removeRow(setInstallItems, installItems, i)}
                    blankIdx={null}
                    onToggleBlank={() => {}}
                    isRowMatched={isRowMatched}
                    clearRow={(i) => clearItemRow(setInstallItems, i)}
                    onPasteCells={(startRow, startCol, data) => handlePasteCells(setInstallItems, startRow, startCol, data)} />
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
                    <div className="px-4 py-3 bg-gray-100/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-slate-500" />
                        <span className="font-sans font-semibold text-sm text-gray-900">설치비 단가</span>
                      </div>
                      <button onClick={() => openPricePicker("install")} type="button"
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors">
                        <List className="h-3 w-3" /> 가격표
                      </button>
                    </div>
                    <PricingRows items={installItems}
                      updateItem={(i, f, v) => updateItem(setInstallItems, i, f, v)}
                      roundUp={roundUp} onToggleRoundUp={() => setRoundUp(!roundUp)}
                      isRowMatched={isRowMatched}
                      onPasteRetrieval={(startRow, data) => handlePasteRetrieval(setInstallItems, startRow, data)} />
                  </div>
                )}
              </div>
            )}

            {/* ===== 사용자 추가 내역서 탭 ===== */}
            {customSheets.map((sheet) => activeTab === sheet.id && (
              <div key={sheet.id} className="flex gap-3">
                <div className={`${leftW} border border-gray-200 rounded-lg shadow-sm overflow-hidden`}>
                  <div className="px-4 py-3 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <span className="font-sans font-semibold text-sm text-gray-900">{sheet.name}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${sheet.items.reduce((s, r) => s + r.amount, 0) > 0 ? "bg-slate-100 text-slate-700" : "bg-gray-100 text-gray-400"
                        }`}>
                        {sheet.items.reduce((s, r) => s + r.amount, 0) > 0
                          ? formatCurrency(sheet.items.reduce((s, r) => s + r.amount, 0))
                          : "0원"}
                      </span>
                    </div>
                  </div>
                  <ItemsTable items={sheet.items}
                    updateItem={(i, f, v) => {
                      setCustomSheets(prev => prev.map(s => s.id === sheet.id
                        ? {
                          ...s, items: s.items.map((row, idx) => idx === i ? (() => {
                            const updated = { ...row, [f]: v }
                            if (f === "quantity" || f === "unit_price") {
                              updated.amount = (Number(updated.quantity) || 0) * (Number(updated.unit_price) || 0)
                            }
                            return updated
                          })() : row)
                        }
                        : s
                      ))
                    }}
                    addRow={() => {
                      setCustomSheets(prev => prev.map(s => s.id === sheet.id
                        ? { ...s, items: [...s.items, emptyRow()] }
                        : s
                      ))
                    }}
                    removeRow={(i) => {
                      setCustomSheets(prev => prev.map(s => s.id === sheet.id
                        ? { ...s, items: s.items.filter((_, idx) => idx !== i) }
                        : s
                      ))
                    }}
                    blankIdx={null}
                    onToggleBlank={() => { }}
                    isRowMatched={isRowMatched}
                    clearRow={(i) => {
                      setCustomSheets(prev => prev.map(s => s.id === sheet.id
                        ? { ...s, items: s.items.map((row, idx) => idx === i ? emptyRow() : row) }
                        : s
                      ))
                    }}
                    onPasteCells={(startRow, startCol, data) => {
                      setCustomSheets(prev => prev.map(s => {
                        if (s.id !== sheet.id) return s
                        const newItems = [...s.items]
                        data.forEach((rowData, rIdx) => {
                          const ri = startRow + rIdx
                          if (ri >= newItems.length) newItems.push(emptyRow())
                          const row = { ...newItems[ri] }
                          const fields = ["item_name", "specification", "unit", "quantity", "unit_price"] as const
                          rowData.forEach((cell, cIdx) => {
                            const fi = startCol + cIdx
                            if (fi < fields.length) {
                              (row as Record<string, unknown>)[fields[fi]] = cell
                            }
                          })
                          row.amount = (Number(row.quantity) || 0) * (Number(row.unit_price) || 0)
                          newItems[ri] = row
                        })
                        return { ...s, items: newItems }
                      }))
                    }} />
                  {/* 소계 */}
                  <div className="px-4 py-2.5 bg-gray-50/30 border-t border-gray-200">
                    <div className="flex justify-end items-center gap-3 text-xs">
                      <span className="text-gray-500 font-medium">{sheet.name} 소계</span>
                      <span className="font-semibold text-gray-900 tabular-nums">{formatCurrency(sheet.items.reduce((s, r) => s + r.amount, 0))}</span>
                    </div>
                  </div>
                </div>

                {/* 원가 분석 패널 (가격표 버튼 없음) */}
                {pricingOpen && (
                  <div className="flex-1 min-w-0 border border-gray-200 rounded-lg self-start bg-gray-50">
                    <div className="px-4 py-3 bg-gray-100/60 flex items-center">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-700" />
                        <span className="font-sans font-semibold text-sm text-gray-900">{sheet.name} 단가</span>
                      </div>
                    </div>
                    <PricingRows items={sheet.items}
                      updateItem={(i, f, v) => {
                        setCustomSheets(prev => prev.map(s => s.id === sheet.id
                          ? {
                            ...s, items: s.items.map((row, idx) => idx === i ? (() => {
                              const updated = { ...row, [f]: v }
                              if (f === "quantity" || f === "unit_price") {
                                updated.amount = (Number(updated.quantity) || 0) * (Number(updated.unit_price) || 0)
                              }
                              return updated
                            })() : row)
                          }
                          : s
                        ))
                      }}
                      roundUp={roundUp} onToggleRoundUp={() => setRoundUp(!roundUp)}
                      isRowMatched={isRowMatched}
                      onPasteRetrieval={(startRow, data) => {
                        setCustomSheets(prev => prev.map(s => {
                          if (s.id !== sheet.id) return s
                          const newItems = [...s.items]
                          data.forEach((val, rIdx) => {
                            const ri = startRow + rIdx
                            if (ri < newItems.length) {
                              newItems[ri] = { ...newItems[ri], retrieval_price: Number(val) || 0 }
                            }
                          })
                          return { ...s, items: newItems }
                        }))
                      }} />
                  </div>
                )}
              </div>
            ))}

          </div>
        </div>

        {/* 하단 액션 바 */}
        <div className="px-6 py-2.5 border-t bg-white shrink-0 flex items-center justify-between">
          {/* 좌측: Excel / 우측에 PDF */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const exportData = buildExportData()
                if (!exportData) return
                exportQuoteExcel(exportData).catch((e) => console.error("Excel 내보내기 오류:", e))
              }}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-slate-700 hover:border-slate-300 transition-colors"
            >
              <FileSpreadsheet className="h-3 w-3" /> Excel
            </button>
            <button
              disabled={pdfExporting}
              onClick={async () => {
                const exportData = buildExportData()
                if (!exportData) return
                setPdfExporting(true)
                try {
                  const { buildQuoteExcelBuffer } = await import("@/lib/quote-export")
                  const xlsxBuffer = await buildQuoteExcelBuffer(exportData)
                  if (!xlsxBuffer) return
                  const res = await fetch("/api/excel-to-pdf", { method: "POST", body: xlsxBuffer })
                  if (!res.ok) throw new Error(await res.text())
                  const pdfBlob = await res.blob()
                  const url = URL.createObjectURL(pdfBlob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = `견적서_${(exportData.title || "무제").replace(/[\\/:*?"<>|]/g, "_")}.pdf`
                  document.body.appendChild(a); a.click(); document.body.removeChild(a)
                  URL.revokeObjectURL(url)
                } catch (e) { console.error("PDF 내보내기 오류:", e) }
                finally { setPdfExporting(false) }
              }}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded border transition-colors ${pdfExporting ? "border-sky-aqua/50 text-sky-aqua bg-sky-aqua/5 cursor-wait" : "border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-slate-700 hover:border-slate-300"}`}
            >
              {pdfExporting ? (
                <><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> PDF 변환중...</>
              ) : (
                <><Download className="h-3 w-3" /> PDF</>
              )}
            </button>
          </div>
          {/* 우측: 저장 상태 */}
          <div className="flex items-center gap-2.5">
            {/* 자동저장 상태 표시 */}
            {autoSaveStatus === "saving" && (
              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                <Loader2 className="h-2.5 w-2.5 animate-spin" /> 저장 중...
              </span>
            )}
            {autoSaveStatus === "saved" && (
              <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-600 bg-green-100 rounded-full">
                <Check className="h-3 w-3" /> 저장됨
              </span>
            )}
            {autoSaveStatus === "error" && (
              <span className="text-[10px] text-red-500">자동저장 실패</span>
            )}
            {saveError && <span className="text-[10px] text-red-500">{saveError}</span>}
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
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium rounded-md transition-all ${supplierMode === "company"
                ? "bg-white text-slate-700 shadow-sm"
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
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium rounded-md transition-all ${supplierMode === "custom"
                ? "bg-white text-slate-700 shadow-sm"
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
                  className="h-3.5 w-3.5 accent-slate-700 rounded"
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
              className="w-full py-2 text-xs font-medium rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
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
                  className="flex items-center gap-1 text-[10px] text-slate-700 hover:text-slate-700/80 transition-colors"
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
            className="w-full mt-1 py-2 text-xs font-medium rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors">
            확인
          </button>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 AlertDialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[360px] p-6">
          <AlertDialogHeader className="space-y-2">
            <div className="flex items-center justify-center w-11 h-11 rounded-full bg-red-100 mx-auto mb-1">
              <Trash2 className="h-5 w-5 text-red-500" />
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
              className="flex-1 py-2 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-[#e8b8b7] transition-colors disabled:opacity-50"
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
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium rounded-md transition-all ${managerMode === "default"
                ? "bg-white text-slate-700 shadow-sm"
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
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium rounded-md transition-all ${managerMode === "custom"
                ? "bg-white text-slate-700 shadow-sm"
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
                  className="h-3.5 w-3.5 accent-slate-700 rounded"
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
              className="w-full py-2 text-xs font-medium rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
            >
              확인
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 가격표 피커 Dialog */}
      <Dialog open={pricePickerOpen} onOpenChange={setPricePickerOpen}>
        <DialogContent className="sm:max-w-[520px] p-0 gap-0 max-h-[80vh] flex flex-col" onInteractOutside={(e) => e.preventDefault()}>
          <PricePickerDialog
            items={priceItems}
            target={pricePickerTarget as "equip" | "install"}
            onSelect={applyPriceItem}
            onClose={() => setPricePickerOpen(false)}
            selectedItems={pricePickerTarget === "equip" ? equipItems : pricePickerTarget === "install" ? installItems : (customSheets.find(s => s.id === pricePickerTarget)?.items || [])}
          />
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}

// ===================================================
// 가격표 피커 Dialog 내부 컴포넌트
// ===================================================
function PricePickerDialog({ items, target, onSelect, onClose, selectedItems }: {
  items: PriceItem[]
  target: string
  onSelect: (item: PriceItem) => void
  onClose: () => void
  selectedItems: ItemRow[]
}) {
  const [activeTab, setActiveTab] = useState<string>(target === "equip" ? "장비" : "설치비")
  const [subFilter, setSubFilter] = useState<string>("전체")
  const [search, setSearch] = useState("")
  // 이번 세션에서 선택한 아이템 ID 추적
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set())

  // 장비/설치비 소분류 순서
  const EQUIP_SUB_ORDER = ["전체", "실외기", "실내기", "판넬", "분지관", "제어기기", "싱글", "HOME", "ETC", "미분류"]
  const INSTALL_SUB_ORDER = ["전체", "냉매배관", "보온재", "드레인", "덕트", "전기/배선", "받침대", "공사비", "미분류"]

  const subCategories = useMemo(() => {
    const order = activeTab === "장비" ? EQUIP_SUB_ORDER : INSTALL_SUB_ORDER
    const existing = new Set<string>()
    let hasNull = false
    items.forEach((item) => {
      if (item.category === activeTab) {
        if (item.sub_category) existing.add(item.sub_category)
        else hasNull = true
      }
    })
    const result = order.filter((s) => s === "전체" || existing.has(s))
    if (hasNull && !result.includes("미분류")) result.push("미분류")
    return result
  }, [items, activeTab])

  const filteredItems = useMemo(() => {
    let tabItems = items.filter((item) => item.category === activeTab)
    if (subFilter !== "전체") {
      if (subFilter === "미분류") {
        tabItems = tabItems.filter((item) => !item.sub_category)
      } else {
        tabItems = tabItems.filter((item) => item.sub_category === subFilter)
      }
    }
    if (search.trim()) {
      const query = search.trim().toLowerCase()
      tabItems = tabItems.filter(
        (item) =>
          item.product_name.toLowerCase().includes(query) ||
          (item.specification && item.specification.toLowerCase().includes(query))
      )
    }

    // 가격표 페이지와 동일한 정렬
    const subOrder = activeTab === "장비" ? EQUIP_SUB_ORDER : INSTALL_SUB_ORDER
    const getSpecNum = (spec: string | null): number => {
      if (!spec) return 9999
      if (spec.includes("소형")) return 1
      if (spec.includes("중형")) return 2
      if (spec.includes("대형")) return 3
      const match = spec.match(/(\d+\.?\d*)/)
      return match ? parseFloat(match[1]) : 9999
    }
    tabItems.sort((a, b) => {
      const ai = subOrder.indexOf(a.sub_category || "")
      const bi = subOrder.indexOf(b.sub_category || "")
      const orderA = ai === -1 ? 999 : ai
      const orderB = bi === -1 ? 999 : bi
      if (orderA !== orderB) return orderA - orderB
      if (activeTab === "장비") {
        const getType = (name: string) => name.replace(/[\d.]+\s*(HP|평|마력)/g, "").replace(/\(.*?\)/g, "").trim()
        const typeCmp = getType(a.product_name).localeCompare(getType(b.product_name))
        if (typeCmp !== 0) return typeCmp
        const getNum = (name: string) => Number(name.match(/(\d+)\s*(HP|평|마력)/)?.[1] || "0")
        const numDiff = getNum(a.product_name) - getNum(b.product_name)
        if (numDiff !== 0) return numDiff
      }
      if (activeTab === "설치비") {
        const nameCmp = a.product_name.localeCompare(b.product_name)
        if (nameCmp !== 0) return nameCmp
        const specDiff = getSpecNum(a.specification) - getSpecNum(b.specification)
        if (specDiff !== 0) return specDiff
        return (a.specification || "").localeCompare(b.specification || "")
      }
      return a.product_name.localeCompare(b.product_name)
    })

    return tabItems
  }, [items, activeTab, subFilter, search])

  // 탭 전환 시 소분류 초기화
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setSubFilter("전체")
    setSearch("")
  }

  const handleSelect = (item: PriceItem) => {
    onSelect(item)
    setPickedIds((prev) => new Set(prev).add(item.id))
  }

  return (
    <>
      {/* 헤더 */}
      <div className="px-5 pt-5 pb-3">
        <DialogHeader className="space-y-1">
          <DialogTitle className="font-sans text-sm font-semibold">가격표에서 선택</DialogTitle>
          <DialogDescription className="text-[11px] text-gray-400">
            {pickedIds.size > 0
              ? <span className="text-green-600 font-medium">{pickedIds.size}개 선택됨</span>
              : "품목을 클릭하면 빈 행에 자동 입력됩니다"
            }
          </DialogDescription>
        </DialogHeader>

        {/* 탭: 장비 / 설치비 */}
        <div className="flex gap-1 mt-3 p-0.5 bg-gray-100 rounded-lg">
          {(["장비", "설치비"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => handleTabChange(tab)}
              className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all ${activeTab === tab
                ? "bg-white text-slate-700 shadow-sm"
                : "text-gray-400 hover:text-gray-600"
                }`}>
              {tab === "장비" ? <><Package className="h-3 w-3 inline mr-1" />장비</> : <><Wrench className="h-3 w-3 inline mr-1" />설치비</>}
              <span className="ml-1 text-[10px] text-gray-400">({items.filter((i) => i.category === tab).length})</span>
            </button>
          ))}
        </div>

        {/* 소분류 필터 */}
        <div className="flex flex-wrap gap-1 mt-2">
          {subCategories.map((sub) => (
            <button key={sub} type="button" onClick={() => setSubFilter(sub)}
              className={`px-2 py-0.5 text-[10px] rounded-full transition-all ${subFilter === sub
                ? "bg-slate-100 text-slate-700 font-medium"
                : "bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                }`}>
              {sub}
            </button>
          ))}
        </div>

        {/* 검색 */}
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="품목명 또는 규격으로 검색..."
            className="pl-8 pr-8 h-8 text-xs border-gray-200 focus-visible:ring-1 focus-visible:ring-slate-300/50"
          />
          {search && (
            <button onClick={() => setSearch("")} type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <XIcon className="h-3.5 w-3.5 text-gray-300 hover:text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* 아이템 리스트 */}
      <div className="flex-1 overflow-y-auto border-t border-gray-100 min-h-0">
        {filteredItems.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-xs text-gray-400">
            검색 결과가 없습니다
          </div>
        ) : (
          <div>
            {filteredItems.map((item) => {
              const isPicked = pickedIds.has(item.id)
              return (
                <button key={item.id} type="button" onClick={() => handleSelect(item)}
                  className={`w-full px-5 py-2.5 flex items-center gap-3 text-left border-b border-gray-50 transition-colors ${isPicked
                    ? "bg-green-50 hover:bg-green-100"
                    : "hover:bg-gray-50"
                    }`}>
                  {/* 선택 표시 */}
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isPicked ? "bg-green-600" : "bg-gray-100"
                    }`}>
                    {isPicked ? (
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    ) : (
                      <Plus className="h-3 w-3 text-gray-400" />
                    )}
                  </div>
                  {/* 품목 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-gray-900 truncate">{item.product_name}</span>
                      {item.sub_category && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-400 shrink-0">{item.sub_category}</span>
                      )}
                    </div>
                    {item.specification && (
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">{item.specification}</p>
                    )}
                  </div>
                  {/* 단가 */}
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-gray-900 tabular-nums">{formatCurrency(item.unit_price)}</p>
                    {item.unit && <p className="text-[9px] text-gray-400">/{item.unit}</p>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 하단 닫기 버튼 */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
        <button onClick={onClose} type="button"
          className="w-full py-2 text-xs font-medium rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors">
          닫기
        </button>
      </div>
    </>
  )
}

// ===================================================
// 좌측: 품목 테이블
// ===================================================
function ItemsTable({ items, updateItem, addRow, removeRow, blankIdx, onToggleBlank, isRowMatched, clearRow, onPasteCells }: {
  items: ItemRow[]
  updateItem: (index: number, field: keyof ItemRow, value: string | number) => void
  addRow: () => void
  removeRow: (index: number) => void
  blankIdx: number | null
  onToggleBlank: (idx: number) => void
  isRowMatched?: (row: ItemRow) => boolean
  clearRow?: (index: number) => void
  onPasteCells?: (startRow: number, startCol: number, data: string[][]) => void
}) {
  // 엑셀 붙여넣기 핸들러: 포커스된 셀 위치 기준으로 데이터 채움
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain")
    // 탭이 있으면 엑셀에서 복사한 데이터로 판단 (일반 텍스트 붙여넣기는 그대로 통과)
    if (!text || !text.includes("\t") || !onPasteCells) return

    e.preventDefault()
    e.stopPropagation()

    // 현재 포커스된 셀의 행/열 인덱스 가져오기
    const active = document.activeElement as HTMLElement | null
    const rowAttr = active?.getAttribute("data-row")
    const colAttr = active?.getAttribute("data-col")
    const startRow = rowAttr !== null && rowAttr !== undefined ? Number(rowAttr) : 0
    const startCol = colAttr !== null && colAttr !== undefined ? Number(colAttr) : 0

    // 클립보드 데이터를 2차원 배열로 파싱
    const lines = text.split(/\r?\n/).filter((line) => line.trim())
    const data: string[][] = []
    for (const line of lines) {
      const cols = line.split("\t")
      if (cols.every((c) => !c.trim())) continue
      data.push(cols)
    }

    if (data.length > 0) {
      onPasteCells(startRow, startCol, data)
    }
  }, [onPasteCells])

  return (
    <div onPaste={handlePaste}>
      {/* 헤더 */}
      <div className="flex">
        <div className={`flex-1 grid grid-cols-[24px_180px_1fr_42px_50px_110px_120px_80px] bg-slate-100 border-y border-slate-300 ${HEADER_H}`}>
          <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">#</div>
          <div className="px-2 flex items-center justify-center text-[11px] font-medium text-gray-600">품명</div>
          <div className="px-2 flex items-center justify-center text-[11px] font-medium text-gray-600">모델 및 사양</div>
          <div className="px-2 flex items-center justify-center text-[11px] font-medium text-gray-600">단위</div>
          <div className="px-2 flex items-center justify-end text-[11px] font-medium text-gray-600">수량</div>
          <div className="px-2 flex items-center justify-end text-[11px] font-medium text-gray-600">단가</div>
          <div className="px-2 flex items-center justify-end text-[11px] font-medium text-gray-600">공급가</div>
          <div className="px-2 flex items-center justify-center text-[11px] font-medium text-gray-600">비고</div>
        </div>
        <div className={`w-[36px] shrink-0 ${HEADER_H}`} />
      </div>
      {/* 행 */}
      {items.map((item, idx) => {
        const isMatched = isRowMatched?.(item)
        return (
          <div key={idx} className={`flex border-b border-gray-100 hover:bg-gray-50 transition-colors ${ROW_H}`}>
            <div className={`flex-1 grid grid-cols-[24px_180px_1fr_42px_50px_110px_120px_80px] ${ROW_H}`}>
              <div className={`relative flex items-center justify-center text-[10px] text-gray-300`}>
                {item.item_name.trim() && !isMatched && (
                  <span className="absolute top-0 left-0 w-0 h-0"
                    style={{ borderTop: "6px solid #F0D2D1", borderRight: "6px solid transparent" }} />
                )}
                {idx + 1}
              </div>
              <CellInput value={item.item_name} onChange={(v) => updateItem(idx, "item_name", v)} placeholder="품명 *" center row={idx} col={0} />
              <CellInput value={item.specification} onChange={(v) => updateItem(idx, "specification", v)} placeholder="모델/사양" center row={idx} col={1} />
              <CellInput value={item.unit} onChange={(v) => updateItem(idx, "unit", v)} placeholder="식" center row={idx} col={2} />
              <CellNumber value={item.quantity} onChange={(v) => updateItem(idx, "quantity", v)} row={idx} col={3} />
              <div className="flex items-center justify-end px-2 text-xs text-gray-900 tabular-nums bg-gray-50">
                {item.unit_price > 0 ? item.unit_price.toLocaleString() : ""}
              </div>
              <div className="flex items-center justify-end px-2 text-xs text-gray-900 tabular-nums bg-gray-50">
                {item.quantity * item.unit_price > 0 ? (item.quantity * item.unit_price).toLocaleString() : ""}
              </div>
              <CellInput value={item.memo} onChange={(v) => updateItem(idx, "memo", v)} placeholder="" center row={idx} col={4} />
            </div>
            {/* 지우개(초기화) + X(행 삭제) */}
            <div className="w-[36px] shrink-0 flex items-center justify-center gap-0.5">
              {clearRow && (
                <button onClick={() => clearRow(idx)} title="데이터 초기화"
                  className="p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Eraser className="h-3 w-3" />
                </button>
              )}
              {items.length > 1 && (
                <button onClick={() => removeRow(idx)} title="행 삭제"
                  className="p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <XIcon className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )
      })}
      <div className="px-4 py-2">
        <button onClick={addRow}
          className="w-full py-2 flex items-center justify-center gap-1.5 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all">
          <Plus className="h-4 w-4" /> 행 추가
        </button>
      </div>
    </div>
  )
}

// ===================================================
// 우측: 내부 단가 행 (# + 단가 컬럼)
// ===================================================
// 내부 단가 그리드 템플릿: #/반출가/DC율/매입단가/매입총액/MG율/제안가/이윤/장려금%/장려금
const PRICING_COLS = "grid-cols-[24px_80px_44px_72px_80px_44px_72px_72px_44px_72px]"

function PricingRows({ items, updateItem, roundUp, onToggleRoundUp, isRowMatched, onPasteRetrieval }: {
  items: ItemRow[]
  updateItem: (index: number, field: keyof ItemRow, value: string | number) => void
  roundUp?: boolean
  onToggleRoundUp?: () => void
  isRowMatched?: (row: ItemRow) => boolean
  onPasteRetrieval?: (startRow: number, data: string[][]) => void
}) {
  // 반출가 열 붙여넣기 핸들러: 포커스된 행부터 세로로 채움
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain")
    if (!text || !onPasteRetrieval) return
    // 탭 또는 개행이 있으면 엑셀 데이터로 판단
    if (!text.includes("\t") && !text.includes("\n")) return

    // 반출가 셀에서만 동작 (data-col="0")
    const active = document.activeElement as HTMLElement | null
    const colAttr = active?.getAttribute("data-col")
    if (colAttr !== "0") return

    e.preventDefault()
    e.stopPropagation()

    const rowAttr = active?.getAttribute("data-row")
    const startRow = rowAttr !== null && rowAttr !== undefined ? Number(rowAttr) : 0

    const lines = text.split(/\r?\n/).filter((line) => line.trim())
    const data: string[][] = []
    for (const line of lines) {
      const cols = line.split("\t")
      if (cols.every((c) => !c.trim())) continue
      data.push(cols)
    }

    if (data.length > 0) {
      onPasteRetrieval(startRow, data)
    }
  }, [onPasteRetrieval])

  return (
    <div onPaste={handlePaste}>
      {/* 헤더 - 10개 열 */}
      <div className={`relative grid ${PRICING_COLS} bg-slate-100 border-y border-slate-300 ${HEADER_H}`}>
        {/* 제안가 열 가운데 위에 단위↑ 토글 (absolute로 행 높이에 영향 없음) */}
        {onToggleRoundUp && (
          <button onClick={onToggleRoundUp}
            className={`absolute -top-[13px] z-10 text-[9px] leading-none px-1.5 py-[2px] rounded-sm transition-all ${roundUp
              ? "bg-slate-100 text-slate-700"
              : "bg-gray-100 text-gray-400"
              }`}
            style={{ left: 364, width: 80, textAlign: "center" }}>
            {roundUp ? "단위↑ ON" : "단위↑ OFF"}
          </button>
        )}
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">#</div>
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">반출가</div>
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">DC율</div>
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">매입단가</div>
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">매입총액</div>
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">MG율</div>
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">제안가</div>
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">이윤</div>
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">장려%</div>
        <div className="px-1 flex items-center justify-center text-[11px] font-medium text-gray-600">장려금</div>
      </div>
      {/* 데이터 행 */}
      {items.map((item, idx) => {
        const isMatched = isRowMatched?.(item)
        return (
          <div key={idx} className={`grid ${PRICING_COLS} border-b border-gray-100 hover:bg-white/50 transition-colors ${ROW_H}`}>
            <div className="relative flex items-center justify-center text-[10px] text-gray-300">
              {item.item_name.trim() && !isMatched && (
                <span className="absolute top-0 left-0 w-0 h-0"
                  style={{ borderTop: "6px solid #F0D2D1", borderRight: "6px solid transparent" }} />
              )}
              {idx + 1}
            </div>
            <CellNumber value={item.retrieval_price} onChange={(v) => updateItem(idx, "retrieval_price", v)} row={idx} col={0} />
            <CellPercent value={item.discount_rate} onChange={(v) => updateItem(idx, "discount_rate", v)} />
            <div className="flex items-center justify-end px-1 text-xs text-gray-900 tabular-nums bg-gray-100/60">{item.purchase_unit_price > 0 ? item.purchase_unit_price.toLocaleString() : ""}</div>
            <div className="flex items-center justify-end px-1 text-xs text-gray-900 tabular-nums bg-gray-100/60">{item.purchase_amount > 0 ? item.purchase_amount.toLocaleString() : ""}</div>
            <CellPercent value={item.margin_rate} onChange={(v) => updateItem(idx, "margin_rate", v)} />
            <div className="flex items-center justify-end px-1 text-xs text-gray-900 tabular-nums bg-gray-100/60">{item.unit_price > 0 ? item.unit_price.toLocaleString() : ""}</div>
            <div className={`flex items-center justify-end px-1 text-xs font-semibold tabular-nums bg-gray-100/60 ${item.profit < 0 ? "text-red-500" : "text-green-600"}`}>{item.profit !== 0 ? item.profit.toLocaleString() : ""}</div>
            <CellPercent value={item.incentive_rate} onChange={(v) => updateItem(idx, "incentive_rate", v)} />
            <div className="flex items-center justify-end px-1 text-xs text-gray-900 tabular-nums bg-gray-100/60">{item.purchase_amount > 0 && item.incentive_rate > 0 ? Math.round(item.purchase_amount * item.incentive_rate / 100).toLocaleString() : ""}</div>
          </div>
        )
      })}
      {/* 열 합계 */}
      {items.some((r) => r.retrieval_price > 0) && (() => {
        const sumRetrieval = items.reduce((s, r) => s + r.retrieval_price, 0)
        const sumPurchaseUnit = items.reduce((s, r) => s + r.purchase_unit_price, 0)
        const sumPurchaseAmt = items.reduce((s, r) => s + r.purchase_amount, 0)
        const sumUnitPrice = items.reduce((s, r) => s + r.unit_price, 0)
        const sumProfit = items.reduce((s, r) => s + r.profit, 0)
        return (
          <div className={`grid ${PRICING_COLS} border-t-2 border-gray-300 bg-gray-50 ${ROW_H}`}>
            <div className="flex items-center justify-center text-[10px] font-bold text-gray-500">Σ</div>
            <div className="flex items-center justify-end px-1 text-xs font-semibold text-gray-900 tabular-nums">{sumRetrieval > 0 ? sumRetrieval.toLocaleString() : ""}</div>
            <div />
            <div className="flex items-center justify-end px-1 text-xs font-semibold text-gray-900 tabular-nums">{sumPurchaseUnit > 0 ? sumPurchaseUnit.toLocaleString() : ""}</div>
            <div className="flex items-center justify-end px-1 text-xs font-semibold text-gray-900 tabular-nums">{sumPurchaseAmt > 0 ? sumPurchaseAmt.toLocaleString() : ""}</div>
            <div />
            <div className="flex items-center justify-end px-1 text-xs font-semibold text-gray-900 tabular-nums">{sumUnitPrice > 0 ? sumUnitPrice.toLocaleString() : ""}</div>
            <div className={`flex items-center justify-end px-1 text-xs font-bold tabular-nums ${sumProfit < 0 ? "text-red-500" : "text-green-600"}`}>{sumProfit !== 0 ? sumProfit.toLocaleString() : ""}</div>
            <div />
            <div className="flex items-center justify-end px-1 text-xs font-semibold text-gray-900 tabular-nums">{(() => { const s = items.reduce((a, r) => a + (r.purchase_amount > 0 && r.incentive_rate > 0 ? Math.round(r.purchase_amount * r.incentive_rate / 100) : 0), 0); return s > 0 ? s.toLocaleString() : ""; })()}</div>
          </div>
        )
      })()}
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
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
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
      <span className={`tabular-nums ${highlight ? "font-bold text-green-600" : "font-medium text-gray-700"}`}>
        {percent ? `${percent}%` : formatCurrency(value)}
      </span>
    </div>
  )
}

function CellInput({ value, onChange, placeholder, center, row, col }: {
  value: string; onChange: (v: string) => void; placeholder?: string; center?: boolean; row?: number; col?: number
}) {
  return (
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      data-row={row} data-col={col}
      className={`w-full h-full px-2 text-xs bg-white border-0 focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder:text-gray-300 ${center ? "text-center" : ""}`} />
  )
}

function CellNumber({ value, onChange, row, col }: { value: number; onChange: (v: number) => void; row?: number; col?: number }) {
  const ref = useRef<HTMLInputElement>(null)
  const [displayVal, setDisplayVal] = useState(value > 0 ? value.toLocaleString() : "")
  useEffect(() => { setDisplayVal(value > 0 ? value.toLocaleString() : "") }, [value])
  return (
    <input ref={ref} type="text" inputMode="numeric"
      value={displayVal}
      data-row={row} data-col={col}
      onChange={(e) => {
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
