/**
 * 설치비 113건에 sub_category(소분류)를 자동 매핑하는 스크립트
 *
 * 실행: node scripts/update-install-subcategory.js
 *
 * 상품명 앞부분(startsWith)을 기준으로 7개 분류 + 기타로 나눈다.
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// ── 매핑 규칙: [소분류, 상품명 접두사 배열] ──
const MAPPING_RULES = [
  ['냉매배관', ['냉매배관', '동배관', '동부속', '냉매가스']],
  ['보온재',   ['고무발포', 'PVC 아티론']],
  ['드레인',   ['PVC 배관', 'PVC 부속', '유연호스', '드레인배관']],
  ['덕트',     ['덕트', '스파이럴', '후렉시블', '보온 후렉시블', '토출 챔버', '디퓨저', '흡입그릴', '후드 캡', '실외기 토출']],
  ['전기/배선', ['VCTF', '난연 CD', '실내기 차단기', '실내기 통신선', '실내기 전원선', '실외기 메인 차단기', '실외기 차단기', '잡자재']],
  ['받침대',   ['실외기 받침대', '실외기 방진가대']],
  ['공사비',   ['기본설치비', '인건비', '노무비', '전기공사', '배관 트레이', '벽체 타공', '보양', '점검구', '중장비', '질소', '진공', '철거', '크레인', '지게차', '유선리모컨 설치', '실외기 인입']],
];

// 상품명 → 소분류 결정 함수
function classify(productName) {
  for (const [category, prefixes] of MAPPING_RULES) {
    for (const prefix of prefixes) {
      if (productName.startsWith(prefix)) {
        return category;
      }
    }
  }
  return '기타'; // 매칭 안 되면 기타
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1) 설치비 항목 전체 조회
  const { data: items, error } = await supabase
    .from('price_list')
    .select('id, product_name, sub_category')
    .eq('category', '설치비');

  if (error) {
    console.error('조회 실패:', error.message);
    return;
  }

  console.log(`설치비 총 ${items.length}건 조회됨\n`);

  // 2) 분류별 카운트 집계
  const stats = {};
  const unmatched = []; // 기타로 분류된 항목들
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const sub = classify(item.product_name);

    // 통계 집계
    stats[sub] = (stats[sub] || 0) + 1;
    if (sub === '기타') {
      unmatched.push(item.product_name);
    }

    // 이미 같은 값이면 스킵
    if (item.sub_category === sub) {
      skipped++;
      continue;
    }

    // DB 업데이트
    const { error: upErr } = await supabase
      .from('price_list')
      .update({ sub_category: sub })
      .eq('id', item.id);

    if (upErr) {
      console.error(`업데이트 실패: ${item.product_name} → ${upErr.message}`);
    } else {
      updated++;
    }
  }

  // 3) 결과 출력
  console.log('── 분류별 개수 ──');
  for (const [cat, count] of Object.entries(stats)) {
    console.log(`  ${cat}: ${count}건`);
  }

  console.log(`\n업데이트: ${updated}건, 이미 동일: ${skipped}건`);

  if (unmatched.length > 0) {
    console.log(`\n⚠ "기타"로 분류된 ${unmatched.length}건:`);
    unmatched.forEach((name) => console.log(`  - ${name}`));
  } else {
    console.log('\n✅ 매칭 실패 0건 — 모든 항목이 정상 분류됨');
  }
}

main();
