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

  // 납기/결제 컬럼 자동 추가 시도
  try {
    // delivery_date 컬럼 확인 및 추가
    const { error: ddErr } = await supabase.from("quotations").select("delivery_date").limit(1)
    if (ddErr && ddErr.message.includes("does not exist")) {
      const { error: addErr } = await supabase.rpc("exec_sql", {
        query: "ALTER TABLE quotations ADD COLUMN delivery_date TEXT, ADD COLUMN delivery_place TEXT, ADD COLUMN payment_condition TEXT;"
      })
      if (addErr) {
        results["delivery_fields"] = `RPC 실패 - Supabase SQL Editor에서 수동 실행 필요`
      } else {
        results["delivery_fields"] = "컬럼 추가 완료"
      }
    } else {
      results["delivery_fields"] = "컬럼 존재"
    }
  } catch (e) {
    results["delivery_fields"] = `에러: ${e}`
  }

  const sql = `-- 아래 SQL을 Supabase 대시보드 SQL Editor에서 실행하세요
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS supplier_manager_email TEXT DEFAULT NULL;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS manager_email TEXT DEFAULT '';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT '간이';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS delivery_date TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS delivery_place TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS payment_condition TEXT;`

  return NextResponse.json({ results, sql, dashboard: "https://supabase.com/dashboard/project/vacqhmvwkqcfpzkzadmp/sql/new" })
}
