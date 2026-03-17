import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const fmt = n => n.toLocaleString('ko-KR');

async function main() {
  const { data: requests } = await supabase
    .from('requests')
    .select('id, title, status, contract_id, customer:customers(company_name)')
    .eq('status', '계약 성공')
    .not('contract_id', 'is', null);

  console.log('총 계약 성공 의뢰:', requests?.length, '건\n');
  if (!requests || requests.length === 0) return;

  const contractIds = requests.map(r => r.contract_id).filter(Boolean);
  const { data: contracts } = await supabase.from('contracts').select('*').in('id', contractIds);
  const { data: metas } = await supabase.from('contract_settlement_meta').select('*').in('contract_id', contractIds);

  const contractMap = new Map();
  contracts?.forEach(c => contractMap.set(c.id, c));
  const metaMap = new Map();
  metas?.forEach(m => metaMap.set(m.contract_id, m));

  const unpaidList = [];
  const anomalyList = [];

  for (const req of requests) {
    const contract = contractMap.get(req.contract_id);
    const meta = metaMap.get(req.contract_id);
    if (!contract) continue;

    const contractAmount = contract.contract_amount || contract.amount || 0;
    const totalWithVat = contractAmount + Math.floor(contractAmount * 0.1);

    let stageRatios = meta?.stage_ratios || {};
    if (typeof stageRatios === 'string') stageRatios = JSON.parse(stageRatios);
    const isAmountMode = stageRatios._mode === 'amount';

    let settlementTypes = [];
    if (contract.settlement_type) {
      try { settlementTypes = JSON.parse(contract.settlement_type); } catch { settlementTypes = contract.settlement_type.split(',').map(s => s.trim()); }
    }

    let statusMap = meta?.settlement_status_map || {};
    if (typeof statusMap === 'string') statusMap = JSON.parse(statusMap);

    let scheduledDates = meta?.stage_scheduled_dates || {};
    if (typeof scheduledDates === 'string') scheduledDates = JSON.parse(scheduledDates);

    // 입금액 계산
    let totalPaid = 0;
    for (const [key, val] of Object.entries(statusMap)) {
      let stagePaid = 0;
      if (val?.payment_entries && Array.isArray(val.payment_entries)) {
        stagePaid = val.payment_entries.filter(e => e.confirmed).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      } else if (val?.actual_amount) {
        stagePaid = Number(val.actual_amount) || 0;
      }
      totalPaid += stagePaid;
    }

    const remaining = totalWithVat - totalPaid;

    // 1. 미완료 체크 (100원 이상 미수금)
    if (remaining > 100) {
      unpaidList.push({
        title: req.title,
        customer: req.customer?.company_name || '(없음)',
        contractAmount, totalWithVat, totalPaid, remaining,
        percent: ((totalPaid / totalWithVat) * 100).toFixed(1)
      });
    }

    // 2. 이상 데이터 체크
    const issues = [];

    // 비율모드: 합계 != 100
    if (!isAmountMode) {
      let ratioSum = 0;
      for (const [k, v] of Object.entries(stageRatios)) {
        if (k === '_mode') continue;
        ratioSum += Number(v) || 0;
      }
      if (Math.abs(ratioSum - 100) > 0.1 && ratioSum !== 0) {
        issues.push(`비율 합계 ${ratioSum}% (100%여야 함)`);
      }
    }

    // 금액모드: 단계합 != totalWithVat
    if (isAmountMode) {
      let amountSum = 0;
      for (const [k, v] of Object.entries(stageRatios)) {
        if (k === '_mode') continue;
        amountSum += Number(v) || 0;
      }
      if (amountSum > 0 && Math.abs(amountSum - totalWithVat) > 100) {
        issues.push(`금액모드 단계합 ₩${fmt(amountSum)} ≠ VAT포함 ₩${fmt(totalWithVat)} (차이: ₩${fmt(Math.abs(amountSum - totalWithVat))})`);
      }
    }

    // 초과 입금
    if (remaining < -100) {
      issues.push(`초과 입금: VAT포함 ₩${fmt(totalWithVat)} vs 입금 ₩${fmt(totalPaid)} (초과 ₩${fmt(-remaining)})`);
    }

    // 활성 단계인데 비율/금액 0
    for (const stage of settlementTypes) {
      const normalKey = stage === '선금' ? '선금' : stage === '잔금' ? '잔금' : '중도금';
      const ratio = stageRatios[normalKey];
      if (ratio === 0 || ratio === undefined) {
        if (isAmountMode) {
          issues.push(`활성 단계 [${stage}]인데 배분 금액 0원`);
        } else {
          issues.push(`활성 단계 [${stage}]인데 배분 비율 0%`);
        }
      }
    }

    // statusMap에 있는 키가 settlementType에 없는데 입금 있음 (유령 단계)
    for (const key of Object.keys(statusMap)) {
      const mapToType = key === '선금' ? '선금' : key === '잔금' ? '잔금' : key.startsWith('middle') ? '중도금' : key;
      if (!settlementTypes.includes(mapToType) && !settlementTypes.includes(key)) {
        const val = statusMap[key];
        const paid = val?.payment_entries?.filter(e => e.confirmed).reduce((s, e) => s + (Number(e.amount) || 0), 0) || Number(val?.actual_amount) || 0;
        if (paid > 0) {
          issues.push(`settlement_type에 없는 단계 [${key}]에 입금 ₩${fmt(paid)} 존재`);
        }
      }
    }

    // 계약금액 0
    if (contractAmount === 0) {
      issues.push('계약금액이 0원');
    }

    // 비율모드인데 stageRatios 값이 매우 큼 (금액이 비율 자리에 들어간 경우)
    if (!isAmountMode) {
      for (const [k, v] of Object.entries(stageRatios)) {
        if (k === '_mode') continue;
        if (Number(v) > 100) {
          issues.push(`비율모드인데 [${k}] 값이 ${fmt(Number(v))} (금액이 비율 자리에 들어간 듯)`);
        }
      }
    }

    if (issues.length > 0) {
      anomalyList.push({
        title: req.title,
        customer: req.customer?.company_name || '(없음)',
        contractAmount, totalWithVat,
        settlementTypes: settlementTypes.join(', '),
        stageRatios: JSON.stringify(stageRatios),
        issues
      });
    }
  }

  // ====== 출력 ======
  console.log('══════════════════════════════════════════════════════');
  console.log('  1. 정산 미완료 (미수금 있음)');
  console.log('══════════════════════════════════════════════════════\n');

  if (unpaidList.length === 0) {
    console.log('  모든 계약 정산 완료!\n');
  } else {
    for (let i = 0; i < unpaidList.length; i++) {
      const u = unpaidList[i];
      console.log(`${i+1}. ${u.title}`);
      console.log(`   고객: ${u.customer}`);
      console.log(`   계약금액(공급가): ₩${fmt(u.contractAmount)}`);
      console.log(`   VAT포함 총액:    ₩${fmt(u.totalWithVat)}`);
      console.log(`   입금완료:        ₩${fmt(u.totalPaid)} (${u.percent}%)`);
      console.log(`   미수금:          ₩${fmt(u.remaining)}`);
      console.log('');
    }
  }

  console.log('══════════════════════════════════════════════════════');
  console.log('  2. 정산 구조 이상 데이터');
  console.log('══════════════════════════════════════════════════════\n');

  if (anomalyList.length === 0) {
    console.log('  이상 없음!\n');
  } else {
    for (let i = 0; i < anomalyList.length; i++) {
      const a = anomalyList[i];
      console.log(`${i+1}. ${a.title}`);
      console.log(`   고객: ${a.customer}`);
      console.log(`   계약금액: ₩${fmt(a.contractAmount)} / VAT포함: ₩${fmt(a.totalWithVat)}`);
      console.log(`   정산구조: ${a.settlementTypes}`);
      for (const issue of a.issues) {
        console.log(`   ⚠ ${issue}`);
      }
      console.log('');
    }
  }

  console.log('─────────────────────────────────────────────────────');
  console.log(`총 계약 성공: ${requests.length}건 / 미완료: ${unpaidList.length}건 / 구조 이상: ${anomalyList.length}건`);
}

main().catch(console.error);
