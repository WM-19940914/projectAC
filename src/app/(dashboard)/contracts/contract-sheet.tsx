"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Contract } from "@/types"
import { cn } from "@/lib/utils"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2, Plus, Calendar, Save, Trash2, Mail, Phone, Hash, User } from "lucide-react"
import { SETTLEMENT_TYPES } from "@/lib/constants"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

interface CustomerOption {
    id: string
    company_name: string
    contact_name: string | null
    phone: string | null
    email: string | null
    address: string | null
    representative: string | null
    business_number: string | null
    memo: string | null
}

interface ContractSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    contract?: Contract
    customers: CustomerOption[]
}

export default function ContractSheet({ open, onOpenChange, contract, customers }: ContractSheetProps) {
    const router = useRouter()
    const isEdit = !!contract

    const [isLoading, setIsLoading] = useState(false)

    // 폼 상태
    const [formData, setFormData] = useState({
        name: "",
        customer_id: "",
        amount: 0,
        vat_inclusive: false,
        settlement_type: [] as string[],
        start_date: "",
        end_date: "",
        memo: "",
    })

    // 고객 검색 (다이얼로그 팝업용)
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
    const [customerSearch, setCustomerSearch] = useState("")

    // 선택된 고객 정보
    const selectedCustomer = customers.find(c => c.id === formData.customer_id)

    useEffect(() => {
        if (open) {
            if (contract) {
                setFormData({
                    name: contract.name || "",
                    customer_id: contract.customer_id || "",
                    amount: contract.amount || 0,
                    vat_inclusive: contract.vat_inclusive || false,
                    settlement_type: contract.settlement_type || [],
                    start_date: contract.start_date || "",
                    end_date: contract.end_date || "",
                    memo: contract.memo || "",
                })
            } else {
                setFormData({
                    name: "",
                    customer_id: "",
                    amount: 0,
                    vat_inclusive: false,
                    settlement_type: [],
                    start_date: "",
                    end_date: "",
                    memo: "",
                })
            }
        }
    }, [open, contract])

    const handleCustomerSelect = (customerId: string) => {
        const cust = customers.find(c => c.id === customerId)
        if (cust) {
            // 신규 생성일 경우, 계약명을 지능적으로 세팅해 줍니다
            if (!isEdit && !formData.name) {
                setFormData(prev => ({
                    ...prev,
                    customer_id: customerId,
                    name: `[${cust.company_name}] 계약`
                }))
            } else {
                setFormData(prev => ({ ...prev, customer_id: customerId }))
            }
        }
        setIsCustomerModalOpen(false)
    }

    const toggleSettlementType = (type: string) => {
        setFormData(prev => {
            const current = prev.settlement_type || []
            if (current.includes(type)) {
                return { ...prev, settlement_type: current.filter(t => t !== type) }
            } else {
                return { ...prev, settlement_type: [...current, type] }
            }
        })
    }

    const handleSave = async () => {
        if (!formData.name.trim()) return alert("계약명을 입력해주세요.")
        if (!formData.customer_id) return alert("고객을 선택해주세요.")

        setIsLoading(true)
        try {
            const payload = {
                name: formData.name,
                customer_id: formData.customer_id,
                amount: Number(formData.amount) || 0,
                vat_inclusive: formData.vat_inclusive,
                settlement_type: formData.settlement_type,
                start_date: formData.start_date || null,
                end_date: formData.end_date || null,
                memo: formData.memo || null,
                status: contract?.status || "계약 준비 중",
            }

            if (isEdit) {
                await fetch("/api/contracts", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: contract.id, ...payload })
                })
            } else {
                await fetch("/api/contracts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                })
            }

            router.refresh()
            onOpenChange(false)
        } catch (e) {
            console.error(e)
            alert("저장 중 오류가 발생했습니다.")
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!contract || !confirm("이 계약을 정말 삭제하시겠습니까?")) return

        setIsLoading(true)
        try {
            await fetch(`/api/contracts?id=${contract.id}`, { method: "DELETE" })
            router.refresh()
            onOpenChange(false)
        } catch (e) {
            console.error(e)
            alert("삭제 중 오류가 발생했습니다.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="w-full sm:max-w-4xl p-0 flex flex-col sm:flex-row h-full overflow-hidden bg-gray-50/50">

                    {/* 좌측: 계약 폼 영억 */}
                    <div className="flex-1 flex flex-col h-full bg-white border-r border-gray-200">
                        <SheetHeader className="p-6 border-b border-gray-100 shrink-0">
                            <SheetTitle className="font-heading text-xl">
                                {isEdit ? "계약 상세" : "새 계약 생성"}
                            </SheetTitle>
                        </SheetHeader>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* 고객 연동 */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">
                                    고객사 연동 <span className="text-soft-blush">*</span>
                                </Label>
                                {selectedCustomer ? (
                                    <div className="flex items-center justify-between p-3 rounded-lg border border-sky-aqua/30 bg-sky-aqua/5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-full bg-white text-sky-aqua shadow-sm">
                                                <Building2 className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 text-sm">{selectedCustomer.company_name}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    {selectedCustomer.contact_name || "담당자 미정"} {selectedCustomer.phone && `· ${selectedCustomer.phone}`}
                                                </p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setIsCustomerModalOpen(true)} className="text-xs text-gray-500 hover:text-sky-aqua">
                                            변경
                                        </Button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsCustomerModalOpen(true)}
                                        className="w-full h-[64px] border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center gap-2 text-sm text-gray-500 hover:border-sky-aqua hover:text-sky-aqua hover:bg-sky-aqua/5 transition-all"
                                    >
                                        <Plus className="h-4 w-4" /> 고객사 선택하기
                                    </button>
                                )}
                            </div>

                            {/* 계약명 */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">
                                    계약명 <span className="text-soft-blush">*</span>
                                </Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="예: [현장명] 계약"
                                    className="bg-gray-50 focus:bg-white"
                                />
                            </div>

                            {/* 계약 금액 & 부가세 */}
                            <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">계약 금액</Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            value={formData.amount === 0 ? "" : formData.amount}
                                            onChange={(e) => setFormData(prev => ({ ...prev, amount: Number(e.target.value) || 0 }))}
                                            placeholder="얼마에 진행하시나요?"
                                            className="bg-gray-50 focus:bg-white pr-8 text-right font-sans tabular-nums font-semibold"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">원</span>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 pb-2.5">
                                    <Checkbox
                                        id="vat-check"
                                        checked={formData.vat_inclusive}
                                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, vat_inclusive: !!checked }))}
                                        className="data-[state=checked]:bg-sky-aqua data-[state=checked]:border-sky-aqua"
                                    />
                                    <label htmlFor="vat-check" className="text-sm font-medium leading-none text-gray-700 cursor-pointer">
                                        부가세 포함
                                    </label>
                                </div>
                            </div>

                            {/* 정산 형태 (다중 체크박스) */}
                            <div className="space-y-3">
                                <Label className="text-sm font-semibold">정산 형태</Label>
                                <div className="flex flex-wrap gap-2">
                                    {SETTLEMENT_TYPES.map(type => {
                                        const isSelected = formData.settlement_type?.includes(type)
                                        return (
                                            <button
                                                key={type}
                                                onClick={() => toggleSettlementType(type)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                                                    isSelected
                                                        ? "bg-sky-aqua/10 text-sky-aqua border-sky-aqua shadow-sm"
                                                        : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                                                )}
                                            >
                                                {type}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* 계약 시작일 / 종료일 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> 착수일</Label>
                                    <Input
                                        type="date"
                                        value={formData.start_date}
                                        onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                                        className="bg-gray-50 focus:bg-white text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> 종료일</Label>
                                    <Input
                                        type="date"
                                        value={formData.end_date}
                                        onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                                        className="bg-gray-50 focus:bg-white text-sm"
                                    />
                                </div>
                            </div>

                            {/* 비고/메모 */}
                            <div className="space-y-2 pb-8">
                                <Label className="text-sm font-semibold">비고</Label>
                                <Textarea
                                    value={formData.memo}
                                    onChange={(e) => setFormData(prev => ({ ...prev, memo: e.target.value }))}
                                    placeholder="특이사항이나 메모를 입력하세요"
                                    className="bg-gray-50 focus:bg-white min-h-[100px] resize-none"
                                />
                            </div>

                        </div>

                        {/* 하단 액션 버튼 */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0 flex items-center justify-between gap-3">
                            {isEdit ? (
                                <Button variant="outline" className="text-soft-blush border-soft-blush/20 hover:bg-soft-blush/10 hover:text-soft-blush" onClick={handleDelete} disabled={isLoading}>
                                    <Trash2 className="h-4 w-4 mr-2" /> 삭제
                                </Button>
                            ) : (
                                <div />
                            )}

                            <div className="flex items-center gap-2">
                                <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading} className="hover:bg-gray-200">
                                    취소
                                </Button>
                                <Button onClick={handleSave} disabled={isLoading} className="bg-sky-aqua hover:bg-sky-aqua/90 text-white min-w-[100px]">
                                    {isLoading ? "저장 중..." : <><Save className="h-4 w-4 mr-2" /> 저장</>}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* 우측: 고객사 정보 프리뷰 */}
                    <div className="hidden sm:flex flex-col w-[320px] bg-slate-50 border-l border-gray-200">
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="font-heading font-semibold text-gray-900 flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-tropical-teal" /> 고객 정보
                            </h3>
                        </div>

                        <div className="flex-1 p-6 overflow-y-auto">
                            {selectedCustomer ? (
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="font-bold text-lg text-gray-900 mb-1">{selectedCustomer.company_name}</h4>
                                        {selectedCustomer.business_number && (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-white border border-gray-200 text-xs font-medium text-gray-600">
                                                <Hash className="h-3 w-3 text-gray-400" />
                                                {selectedCustomer.business_number}
                                            </span>
                                        )}
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-gray-200">
                                        <div>
                                            <Label className="text-[11px] text-gray-400 mb-1 flex items-center gap-1"><User className="h-3 w-3" /> 담당자</Label>
                                            <p className="text-sm font-medium text-gray-900">{selectedCustomer.contact_name || "미등록"}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label className="text-[11px] text-gray-400 mb-1 flex items-center gap-1"><Phone className="h-3 w-3" /> 연락처</Label>
                                                <p className="text-sm font-medium text-gray-900">{selectedCustomer.phone || "-"}</p>
                                            </div>
                                            <div>
                                                <Label className="text-[11px] text-gray-400 mb-1 flex items-center gap-1"><Mail className="h-3 w-3" /> 이메일</Label>
                                                <p className="text-sm font-medium text-gray-900 truncate" title={selectedCustomer.email || ""}>{selectedCustomer.email || "-"}</p>
                                            </div>
                                        </div>

                                        <div>
                                            <Label className="text-[11px] text-gray-400 mb-1 flex items-center gap-1"><Building2 className="h-3 w-3" /> 주소</Label>
                                            <p className="text-sm text-gray-800 leading-relaxed">{selectedCustomer.address || "미등록 주소지"}</p>
                                        </div>

                                        {selectedCustomer.memo && (
                                            <div>
                                                <Label className="text-[11px] text-gray-400 mb-1">고객사 노트</Label>
                                                <div className="p-3 bg-white rounded-lg border border-vanilla-custard border-dashed">
                                                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedCustomer.memo}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                                    <div className="h-12 w-12 rounded-full bg-gray-200/50 flex items-center justify-center mb-4">
                                        <User className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">선택된 고객사가 없습니다</p>
                                    <p className="text-[11px] text-gray-400">좌측 폼에서 고객을 선택하면<br />여기에 상세 정보가 표시됩니다</p>
                                </div>
                            )}
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* 고객 검색 모달 */}
            <Dialog open={isCustomerModalOpen} onOpenChange={setIsCustomerModalOpen}>
                <DialogContent className="sm:max-w-md p-0 overflow-hidden">
                    <DialogHeader className="p-4 border-b bg-gray-50">
                        <DialogTitle>고객사 검색</DialogTitle>
                    </DialogHeader>
                    <div className="p-4">
                        <Input
                            autoFocus
                            placeholder="회사명, 담당자 이름 검색..."
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            className="mb-4"
                        />
                        <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1">
                            {customers
                                .filter(c =>
                                    c.company_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                                    (c.contact_name && c.contact_name.toLowerCase().includes(customerSearch.toLowerCase()))
                                )
                                .map(cust => (
                                    <button
                                        key={cust.id}
                                        onClick={() => handleCustomerSelect(cust.id)}
                                        className="w-full flex flex-col text-left p-3 hover:bg-sky-aqua/5 rounded-lg border border-transparent hover:border-sky-aqua/20 transition-all group"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold text-sm text-gray-900 group-hover:text-sky-aqua transition-colors">{cust.company_name}</span>
                                            <span className="text-xs text-gray-400 font-sans">{cust.contact_name}</span>
                                        </div>
                                        {cust.phone && <span className="text-xs text-gray-500">{cust.phone}</span>}
                                    </button>
                                ))
                            }
                            {customers.length > 0 && customers.filter(c => c.company_name.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                                <p className="text-sm text-gray-500 text-center py-8">검색 결과가 없습니다.</p>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
