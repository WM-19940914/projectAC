import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const fmt = n => Number(n).toLocaleString('ko-KR');
const parseNum = s => {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  return Number(String(s).replace(/,/g, '')) || 0;
};

// 제목 정규화 (비교용)
function normalize(title) {
  return (title || '')
    .replace(/\s+/g, '')
    .replace(/계약$/, '')
    .replace(/\(주\)/g, '')
    .replace(/주\)/g, '')
    .toLowerCase();
}

async function main() {
  // ====== 엑셀 읽기 ======
  const wb1 = XLSX.readFile('c:/Users/User/Downloads/pluuug_data_Melea_김우민_정산_260317.xlsx');
  const excelSettlements = XLSX.utils.sheet_to_json(wb1.Sheets['정산']);

  const wb2 = XLSX.readFile('c:/Users/User/Downloads/pluuug_data_Melea_김우민_계약_260317.xlsx');
  const excelContracts = XLSX.utils.sheet_to_json(wb2.Sheets['계약']);

  // 엑셀 정산을 계약별로 그룹핑
  const excelSettByContract = {};
  for (const row of excelSettlements) {
    const title = row['계약 제목'] || '';
    if (!excelSettByContract[title]) excelSettByContract[title] = [];
    excelSettByContract[title].push(row);
  }

  // ====== DB 읽기 ======
  const { data: requests } = await supabase
    .from('requests')
    .select('id, title, status, contract_id, customer:customers(company_name)')
    .eq('status', '계약 성공');

  const contractIds = requests.filter(r => r.contract_id).map(r => r.contract_id);
  const { data: contracts } = await supabase.from('contracts').select('*').in('id', contractIds);
  const { data: metas } = await supabase.from('contract_settlement_meta').select('*').in('contract_id', contractIds);

  const contractMap = new Map();
  contracts?.forEach(c => contractMap.set(c.id, c));
  const metaMap = new Map();
  metas?.forEach(m => metaMap.set(m.contract_id, m));

  // DB 계약을 title로 인덱싱
  const dbByTitle = {};
  for (const req of requests) {
    const contract = req.contract_id ? contractMap.get(req.contract_id) : null;
    const meta = req.contract_id ? metaMap.get(req.contract_id) : null;
    dbByTitle[normalize(req.title)] = { req, contract, meta };
  }

  // ====== 매칭 ======
  console.log('══════════════════════════════════════════════════════════');
  console.log('  엑셀 ↔ 웹앱 데이터 매칭 비교');
  console.log('══════════════════════════════════════════════════════════\n');

  const matched = [];
  const unmatched = [];
  const issues = [];

  for (const ec of excelContracts) {
    const exTitle = ec['계약 제목'] || '';
    const normTitle = normalize(exTitle);
    const db = dbByTitle[normTitle];

    if (!db) {
      // 부분 매칭 시도
      let found = null;
      for (const [key, val] of Object.entries(dbByTitle)) {
        if (key.includes(normTitle.slice(0, 10)) || normTitle.includes(key.slice(0, 10))) {
          found = { key, val };
          break;
        }
      }
      if (found) {
        matched.push({ exTitle, db: found.val, ec, partial: true });
      } else {
        unmatched.push(exTitle);
      }
    } else {
      matched.push({ exTitle, db, ec, partial: false });
    }
  }

  // ====== 매칭 결과 상세 비교 ======
  let issueCount = 0;

  for (const m of matched) {
    const { exTitle, db, ec, partial } = m;
    const contract = db.contract;
    const meta = db.meta;
    const req = db.req;

    if (!contract) continue;

    const exAmount = parseNum(ec['계약 금액']);
    const dbAmount = contract.contract_amount || contract.amount || 0;

    // 정산 형태 비교
    let dbSettTypes = [];
    if (contract.settlement_type) {
      try { dbSettTypes = JSON.parse(contract.settlement_type); } catch { dbSettTypes = contract.settlement_type.split(',').map(s => s.trim()); }
    }

    const exSettType = ec['정산 형태'] || '';

    // 엑셀 정산 항목
    const exSettItems = excelSettByContract[exTitle] || [];

    // DB 정산 상태
    let statusMap = meta?.settlement_status_map || {};
    if (typeof statusMap === 'string') statusMap = JSON.parse(statusMap);

    let stageRatios = meta?.stage_ratios || {};
    if (typeof stageRatios === 'string') stageRatios = JSON.parse(stageRatios);

    let scheduledDates = meta?.stage_scheduled_dates || {};
    if (typeof scheduledDates === 'string') scheduledDates = JSON.parse(scheduledDates);

    const itemIssues = [];

    // 1. 계약금액 비교
    if (exAmount !== dbAmount) {
      itemIssues.push(`계약금액 불일치: 엑셀 ₩${fmt(exAmount)} vs DB ₩${fmt(dbAmount)}`);
    }

    // 2. 정산 항목별 비교 — 엑셀 금액 vs DB 입금액
    let exTotalSettled = 0;
    let dbTotalPaid = 0;

    for (const [key, val] of Object.entries(statusMap)) {
      let paid = 0;
      if (val?.payment_entries && Array.isArray(val.payment_entries)) {
        paid = val.payment_entries.filter(e => e.confirmed).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      } else if (val?.actual_amount) {
        paid = Number(val.actual_amount) || 0;
      }
      dbTotalPaid += paid;
    }

    for (const si of exSettItems) {
      const settAmount = parseNum(si['세금 포함 금액']);
      exTotalSettled += settAmount;
    }

    if (Math.abs(exTotalSettled - dbTotalPaid) > 100) {
      itemIssues.push(`정산 총액 불일치: 엑셀(세금포함) ₩${fmt(exTotalSettled)} vs DB입금 ₩${fmt(dbTotalPaid)} (차이: ₩${fmt(Math.abs(exTotalSettled - dbTotalPaid))})`);
    }

    // 3. 정산 예정일 비교
    for (const si of exSettItems) {
      const exDate = si['정산 예정일'] || '';
      const exType = si['정산 형태'] || '';

      // 엑셀 정산 형태 → DB 키 매핑
      let dbKey = null;
      if (exType === '선급금') dbKey = '선금';
      else if (exType === '잔금') dbKey = '잔금';
      else if (exType === '1차 중도금') dbKey = 'middle-1';
      else if (exType === '추가 정산') dbKey = null; // 추가정산은 별도

      if (dbKey && scheduledDates[dbKey] && exDate) {
        if (scheduledDates[dbKey] !== exDate) {
          itemIssues.push(`[${exType}] 예정일 불일치: 엑셀 ${exDate} vs DB ${scheduledDates[dbKey]}`);
        }
      }
    }

    // 4. 세금계산서 발행 상태 비교
    for (const si of exSettItems) {
      const exTaxIssued = si['세금 계산서 발행'];
      const exType = si['정산 형태'] || '';
      let dbKey = null;
      if (exType === '선급금') dbKey = '선금';
      else if (exType === '잔금') dbKey = '잔금';
      else if (exType === '1차 중도금') dbKey = 'middle-1';

      if (dbKey && statusMap[dbKey]) {
        const dbTax = statusMap[dbKey].tax_invoice_issued;
        if (exTaxIssued === true && !dbTax) {
          itemIssues.push(`[${exType}] 세금계산서: 엑셀은 발행완료인데 DB는 미발행`);
        }
      }
    }

    // 5. 정산 확인일 비교 (엑셀의 확인일 = DB의 payment_entries.paid_at)
    for (const si of exSettItems) {
      const exConfirmDate = si['정산 확인일'] || '';
      const exType = si['정산 형태'] || '';
      let dbKey = null;
      if (exType === '선급금') dbKey = '선금';
      else if (exType === '잔금') dbKey = '잔금';
      else if (exType === '1차 중도금') dbKey = 'middle-1';

      if (dbKey && statusMap[dbKey] && exConfirmDate) {
        const dbEntries = statusMap[dbKey].payment_entries || [];
        const dbDate = statusMap[dbKey].received_date || (dbEntries[0]?.paid_at) || '';
        // 날짜만 대략 비교
      }
    }

    if (itemIssues.length > 0) {
      issueCount++;
      issues.push({ title: exTitle, reqTitle: req.title, customer: req.customer?.company_name, partial, issues: itemIssues });
    }
  }

  // ====== 출력 ======
  console.log('--- 매칭 안 된 엑셀 계약 ---');
  if (unmatched.length === 0) {
    console.log('  없음\n');
  } else {
    unmatched.forEach((t, i) => console.log(`  ${i+1}. ${t}`));
    console.log('');
  }

  console.log(`--- 데이터 불일치 (${issues.length}건) ---\n`);
  for (let i = 0; i < issues.length; i++) {
    const item = issues[i];
    console.log(`${i+1}. ${item.title}${item.partial ? ' (부분매칭→' + item.reqTitle + ')' : ''}`);
    console.log(`   고객: ${item.customer || '(없음)'}`);
    for (const iss of item.issues) {
      console.log(`   ⚠ ${iss}`);
    }
    console.log('');
  }

  console.log('─────────────────────────────────────────────────────');
  console.log(`엑셀 계약: ${excelContracts.length}건 / 매칭: ${matched.length}건 / 미매칭: ${unmatched.length}건 / 불일치: ${issues.length}건`);
}

main().catch(console.error);
