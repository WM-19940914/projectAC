import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

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
          items:quotation_items(*, id, quotation_id, category, item_order, item_name, specification, unit, quantity, unit_price, amount, memo),
          customer:customers(id, company_name),
          request:requests(id, title)
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
        items:quotation_items(id, quotation_id, category, item_order, item_name, specification, unit, quantity, unit_price, amount, memo),
        customer:customers(id, company_name),
        request:requests(id, title)
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

    // 견적번호 자동 생성: Q-{년도}-{4자리}
    const year = new Date().getFullYear()
    const { count } = await supabase
      .from("quotations")
      .select("*", { count: "exact", head: true })
      .like("quotation_number", `Q-${year}-%`)

    const seq = String((count || 0) + 1).padStart(4, "0")
    const quotationNumber = `Q-${year}-${seq}`

    // 합계 계산
    const totalAmount = (items || []).reduce(
      (sum: number, item: Record<string, unknown>) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
      0
    )
    const taxAmount = Math.round(totalAmount * 0.1)
    const grandTotal = totalAmount + taxAmount

    // 견적서 헤더 생성
    const { data: quotation, error: headerError } = await supabase
      .from("quotations")
      .insert({
        quotation_number: quotationNumber,
        type: "간이",
        title: header.title.trim(),
        request_id: header.request_id || null,
        customer_id: header.customer_id || null,
        quotation_date: header.quotation_date || new Date().toISOString().split("T")[0],
        valid_until: header.valid_until || null,
        total_amount: totalAmount,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        notes: header.notes || null,
        terms: header.terms || null,
      })
      .select()
      .single()

    if (headerError) {
      return NextResponse.json({ error: headerError.message }, { status: 500 })
    }

    // 품목 삽입
    if (items && items.length > 0) {
      const itemRows = items.map((item: Record<string, unknown>, index: number) => ({
        quotation_id: quotation.id,
        category: "일반",
        item_order: index,
        item_name: item.item_name || "",
        specification: item.specification || null,
        unit: item.unit || null,
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
        amount: (Number(item.quantity) || 1) * (Number(item.unit_price) || 0),
        memo: item.memo || null,
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

    // 합계 재계산
    const totalAmount = (items || []).reduce(
      (sum: number, item: Record<string, unknown>) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
      0
    )
    const taxAmount = Math.round(totalAmount * 0.1)
    const grandTotal = totalAmount + taxAmount

    // 헤더 업데이트
    const updateData: Record<string, unknown> = {
      total_amount: totalAmount,
      tax_amount: taxAmount,
      grand_total: grandTotal,
      updated_at: new Date().toISOString(),
    }

    const allowedFields = ["title", "quotation_date", "valid_until", "notes", "terms", "customer_id", "request_id"]
    for (const key of allowedFields) {
      if (key in fields) {
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

    // 품목 교체: 기존 삭제 후 재삽입
    if (items) {
      await supabase.from("quotation_items").delete().eq("quotation_id", id)

      if (items.length > 0) {
        const itemRows = items.map((item: Record<string, unknown>, index: number) => ({
          quotation_id: id,
          category: "일반",
          item_order: index,
          item_name: item.item_name || "",
          specification: item.specification || null,
          unit: item.unit || null,
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price) || 0,
          amount: (Number(item.quantity) || 1) * (Number(item.unit_price) || 0),
          memo: item.memo || null,
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
