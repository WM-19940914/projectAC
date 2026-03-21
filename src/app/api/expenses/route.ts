import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdminOrSales } from "@/lib/api-auth"
import { logError } from "@/lib/logger"
import { revalidatePath } from "next/cache"

// GET /api/expenses?request_id=xxx — 의뢰별 지출 목록 조회
export async function GET(req: NextRequest) {
  try {
    const requestId = req.nextUrl.searchParams.get("request_id")
    if (!requestId) {
      return NextResponse.json({ error: "request_id 필요" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("expenses")
      .select("id, category, expense_date, amount_excl_tax, vendor, payment_method, description, is_paid, tax_invoice_received")
      .eq("request_id", requestId)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (e: unknown) {
    logError("[GET /api/expenses]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}

// POST /api/expenses — 지출 추가
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { request_id, category, expense_date, amount, vendor, payment_method, description, is_unpaid, needs_tax_invoice } = body

    if (!request_id) {
      return NextResponse.json({ error: "request_id 필요" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        request_id,
        category,
        expense_date,
        amount_excl_tax: amount,
        // VAT 포함 금액도 함께 저장
        amount_incl_tax: Math.floor(amount * 1.1),
        tax_amount: Math.floor(amount * 0.1),
        vendor: vendor || null,
        payment_method: payment_method || null,
        description: description || null,
        // is_unpaid(미지급) → is_paid 반전
        is_paid: !is_unpaid,
        // needs_tax_invoice → tax_invoice_received
        tax_invoice_received: needs_tax_invoice ? "미수령" : "수령",
      })
      .select("id")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidatePath("/requests")
    return NextResponse.json({ success: true, id: data.id })
  } catch (e: unknown) {
    logError("[POST /api/expenses]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}

// PATCH /api/expenses — 지출 수정
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, category, expense_date, amount, vendor, payment_method, description, is_unpaid, needs_tax_invoice } = body

    if (!id) {
      return NextResponse.json({ error: "id 필요" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from("expenses")
      .update({
        category,
        expense_date,
        amount_excl_tax: amount,
        amount_incl_tax: Math.floor(amount * 1.1),
        tax_amount: Math.floor(amount * 0.1),
        vendor: vendor || null,
        payment_method: payment_method || null,
        description: description || null,
        is_paid: !is_unpaid,
        tax_invoice_received: needs_tax_invoice ? "미수령" : "수령",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidatePath("/requests")
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    logError("[PATCH /api/expenses]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}

// DELETE /api/expenses — 지출 삭제
export async function DELETE(req: NextRequest) {
  try {
    // 역할 검증: admin 또는 sales만 삭제 가능
    const denied = await requireAdminOrSales(req)
    if (denied) return denied

    const { id } = await req.json()

    if (!id) {
      return NextResponse.json({ error: "id 필요" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from("expenses").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidatePath("/requests")
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    logError("[DELETE /api/expenses]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}
