const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function analyze() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await supabase.from('price_list').select('product_name, specification, unit_price, sub_category').eq('category', '장비').order('sub_category').order('product_name');

  const groups = {};
  data.forEach(d => {
    const cat = d.sub_category || '미분류';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(d);
  });

  for (const [cat, items] of Object.entries(groups)) {
    console.log(`\n========== ${cat} (${items.length}건) ==========`);
    items.forEach(d => {
      console.log(`  ${d.product_name} | ${d.specification || ''} | ${d.unit_price.toLocaleString()}원`);
    });
  }
}
analyze();
