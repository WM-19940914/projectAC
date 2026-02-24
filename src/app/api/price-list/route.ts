// 가격표 API - GET: 전체 가격표 조회
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

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
