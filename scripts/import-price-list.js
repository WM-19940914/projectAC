// 가격표 엑셀 → Supabase 임포트 스크립트
// sub_category 자동 분류 포함 (임포트 한 번에 완료)
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXCEL_PATH = 'C:/Users/User/OneDrive/Desktop/가격표.xlsx';

// ── 장비 소분류 자동 분류 규칙 (상품명 기준) ──
// 주의: 순서가 중요함 — "실외기 받침대/방진가대"가 실외기로 잘못 분류되지 않도록
// ETC에 해당하는 접두사를 먼저 제외하는 방식으로 처리
const EQUIP_RULES = [
  // 판넬 (무풍1Way, 무풍 4WAY 등 — "무풍"으로 시작)
  ['판넬', ['무풍', '미니 4way 판넬', '사각 원형']],
  ['분지관', ['T형 분지관', 'Y형 분지관']],
  ['제어기기', [
    'DMS', '중앙제어기', '터치중앙제어기', '무선리모컨', '유선리모컨',
    '솔라셀', '프리미엄 냉난방 무선',
  ]],
  ['싱글', [
    '1WAY 싱글', '2WAY 일반', '4WAY 싱글', '냉난방기', '냉방전용',
    '매립덕트형 싱글',
  ]],
  ['HOME', [
    'HOME 멀티', '단배관', '다배관', '단내림',
  ]],
  // 실내기
  ['실내기', [
    'DVM S', 'NEW 고정압', '고정압 덕트',
    '저정압(', '중정압(',
    '멀티형 PAC', '멀티형 무풍',
  ]],
  // 실외기 — "실외기 받침대/방진가대"는 제외 (ETC로 분류)
  ['실외기', [
    '상부토출', '프라임', '고효율 한랭지', '표준형',
    'ECO', 'GHP',
  ]],
];

function classifyEquip(productName) {
  // "실외기 받침대/방진가대", "저정압 펌프", "중정압 펌프" 등은 ETC
  if (productName.startsWith('실외기 받침대') || productName.startsWith('실외기 방진가대')) return 'ETC';
  if (productName.includes('펌프')) return 'ETC';
  if (productName.startsWith('유연호스')) return 'ETC';

  for (const [sub, prefixes] of EQUIP_RULES) {
    for (const prefix of prefixes) {
      if (productName.startsWith(prefix)) return sub;
    }
  }
  return 'ETC';
}

// ── 설치비 소분류 자동 분류 규칙 (상품명 기준) ──
const INSTALL_RULES = [
  ['냉매배관', ['냉매배관', '동배관', '동부속', '냉매가스']],
  ['보온재', ['고무발포', 'PVC 아티론']],
  ['드레인', ['PVC 배관', 'PVC 부속', '유연호스', '드레인배관']],
  ['덕트', ['덕트', '스파이럴', '후렉시블', '보온 후렉시블', '토출 챔버', '디퓨저', '흡입그릴', '후드 캡', '실외기 토출']],
  ['전기/배선', ['VCTF', '난연 CD', '실내기 차단기', '실내기 통신선', '실내기 전원선', '실외기 메인 차단기', '실외기 차단기', '잡자재']],
  ['받침대', ['실외기 받침대', '실외기 방진가대']],
  ['공사비', ['기본설치비', '인건비', '노무비', '전기공사', '배관 트레이', '벽체 타공', '보양', '점검구', '중장비', '질소', '진공', '철거', '크레인', '지게차', '유선리모컨 설치', '실외기 인입']],
];

function classifyInstall(productName) {
  for (const [sub, prefixes] of INSTALL_RULES) {
    for (const prefix of prefixes) {
      if (productName.startsWith(prefix)) return sub;
    }
  }
  return '공사비';
}

async function run() {
  const wb = XLSX.readFile(EXCEL_PATH);

  // 1. 장비 가격표 파싱 (헤더: 행3, 데이터: 행4~)
  // 컬럼: [빈칸, 상품명, 규격, 단위, 단가, #태그]
  const ws1 = wb.Sheets['장비 가격표'];
  const rows1 = XLSX.utils.sheet_to_json(ws1, { header: 1 });

  const equipmentData = [];
  for (let i = 4; i < rows1.length; i++) {
    const row = rows1[i];
    if (!row || !row[1]) continue;
    const productName = String(row[1] || '').trim();
    equipmentData.push({
      category: '장비',
      sub_category: classifyEquip(productName),
      product_name: productName,
      specification: row[2] ? String(row[2]).trim() : null,
      unit: row[3] ? String(row[3]).trim() : null,
      unit_price: row[4] ? Number(row[4]) : 0,
      tags: null,
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
    if (!row || !row[1]) continue;
    const productName = String(row[1] || '').trim();
    installData.push({
      category: '설치비',
      sub_category: classifyInstall(productName),
      product_name: productName,
      specification: row[2] ? String(row[2]).trim() : null,
      unit: row[3] ? String(row[3]).trim() : null,
      unit_price: row[4] ? Number(row[4]) : 0,
      notes: row[5] ? String(row[5]).trim() : null,
      tags: row[6] ? String(row[6]).trim() : null,
    });
  }
  console.log('설치비 가격표:', installData.length, '건');

  // 소분류 분포 출력
  const stats = {};
  [...equipmentData, ...installData].forEach(item => {
    const key = item.category + ' > ' + item.sub_category;
    stats[key] = (stats[key] || 0) + 1;
  });
  console.log('\n── 소분류 분포 ──');
  Object.entries(stats).sort().forEach(([k, v]) => console.log('  ' + k + ': ' + v + '건'));

  // 3. 기존 데이터 삭제 후 삽입
  const { error: delError } = await supabase.from('price_list').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delError) {
    console.log('기존 데이터 삭제 중 에러 (무시 가능):', delError.message);
  }

  // 4. 데이터 삽입 (50개씩 배치)
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
