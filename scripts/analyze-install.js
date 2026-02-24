const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function analyze() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await supabase.from('price_list').select('product_name, specification, unit, unit_price, tags, notes').eq('category', '설치비').order('product_name');

  // 태그별 분류
  const tagGroups = {};
  const noTag = [];

  data.forEach(d => {
    if (!d.tags) {
      noTag.push(d);
      return;
    }
    const tags = d.tags.split('#').map(t => t.trim()).filter(Boolean);
    tags.forEach(tag => {
      if (!tagGroups[tag]) tagGroups[tag] = [];
      tagGroups[tag].push(d);
    });
  });

  console.log('=== 설치비 총:', data.length, '건 ===\n');

  console.log('=== 태그별 분류 ===');
  Object.entries(tagGroups).sort((a,b) => b[1].length - a[1].length).forEach(([tag, items]) => {
    console.log(`\n#${tag} (${items.length}건)`);
    items.forEach(d => console.log(`  ${d.product_name} | ${d.specification || ''} | ${d.unit_price.toLocaleString()}원 | ${d.notes || ''}`));
  });

  if (noTag.length > 0) {
    console.log(`\n태그없음 (${noTag.length}건)`);
    noTag.forEach(d => console.log(`  ${d.product_name} | ${d.specification || ''} | ${d.unit_price.toLocaleString()}원 | ${d.notes || ''}`));
  }
}
analyze();
