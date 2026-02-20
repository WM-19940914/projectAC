// 의뢰 테이블에 hidden 컬럼 추가하는 일회성 스크립트
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // hidden 컬럼 추가 (이미 있으면 무시)
  const { error } = await supabase.rpc('exec_sql', {
    query: `
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
      CREATE INDEX IF NOT EXISTS idx_requests_hidden ON requests(hidden);
    `
  });

  if (error) {
    // rpc가 안 되면 직접 테스트로 확인
    console.log('⚠️  rpc 방식 실패, 직접 확인합니다...');

    // hidden 컬럼이 있는지 테스트
    const { data, error: testError } = await supabase
      .from('requests')
      .select('hidden')
      .limit(1);

    if (testError && testError.message.includes('hidden')) {
      console.log('❌ hidden 컬럼이 없습니다. Supabase 대시보드에서 SQL을 실행해주세요:');
      console.log('');
      console.log('  ALTER TABLE requests ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;');
      console.log('  CREATE INDEX IF NOT EXISTS idx_requests_hidden ON requests(hidden);');
      console.log('');
      console.log('👉 Supabase 대시보드 → SQL Editor → 위 SQL 붙여넣기 → Run');
    } else {
      console.log('✅ hidden 컬럼이 이미 존재합니다!');
    }
  } else {
    console.log('✅ hidden 컬럼 추가 완료!');
  }
}

run();
