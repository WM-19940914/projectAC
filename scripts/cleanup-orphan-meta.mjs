// ============================================
// soft-deleted 계약에 남은 정산 메타 정리 스크립트
// 실행: node scripts/cleanup-orphan-meta.mjs
// ============================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SEP = '═'.repeat(60);
const THIN = '─'.repeat(60);

async function main() {
  console.log(SEP);
  console.log('  soft-deleted 계약의 정산 메타 정리');
  console.log('  실행 시각: ' + new Date().toLocaleString('ko-KR'));
  console.log(SEP + '\n');

  // ── 1단계: soft-deleted 계약 조회 ──
  console.log('[1] contracts 테이블에서 deleted_at IS NOT NULL 조회...\n');

  const { data: deletedContracts, error: e1 } = await supabase
    .from('contracts')
    .select('id, title, deleted_at')
    .not('deleted_at', 'is', null);

  if (e1) {
    console.error('  계약 조회 실패:', e1.message);
    process.exit(1);
  }

  console.log(`  soft-deleted 계약 수: ${deletedContracts.length}건`);
  for (const c of deletedContracts) {
    console.log(`    - ${c.id} | ${(c.title || '(제목 없음)').substring(0, 40)} | deleted_at: ${c.deleted_at}`);
  }
  console.log();

  if (deletedContracts.length === 0) {
    console.log('  soft-deleted 계약이 없습니다. 종료합니다.');
    return;
  }

  const deletedContractIds = deletedContracts.map(c => c.id);

  // ── 2단계: 해당 contract_id들의 정산 메타 조회 ──
  console.log(THIN);
  console.log('[2] 해당 계약들의 contract_settlement_meta 레코드 조회...\n');

  const { data: orphanMetas, error: e2 } = await supabase
    .from('contract_settlement_meta')
    .select('contract_id, stage_ratios, settlement_status_map, middle_installments, created_at')
    .in('contract_id', deletedContractIds);

  if (e2) {
    console.error('  정산 메타 조회 실패:', e2.message);
    process.exit(1);
  }

  console.log(`  삭제 대상 정산 메타: ${orphanMetas.length}건\n`);

  if (orphanMetas.length === 0) {
    console.log('  삭제할 정산 메타가 없습니다. 종료합니다.');
    return;
  }

  // 삭제 전 상세 내역 출력
  for (const m of orphanMetas) {
    const contract = deletedContracts.find(c => c.id === m.contract_id);
    console.log(`  contract_id   : ${m.contract_id}`);
    console.log(`  contract_title: ${(contract?.title || '(제목 없음)').substring(0, 40)}`);
    console.log(`  stage_ratios  : ${JSON.stringify(m.stage_ratios)}`);
    console.log(`  status_map    : ${JSON.stringify(m.settlement_status_map)}`);
    console.log(`  installments  : ${m.middle_installments}`);
    console.log(`  created_at    : ${m.created_at}`);
    console.log();
  }

  // ── 3단계: 삭제 실행 ──
  console.log(THIN);
  console.log('[3] 삭제 실행 중...\n');

  const orphanContractIds = orphanMetas.map(m => m.contract_id);

  const { data: deleted, error: e3 } = await supabase
    .from('contract_settlement_meta')
    .delete()
    .in('contract_id', orphanContractIds)
    .select('contract_id');

  if (e3) {
    console.error('  삭제 실패:', e3.message);
    process.exit(1);
  }

  console.log(`  삭제 완료: ${deleted.length}건\n`);

  // ── 4단계: 삭제 후 확인 ──
  console.log(THIN);
  console.log('[4] 삭제 후 확인...\n');

  const { data: remaining, error: e4 } = await supabase
    .from('contract_settlement_meta')
    .select('contract_id')
    .in('contract_id', deletedContractIds);

  if (e4) {
    console.error('  확인 조회 실패:', e4.message);
    process.exit(1);
  }

  if (remaining.length === 0) {
    console.log('  soft-deleted 계약에 남은 정산 메타: 0건 (정리 완료)');
  } else {
    console.log(`  [경고] 아직 남아있는 레코드: ${remaining.length}건`);
    for (const r of remaining) {
      console.log(`    - contract_id: ${r.contract_id}`);
    }
  }

  // 전체 정산 메타 건수 확인
  const { count, error: e5 } = await supabase
    .from('contract_settlement_meta')
    .select('contract_id', { count: 'exact', head: true });

  if (!e5) {
    console.log(`\n  전체 contract_settlement_meta 레코드 수: ${count}건`);
  }

  console.log('\n' + SEP);
  console.log('  완료');
  console.log(SEP);
}

main().catch(err => {
  console.error('스크립트 실행 오류:', err);
  process.exit(1);
});
