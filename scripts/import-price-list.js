// 가격표 엑셀 → Supabase 임포트 스크립트
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXCEL_PATH = 'C:/Users/User/OneDrive/Desktop/가격표.xlsx';

async function run() {
  const wb = XLSX.readFile(EXCEL_PATH);

  // 1. 장비 가격표 파싱 (헤더: 행3, 데이터: 행4~)
  // 컬럼: [빈칸, 상품명, 규격, 단위, 단가, #태그]
  const ws1 = wb.Sheets['장비 가격표'];
  const rows1 = XLSX.utils.sheet_to_json(ws1, { header: 1 });

  const equipmentData = [];
  for (let i = 4; i < rows1.length; i++) {
    const row = rows1[i];
    if (!row || !row[1]) continue; // 상품명 없으면 스킵
    equipmentData.push({
      category: '장비',
      product_name: String(row[1] || '').trim(),
      specification: row[2] ? String(row[2]).trim() : null,
      unit: row[3] ? String(row[3]).trim() : null,
      unit_price: row[4] ? Number(row[4]) : 0,
      tags: row[5] ? String(row[5]).trim() : null,
      notes: null,
    });
  }
  console.log('장비 가격표:', equipmentData.length, '건');

  // 2. 설치비 가격표 파싱 (헤더: 행3, 데이터: 행4~)
  // 컬럼: [빈칸, 상품명, 규격, 단위, 단가, 비고, #태그]
  const ws2 = wb.Sheets['설치비 가격표'];
  const rows2 = XLSX.utils.sheet_to_json(ws2, { header: 1 });

  const installData = [];
  for (let i = 4; i < rows2.length; i++) {
    const row = rows2[i];
    if (!row || !row[1]) continue; // 상품명 없으면 스킵
    installData.push({
      category: '설치비',
      product_name: String(row[1] || '').trim(),
      specification: row[2] ? String(row[2]).trim() : null,
      unit: row[3] ? String(row[3]).trim() : null,
      unit_price: row[4] ? Number(row[4]) : 0,
      notes: row[5] ? String(row[5]).trim() : null,
      tags: row[6] ? String(row[6]).trim() : null,
    });
  }
  console.log('설치비 가격표:', installData.length, '건');

  // 3. 기존 데이터 삭제 후 삽입
  const { error: delError } = await supabase.from('price_list').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delError) {
    console.log('기존 데이터 삭제 중 에러 (무시 가능):', delError.message);
  }

  // 4. 장비 데이터 삽입 (50개씩 배치)
  const allData = [...equipmentData, ...installData];
  const BATCH = 50;
  let inserted = 0;

  for (let i = 0; i < allData.length; i += BATCH) {
    const batch = allData.slice(i, i + BATCH);
    const { data, error } = await supabase.from('price_list').insert(batch).select('id');
    if (error) {
      console.log('삽입 에러 (배치', Math.floor(i / BATCH) + 1, '):', error.message);
    } else {
      inserted += data.length;
    }
  }

  console.log('\n총', inserted, '건 삽입 완료!');
  console.log('- 장비:', equipmentData.length, '건');
  console.log('- 설치비:', installData.length, '건');
}

run().catch(console.error);
