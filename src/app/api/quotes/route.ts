import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

function hasMeaningfulItem(item: Record<string, unknown>): boolean {
  const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0
  return (
    hasText(item.item_name) ||
    hasText(item.specification) ||
    hasText(item.unit) ||
    hasText(item.memo) ||
    (Number(item.quantity) || 0) > 0 ||
    (Number(item.unit_price) || 0) > 0 ||
    (Number(item.retrieval_price) || 0) > 0
  )
}

function normalizeOptionalId(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function ensureRequestExists(
  supabase: ReturnType<typeof createAdminClient>,
  requestId: string
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { data, error } = await supabase
    .from("requests")
    .select("id")
    .eq("id", requestId)
    .maybeSingle()

  if (error) {
    return {
      ok: false,
      response: NextResponse.json({ error: "의뢰 확인 중 오류가 발생했습니다." }, { status: 500 }),
    }
  }

  if (!data) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "선택한 의뢰를 찾을 수 없습니다. 새로고침 후 다시 시도해주세요." },
        { status: 400 }
      ),
    }
  }

  return { ok: true }
}

// 견적서 목록 조회 (request_id 필터 지원)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const requestId = searchParams.get("request_id")
    const id = searchParams.get("id")

    const supabase = createAdminClient()

    // 단건 조회 (품목 포함)
    if (id) {
      const { data, error } = await supabase
        .from("quotations")
        .select(`
          *,
          items:quotation_items(*),
          customer:customers!quotations_customer_id_fkey(id, company_name),
          request:requests!quotations_request_id_fkey(id, title)
        `)
        .eq("id", id)
        .order("item_order", { referencedTable: "quotation_items", ascending: true })
        .single()

      if (error) {
        console.error("[/api/quotes]", error.message)
        return NextResponse.json({ error: "견적서 처리에 실패했습니다" }, { status: 500 })
      }
      return NextResponse.json({ data })
    }

    // 목록 조회
    let query = supabase
      .from("quotations")
      .select(`
        *,
        items:quotation_items(*),
        customer:customers!quotations_customer_id_fkey(id, company_name),
        request:requests!quotations_request_id_fkey(id, title)
      `)
      .order("created_at", { ascending: false })

    if (requestId) {
      query = query.eq("request_id", requestId)
    }

    const { data, error } = await query

    if (error) {
      console.error("[/api/quotes]", error.message)
      return NextResponse.json({ error: "견적서 처리에 실패했습니다" }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (e: unknown) {
    console.error("[/api/quotes]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}

// 견적서 생성 (헤더 + 품목 한 번에)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { items, ...header } = body

    if (!header.title?.trim()) {
      return NextResponse.json({ error: "제목은 필수입니다" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const requestId = normalizeOptionalId(header.request_id)
    const customerId = normalizeOptionalId(header.customer_id)

    if (requestId) {
      const requestValidation = await ensureRequestExists(supabase, requestId)
      if (!requestValidation.ok) return requestValidation.response
    }

    // 견적번호 생성: Q-YYYYMMDD-NNN 형식
    const today = new Date().toLocaleDateString("sv-SE").replace(/-/g, "")
    const { count } = await supabase
      .from("quotations")
      .select("*", { count: "exact", head: true })
      .like("quotation_number", `Q-${today}-%`)
    const seq = ((count || 0) + 1).toString().padStart(3, "0")
    const quotationNumber = `Q-${today}-${seq}`

    // 합계 계산 (단위절사 반영: 프론트에서 전달된 값 우선, 없으면 자동 계산)
    const rawTotal = (items || []).reduce(
      (sum: number, item: Record<string, unknown>) =>
        sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
      0
    )
    const totalAmount = header.total_amount !== undefined ? Number(header.total_amount) : rawTotal
    const taxAmount = header.tax_amount !== undefined ? Number(header.tax_amount) : Math.floor(totalAmount * 0.1)
    const grandTotal = header.grand_total !== undefined ? Number(header.grand_total) : totalAmount + taxAmount

    // 견적서 헤더 생성
    const { data: quotation, error: headerError } = await supabase
      .from("quotations")
      .insert({
        quotation_number: quotationNumber,
        type: header.type || "간이",
        title: header.title.trim(),
        request_id: requestId,
        customer_id: customerId,
        quotation_date: header.quotation_date || new Date().toLocaleDateString("sv-SE"),
        valid_until: header.valid_until || null,
        total_amount: totalAmount,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        notes: header.notes || null,
        terms: header.terms || null,
        site_name: header.site_name || null,
        recipient: header.recipient || null,
        contact_person: header.contact_person || null,
        contact_phone: header.contact_phone || null,
        // 공급자 정보 (직접입력 모드일 때만 값 있음, 우리 회사 모드는 null)
        supplier_company_name: header.supplier_company_name || null,
        supplier_biz_number: header.supplier_biz_number || null,
        supplier_ceo_name: header.supplier_ceo_name || null,
        supplier_email: header.supplier_email || null,
        supplier_address: header.supplier_address || null,
        supplier_manager: header.supplier_manager || null,
        supplier_manager_phone: header.supplier_manager_phone || null,
        supplier_manager_email: header.supplier_manager_email || null,
        // 납기/결제 정보
        delivery_date: header.delivery_date || null,
        delivery_place: header.delivery_place || null,
        payment_condition: header.payment_condition || null,
        // 수신자 확장
        receiver_company_name: header.receiver_company_name || null,
        receiver_biz_number: header.receiver_biz_number || null,
        receiver_email: header.receiver_email || null,
        receiver_address: header.receiver_address || null,
      })
      .select()
      .single()

    if (headerError) {
      return NextResponse.json({ error: headerError.message }, { status: 500 })
    }

    // 품목 삽입 (빈 행은 저장하지 않음)
    const normalizedCreateItems = (Array.isArray(items) ? items : []).filter((item) =>
      hasMeaningfulItem(item as Record<string, unknown>)
    ) as Record<string, unknown>[]

    if (normalizedCreateItems.length > 0) {
      const itemRows = normalizedCreateItems.map((item, index: number) => ({
        quotation_id: quotation.id,
        category: item.category || "장비",
        item_order: index,
        item_name: item.item_name || "",
        specification: item.specification || null,
        unit: item.unit || null,
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
        amount: (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
        memo: item.memo || null,
        // 내부 단가 필드
        retrieval_price: Number(item.retrieval_price) || 0,
        discount_rate: Number(item.discount_rate) || 0,
        purchase_unit_price: Number(item.purchase_unit_price) || 0,
        purchase_amount: Number(item.purchase_amount) || 0,
        margin_rate: Number(item.margin_rate) || 0,
        proposed_price: Number(item.proposed_price) || 0,
        profit: Number(item.profit) || 0,
        incentive_rate: Number(item.incentive_rate) || 0,
      }))

      const { error: itemsError } = await supabase
        .from("quotation_items")
        .insert(itemRows)

      if (itemsError) {
        // 롤백: 헤더도 삭제
        await supabase.from("quotations").delete().eq("id", quotation.id)
        return NextResponse.json({ error: itemsError.message }, { status: 500 })
      }
    }

    revalidatePath("/quotes")
    revalidatePath("/requests")

    return NextResponse.json({ success: true, data: quotation })
  } catch (e: unknown) {
    console.error("[/api/quotes]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}

// 견적서 수정 (헤더 + 품목 delete-then-reinsert)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, items, ...fields } = body

    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const requestIdFromFields = "request_id" in fields
      ? normalizeOptionalId(fields.request_id)
      : undefined

    if (typeof requestIdFromFields === "string") {
      const requestValidation = await ensureRequestExists(supabase, requestIdFromFields)
      if (!requestValidation.ok) return requestValidation.response
    }

    // 헤더 업데이트 (items가 없는 경우 합계 재계산 생략 - supplier 등 부분 업데이트 허용)
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // items가 전달된 경우에만 합계 재계산 (단위절사 반영: 프론트 전달값 우선)
    if (items !== undefined) {
      const rawTotal = (items || []).reduce(
        (sum: number, item: Record<string, unknown>) =>
          sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
        0
      )
      const totalAmount = fields.total_amount !== undefined ? Number(fields.total_amount) : rawTotal
      const taxAmount = fields.tax_amount !== undefined ? Number(fields.tax_amount) : Math.floor(totalAmount * 0.1)
      const grandTotal = fields.grand_total !== undefined ? Number(fields.grand_total) : totalAmount + taxAmount
      updateData.total_amount = totalAmount
      updateData.tax_amount = taxAmount
      updateData.grand_total = grandTotal
    }

    const allowedFields = [
      "title", "type", "quotation_date", "valid_until", "notes", "terms",
      "customer_id", "request_id",
      "site_name", "recipient", "contact_person", "contact_phone",
      // 공급자 정보
      "supplier_company_name", "supplier_biz_number", "supplier_ceo_name",
      "supplier_email", "supplier_address", "supplier_manager", "supplier_manager_phone", "supplier_manager_email",
      // 납기/결제 정보
      "delivery_date", "delivery_place", "payment_condition",
      // 수신자 확장
      "receiver_company_name", "receiver_biz_number", "receiver_email", "receiver_address",
    ]
    for (const key of allowedFields) {
      if (key in fields) {
        if (key === "request_id") {
          updateData.request_id = requestIdFromFields ?? null
          continue
        }
        updateData[key] = fields[key] || null
      }
    }

    const { error: headerError } = await supabase
      .from("quotations")
      .update(updateData)
      .eq("id", id)

    if (headerError) {
      return NextResponse.json({ error: headerError.message }, { status: 500 })
    }

    // 품목 교체: 기존 삭제 후 재삽입 (빈 행은 저장하지 않음)
    if (items !== undefined) {
      await supabase.from("quotation_items").delete().eq("quotation_id", id)

      const normalizedUpdateItems = (Array.isArray(items) ? items : []).filter((item) =>
        hasMeaningfulItem(item as Record<string, unknown>)
      ) as Record<string, unknown>[]

      if (normalizedUpdateItems.length > 0) {
        const itemRows = normalizedUpdateItems.map((item, index: number) => ({
          quotation_id: id,
          category: item.category || "장비",
          item_order: index,
          item_name: item.item_name || "",
          specification: item.specification || null,
          unit: item.unit || null,
          quantity: Number(item.quantity) || 0,
          unit_price: Number(item.unit_price) || 0,
          amount: (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
          memo: item.memo || null,
          // 내부 단가 필드
          retrieval_price: Number(item.retrieval_price) || 0,
          discount_rate: Number(item.discount_rate) || 0,
          purchase_unit_price: Number(item.purchase_unit_price) || 0,
          purchase_amount: Number(item.purchase_amount) || 0,
          margin_rate: Number(item.margin_rate) || 0,
          proposed_price: Number(item.proposed_price) || 0,
          profit: Number(item.profit) || 0,
          incentive_rate: Number(item.incentive_rate) || 0,
        }))

        const { error: itemsError } = await supabase
          .from("quotation_items")
          .insert(itemRows)

        if (itemsError) {
          return NextResponse.json({ error: itemsError.message }, { status: 500 })
        }
      }
    }

    revalidatePath("/quotes")
    revalidatePath("/requests")

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error("[/api/quotes]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}

// 견적서 삭제 (CASCADE로 items 자동 삭제)
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()

    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from("quotations").delete().eq("id", id)

    if (error) {
      console.error("[/api/quotes]", error.message)
      return NextResponse.json({ error: "견적서 처리에 실패했습니다" }, { status: 500 })
    }

    revalidatePath("/quotes")
    revalidatePath("/requests")

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error("[/api/quotes]", e)
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}
