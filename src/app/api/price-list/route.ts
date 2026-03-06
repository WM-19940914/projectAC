// 가격표 API - UTF-8 강제
import { createAdminClient } from "@/lib/supabase/admin"
import { jsonWithUTF8, sanitizeDBResponse } from "@/lib/utf8-response"
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("price_list")
    .select("*")
    .order("category")
    .order("product_name")

  if (error) {
    return jsonWithUTF8({ error: error.message }, { status: 500 })
  }

  return jsonWithUTF8({ data: sanitizeDBResponse(data || []) })
}

export async function POST(req: Request) {
  const supabase = createAdminClient()
  try {
    const body = await req.json()
    const { category, sub_category, product_name, specification, unit, unit_price, tags, notes } = body
    const { data, error } = await supabase
      .from("price_list")
      .insert({ category, sub_category, product_name, specification, unit, unit_price, tags, notes })
      .select()
      .single()

    if (error) throw error
    revalidatePath("/price-list")
    return jsonWithUTF8({ data: sanitizeDBResponse(data) })
  } catch (error) {
    return jsonWithUTF8({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const supabase = createAdminClient()
  try {
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return jsonWithUTF8({ error: "id is required" }, { status: 400 })

    const { data, error } = await supabase
      .from("price_list")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error
    revalidatePath("/price-list")
    return jsonWithUTF8({ data: sanitizeDBResponse(data) })
  } catch (error) {
    return jsonWithUTF8({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const supabase = createAdminClient()
  try {
    const body = await req.json()
    const { id } = body
    if (!id) return jsonWithUTF8({ error: "id is required" }, { status: 400 })

    const { error } = await supabase
      .from("price_list")
      .delete()
      .eq("id", id)

    if (error) throw error
    revalidatePath("/price-list")
    return jsonWithUTF8({ success: true })
  } catch (error) {
    return jsonWithUTF8({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
