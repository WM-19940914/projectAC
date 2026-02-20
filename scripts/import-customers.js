const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const wb = XLSX.readFile('C:/Users/minig/Desktop/pluuug_data_Melea_김우민_고객_260220.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws);

async function run() {
  // 1. 기존 고객 전부 조회
  const { data: existing } = await supabase.from('customers').select('id, company_name');
  console.log('기존 고객 수:', (existing || []).length);

  // 2. 하나씩 삭제 (FK 관계 때문에 안전하게)
  for (const c of (existing || [])) {
    const { error } = await supabase.from('customers').delete().eq('id', c.id);
    if (error) {
      console.log('삭제 실패:', c.company_name, error.message);
    }
  }

  // 3. 삭제 확인
  const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true });
  console.log('삭제 후 남은 수:', count);

  // 4. 엑셀 데이터 삽입
  const toInsert = rows.map(row => ({
    company_name: row['회사명'] || '',
    contact_name: row['담당자'] || null,
    contact_title: row['직책'] || null,
    phone: row['연락처'] || null,
    email: row['이메일'] || null,
    business_number: row['사업자 등록번호'] || null,
    representative: row['대표자'] || null,
    address: row['소재지'] || null,
    customer_type: '법인',
  }));

  const { data, error } = await supabase.from('customers').insert(toInsert).select('id, company_name, contact_name, phone');
  if (error) {
    console.log('삽입 에러:', error.message);
  } else {
    console.log('\n총 ' + data.length + '개 등록 완료!');
    data.forEach((d, i) => console.log(i+1, d.company_name, '|', d.contact_name, '|', d.phone));
  }
}

run();
