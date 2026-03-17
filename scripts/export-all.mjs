import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const fmt = n => (n || 0).toLocaleString('ko-KR');

async function main() {
  // ====== 데이터 조회 ======
  const { data: requests } = await supabase
    .from('requests')
    .select('*, customer:customers(id, company_name)')
    .neq('status', '숨김')
    .order('created_at', { ascending: false });

  const { data: contracts } = await supabase
    .from('contracts')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: metas } = await supabase
    .from('contract_settlement_meta')
    .select('*');

  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .is('deleted_at', null)
    .order('company_name');

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*, contract:contracts(title)')
    .order('created_at', { ascending: false });

  const contractMap = new Map();
  contracts?.forEach(c => contractMap.set(c.id, c));
  const metaMap = new Map();
  metas?.forEach(m => metaMap.set(m.contract_id, m));

  // ====== 시트 1: 의뢰 목록 ======
  const reqRows = requests.map(r => {
    const contract = r.contract_id ? contractMap.get(r.contract_id) : null;
    const meta = r.contract_id ? metaMap.get(r.contract_id) : null;

    // 정산 형태
    let settlementType = '';
    if (contract?.settlement_type) {
      try { settlementType = JSON.parse(contract.settlement_type).join(', '); }
      catch { settlementType = contract.settlement_type; }
    }

    // 입금 합계
    let totalPaid = 0;
    const statusMap = meta?.settlement_status_map || {};
    for (const [key, val] of Object.entries(statusMap)) {
      if (val?.payment_entries && Array.isArray(val.payment_entries)) {
        totalPaid += val.payment_entries.filter(e => e.confirmed).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      } else if (val?.actual_amount) {
        totalPaid += Number(val.actual_amount) || 0;
      }
    }

    const contractAmount = contract?.contract_amount || 0;
    const vatTotal = contractAmount + Math.floor(contractAmount * 0.1);

    return {
      '의뢰 제목': r.title,
      '상태': r.status,
      '고객명': r.customer?.company_name || '',
      '문의일': r.inquiry_date || '',
      '계약금액(공급가)': contractAmount,
      'VAT포함 총액': vatTotal,
      '입금 완료액': totalPaid,
      '미수금': vatTotal - totalPaid,
      '정산 형태': settlementType,
      '착수일': contract?.start_date || '',
      '종료일': contract?.end_date || '',
      '숨김': r.hidden ? 'Y' : '',
      '메모': r.memo || '',
    };
  });

  // ====== 시트 2: 계약 목록 ======
  const contractRows = contracts.map(c => {
    let settlementType = '';
    if (c.settlement_type) {
      try { settlementType = JSON.parse(c.settlement_type).join(', '); }
      catch { settlementType = c.settlement_type; }
    }

    return {
      '계약 제목': c.title,
      '계약금액(공급가)': c.contract_amount || 0,
      'VAT포함': (c.contract_amount || 0) + Math.floor((c.contract_amount || 0) * 0.1),
      '정산 형태': settlementType,
      '착수일': c.start_date || '',
      '종료일': c.end_date || '',
      '메모': (() => {
        if (!c.memo) return '';
        try {
          const parsed = JSON.parse(c.memo);
          return parsed.note || '';
        } catch { return c.memo; }
      })(),
    };
  });

  // ====== 시트 3: 정산 상세 ======
  // stage_ratios 기준으로 모든 단계 출력 (입금 내역 없는 단계 포함)
  const STAGE_ORDER = ['선금', 'middle-1', 'middle-2', 'middle-3', 'middle-4', 'middle-5', '잔금'];
  const settlementRows = [];
  for (const r of requests) {
    if (!r.contract_id) continue;
    const contract = contractMap.get(r.contract_id);
    const meta = metaMap.get(r.contract_id);
    if (!contract || !meta) continue;

    const statusMap = meta.settlement_status_map || {};
    const scheduledDates = meta.stage_scheduled_dates || {};
    const stageRatios = meta.stage_ratios || {};
    const isAmountMode = stageRatios._mode === 'amount';
    const middleInstallments = meta.middle_installments || 1;

    // settlement_type에서 활성 단계 파악
    let settlementTypes = [];
    if (contract.settlement_type) {
      try { settlementTypes = JSON.parse(contract.settlement_type); }
      catch { settlementTypes = contract.settlement_type.split(',').map(s => s.trim()); }
    }

    const contractAmount = contract.contract_amount || 0;
    const vatTotal = contractAmount + Math.floor(contractAmount * 0.1);

    // 활성 단계 키 목록 구성
    const activeKeys = [];
    for (const stage of settlementTypes) {
      if (stage === '선금') activeKeys.push('선금');
      else if (stage === '중도금') {
        for (let i = 1; i <= middleInstallments; i++) activeKeys.push('middle-' + i);
      }
      else if (stage === '잔금') activeKeys.push('잔금');
    }
    // statusMap에 있지만 activeKeys에 없는 키도 추가 (추가 정산 등)
    for (const key of Object.keys(statusMap)) {
      if (!activeKeys.includes(key)) activeKeys.push(key);
    }

    for (const key of activeKeys) {
      const val = statusMap[key] || null;
      let paid = 0;
      if (val?.payment_entries && Array.isArray(val.payment_entries)) {
        paid = val.payment_entries.filter(e => e.confirmed).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      } else if (val?.actual_amount) {
        paid = Number(val.actual_amount) || 0;
      }

      const label = key.startsWith('middle-') ? '중도금 ' + key.split('-')[1] + '차' : key;
      // 배분 금액 계산
      const ratioKey = key.startsWith('middle-') ? '중도금' : key;
      let plannedAmount = 0;
      if (isAmountMode) {
        const rawVal = Number(stageRatios[key] || stageRatios[ratioKey] || 0);
        if (rawVal > 100) {
          // 정상 금액모드
          plannedAmount = key.startsWith('middle-') ? Math.round(rawVal / middleInstallments) : rawVal;
        } else if (rawVal > 0) {
          // 비율이 금액 자리에 들어간 경우 → 비율로 계산
          plannedAmount = Math.round(vatTotal * rawVal / 100);
          if (key.startsWith('middle-')) plannedAmount = Math.round(plannedAmount / middleInstallments);
        }
      } else {
        const pct = Number(stageRatios[ratioKey] || 0);
        plannedAmount = Math.round(vatTotal * pct / 100);
        if (key.startsWith('middle-')) plannedAmount = Math.round(plannedAmount / middleInstallments);
      }

      settlementRows.push({
        '의뢰 제목': r.title,
        '고객명': r.customer?.company_name || '',
        '정산 단계': label,
        '단계 금액(VAT포함)': plannedAmount,
        '입금예정일': scheduledDates[key] || scheduledDates[ratioKey] || '',
        '입금액': paid,
        '미수금': plannedAmount - paid,
        '입금일': val?.received_date || val?.payment_entries?.[0]?.paid_at || '',
        '입금확정': val?.payment_entries?.every(e => e.confirmed) ? 'Y' : '',
        '세금계산서 발행': val?.tax_invoice_issued ? 'Y' : '',
        '세금계산서 발행일': val?.tax_invoice_date || '',
        '정산 상태': paid >= plannedAmount && plannedAmount > 0 ? '완료' : paid > 0 ? '부분' : '미입금',
      });
    }
  }

  // ====== 시트 4: 고객 목록 ======
  const customerRows = customers.map(c => ({
    '회사명': c.company_name || '',
    '담당자': c.contact_name || '',
    '전화': c.phone || '',
    '이메일': c.email || '',
    '주소': c.address || '',
    '대표자': c.representative || '',
    '사업자번호': c.business_number || '',
  }));

  // ====== 시트 5: 지출 목록 ======
  const expenseRows = (expenses || []).map(e => ({
    '계약명': e.contract?.title || '',
    '항목': e.description || '',
    '거래처': e.vendor || '',
    '금액(VAT별도)': e.amount_excl_tax || e.cost_amount || 0,
    'VAT': e.tax_amount || 0,
    '금액(VAT포함)': e.amount_incl_tax || 0,
    '카테고리': e.category || '',
    '계정과목': e.account_category || '',
    '지출일': e.expense_date || '',
    '결제완료': e.is_paid ? 'Y' : '',
    '결제수단': e.payment_method || '',
    '메모': e.memo || '',
  }));

  // ====== 엑셀 생성 ======
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(reqRows);
  XLSX.utils.book_append_sheet(wb, ws1, '의뢰');

  const ws2 = XLSX.utils.json_to_sheet(contractRows);
  XLSX.utils.book_append_sheet(wb, ws2, '계약');

  const ws3 = XLSX.utils.json_to_sheet(settlementRows);
  XLSX.utils.book_append_sheet(wb, ws3, '정산상세');

  const ws4 = XLSX.utils.json_to_sheet(customerRows);
  XLSX.utils.book_append_sheet(wb, ws4, '고객');

  const ws5 = XLSX.utils.json_to_sheet(expenseRows);
  XLSX.utils.book_append_sheet(wb, ws5, '지출');

  const outPath = 'c:/Users/User/Downloads/웹앱_전체데이터_260317_v2.xlsx';
  XLSX.writeFile(wb, outPath);
  console.log('내보내기 완료:', outPath);
  console.log('  의뢰:', reqRows.length, '건');
  console.log('  계약:', contractRows.length, '건');
  console.log('  정산상세:', settlementRows.length, '건');
  console.log('  고객:', customerRows.length, '건');
  console.log('  지출:', expenseRows.length, '건');
}

main().catch(console.error);
