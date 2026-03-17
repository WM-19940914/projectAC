import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixOne(contractId, title) {
  // 계약 금액 조회
  const { data: contract } = await supabase.from('contracts').select('contract_amount').eq('id', contractId).single();
  const { data: meta } = await supabase.from('contract_settlement_meta').select('stage_ratios').eq('contract_id', contractId).single();

  if (!contract || !meta) { console.log('✗ 조회 실패:', title); return false; }

  const contractAmount = contract.contract_amount || 0;
  const vatTotal = contractAmount + Math.floor(contractAmount * 0.1);
  const oldRatios = meta.stage_ratios || {};

  // 활성 단계와 비율 파악
  const stages = ['선금', '중도금', '잔금'];
  let ratioSum = 0;
  for (const s of stages) {
    ratioSum += Number(oldRatios[s]) || 0;
  }

  if (ratioSum === 0) { console.log('✗ 비율합 0:', title); return false; }

  // 비율 → 실제 금액 변환
  const newRatios = { _mode: 'amount' };
  let allocated = 0;
  const activeStages = stages.filter(s => (Number(oldRatios[s]) || 0) > 0);

  for (const s of stages) {
    const ratio = Number(oldRatios[s]) || 0;
    if (ratio === 0) {
      newRatios[s] = 0;
    } else if (s === activeStages[activeStages.length - 1]) {
      // 마지막 활성 단계 = 나머지
      newRatios[s] = vatTotal - allocated;
    } else {
      const amount = Math.round(vatTotal * ratio / ratioSum);
      newRatios[s] = amount;
      allocated += amount;
    }
  }

  // 업데이트
  const { data, error } = await supabase
    .from('contract_settlement_meta')
    .update({ stage_ratios: newRatios })
    .eq('contract_id', contractId)
    .select('stage_ratios');

  if (error) { console.log('✗ 실패:', title, error.message); return false; }

  // 검증
  const saved = data[0].stage_ratios;
  const detail = stages.map(s => s + ':₩' + (saved[s] || 0).toLocaleString()).join(' / ');
  console.log('✓', title, '| VAT포함:', vatTotal.toLocaleString(), '→', detail);
  return true;
}

async function main() {
  const targets = [
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

  // 메리어트는 이미 수정됨 — 검증만
  const { data: verify } = await supabase.from('contract_settlement_meta').select('stage_ratios').eq('contract_id', '1024d73f-2b9a-47a8-a008-4ffa330ca2fb').single();
  console.log('✓ 메리어트호텔 (이미 수정) →', JSON.stringify(verify.stage_ratios));

  console.log('\n완료:', success + '/8건 + 메리어트 1건(기수정)');
}

main().catch(console.error);
