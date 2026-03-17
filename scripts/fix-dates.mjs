import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const norm = s => (s || '').replace(/\s+/g, '').replace(/계약$/, '').toLowerCase();

const fixes = [
  { exTitle: '성균관대학교 계약', dbKey: 'middle-1', scheduledDate: '2025-09-19', paidAt: '2025-09-22' },
  { exTitle: '마레보인 웨이브 냉난방 설치공사 계약', dbKey: 'middle-1', scheduledDate: '2025-07-02', paidAt: '2025-06-11' },
  { exTitle: '애플산부인과 시스템에어컨 납품건 계약', dbKey: 'middle-1', scheduledDate: '2024-09-14', paidAt: '2024-09-14' },
  { exTitle: '24년 교원그룹 10월 계약', dbKey: '잔금', scheduledDate: '2025-01-20', paidAt: null },
  { exTitle: '강화도 전원주택 2채 시스템에어컨 납품건 계약', dbKey: '잔금', scheduledDate: '2024-12-16', paidAt: null },
  { exTitle: '천지수왕사 A.B동 냉난방기 납품건 계약', dbKey: 'middle-1', scheduledDate: '2024-12-31', paidAt: '2024-12-31' },
  { exTitle: '주안동 다세대주택 DVM HOME 납품건 계약', dbKey: 'middle-1', scheduledDate: '2023-12-08', paidAt: '2023-12-15' },
  { exTitle: '가든파이브툴 fcu 교체 시스템에어컨 납품', dbKey: '선금', scheduledDate: '2024-05-23', paidAt: '2024-05-23' },
  { exTitle: '메이필드호텔 매립덕트 교체공사 계약', dbKey: 'middle-1', scheduledDate: '2025-04-14', paidAt: '2025-05-30' },
  { exTitle: '용인 수지정약국 냉난방기 설치 1등급', dbKey: '잔금', scheduledDate: null, paidAt: '2026-02-19' },
];

async function main() {
  const { data: reqs } = await supabase.from('requests').select('id, title, contract_id').eq('status', '계약 성공').not('contract_id', 'is', null);
  const contractIds = reqs.map(r => r.contract_id);
  const { data: metas } = await supabase.from('contract_settlement_meta').select('*').in('contract_id', contractIds);

  const metaMap = new Map();
  metas?.forEach(m => metaMap.set(m.contract_id, m));

  const reqByTitle = new Map();
  reqs.forEach(r => reqByTitle.set(norm(r.title), r));

  let success = 0;
  for (const fix of fixes) {
    const exNorm = norm(fix.exTitle);
    let req = reqByTitle.get(exNorm);
    if (!req) {
      for (const [key, val] of reqByTitle.entries()) {
        if (key.includes(exNorm.slice(0, 8)) || exNorm.includes(key.slice(0, 8))) {
          req = val; break;
        }
      }
    }
    if (!req) { console.log('✗ 매칭 실패:', fix.exTitle); continue; }

    const meta = metaMap.get(req.contract_id);
    if (!meta) { console.log('✗ 메타 없음:', fix.exTitle); continue; }

    // deep copy
    const statusMap = JSON.parse(JSON.stringify(meta.settlement_status_map || {}));
    const scheduledDates = JSON.parse(JSON.stringify(meta.stage_scheduled_dates || {}));
    let changed = false;

    // 입금예정일 수정
    if (fix.scheduledDate) {
      scheduledDates[fix.dbKey] = fix.scheduledDate;
      changed = true;
    }

    // 입금일(paid_at, received_date) 수정
    if (fix.paidAt && statusMap[fix.dbKey]) {
      statusMap[fix.dbKey].received_date = fix.paidAt;
      if (statusMap[fix.dbKey].payment_entries && statusMap[fix.dbKey].payment_entries.length > 0) {
        statusMap[fix.dbKey].payment_entries = statusMap[fix.dbKey].payment_entries.map(e => ({
          ...e,
          paid_at: fix.paidAt,
        }));
      }
      changed = true;
    }

    if (changed) {
      const { error } = await supabase.from('contract_settlement_meta')
        .update({ settlement_status_map: statusMap, stage_scheduled_dates: scheduledDates })
        .eq('contract_id', req.contract_id);

      if (error) {
        console.log('✗ 업데이트 실패:', fix.exTitle, error.message);
      } else {
        console.log('✓', fix.exTitle, '[' + fix.dbKey + '] 예정일:' + (fix.scheduledDate || '유지') + ' 입금일:' + (fix.paidAt || '유지'));
        success++;
      }
    }
  }

  console.log('\n완료:', success + '/' + fixes.length + '건');
}

main().catch(console.error);
