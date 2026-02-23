// 임시 마이그레이션 실행용 API 라우트 (실행 후 삭제 예정)
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const supabase = createAdminClient()
  const results: Record<string, string> = {}

  // quotations.supplier_manager_email 확인
  try {
    const { error } = await supabase.from("quotations").select("supplier_manager_email").limit(1)
    if (error && error.message.includes("does not exist")) {
      results["quotations.supplier_manager_email"] = "컬럼 없음 - 대시보드에서 실행 필요"
    } else {
      results["quotations.supplier_manager_email"] = "컬럼 존재"
    }
  } catch (e) {
    results["quotations.supplier_manager_email"] = `에러: ${e}`
  }

  // business_settings.manager_email 확인
  try {
    const { error } = await supabase.from("business_settings").select("manager_email").limit(1)
    if (error && error.message.includes("does not exist")) {
      results["business_settings.manager_email"] = "컬럼 없음 - 대시보드에서 실행 필요"
    } else {
      results["business_settings.manager_email"] = "컬럼 존재"
    }
  } catch (e) {
    results["business_settings.manager_email"] = `에러: ${e}`
  }

  // quotations.type 확인 (간이/상세 구분)
  try {
    const { error } = await supabase.from("quotations").select("type").limit(1)
    if (error && error.message.includes("does not exist")) {
      results["quotations.type"] = "컬럼 없음 - 대시보드에서 실행 필요"
    } else {
      results["quotations.type"] = "컬럼 존재"
    }
  } catch (e) {
    results["quotations.type"] = `에러: ${e}`
  }

  const sql = `-- 아래 SQL을 Supabase 대시보드 SQL Editor에서 실행하세요
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS supplier_manager_email TEXT DEFAULT NULL;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS manager_email TEXT DEFAULT '';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT '간이';`

  return NextResponse.json({ results, sql, dashboard: "https://supabase.com/dashboard/project/vacqhmvwkqcfpzkzadmp/sql/new" })
}
