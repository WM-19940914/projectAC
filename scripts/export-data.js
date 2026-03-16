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
// 메인: DB 데이터를 엑셀로 내보내기
// ═══════════════════════════════════════════════════════════
async function main() {
  console.log('📦 데이터 내보내기 시작...\n');

  // 1. 모든 데이터 병렬 조회
  const [reqRes, custRes, contRes, metaRes, expRes] = await Promise.all([
    supabase.from('requests').select('*').neq('status', '숨김').order('created_at', { ascending: false }),
    supabase.from('customers').select('*').is('deleted_at', null).order('company_name'),
    supabase.from('contracts').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('contract_settlement_meta').select('*'),
    supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
  ]);

  const requests = reqRes.data || [];
  const customers = custRes.data || [];
  const contracts = contRes.data || [];
  const metas = metaRes.data || [];
  const expenses = expRes.data || [];

  console.log(`  의뢰: ${requests.length}건`);
  console.log(`  고객: ${customers.length}건`);
  console.log(`  계약: ${contracts.length}건`);
  console.log(`  정산메타: ${metas.length}건`);
  console.log(`  지출: ${expenses.length}건\n`);

  // 맵 구성
  const customerMap = new Map(customers.map(c => [c.id, c]));
  const contractMap = new Map(contracts.map(c => [c.id, c]));
  const metaMap = new Map(metas.map(m => [m.contract_id, m]));

  // request_id로 계약 찾기
  const requestContractMap = new Map();
  for (const c of contracts) {
    if (c.request_id) requestContractMap.set(c.request_id, c);
  }

  // ───────────────────────────────────────────
  // 시트1: 의뢰 + 계약 통합 (메인 시트)
  // ───────────────────────────────────────────
  const mainRows = requests.map(r => {
    const customer = r.customer_id ? customerMap.get(r.customer_id) : null;
    const contract = r.contract_id ? contractMap.get(r.contract_id) : null;
    const meta = r.contract_id ? metaMap.get(r.contract_id) : null;

    // 정산 단계 파싱
    let settlementType = '';
    if (contract?.settlement_type) {
      const raw = contract.settlement_type;
      if (typeof raw === 'string') {
        settlementType = raw.startsWith('[') ? JSON.parse(raw).join(', ') : raw;
      } else if (Array.isArray(raw)) {
        settlementType = raw.join(', ');
      }
    }

    // 비율 파싱
    let ratioText = '';
    if (meta?.stage_ratios && typeof meta.stage_ratios === 'object') {
      ratioText = Object.entries(meta.stage_ratios)
        .filter(([, v]) => Number(v) > 0)
        .map(([k, v]) => `${k} ${v}%`)
        .join(', ');
    }

    // 예정일 파싱
    let scheduledText = '';
    if (meta?.stage_scheduled_dates && typeof meta.stage_scheduled_dates === 'object') {
      scheduledText = Object.entries(meta.stage_scheduled_dates)
        .filter(([, v]) => v && String(v).trim())
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
    }

    // 입금 현황 파싱
    let paymentText = '';
    if (meta?.settlement_status_map && typeof meta.settlement_status_map === 'object') {
      const entries = [];
      for (const [stageKey, stageData] of Object.entries(meta.settlement_status_map)) {
        if (!stageData || typeof stageData !== 'object') continue;
        const sd = stageData;
        // payment_entries에서 합산
        let paid = 0;
        if (Array.isArray(sd.payment_entries)) {
          for (const pe of sd.payment_entries) {
            if (pe && pe.confirmed === true) paid += Number(pe.amount) || 0;
          }
        } else if (sd.actual_amount) {
          paid = Number(sd.actual_amount) || 0;
        }
        if (paid > 0) {
          entries.push(`${stageKey}: ₩${paid.toLocaleString()}`);
        }
      }
      paymentText = entries.join(', ');
    }

    return {
      '의뢰ID': r.id,
      '현장명(의뢰제목)': r.title || '',
      '상태': r.status || '',
      '숨김여부': r.hidden ? 'Y' : 'N',
      '의뢰일': r.inquiry_date || '',
      '고객ID': r.customer_id || '',
      '고객(회사명)': customer?.company_name || '⚠️ 미연결',
      '담당자': customer?.contact_name || '',
      '연락처': customer?.phone || '',
      '계약ID': r.contract_id || '',
      '계약금액(공급가액)': contract ? (Number(contract.contract_amount || contract.amount) || 0) : '',
      '계약시작일': contract?.start_date || '',
      '계약종료일': contract?.end_date || '',
      '정산단계': settlementType || '⚠️ 미설정',
      '단계별비율': ratioText || '',
      '단계별예정일': scheduledText || '⚠️ 미설정',
      '입금현황': paymentText || '',
      '중도금분할횟수': meta?.middle_installments || '',
      '메모': r.memo || '',
    };
  });

  // ───────────────────────────────────────────
  // 시트2: 고객 목록
  // ───────────────────────────────────────────
  const customerRows = customers.map(c => ({
    '고객ID': c.id,
    '회사명': c.company_name || '',
    '담당자': c.contact_name || '',
    '전화번호': c.phone || '',
    '이메일': c.email || '',
    '주소': c.address || '',
    '대표자': c.representative || '',
    '사업자번호': c.business_number || '',
    '고객유형': c.customer_type || '',
    '메모': c.memo || '',
  }));

  // ───────────────────────────────────────────
  // 시트3: 지출 목록
  // ───────────────────────────────────────────
  const expenseRows = expenses.map(e => {
    const contract = e.contract_id ? contractMap.get(e.contract_id) : null;
    // contract → request 찾기
    let requestTitle = '';
    for (const r of requests) {
      if (r.contract_id === e.contract_id) {
        requestTitle = r.title;
        break;
      }
    }

    return {
      '지출ID': e.id,
      '연결된현장': requestTitle || '⚠️ 미연결',
      '계약ID': e.contract_id || '',
      '지출일': e.expense_date || '',
      '거래처': e.vendor || '',
      '내용': e.description || '',
      '계정과목': e.account_category || '',
      '공급가액': Number(e.amount_excl_tax) || 0,
      '세액': Number(e.tax_amount) || 0,
      '합계(VAT포함)': Number(e.amount_incl_tax) || 0,
      '지급여부': e.is_paid ? '지급완료' : '⚠️ 미지급',
      '결제수단': e.payment_method || '',
      '세금계산서수령': e.tax_invoice_received || '',
      '세금계산서마감일': e.tax_invoice_due_date || '',
      '메모': e.memo || '',
    };
  });

  // ───────────────────────────────────────────
  // 시트4: 이거 채워주세요! (빈 템플릿)
  // ───────────────────────────────────────────
  // 계약 성공 상태인 의뢰 중 데이터가 빠진 것만 추려서 보여줌
  const todoRows = [];
  for (const r of requests) {
    if (r.status !== '계약 성공') continue;
    const contract = r.contract_id ? contractMap.get(r.contract_id) : null;
    const meta = r.contract_id ? metaMap.get(r.contract_id) : null;
    const customer = r.customer_id ? customerMap.get(r.customer_id) : null;

    const missing = [];
    if (!r.customer_id || !customer) missing.push('고객 미연결');
    if (!r.contract_id || !contract) missing.push('계약 미연결');
    if (contract && !(Number(contract.contract_amount || contract.amount) > 0)) missing.push('계약금액 없음');
    if (!contract?.settlement_type) missing.push('정산단계 미설정');
    if (meta) {
      const ratios = meta.stage_ratios;
      if (!ratios || typeof ratios !== 'object' || Object.values(ratios).every(v => !Number(v))) {
        missing.push('비율 미설정');
      }
      const dates = meta.stage_scheduled_dates;
      if (!dates || typeof dates !== 'object' || Object.values(dates).every(v => !v || !String(v).trim())) {
        missing.push('예정일 미설정');
      }
    } else if (r.contract_id) {
      missing.push('정산메타 없음 (비율/예정일 전부)');
    }

    if (missing.length > 0) {
      todoRows.push({
        '현장명': r.title || '',
        '고객명': customer?.company_name || '',
        '현재상태': r.status,
        '계약금액': contract ? (Number(contract.contract_amount || contract.amount) || 0) : '',
        '부족한정보': missing.join(' / '),
        '의뢰ID': r.id,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 엑셀 파일 생성
  // ═══════════════════════════════════════════════════════════
  const wb = XLSX.utils.book_new();

  // 시트1: 의뢰+계약 통합
  const ws1 = XLSX.utils.json_to_sheet(mainRows);
  // 열 너비 설정
  ws1['!cols'] = [
    { wch: 12 }, // 의뢰ID
    { wch: 25 }, // 현장명
    { wch: 10 }, // 상태
    { wch: 8 },  // 숨김여부
    { wch: 12 }, // 의뢰일
    { wch: 12 }, // 고객ID
    { wch: 20 }, // 고객명
    { wch: 10 }, // 담당자
    { wch: 15 }, // 연락처
    { wch: 12 }, // 계약ID
    { wch: 18 }, // 계약금액
    { wch: 12 }, // 시작일
    { wch: 12 }, // 종료일
    { wch: 20 }, // 정산단계
    { wch: 25 }, // 비율
    { wch: 30 }, // 예정일
    { wch: 30 }, // 입금현황
    { wch: 12 }, // 중도금분할
    { wch: 25 }, // 메모
  ];
  XLSX.utils.book_append_sheet(wb, ws1, '의뢰+계약 통합');

  // 시트2: 고객
  const ws2 = XLSX.utils.json_to_sheet(customerRows);
  ws2['!cols'] = [
    { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 15 },
    { wch: 25 }, { wch: 30 }, { wch: 10 }, { wch: 15 },
    { wch: 8 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, '고객목록');

  // 시트3: 지출
  const ws3 = XLSX.utils.json_to_sheet(expenseRows);
  ws3['!cols'] = [
    { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
    { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 15 },
    { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 12 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, '지출목록');

  // 시트4: 부족한 정보
  if (todoRows.length > 0) {
    const ws4 = XLSX.utils.json_to_sheet(todoRows);
    ws4['!cols'] = [
      { wch: 25 }, { wch: 20 }, { wch: 10 }, { wch: 18 },
      { wch: 40 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws4, '⚠️ 이거 채워주세요');
  }

  // 파일 저장
  const fileName = `M_데이터_내보내기_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);

  console.log(`\n✅ 엑셀 파일 생성 완료: ${fileName}`);
  console.log('\n📋 시트 구성:');
  console.log('  1. 의뢰+계약 통합 — 현재 모든 의뢰와 계약 정보');
  console.log('  2. 고객목록 — 등록된 고객 정보');
  console.log('  3. 지출목록 — 지출 내역');
  if (todoRows.length > 0) {
    console.log(`  4. ⚠️ 이거 채워주세요 — 계약 성공인데 정보 부족한 항목 ${todoRows.length}건`);
  }
  console.log('\n💡 ⚠️ 표시가 있는 셀은 데이터가 빠져있다는 뜻이에요!');
}

main().catch(err => {
  console.error('❌ 에러:', err.message);
  process.exit(1);
});
