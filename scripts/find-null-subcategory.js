const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function find() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await supabase.from('price_list').select('id, product_name, specification').eq('category', '장비').is('sub_category', null);
  console.log('DB에서 sub_category가 NULL인 장비:', data.length, '건');
  data.forEach(d => console.log(' -', d.product_name, '|', d.specification || ''));
}
find();
