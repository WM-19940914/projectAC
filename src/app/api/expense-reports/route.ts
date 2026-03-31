import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

// ── GET: 의뢰별 지출결의서 + 행 조회 ──
export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get("request_id")
  if (!requestId) return NextResponse.json({ error: "request_id 필수" }, { status: 400 })

  const supabase = createAdminClient()

  // 해당 의뢰의 지출결의서 조회 (최신 1건)
  const { data: report, error } = await supabase
    .from("expense_reports")
    .select("*, expense_report_rows(*)")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 행을 row_order 순으로 정렬
  if (report?.expense_report_rows) {
    report.expense_report_rows.sort(
      (a: { row_order: number }, b: { row_order: number }) => a.row_order - b.row_order
    )
  }

  return NextResponse.json({ data: report })
}

// ── POST: 지출결의서 생성 (헤더 + 행 한번에) ──
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { request_id, header, rows } = body

  if (!request_id) return NextResponse.json({ error: "request_id 필수" }, { status: 400 })

  const supabase = createAdminClient()

  // 헤더 생성
  const { data: report, error: hErr } = await supabase
    .from("expense_reports")
    .insert({
      request_id,
      project_name: header?.project_name || null,
      customer: header?.customer || null,
      customer_contact: header?.customer_contact || null,
      team: header?.team || "MA영업팀",
      manager: header?.manager || null,
    })
    .select()
    .single()

  if (hErr || !report) return NextResponse.json({ error: hErr?.message || "생성 실패" }, { status: 500 })

  // 행 생성
  if (rows && rows.length > 0) {
    const rowPayloads = rows.map((r: Record<string, unknown>, i: number) => ({
      report_id: report.id,
      row_order: i + 1,
      category: r.category || null,
      supplier: r.supplier || null,
      item: r.item || null,
      spec: r.spec || null,
      quantity: r.quantity || 0,
      list_price: r.list_price || 0,
      dc_rate: r.dc_rate || 0,
      option_amount: r.option_amount || 0,
      proposed_unit: r.proposed_unit || 0,
      grade_reb: r.grade_reb || 0,
      item_reb: r.item_reb || 0,
    }))

    const { error: rErr } = await supabase
      .from("expense_report_rows")
      .insert(rowPayloads)

    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })
  }

  revalidatePath("/requests")
  return NextResponse.json({ data: report })
}

// ── PATCH: 지출결의서 수정 (헤더 + 행 통째로 교체) ──
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, header, rows } = body

  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 })

  const supabase = createAdminClient()

  // 헤더 업데이트
  if (header) {
    const { error } = await supabase
      .from("expense_reports")
      .update({
        project_name: header.project_name,
        customer: header.customer,
        customer_contact: header.customer_contact,
        team: header.team,
        manager: header.manager,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 행: 기존 삭제 후 새로 삽입 (간단하고 확실한 방법)
  if (rows) {
    const { error: delErr } = await supabase
      .from("expense_report_rows")
      .delete()
      .eq("report_id", id)

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    if (rows.length > 0) {
      const rowPayloads = rows.map((r: Record<string, unknown>, i: number) => ({
        report_id: id,
        row_order: i + 1,
        category: r.category || null,
        supplier: r.supplier || null,
        item: r.item || null,
        spec: r.spec || null,
        quantity: r.quantity || 0,
        list_price: r.list_price || 0,
        dc_rate: r.dc_rate || 0,
        option_amount: r.option_amount || 0,
        proposed_unit: r.proposed_unit || 0,
        grade_reb: r.grade_reb || 0,
        item_reb: r.item_reb || 0,
      }))

      const { error: insErr } = await supabase
        .from("expense_report_rows")
        .insert(rowPayloads)

      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  revalidatePath("/requests")
  return NextResponse.json({ data: { id } })
}

// ── DELETE: 지출결의서 삭제 ──
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 })

  const supabase = createAdminClient()

  const { error } = await supabase
    .from("expense_reports")
    .delete()
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath("/requests")
  return NextResponse.json({ data: { id } })
}
