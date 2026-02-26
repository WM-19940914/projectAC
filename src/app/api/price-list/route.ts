// 가격표 API
import { createAdminClient } from "@/lib/supabase/admin"
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data || [] })
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
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const supabase = createAdminClient()
  try {
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const { data, error } = await supabase
      .from("price_list")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error
    revalidatePath("/price-list")
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const supabase = createAdminClient()
  try {
    const body = await req.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const { error } = await supabase
      .from("price_list")
      .delete()
      .eq("id", id)

    if (error) throw error
    revalidatePath("/price-list")
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
