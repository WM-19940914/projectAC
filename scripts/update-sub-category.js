const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function updateSubCategory() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 엑셀 읽기
  const wb = XLSX.readFile('C:/Users/minig/Desktop/장비_가격표.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  // DB에서 장비 목록 가져오기 (상품명 + 규격으로 매칭)
  const { data: dbItems, error } = await supabase.from('price_list').select('id, product_name, specification').eq('category', '장비');
  if (error) { console.error(error); return; }

  // 상품명+규격 → id 매핑
  const keyToId = {};
  dbItems.forEach(item => {
    const key = (item.product_name || '') + '|||' + (item.specification || '');
    keyToId[key] = item.id;
  });

  let updated = 0;
  let notFound = 0;

  for (const row of rows) {
    const name = row['상품명'];
    const spec = row['규격'] || '';
    const subCat = row['분류'];
    if (!name || !subCat) continue;

    const key = name + '|||' + spec;
    const id = keyToId[key];
    if (!id) { notFound++; console.log('매칭 실패:', name, '|', spec); continue; }

    const { error: upErr } = await supabase.from('price_list').update({ sub_category: subCat }).eq('id', id);
    if (upErr) { console.error('업데이트 실패:', name, upErr.message); }
    else { updated++; }
  }

  console.log('완료! 업데이트: ' + updated + '건, 매칭 실패: ' + notFound + '건');
}
updateSubCategory();
