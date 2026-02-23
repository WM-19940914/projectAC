// 견적 담당자 이메일 컬럼 추가 스크립트
// quotations.supplier_manager_email, business_settings.manager_email
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkColumn(table, column) {
  const { error } = await supabase
    .from(table)
    .select(column)
    .limit(1);
  if (error && error.message.includes('does not exist')) return false;
  return true;
}

async function run() {
  console.log('=== 견적 담당자 이메일 컬럼 마이그레이션 ===\n');

  // 1. quotations.supplier_manager_email 확인
  const col1Exists = await checkColumn('quotations', 'supplier_manager_email');
  if (col1Exists) {
    console.log('✅ quotations.supplier_manager_email 컬럼이 이미 존재합니다.');
  } else {
    console.log('❌ quotations.supplier_manager_email 컬럼 없음 → 추가 필요');
  }

  // 2. business_settings.manager_email 확인
  const col2Exists = await checkColumn('business_settings', 'manager_email');
  if (col2Exists) {
    console.log('✅ business_settings.manager_email 컬럼이 이미 존재합니다.');
  } else {
    console.log('❌ business_settings.manager_email 컬럼 없음 → 추가 필요');
  }

  if (!col1Exists || !col2Exists) {
    console.log('\n⚠️  Supabase 대시보드 SQL Editor에서 아래 SQL을 실행해주세요:');
    console.log('─────────────────────────────────────────────────────────');
    if (!col1Exists) {
      console.log('ALTER TABLE quotations ADD COLUMN IF NOT EXISTS supplier_manager_email TEXT DEFAULT NULL;');
    }
    if (!col2Exists) {
      console.log("ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS manager_email TEXT DEFAULT '';");
    }
    console.log('─────────────────────────────────────────────────────────');
    console.log('\n👉 접속 URL: https://supabase.com/dashboard/project/vacqhmvwkqcfpzkzadmp/sql/new');
  } else {
    console.log('\n✅ 모든 컬럼이 이미 존재합니다. 마이그레이션 불필요!');
  }
}

run().catch(console.error);
