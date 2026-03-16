import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

const HEADER_FIELDS = ["site_name", "opti_name", "opti_number", "contract_number"] as const
const LINE_FIELDS = [
  "supplier",
  "order_date",
  "order_number",
  "model_name",
  "quantity",
  "delivery_request_date",
  "delivery_expected_date",
  "delivery_confirmed_date",
  "delivery_place",
] as const

const LINE_DATE_FIELDS = new Set([
  "order_date",
  "delivery_request_date",
  "delivery_expected_date",
  "delivery_confirmed_date",
])

function asNullableText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asNullableDate(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asNullableInteger(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string" && value.trim().length === 0) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.round(parsed))
}

function buildHeaderPayload(input: Record<string, unknown>) {
  const payload: Record<string, unknown> = {}
  for (const key of HEADER_FIELDS) {
    if (!(key in input)) continue
    payload[key] = asNullableText(input[key])
  }
  return payload
}

function buildLinePayload(input: Record<string, unknown>) {
  const payload: Record<string, unknown> = {}

  for (const key of LINE_FIELDS) {
    if (!(key in input)) continue

    if (key === "quantity") {
      payload[key] = asNullableInteger(input[key])
      continue
    }

    if (LINE_DATE_FIELDS.has(key)) {
      payload[key] = asNullableDate(input[key])
      continue
    }

    payload[key] = asNullableText(input[key])
  }

  return payload
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) return message
  }
  return "요청 처리 중 오류가 발생했습니다."
}

function hasMissingColumnError(error: unknown, column: string): boolean {
  const message = extractErrorMessage(error).toLowerCase()
  return (
    message.includes(column.toLowerCase()) &&
    (message.includes("schema cache") || message.includes("does not exist"))
  )
}

async function resolveRequestSiteName(
  supabase: ReturnType<typeof createAdminClient>,
  requestId: string
): Promise<string | null> {
  const { data: requestRow, error: requestError } = await supabase
    .from("requests")
    .select("confirmed_quote_id")
    .eq("id", requestId)
    .maybeSingle()

  if (requestError) throw requestError

  const confirmedQuoteId =
    typeof requestRow?.confirmed_quote_id === "string" ? requestRow.confirmed_quote_id : null

  if (confirmedQuoteId) {
    const { data: confirmedQuote, error: confirmedQuoteError } = await supabase
      .from("quotations")
      .select("site_name")
      .eq("id", confirmedQuoteId)
      .maybeSingle()

    if (confirmedQuoteError) throw confirmedQuoteError

    const siteName =
      typeof confirmedQuote?.site_name === "string" ? confirmedQuote.site_name.trim() : ""

    if (siteName) return siteName
  }

  const { data: fallbackQuote, error: fallbackQuoteError } = await supabase
    .from("quotations")
    .select("site_name")
    .eq("request_id", requestId)
    .not("site_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fallbackQuoteError) throw fallbackQuoteError

  const fallbackSiteName =
    typeof fallbackQuote?.site_name === "string" ? fallbackQuote.site_name.trim() : ""

  return fallbackSiteName || null
}

function normalizeCard(raw: Record<string, unknown>) {
  const linesRaw = Array.isArray(raw.order_delivery_lines)
    ? (raw.order_delivery_lines as Record<string, unknown>[])
    : []

  const lines = [...linesRaw]
    .sort((a, b) => {
      const rowA = Number(a.row_order ?? 0)
      const rowB = Number(b.row_order ?? 0)
      return rowA - rowB
    })
    .map((line, index) => {
      const rowOrder = Number(line.row_order)
      return {
        ...line,
        row_order: Number.isFinite(rowOrder) && rowOrder > 0 ? rowOrder : index + 1,
      }
    })

  const rest = { ...raw }
  delete rest.order_delivery_lines
  return {
    ...rest,
    lines,
  }
}

async function populateCardSiteName(
  supabase: ReturnType<typeof createAdminClient>,
  raw: Record<string, unknown>
) {
  const normalized = normalizeCard(raw) as Record<string, unknown> & { lines: { row_order: number }[] }
  const existingSiteName =
    typeof normalized.site_name === "string" ? normalized.site_name.trim() : ""
  const requestId =
    typeof normalized.request_id === "string" ? normalized.request_id.trim() : ""

  if (existingSiteName || !requestId) {
    return normalized
  }

  const resolvedSiteName = await resolveRequestSiteName(supabase, requestId)

  return {
    ...normalized,
    site_name: resolvedSiteName,
  }
}

async function fetchCardById(supabase: ReturnType<typeof createAdminClient>, id: string) {
  const { data, error } = await supabase
    .from("order_deliveries")
    .select("*, order_delivery_lines(*)")
    .eq("id", id)
    .single()

  if (error) throw error
  return populateCardSiteName(supabase, (data ?? {}) as Record<string, unknown>)
}

export async function GET(req: NextRequest) {
  try {
    const requestId = req.nextUrl.searchParams.get("request_id")
    if (!requestId) {
      return NextResponse.json({ success: false, error: "request_id가 필요합니다." }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("order_deliveries")
      .select("*, order_delivery_lines(*)")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false })

    if (error) throw error

    const normalized = Array.isArray(data)
      ? await Promise.all(
          data.map((row) => populateCardSiteName(supabase, (row ?? {}) as Record<string, unknown>))
        )
      : []

    return NextResponse.json({ success: true, data: normalized })
  } catch (error) {
    return NextResponse.json({ success: false, error: extractErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const requestId = typeof body.request_id === "string" ? body.request_id : ""

    if (!requestId) {
      return NextResponse.json({ success: false, error: "request_id가 필요합니다." }, { status: 400 })
    }

    const supabase = createAdminClient()
    const headerPayload = buildHeaderPayload(body as Record<string, unknown>)
    const resolvedSiteName =
      headerPayload.site_name === undefined ? await resolveRequestSiteName(supabase, requestId) : null
    const payload = {
      request_id: requestId,
      ...headerPayload,
      ...(headerPayload.site_name === undefined ? { site_name: resolvedSiteName } : {}),
    }

    let { data: created, error: createError } = await supabase
      .from("order_deliveries")
      .insert(payload)
      .select()
      .single()

    if (createError && "site_name" in payload && hasMissingColumnError(createError, "site_name")) {
      const fallbackPayload = { ...payload }
      delete (fallbackPayload as Record<string, unknown>).site_name

      const retry = await supabase
        .from("order_deliveries")
        .insert(fallbackPayload)
        .select()
        .single()

      created = retry.data
      createError = retry.error
    }

    if (createError) throw createError

    const cardId = (created as { id?: string } | null)?.id
    if (!cardId) {
      throw new Error("주문 내역 카드 생성에 실패했습니다.")
    }

    const defaultLines = Array.from({ length: 5 }, (_, index) => ({
      order_delivery_id: cardId,
      row_order: index + 1,
    }))

    const { error: lineInsertError } = await supabase
      .from("order_delivery_lines")
      .insert(defaultLines)

    if (lineInsertError) throw lineInsertError

    const card = await fetchCardById(supabase, cardId)

    revalidatePath("/requests")
    return NextResponse.json({ success: true, data: card })
  } catch (error) {
    return NextResponse.json({ success: false, error: extractErrorMessage(error) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const id = typeof body.id === "string" ? body.id : ""

    if (!id) {
      return NextResponse.json({ success: false, error: "id가 필요합니다." }, { status: 400 })
    }

    const headerPayload = buildHeaderPayload(body as Record<string, unknown>)
    const rawLines = Array.isArray(body.lines) ? body.lines : null

    if (Object.keys(headerPayload).length === 0 && rawLines === null) {
      return NextResponse.json({ success: false, error: "변경할 데이터가 없습니다." }, { status: 400 })
    }

    const supabase = createAdminClient()

    if (Object.keys(headerPayload).length > 0) {
      let { error: headerError } = await supabase
        .from("order_deliveries")
        .update({
          ...headerPayload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

      if (headerError && "site_name" in headerPayload && hasMissingColumnError(headerError, "site_name")) {
        const fallbackPayload = { ...headerPayload }
        delete fallbackPayload.site_name

        if (Object.keys(fallbackPayload).length > 0) {
          const retry = await supabase
            .from("order_deliveries")
            .update({
              ...fallbackPayload,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id)
          headerError = retry.error
        } else {
          headerError = null
        }
      }

      if (headerError) throw headerError
    }

    if (rawLines !== null) {
      const { error: deleteError } = await supabase
        .from("order_delivery_lines")
        .delete()
        .eq("order_delivery_id", id)

      if (deleteError) throw deleteError

      const sourceLines: unknown[] = rawLines.length > 0 ? rawLines : [{}]
      const linePayload = sourceLines.map((line: unknown, index: number) => ({
        order_delivery_id: id,
        row_order: index + 1,
        ...buildLinePayload((line ?? {}) as Record<string, unknown>),
      }))

      const { error: insertError } = await supabase
        .from("order_delivery_lines")
        .insert(linePayload)

      if (insertError) throw insertError
    }

    const card = await fetchCardById(supabase, id)

    revalidatePath("/requests")
    return NextResponse.json({ success: true, data: card })
  } catch (error) {
    return NextResponse.json({ success: false, error: extractErrorMessage(error) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id")
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required." }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error: linesDeleteError } = await supabase
      .from("order_delivery_lines")
      .delete()
      .eq("order_delivery_id", id)

    if (linesDeleteError) throw linesDeleteError

    const { error: cardDeleteError } = await supabase
      .from("order_deliveries")
      .delete()
      .eq("id", id)

    if (cardDeleteError) throw cardDeleteError

    revalidatePath("/requests")
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: extractErrorMessage(error) }, { status: 500 })
  }
}
