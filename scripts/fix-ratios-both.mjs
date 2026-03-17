import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixOne(contractId, title) {
  // 1. 계약 금액 + memo 조회
  const { data: contract } = await supabase.from('contracts').select('contract_amount, memo').eq('id', contractId).single();
  const { data: meta } = await supabase.from('contract_settlement_meta').select('*').eq('contract_id', contractId).single();

  if (!contract || !meta) { console.log('✗ 조회 실패:', title); return false; }

  const contractAmount = contract.contract_amount || 0;
  const vatTotal = contractAmount + Math.floor(contractAmount * 0.1);
  const oldRatios = meta.stage_ratios || {};

  // 비율 → 금액 변환
  const stages = ['선금', '중도금', '잔금'];
  let ratioSum = 0;
  for (const s of stages) ratioSum += Number(oldRatios[s]) || 0;
  if (ratioSum === 0) { console.log('✗ 비율합 0:', title); return false; }

  const newRatios = { _mode: 'amount' };
  let allocated = 0;
  const activeStages = stages.filter(s => (Number(oldRatios[s]) || 0) > 0);

  for (const s of stages) {
    const ratio = Number(oldRatios[s]) || 0;
    if (ratio === 0) {
      newRatios[s] = 0;
    } else if (s === activeStages[activeStages.length - 1]) {
      newRatios[s] = vatTotal - allocated;
    } else {
      const amount = Math.round(vatTotal * ratio / ratioSum);
      newRatios[s] = amount;
      allocated += amount;
    }
  }

  // 2. contract_settlement_meta 테이블 업데이트
  const { error: metaErr } = await supabase
    .from('contract_settlement_meta')
    .update({ stage_ratios: newRatios })
    .eq('contract_id', contractId);

  if (metaErr) { console.log('✗ 메타 테이블 실패:', title, metaErr.message); return false; }

  // 3. contracts.memo 필드도 업데이트 (JSON 봉투 안의 stage_ratios)
  let memoUpdated = false;
  if (contract.memo) {
    try {
      const parsed = JSON.parse(contract.memo);
      if (parsed && parsed.__sac_contract_meta && parsed.__sac_contract_meta.stage_ratios) {
        parsed.__sac_contract_meta.stage_ratios = newRatios;
        const { error: memoErr } = await supabase
          .from('contracts')
          .update({ memo: JSON.stringify(parsed) })
          .eq('id', contractId);
        if (memoErr) {
          console.log('  ⚠ memo 업데이트 실패:', memoErr.message);
        } else {
          memoUpdated = true;
        }
      }
    } catch {
      // memo가 JSON이 아닌 경우 무시
    }
  }

  // 4. 검증
  const { data: verify } = await supabase.from('contract_settlement_meta').select('stage_ratios').eq('contract_id', contractId).single();
  const detail = stages.map(s => s + ':₩' + (verify.stage_ratios[s] || 0).toLocaleString()).join(' / ');
  console.log('✓', title, '| VAT포함:', vatTotal.toLocaleString(), '→', detail, memoUpdated ? '(memo도 수정)' : '(memo 없음)');
  return true;
}

async function main() {
  const targets = [
    ['1024d73f-2b9a-47a8-a008-4ffa330ca2fb', '메리어트호텔'],
    ['d975354a-9d70-43e5-a83a-b5d9a8977bf5', '삼성전자 로지텍 서서울물류센터'],
    ['1b295bcc-8bc2-47c4-808c-9419e823956f', '현대기술산업 ERV 납품건'],
    ['3324e9e7-8f67-48f0-978a-afb8a85dd57d', '주와그리스도 교회'],
    ['07112b67-ac7a-40b2-a0ef-ee839cd44ebd', '용인 수지정약국'],
    ['bf6bef3f-93a1-4138-975e-b8c69ca13685', '애플산부인과 추가 증설'],
    ['186c6229-c77c-42c2-a207-7b69d24315fc', '르와르빌 102호'],
    ['ecbeadc0-878e-4182-a890-db7bfd870197', '슬로우캘리 왕십리뉴타운점'],
    ['b1b0eb38-fcd4-4133-9e2f-94fa43541241', '군산 수송 오투그란데'],
  ];

  let success = 0;
  for (const [id, title] of targets) {
    if (await fixOne(id, title)) success++;
  }
  console.log('\n완료:', success + '/' + targets.length + '건');
  console.log('\n⚠ 브라우저에서 Ctrl+Shift+R (강력 새로고침) 필요!');
}

main().catch(console.error);
