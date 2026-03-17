import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 금액모드인데 비율값이 들어간 9건
const targets = [
  { contractId: 'd975354a-9d70-43e5-a83a-b5d9a8977bf5', title: '삼성전자 로지텍 서서울물류센터' },
  { contractId: '1b295bcc-8bc2-47c4-808c-9419e823956f', title: '현대기술산업 ERV 납품건' },
  { contractId: '3324e9e7-8f67-48f0-978a-afb8a85dd57d', title: '주와그리스도 교회' },
  { contractId: '07112b67-ac7a-40b2-a0ef-ee839cd44ebd', title: '용인 수지정약국' },
  { contractId: 'bf6bef3f-93a1-4138-975e-b8c69ca13685', title: '애플산부인과 추가 증설' },
  { contractId: '186c6229-c77c-42c2-a207-7b69d24315fc', title: '르와르빌 102호' },
  { contractId: 'ecbeadc0-878e-4182-a890-db7bfd870197', title: '슬로우캘리 왕십리뉴타운점' },
  { contractId: 'b1b0eb38-fcd4-4133-9e2f-94fa43541241', title: '군산 수송 오투그란데' },
  { contractId: '1024d73f-2b9a-47a8-a008-4ffa330ca2fb', title: '메리어트호텔' },
];

async function main() {
  let success = 0;

  for (const t of targets) {
    // 계약 정보 조회
    const { data: contract } = await supabase.from('contracts').select('contract_amount').eq('id', t.contractId).single();
    const { data: meta } = await supabase.from('contract_settlement_meta').select('*').eq('contract_id', t.contractId).single();

    if (!contract || !meta) { console.log('✗ 조회 실패:', t.title); continue; }

    const contractAmount = contract.contract_amount || 0;
    const vatTotal = contractAmount + Math.floor(contractAmount * 0.1);
    const ratios = JSON.parse(JSON.stringify(meta.stage_ratios || {}));

    // 현재 비율값을 실제 VAT포함 금액으로 변환
    // 비율 합계 구하기 (0이 아닌 것들만)
    const stages = ['선금', '중도금', '잔금'];
    let ratioSum = 0;
    for (const s of stages) {
      ratioSum += Number(ratios[s]) || 0;
    }

    if (ratioSum === 0) { console.log('✗ 비율 합계 0:', t.title); continue; }

    // 각 단계의 비율을 VAT포함 금액으로 변환
    const newRatios = { _mode: 'amount' };
    let allocated = 0;
    const activeStages = stages.filter(s => (Number(ratios[s]) || 0) > 0);

    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      const ratio = Number(ratios[s]) || 0;

      if (ratio === 0) {
        newRatios[s] = 0;
      } else if (i === stages.length - 1 || s === activeStages[activeStages.length - 1]) {
        // 마지막 활성 단계는 잔여분으로 (반올림 오차 방지)
        newRatios[s] = vatTotal - allocated;
      } else {
        const amount = Math.round(vatTotal * ratio / ratioSum);
        newRatios[s] = amount;
        allocated += amount;
      }
    }

    // 마지막 활성 단계 보정
    let totalCheck = 0;
    for (const s of stages) totalCheck += newRatios[s];
    if (totalCheck !== vatTotal) {
      // 차이 보정
      const lastActive = activeStages[activeStages.length - 1];
      newRatios[lastActive] += (vatTotal - totalCheck);
    }

    const { error } = await supabase.from('contract_settlement_meta')
      .update({ stage_ratios: newRatios })
      .eq('contract_id', t.contractId);

    if (error) {
      console.log('✗ 업데이트 실패:', t.title, error.message);
    } else {
      const detail = stages.map(s => s + ':₩' + (newRatios[s] || 0).toLocaleString()).join(' / ');
      console.log('✓', t.title);
      console.log('  VAT포함:', vatTotal.toLocaleString(), '→', detail);
      success++;
    }
  }

  console.log('\n완료:', success + '/' + targets.length + '건');
}

main().catch(console.error);
