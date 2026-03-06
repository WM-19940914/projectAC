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

// ═══════════════════════════════════════════════════════════
// UTF-8 인코딩 검증 및 복구 함수
// ═══════════════════════════════════════════════════════════

/**
 * 문자열이 깨졌는지 확인 (물음표, 제어문자 등)
 */
function isEncodingBroken(str) {
  if (!str) return false;
  // 물음표가 연속으로 있거나 제어문자가 있으면 깨진 것으로 판단
  return /\?{2,}/.test(str) || /[\x00-\x08\x0B-\x0C\x0E-\x1F]/.test(str);
}

/**
 * UTF-8 유효성 검증
 */
function isValidUtf8(str) {
  if (typeof str !== 'string') return true;
  try {
    // UTF-8로 인코딩 후 다시 디코딩
    const buffer = Buffer.from(str, 'utf8');
    const decoded = buffer.toString('utf8');
    return decoded === str;
  } catch {
    return false;
  }
}

/**
 * 데이터 정제 및 검증
 */
function sanitizeField(value, fieldName = '') {
  if (!value) return value;
  
  const str = String(value).trim();
  
  // 물음표 연속 감지
  if (isEncodingBroken(str)) {
    console.warn(`⚠️  [${fieldName}] 인코딩 손상 감지: "${str.substring(0, 20)}..."`);
    // 손상된 데이터로 표시
    return `[손상:${fieldName}] ${str}`;
  }
  
  // UTF-8 유효성 확인
  if (!isValidUtf8(str)) {
    console.warn(`⚠️  [${fieldName}] UTF-8 인코딩 오류: "${str.substring(0, 20)}..."`);
    return `[오류:${fieldName}] ${str}`;
  }
  
  return str;
}

/**
 * 데이터베이스에서 손상된 기존 데이터 복구
 */
async function repairExistingData() {
  console.log('\n🔍 기존 데이터 손상 여부 검사 중...\n');
  
  const { data: allCustomers, error } = await supabase
    .from('customers')
    .select('id, company_name, contact_name, contact_title, address');
  
  if (error) {
    console.error('조회 에러:', error);
    return;
  }
  
  if (!allCustomers || allCustomers.length === 0) {
    console.log('✓ 기존 데이터 없음 (새로 시작)');
    return;
  }
  
  const brokenRecords = allCustomers.filter(c => 
    isEncodingBroken(c.company_name) ||
    isEncodingBroken(c.contact_name) ||
    isEncodingBroken(c.contact_title) ||
    isEncodingBroken(c.address)
  );
  
  if (brokenRecords.length > 0) {
    console.log(`⚠️  손상된 레코드 ${brokenRecords.length}개 발견!\n`);
    
    // 손상된 레코드 표시
    for (const record of brokenRecords) {
      console.log(`❌ ID: ${record.id}`);
      if (isEncodingBroken(record.company_name)) {
        console.log(`   company_name: "${record.company_name}"`);
      }
      if (isEncodingBroken(record.contact_name)) {
        console.log(`   contact_name: "${record.contact_name}"`);
      }
    }
    
    console.log('\n💡 권장: 손상된 데이터를 새 자료로 덮어쓰거나 수동으로 수정하세요.\n');
  } else {
    console.log('✓ 기존 데이터 인코딩 검사 통과\n');
  }
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('고객 데이터 Import (UTF-8 강제 mode)');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // 0. 기존 데이터 검사
  await repairExistingData();
  
  // 1. 엑셀 파일 읽기
  const wb = XLSX.readFile('C:/Users/minig/Desktop/pluuug_data_Melea_김우민_고객_260220.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);
  
  console.log(`📥 엑셀 파일에서 ${rows.length}개 행 로드됨\n`);
  
  // 2. 데이터 정제
  const toInsert = rows.map((row, idx) => {
    const cleaned = {
      company_name: sanitizeField(row['회사명'], '회사명') || '',
      contact_name: sanitizeField(row['담당자'], '담당자') || null,
      contact_title: sanitizeField(row['직책'], '직책') || null,
      phone: sanitizeField(row['연락처'], '연락처') || null,
      email: sanitizeField(row['이메일'], '이메일') || null,
      business_number: sanitizeField(row['사업자 등록번호'], '사업자등록번호') || null,
      representative: sanitizeField(row['대표자'], '대표자') || null,
      address: sanitizeField(row['소재지'], '소재지') || null,
      customer_type: '법인',
    };
    
    // 필수 필드 검증
    if (!cleaned.company_name) {
      console.warn(`⚠️  행 ${idx + 1}: 회사명 없음 - 스킵됨`);
      return null;
    }
    
    return cleaned;
  }).filter(Boolean);
  
  console.log(`✓ ${toInsert.length}개 항목 정제 완료\n`);
  
  // 3. 기존 데이터 삭제 (선택적)
  console.log('🗑️  기존 고객 데이터 삭제 중...');
  const { data: existing } = await supabase.from('customers').select('id');
  
  for (const c of (existing || [])) {
    const { error } = await supabase.from('customers').delete().eq('id', c.id);
    if (error) {
      console.error('삭제 실패:', c.id, error.message);
    }
  }
  
  // 4. 새 데이터 삽입
  console.log(`\n📤 ${toInsert.length}개 항목 Supabase에 저장 중...\n`);
  const { data, error } = await supabase
    .from('customers')
    .insert(toInsert)
    .select('id, company_name, contact_name, phone');
  
  if (error) {
    console.error('❌ 삽입 에러:', error.message);
    process.exit(1);
  } else {
    console.log(`✅ 총 ${data.length}개 등록 완료!\n`);
    data.forEach((d, i) => {
      console.log(`${i + 1}. ${d.company_name} | ${d.contact_name || '-'} | ${d.phone || '-'}`);
    });
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Import 완료! 데이터가 UTF-8로 저장되었습니다.');
  console.log('═══════════════════════════════════════════════════════════\n');
}

run().catch(err => {
  console.error('❌ 오류:', err);
  process.exit(1);
});
