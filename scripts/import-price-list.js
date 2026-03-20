// 가격표 엑셀 → Supabase 임포트 스크립트
// sub_category 자동 분류 포함 (임포트 한 번에 완료)
// UTF-8 인코딩 강제 모드

const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// 강제 UTF-8 설정
process.env.LANG = 'ko_KR.UTF-8';
process.env.LC_ALL = 'ko_KR.UTF-8';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// CLI 인자 또는 기본 경로에서 엑셀 파일 로드
// 사용법: node scripts/import-price-list.js [파일경로]
const EXCEL_PATH = process.argv[2] || './imports/price-list.xlsx';

// ═══════════════════════════════════════════════════════════
// UTF-8 인코딩 검증 및 정제 함수
// ═══════════════════════════════════════════════════════════

function isEncodingBroken(str) {
  if (!str) return false;
  return /\?{2,}/.test(str) || /[\x00-\x08\x0B-\x0C\x0E-\x1F]/.test(str);
}

function isValidUtf8(str) {
  if (typeof str !== 'string') return true;
  try {
    const buffer = Buffer.from(str, 'utf8');
    const decoded = buffer.toString('utf8');
    return decoded === str;
  } catch {
    return false;
  }
}

function sanitizeField(value, fieldName = '') {
  if (!value) return value;
  
  const str = String(value).trim();
  
  if (isEncodingBroken(str)) {
    console.warn(`⚠️  [${fieldName}] 인코딩 손상: "${str.substring(0, 20)}..."`);
    return `[손상] ${str}`;
  }
  
  if (!isValidUtf8(str)) {
    console.warn(`⚠️  [${fieldName}] UTF-8 오류: "${str.substring(0, 20)}..."`);
    return `[오류] ${str}`;
  }
  
  return str;
}

// ── 장비 소분류 자동 분류 규칙 (상품명 기준) ──
const EQUIP_RULES = [
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
  ['실내기', [
    'DVM S', 'NEW 고정압', '고정압 덕트',
    '저정압(', '중정압(',
    '멀티형 PAC', '멀티형 무풍',
  ]],
  ['실외기', [
    '상부토출', '프라임', '고효율 한랭지', '표준형',
    'ECO', 'GHP',
  ]],
];

function classifyEquip(productName) {
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

// ── 설치비 소분류 자동 분류 규칙 ──
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
  console.log('═══════════════════════════════════════════════════════════');
  console.log('가격표 Import (UTF-8 강제 mode)');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const wb = XLSX.readFile(EXCEL_PATH);

  // 1. 장비 가격표 파싱
  const ws1 = wb.Sheets['장비 가격표'];
  const rows1 = XLSX.utils.sheet_to_json(ws1, { header: 1 });

  const equipmentData = [];
  let equipBroken = 0;
  
  for (let i = 4; i < rows1.length; i++) {
    const row = rows1[i];
    if (!row || !row[1]) continue;
    
    const productName = sanitizeField(row[1], '상품명(장비)');
    if (isEncodingBroken(productName)) equipBroken++;
    
    equipmentData.push({
      category: '장비',
      sub_category: classifyEquip(productName),
      product_name: productName,
      specification: sanitizeField(row[2], '규격'),
      unit: sanitizeField(row[3], '단위'),
      unit_price: row[4] ? Number(row[4]) : 0,
      tags: null,
      notes: null,
    });
  }
  console.log(`📦 장비 가격표: ${equipmentData.length}건 (손상${equipBroken}건)\n`);

  // 2. 설치비 가격표 파싱
  const ws2 = wb.Sheets['설치비 가격표'];
  const rows2 = XLSX.utils.sheet_to_json(ws2, { header: 1 });

  const installData = [];
  let installBroken = 0;
  
  for (let i = 4; i < rows2.length; i++) {
    const row = rows2[i];
    if (!row || !row[1]) continue;
    
    const productName = sanitizeField(row[1], '상품명(설치비)');
    if (isEncodingBroken(productName)) installBroken++;
    
    installData.push({
      category: '설치비',
      sub_category: classifyInstall(productName),
      product_name: productName,
      specification: sanitizeField(row[2], '규격'),
      unit: sanitizeField(row[3], '단위'),
      unit_price: row[4] ? Number(row[4]) : 0,
      notes: sanitizeField(row[5], '비고'),
      tags: sanitizeField(row[6], '태그'),
    });
  }
  console.log(`⚙️  설치비 가격표: ${installData.length}건 (손상${installBroken}건)\n`);

  // 3. 소분류 분포
  const stats = {};
  [...equipmentData, ...installData].forEach(item => {
    const key = item.category + ' > ' + item.sub_category;
    stats[key] = (stats[key] || 0) + 1;
  });
  
  console.log('── 소분류 분포 ──');
  Object.entries(stats).sort().forEach(([k, v]) => console.log('  ' + k + ': ' + v + '건'));

  // 4. 기존 데이터 삭제
  console.log('\n🗑️  기존 가격표 삭제 중...');
  const { error: delError } = await supabase
    .from('price_list')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (delError && !delError.message.includes('0 rows')) {
    console.log('⚠️  삭제 중 에러 (무시 가능):', delError.message);
  }

  // 5. 데이터 삽입 (50개씩 배치)
  const allData = [...equipmentData, ...installData];
  const BATCH = 50;
  let inserted = 0;
  let failed = 0;

  console.log(`\n📤 ${allData.length}개 항목 저장 중...\n`);

  for (let i = 0; i < allData.length; i += BATCH) {
    const batch = allData.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    const totalBatches = Math.ceil(allData.length / BATCH);
    
    const { data, error } = await supabase
      .from('price_list')
      .insert(batch)
      .select('id');
    
    if (error) {
      console.error(`❌ 배치 ${batchNum}/${totalBatches} 실패:`, error.message);
      failed += batch.length;
    } else {
      inserted += data.length;
      console.log(`✓ 배치 ${batchNum}/${totalBatches} 완료 (+${data.length}건)`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`✅ Import 완료!`);
  console.log(`  - 전체: ${allData.length}건`);
  console.log(`  - 저장됨: ${inserted}건`);
  console.log(`  - 실패: ${failed}건`);
  if (equipBroken + installBroken > 0) {
    console.log(`⚠️  손상된 데이터: ${equipBroken + installBroken}건 (표시됨)`);
  }
  console.log('═══════════════════════════════════════════════════════════\n');
}

run().catch(err => {
  console.error('❌ 오류:', err);
  process.exit(1);
});
