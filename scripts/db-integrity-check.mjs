// ============================================
// DB 정합성 점검 스크립트
// 실행: node scripts/db-integrity-check.mjs
// ============================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 유효한 의뢰 상태값
const VALID_REQUEST_STATUSES = ['견적 문의', '영업중', '계약 성공', '수주 실패', '숨김'];

// 구분선 유틸
const SEP = '═'.repeat(70);
const THIN = '─'.repeat(70);

// 숫자 포맷 유틸
const fmt = n => (n || 0).toLocaleString('ko-KR');

// ============================================
// 데이터 로드
// ============================================
async function loadAllData() {
  console.log('데이터 로딩 중...\n');

  // 모든 데이터를 deleted_at 관계없이 전체 로드
  const [
    { data: requests, error: e1 },
    { data: contracts, error: e2 },
    { data: metas, error: e3 },
    { data: customers, error: e4 },
    { data: expenses, error: e5 },
    { data: quotations, error: e6 },
    { data: orderDeliveries, error: e7 },
    { data: orderDeliveryLines, error: e8 },
  ] = await Promise.all([
    supabase.from('requests').select('*'),
    supabase.from('contracts').select('*'),
    supabase.from('contract_settlement_meta').select('*'),
    supabase.from('customers').select('*'),
    supabase.from('expenses').select('*'),
    supabase.from('quotations').select('*'),
    supabase.from('order_deliveries').select('*'),
    supabase.from('order_delivery_lines').select('*'),
  ]);

  // tax_invoices 테이블 존재 여부 확인
  const { data: taxInvoices, error: taxErr } = await supabase
    .from('tax_invoices')
    .select('*')
    .limit(1);

  const hasTaxInvoiceTable = !taxErr;
  let allTaxInvoices = [];
  if (hasTaxInvoiceTable) {
    const { data } = await supabase.from('tax_invoices').select('*');
    allTaxInvoices = data || [];
  }

  // 에러 체크
  for (const [name, err] of [
    ['requests', e1], ['contracts', e2], ['contract_settlement_meta', e3],
    ['customers', e4], ['expenses', e5], ['quotations', e6],
    ['order_deliveries', e7], ['order_delivery_lines', e8]
  ]) {
    if (err) console.error(`[경고] ${name} 로드 실패:`, err.message);
  }

  return {
    requests: requests || [],
    contracts: contracts || [],
    metas: metas || [],
    customers: customers || [],
    expenses: expenses || [],
    quotations: quotations || [],
    orderDeliveries: orderDeliveries || [],
    orderDeliveryLines: orderDeliveryLines || [],
    taxInvoices: allTaxInvoices,
    hasTaxInvoiceTable,
  };
}

// ============================================
// 1. 고아 데이터(Orphan) 점검
// ============================================
function checkOrphans(data) {
  const results = [];

  const requestIds = new Set(data.requests.map(r => r.id));
  const contractIds = new Set(data.contracts.map(c => c.id));
  const customerIds = new Set(data.customers.map(c => c.id));

  // 1-1. contracts에서 request_id가 NULL이거나 해당 request가 없는 계약
  const orphanContracts = [];
  // request → contract_id 로 연결된 계약 ID 셋
  const linkedContractIds = new Set(
    data.requests.filter(r => r.contract_id).map(r => r.contract_id)
  );
  for (const c of data.contracts) {
    // 역으로: request에서 이 계약을 참조하는 건이 있는지 체크
    if (!linkedContractIds.has(c.id)) {
      orphanContracts.push({
        id: c.id,
        title: c.title || '(제목 없음)',
        amount: c.contract_amount || 0,
        reason: '어떤 의뢰에서도 참조하지 않는 계약',
      });
    }
  }
  results.push({
    name: '의뢰에 연결되지 않은 계약 (contracts)',
    items: orphanContracts,
    columns: ['id', 'title', 'amount', 'reason'],
  });

  // 1-2. contract_settlement_meta에서 해당 contract가 없는 레코드
  const orphanMetas = data.metas.filter(m => !contractIds.has(m.contract_id));
  results.push({
    name: 'contract가 없는 정산 메타 (contract_settlement_meta)',
    items: orphanMetas.map(m => ({
      id: m.id,
      contract_id: m.contract_id,
      reason: '해당 contract가 존재하지 않음',
    })),
    columns: ['id', 'contract_id', 'reason'],
  });

  // 1-3. expenses에서 해당 request_id/contract_id가 없는 지출
  const orphanExpenses = [];
  for (const e of data.expenses) {
    const issues = [];
    if (e.request_id && !requestIds.has(e.request_id)) {
      issues.push('request가 존재하지 않음');
    }
    if (e.contract_id && !contractIds.has(e.contract_id)) {
      issues.push('contract가 존재하지 않음');
    }
    if (!e.request_id && !e.contract_id) {
      issues.push('request_id, contract_id 모두 NULL');
    }
    if (issues.length > 0) {
      orphanExpenses.push({
        id: e.id,
        description: (e.description || '').substring(0, 30),
        amount: e.amount_incl_tax || e.cost_amount || 0,
        reason: issues.join(' / '),
      });
    }
  }
  results.push({
    name: '참조 대상이 없는 지출 (expenses)',
    items: orphanExpenses,
    columns: ['id', 'description', 'amount', 'reason'],
  });

  // 1-4. quotations에서 해당 request_id가 없는 견적서
  const orphanQuotations = data.quotations.filter(
    q => q.request_id && !requestIds.has(q.request_id)
  );
  results.push({
    name: 'request가 없는 견적서 (quotations)',
    items: orphanQuotations.map(q => ({
      id: q.id,
      quotation_number: q.quotation_number,
      request_id: q.request_id,
      reason: '해당 request가 존재하지 않음',
    })),
    columns: ['id', 'quotation_number', 'request_id', 'reason'],
  });

  // 1-5. tax_invoices에서 해당 contract가 없는 세금계산서
  if (data.hasTaxInvoiceTable) {
    const orphanTax = data.taxInvoices.filter(
      t => t.contract_id && !contractIds.has(t.contract_id)
    );
    results.push({
      name: 'contract가 없는 세금계산서 (tax_invoices)',
      items: orphanTax.map(t => ({
        id: t.id,
        contract_id: t.contract_id,
        reason: '해당 contract가 존재하지 않음',
      })),
      columns: ['id', 'contract_id', 'reason'],
    });
  } else {
    results.push({
      name: 'tax_invoices 테이블',
      items: [{ reason: '테이블이 존재하지 않음 (점검 생략)' }],
      columns: ['reason'],
    });
  }

  // 1-6. order_delivery_lines에서 해당 order_delivery가 없는 레코드
  const odIds = new Set(data.orderDeliveries.map(od => od.id));
  const orphanLines = data.orderDeliveryLines.filter(
    l => !odIds.has(l.order_delivery_id)
  );
  results.push({
    name: 'order_delivery가 없는 배송 라인 (order_delivery_lines)',
    items: orphanLines.map(l => ({
      id: l.id,
      order_delivery_id: l.order_delivery_id,
      model_name: l.model_name || '',
      reason: '해당 order_delivery가 존재하지 않음',
    })),
    columns: ['id', 'order_delivery_id', 'model_name', 'reason'],
  });

  return results;
}

// ============================================
// 2. Soft-delete 현황
// ============================================
function checkSoftDeletes(data) {
  const results = [];

  // 2-1. 각 테이블별 soft-deleted 수
  const tables = [
    { name: 'customers', data: data.customers },
    { name: 'contracts', data: data.contracts },
    { name: 'requests', data: data.requests },
    { name: 'expenses', data: data.expenses },
    { name: 'quotations', data: data.quotations },
  ];

  const softDeleteSummary = [];
  for (const t of tables) {
    const total = t.data.length;
    const deleted = t.data.filter(r => r.deleted_at).length;
    softDeleteSummary.push({
      table: t.name,
      total,
      active: total - deleted,
      deleted,
      ratio: total > 0 ? ((deleted / total) * 100).toFixed(1) + '%' : '0%',
    });
  }
  results.push({
    name: 'soft-delete 현황 (deleted_at IS NOT NULL)',
    items: softDeleteSummary,
    columns: ['table', 'total', 'active', 'deleted', 'ratio'],
  });

  // 2-2. soft-deleted인데 다른 테이블에서 참조되는 경우
  const deletedCustomerIds = new Set(
    data.customers.filter(c => c.deleted_at).map(c => c.id)
  );
  const deletedContractIds = new Set(
    data.contracts.filter(c => c.deleted_at).map(c => c.id)
  );
  const deletedRequestIds = new Set(
    data.requests.filter(r => r.deleted_at).map(r => r.id)
  );

  const crossRefIssues = [];

  // soft-deleted 고객이 활성 의뢰에서 참조됨
  for (const r of data.requests) {
    if (r.deleted_at) continue; // 의뢰도 삭제되면 상관없음
    if (r.customer_id && deletedCustomerIds.has(r.customer_id)) {
      crossRefIssues.push({
        source_table: 'requests',
        source_id: r.id,
        source_title: (r.title || '').substring(0, 30),
        ref_table: 'customers',
        ref_id: r.customer_id,
        issue: '삭제된 고객을 참조하는 활성 의뢰',
      });
    }
  }

  // soft-deleted 계약이 활성 의뢰에서 참조됨
  for (const r of data.requests) {
    if (r.deleted_at) continue;
    if (r.contract_id && deletedContractIds.has(r.contract_id)) {
      crossRefIssues.push({
        source_table: 'requests',
        source_id: r.id,
        source_title: (r.title || '').substring(0, 30),
        ref_table: 'contracts',
        ref_id: r.contract_id,
        issue: '삭제된 계약을 참조하는 활성 의뢰',
      });
    }
  }

  // soft-deleted 계약에 정산 메타가 존재
  for (const m of data.metas) {
    if (deletedContractIds.has(m.contract_id)) {
      crossRefIssues.push({
        source_table: 'contract_settlement_meta',
        source_id: m.id,
        source_title: '',
        ref_table: 'contracts',
        ref_id: m.contract_id,
        issue: '삭제된 계약의 정산 메타가 남아있음',
      });
    }
  }

  // soft-deleted 의뢰에 지출이 존재
  for (const e of data.expenses) {
    if (e.request_id && deletedRequestIds.has(e.request_id)) {
      crossRefIssues.push({
        source_table: 'expenses',
        source_id: e.id,
        source_title: (e.description || '').substring(0, 30),
        ref_table: 'requests',
        ref_id: e.request_id,
        issue: '삭제된 의뢰의 지출이 남아있음',
      });
    }
  }

  results.push({
    name: 'soft-deleted 레코드의 교차 참조 문제',
    items: crossRefIssues,
    columns: ['source_table', 'source_id', 'source_title', 'ref_table', 'ref_id', 'issue'],
  });

  return results;
}

// ============================================
// 3. 데이터 정합성
// ============================================
function checkDataIntegrity(data) {
  const results = [];

  const contractMap = new Map();
  data.contracts.forEach(c => contractMap.set(c.id, c));
  const metaMap = new Map();
  data.metas.forEach(m => metaMap.set(m.contract_id, m));
  const requestMap = new Map();
  data.requests.forEach(r => requestMap.set(r.id, r));

  // 3-1. settlement_type과 stage_ratios 키 불일치
  const settlementMismatch = [];
  for (const meta of data.metas) {
    const contract = contractMap.get(meta.contract_id);
    if (!contract) continue;

    let settlementTypes = [];
    if (contract.settlement_type) {
      try { settlementTypes = JSON.parse(contract.settlement_type); }
      catch { settlementTypes = contract.settlement_type.split(',').map(s => s.trim()); }
    }
    if (!Array.isArray(settlementTypes)) settlementTypes = [];

    const stageRatios = meta.stage_ratios || {};
    const ratioKeys = Object.keys(stageRatios).filter(k => k !== '_mode');
    const statusMap = meta.settlement_status_map || {};
    const statusKeys = Object.keys(statusMap);

    // 3-1a. stage_ratios의 키 vs settlement_type
    const expectedKeys = new Set();
    for (const s of settlementTypes) {
      if (s === '선금') expectedKeys.add('선금');
      else if (s === '중도금') expectedKeys.add('중도금');
      else if (s === '잔금') expectedKeys.add('잔금');
      else expectedKeys.add(s);
    }

    const extraRatioKeys = ratioKeys.filter(k => !expectedKeys.has(k));
    const missingRatioKeys = [...expectedKeys].filter(k => !ratioKeys.includes(k));

    if (extraRatioKeys.length > 0 || missingRatioKeys.length > 0) {
      settlementMismatch.push({
        contract_id: meta.contract_id,
        contract_title: (contract.title || '').substring(0, 25),
        settlement_type: settlementTypes.join(','),
        ratio_keys: ratioKeys.join(','),
        issue: [
          extraRatioKeys.length > 0 ? `초과 키: [${extraRatioKeys.join(',')}]` : '',
          missingRatioKeys.length > 0 ? `누락 키: [${missingRatioKeys.join(',')}]` : '',
        ].filter(Boolean).join(' / '),
      });
    }

    // 3-1b. settlement_status_map의 키 vs settlement_type (middle-N 포함 허용)
    const expandedExpected = new Set();
    const middleInstallments = meta.middle_installments || 1;
    for (const s of settlementTypes) {
      if (s === '선금') expandedExpected.add('선금');
      else if (s === '중도금') {
        for (let i = 1; i <= middleInstallments; i++) expandedExpected.add('middle-' + i);
      }
      else if (s === '잔금') expandedExpected.add('잔금');
      else expandedExpected.add(s);
    }

    const extraStatusKeys = statusKeys.filter(k => !expandedExpected.has(k));
    if (extraStatusKeys.length > 0) {
      settlementMismatch.push({
        contract_id: meta.contract_id,
        contract_title: (contract.title || '').substring(0, 25),
        settlement_type: settlementTypes.join(','),
        ratio_keys: statusKeys.join(','),
        issue: `status_map에 초과 키: [${extraStatusKeys.join(',')}]`,
      });
    }
  }
  results.push({
    name: 'settlement_type vs stage_ratios/status_map 키 불일치',
    items: settlementMismatch,
    columns: ['contract_id', 'contract_title', 'settlement_type', 'ratio_keys', 'issue'],
  });

  // 3-2. requests의 status가 유효하지 않은 값
  const invalidStatuses = data.requests.filter(
    r => !VALID_REQUEST_STATUSES.includes(r.status)
  );
  results.push({
    name: '유효하지 않은 의뢰 상태 (requests.status)',
    items: invalidStatuses.map(r => ({
      id: r.id,
      title: (r.title || '').substring(0, 30),
      status: r.status,
      expected: VALID_REQUEST_STATUSES.join(' | '),
    })),
    columns: ['id', 'title', 'status', 'expected'],
  });

  // 3-3. contract_amount가 0이거나 NULL인 계약
  const zeroAmountContracts = data.contracts.filter(
    c => !c.deleted_at && (!c.contract_amount || c.contract_amount === 0)
  );
  results.push({
    name: '계약 금액이 0 또는 NULL (contracts.contract_amount)',
    items: zeroAmountContracts.map(c => ({
      id: c.id,
      title: (c.title || '').substring(0, 30),
      contract_amount: c.contract_amount,
      created_at: (c.created_at || '').substring(0, 10),
    })),
    columns: ['id', 'title', 'contract_amount', 'created_at'],
  });

  // 3-4. 계약 성공 의뢰에 연결된 계약에서 start_date/end_date가 NULL
  const successRequests = data.requests.filter(
    r => r.status === '계약 성공' && r.contract_id && !r.deleted_at
  );
  const missingDates = [];
  for (const r of successRequests) {
    const contract = contractMap.get(r.contract_id);
    if (!contract || contract.deleted_at) continue;
    const issues = [];
    if (!contract.start_date) issues.push('start_date NULL');
    if (!contract.end_date) issues.push('end_date NULL');
    if (issues.length > 0) {
      missingDates.push({
        request_title: (r.title || '').substring(0, 25),
        contract_id: r.contract_id,
        contract_title: (contract.title || '').substring(0, 25),
        start_date: contract.start_date || 'NULL',
        end_date: contract.end_date || 'NULL',
        issue: issues.join(' / '),
      });
    }
  }
  results.push({
    name: '계약 성공 의뢰의 계약에 시작/종료일 누락',
    items: missingDates,
    columns: ['request_title', 'contract_title', 'start_date', 'end_date', 'issue'],
  });

  // 3-5. 비율 모드에서 합계가 100%가 아닌 정산 메타
  const ratioIssues = [];
  for (const meta of data.metas) {
    const stageRatios = meta.stage_ratios || {};
    const isAmountMode = stageRatios._mode === 'amount';
    if (isAmountMode) continue;

    let sum = 0;
    for (const [k, v] of Object.entries(stageRatios)) {
      if (k === '_mode') continue;
      sum += Number(v) || 0;
    }
    if (sum > 0 && Math.abs(sum - 100) > 0.5) {
      const contract = contractMap.get(meta.contract_id);
      ratioIssues.push({
        contract_id: meta.contract_id,
        contract_title: (contract?.title || '').substring(0, 25),
        ratio_sum: sum.toFixed(1) + '%',
        ratios: JSON.stringify(stageRatios),
      });
    }
  }
  results.push({
    name: '비율 모드에서 합계가 100%가 아닌 정산',
    items: ratioIssues,
    columns: ['contract_id', 'contract_title', 'ratio_sum', 'ratios'],
  });

  return results;
}

// ============================================
// 4. 미사용/불필요 데이터
// ============================================
function checkUnusedData(data) {
  const results = [];

  // 4-1. 어떤 의뢰에도 연결되지 않은 고객
  const usedCustomerIds = new Set();
  for (const r of data.requests) {
    if (r.customer_id) usedCustomerIds.add(r.customer_id);
  }
  // 계약에서도 참조하는지 추가 확인
  for (const c of data.contracts) {
    if (c.customer_id) usedCustomerIds.add(c.customer_id);
  }
  // 견적에서도 참조하는지 추가 확인
  for (const q of data.quotations) {
    if (q.customer_id) usedCustomerIds.add(q.customer_id);
  }

  const unusedCustomers = data.customers.filter(
    c => !c.deleted_at && !usedCustomerIds.has(c.id)
  );
  results.push({
    name: '어떤 의뢰/계약/견적에도 연결되지 않은 고객',
    items: unusedCustomers.map(c => ({
      id: c.id,
      company_name: c.company_name,
      contact_name: c.contact_name || '',
      phone: c.phone || '',
      created_at: (c.created_at || '').substring(0, 10),
    })),
    columns: ['id', 'company_name', 'contact_name', 'phone', 'created_at'],
  });

  // 4-2. 금액 0인 지출
  const zeroExpenses = data.expenses.filter(
    e => !e.deleted_at && (!e.amount_incl_tax || e.amount_incl_tax === 0)
      && (!e.cost_amount || e.cost_amount === 0)
  );
  results.push({
    name: '금액이 0인 지출 (expenses)',
    items: zeroExpenses.map(e => ({
      id: e.id,
      description: (e.description || '').substring(0, 30) || '(없음)',
      amount_incl_tax: e.amount_incl_tax || 0,
      cost_amount: e.cost_amount || 0,
      expense_date: (e.expense_date || '').substring(0, 10),
    })),
    columns: ['id', 'description', 'amount_incl_tax', 'cost_amount', 'expense_date'],
  });

  // 4-3. 제목이나 내용이 없는 의뢰
  const emptyRequests = data.requests.filter(
    r => !r.deleted_at && (!r.title || r.title.trim() === '')
  );
  results.push({
    name: '제목이 없는 의뢰 (requests)',
    items: emptyRequests.map(r => ({
      id: r.id,
      title: r.title || '(없음)',
      status: r.status,
      created_at: (r.created_at || '').substring(0, 10),
    })),
    columns: ['id', 'title', 'status', 'created_at'],
  });

  // 4-4. 제목이 없는 계약
  const emptyContracts = data.contracts.filter(
    c => !c.deleted_at && (!c.title || c.title.trim() === '')
  );
  results.push({
    name: '제목이 없는 계약 (contracts)',
    items: emptyContracts.map(c => ({
      id: c.id,
      title: c.title || '(없음)',
      contract_amount: c.contract_amount || 0,
      created_at: (c.created_at || '').substring(0, 10),
    })),
    columns: ['id', 'title', 'contract_amount', 'created_at'],
  });

  // 4-5. request_id가 NULL인 견적서
  const noReqQuotations = data.quotations.filter(
    q => !q.request_id
  );
  results.push({
    name: 'request_id가 NULL인 견적서',
    items: noReqQuotations.map(q => ({
      id: q.id,
      quotation_number: q.quotation_number,
      title: (q.title || '').substring(0, 30),
      created_at: (q.created_at || '').substring(0, 10),
    })),
    columns: ['id', 'quotation_number', 'title', 'created_at'],
  });

  return results;
}

// ============================================
// 테이블 출력 유틸
// ============================================
function printTable(items, columns) {
  if (!items || items.length === 0) {
    console.log('  (해당 없음 - 0건)\n');
    return;
  }

  // 각 컬럼의 최대 폭 계산
  const widths = {};
  for (const col of columns) {
    widths[col] = col.length;
  }
  for (const item of items) {
    for (const col of columns) {
      const val = String(item[col] ?? '');
      widths[col] = Math.max(widths[col], val.length);
    }
  }

  // 최대 폭 제한 (너무 넓으면 잘림)
  for (const col of columns) {
    widths[col] = Math.min(widths[col], 50);
  }

  // 헤더
  const header = columns.map(col => col.padEnd(widths[col])).join(' | ');
  const divider = columns.map(col => '─'.repeat(widths[col])).join('─┼─');
  console.log('  ' + header);
  console.log('  ' + divider);

  // 본문
  for (const item of items) {
    const row = columns.map(col => {
      let val = String(item[col] ?? '');
      if (val.length > 50) val = val.substring(0, 47) + '...';
      return val.padEnd(widths[col]);
    }).join(' | ');
    console.log('  ' + row);
  }
  console.log(`  (${items.length}건)\n`);
}

// ============================================
// 전체 요약 출력
// ============================================
function printSummary(allSections) {
  console.log('\n' + SEP);
  console.log('  종합 요약');
  console.log(SEP + '\n');

  const summaryItems = [];
  let totalIssues = 0;

  for (const section of allSections) {
    for (const result of section.results) {
      const count = result.items.length;
      const status = count === 0 ? 'OK' : `${count}건`;
      if (count > 0) totalIssues += count;
      summaryItems.push({
        category: section.title,
        check: result.name,
        result: status,
      });
    }
  }

  printTable(summaryItems, ['category', 'check', 'result']);

  console.log(THIN);
  if (totalIssues === 0) {
    console.log('  모든 점검 항목 통과! 데이터 정합성 양호합니다.');
  } else {
    console.log(`  총 ${totalIssues}건의 점검 대상 발견. 위 상세 내역을 확인하세요.`);
  }
  console.log(THIN + '\n');
}

// ============================================
// 메인 실행
// ============================================
async function main() {
  console.log(SEP);
  console.log('  Supabase DB 정합성 점검 보고서');
  console.log('  실행 시각: ' + new Date().toLocaleString('ko-KR'));
  console.log(SEP + '\n');

  const data = await loadAllData();

  // 전체 레코드 수 요약
  console.log(SEP);
  console.log('  테이블별 레코드 수');
  console.log(SEP + '\n');
  printTable([
    { table: 'requests', count: data.requests.length },
    { table: 'contracts', count: data.contracts.length },
    { table: 'contract_settlement_meta', count: data.metas.length },
    { table: 'customers', count: data.customers.length },
    { table: 'expenses', count: data.expenses.length },
    { table: 'quotations', count: data.quotations.length },
    { table: 'order_deliveries', count: data.orderDeliveries.length },
    { table: 'order_delivery_lines', count: data.orderDeliveryLines.length },
    { table: 'tax_invoices', count: data.hasTaxInvoiceTable ? data.taxInvoices.length : '(테이블 없음)' },
  ], ['table', 'count']);

  const allSections = [];

  // 1. 고아 데이터
  console.log(SEP);
  console.log('  1. 고아 데이터 (Orphan) 점검');
  console.log(SEP + '\n');
  const orphanResults = checkOrphans(data);
  for (const r of orphanResults) {
    console.log(`  [1] ${r.name}`);
    console.log('  ' + THIN);
    printTable(r.items, r.columns);
  }
  allSections.push({ title: '1. 고아 데이터', results: orphanResults });

  // 2. Soft-delete 현황
  console.log(SEP);
  console.log('  2. Soft-delete 현황');
  console.log(SEP + '\n');
  const softDeleteResults = checkSoftDeletes(data);
  for (const r of softDeleteResults) {
    console.log(`  [2] ${r.name}`);
    console.log('  ' + THIN);
    printTable(r.items, r.columns);
  }
  allSections.push({ title: '2. Soft-delete', results: softDeleteResults });

  // 3. 데이터 정합성
  console.log(SEP);
  console.log('  3. 데이터 정합성');
  console.log(SEP + '\n');
  const integrityResults = checkDataIntegrity(data);
  for (const r of integrityResults) {
    console.log(`  [3] ${r.name}`);
    console.log('  ' + THIN);
    printTable(r.items, r.columns);
  }
  allSections.push({ title: '3. 데이터 정합성', results: integrityResults });

  // 4. 미사용/불필요 데이터
  console.log(SEP);
  console.log('  4. 미사용/불필요 데이터');
  console.log(SEP + '\n');
  const unusedResults = checkUnusedData(data);
  for (const r of unusedResults) {
    console.log(`  [4] ${r.name}`);
    console.log('  ' + THIN);
    printTable(r.items, r.columns);
  }
  allSections.push({ title: '4. 미사용/불필요', results: unusedResults });

  // 종합 요약
  printSummary(allSections);
}

main().catch(err => {
  console.error('스크립트 실행 오류:', err);
  process.exit(1);
});
