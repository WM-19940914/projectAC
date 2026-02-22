import { createAdminClient } from "@/lib/supabase/admin"
import PriceList from "./price-list"

export const dynamic = "force-dynamic"

export default async function PriceListPage() {
  const supabase = createAdminClient()

  // 전체 가격표 데이터 조회
  const { data: priceItems } = await supabase
    .from("price_list")
    .select("*")
    .order("category")
    .order("product_name")

  return <PriceList items={priceItems || []} />
}
