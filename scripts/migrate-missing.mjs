import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const parseNum = s => {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  return Number(String(s).replace(/,/g, '')) || 0;
};

// 고객 ID 매핑
const CUSTOMER_IDS = {
  '교원그룹': '5299326d-e0af-466d-ac56-31dec99fc79d',
  '에스이시스템': '0b79cca5-772d-4aaf-8dd6-10f539ce1841',
};

// 생성할 항목 데이터 (엑셀에서 추출)
const items = [
  // === 24년 교원그룹 월별 ===
  {
    title: '24년 교원그룹 1월',
    customer_id: CUSTOMER_IDS['교원그룹'],
    contract_amount: 58019000,
    settlement_type: '잔금',
    start_date: '2024-01-01',
    end_date: '2024-01-31',
    settlement: {
      key: '잔금',
      amount: 63820900, // 세금포함
      supply: 58019000,
      scheduled_date: '2024-04-20',
      confirmed_date: '2024-04-20',
      tax_invoice: false,
      tax_invoice_date: '',
    }
  },
  {
    title: '24년 교원그룹 2월',
    customer_id: CUSTOMER_IDS['교원그룹'],
    contract_amount: 24898000,
    settlement_type: '잔금',
    start_date: '2024-02-01',
    end_date: '2024-02-29',
    settlement: {
      key: '잔금',
      amount: 27387800,
      supply: 24898000,
      scheduled_date: '2024-05-20',
      confirmed_date: '2024-05-20',
      tax_invoice: false,
      tax_invoice_date: '',
    }
  },
  {
    title: '24년 교원그룹 3월',
    customer_id: CUSTOMER_IDS['교원그룹'],
    contract_amount: 14278036,
    settlement_type: '잔금',
    start_date: '2024-03-01',
    end_date: '2024-03-31',
    settlement: {
      key: '잔금',
      amount: 15705839,
      supply: 14278036,
      scheduled_date: '2024-06-20',
      confirmed_date: '2024-06-20',
      tax_invoice: false,
      tax_invoice_date: '',
    }
  },
  {
    title: '24년 교원그룹 4월',
    customer_id: CUSTOMER_IDS['교원그룹'],
    contract_amount: 61571000,
    settlement_type: '잔금',
    start_date: '2024-04-01',
    end_date: '2024-04-30',
    settlement: {
      key: '잔금',
      amount: 67728100,
      supply: 61571000,
      scheduled_date: '2024-07-20',
      confirmed_date: '2024-07-20',
      tax_invoice: false,
      tax_invoice_date: '',
    }
  },
  {
    title: '24년 교원그룹 5월',
    customer_id: CUSTOMER_IDS['교원그룹'],
    contract_amount: 16026000,
    settlement_type: '잔금',
    start_date: '2024-05-01',
    end_date: '2024-05-31',
    settlement: {
      key: '잔금',
      amount: 17628600,
      supply: 16026000,
      scheduled_date: '2024-08-21',
      confirmed_date: '2024-08-21',
      tax_invoice: false,
      tax_invoice_date: '',
    }
  },
  {
    title: '24년 교원그룹 6월',
    customer_id: CUSTOMER_IDS['교원그룹'],
    contract_amount: 35259000,
    settlement_type: '잔금',
    start_date: '2024-06-01',
    end_date: '2024-06-30',
    settlement: {
      key: '잔금',
      amount: 38784900,
      supply: 35259000,
      scheduled_date: '2024-09-20',
      confirmed_date: '2024-09-20',
      tax_invoice: false,
      tax_invoice_date: '',
    }
  },
  {
    title: '24년 교원그룹 7월',
    customer_id: CUSTOMER_IDS['교원그룹'],
    contract_amount: 27624000,
    settlement_type: '잔금',
    start_date: '2024-07-01',
    end_date: '2024-07-31',
    settlement: {
      key: '잔금',
      amount: 30386400,
      supply: 27624000,
      scheduled_date: '2024-10-21',
      confirmed_date: '2024-10-21',
      tax_invoice: false,
      tax_invoice_date: '',
    }
  },
  {
    title: '24년 교원그룹 8월',
    customer_id: CUSTOMER_IDS['교원그룹'],
    contract_amount: 68515400,
    settlement_type: '잔금',
    start_date: '2024-08-01',
    end_date: '2024-08-31',
    settlement: {
      key: '잔금',
      amount: 75366940,
      supply: 68515400,
      scheduled_date: '2024-08-31',
      confirmed_date: '2024-11-20',
      tax_invoice: false,
      tax_invoice_date: '',
    }
  },
  {
    title: '24년 교원그룹 9월',
    customer_id: CUSTOMER_IDS['교원그룹'],
    contract_amount: 47299900,
    settlement_type: '잔금',
    start_date: '2024-09-01',
    end_date: '2024-09-30',
    settlement: {
      key: '잔금',
      amount: 52029890,
      supply: 47299900,
      scheduled_date: '2024-12-20',
      confirmed_date: '2024-12-20',
      tax_invoice: false,
      tax_invoice_date: '',
    }
  },
  {
    title: '24년 교원그룹 10월',
    customer_id: CUSTOMER_IDS['교원그룹'],
    contract_amount: 18687000,
    settlement_type: '잔금',
    start_date: '2024-10-01',
    end_date: '2024-10-31',
    settlement: {
      key: '잔금',
      amount: 20555700,
      supply: 18687000,
      scheduled_date: '2025-01-20',
      confirmed_date: '2025-01-20',
      tax_invoice: false,
      tax_invoice_date: '',
    }
  },
  {
    title: '24년 교원그룹 11월',
    customer_id: CUSTOMER_IDS['교원그룹'],
    contract_amount: 40805000,
    settlement_type: '잔금',
    start_date: '2024-11-01',
    end_date: '2024-11-30',
    settlement: {
      key: '잔금',
      amount: 44885500,
      supply: 40805000,
      scheduled_date: '2025-02-20',
      confirmed_date: '2025-02-20',
      tax_invoice: false,
      tax_invoice_date: '',
    }
  },
  {
    title: '24년 교원그룹 12월',
    customer_id: CUSTOMER_IDS['교원그룹'],
    contract_amount: 64519700,
    settlement_type: '잔금',
    start_date: '2024-12-01',
    end_date: '2024-12-31',
    settlement: {
      key: '잔금',
      amount: 70971670,
      supply: 64519700,
      scheduled_date: '2025-03-21',
      confirmed_date: '2025-03-21',
      tax_invoice: false,
      tax_invoice_date: '',
    }
  },
  // === 25년 교원그룹 월별 ===
  {
    title: '25년 교원그룹 1월',
    customer_id: CUSTOMER_IDS['교원그룹'],
    contract_amount: 13502000,
    settlement_type: '잔금',
    start_date: '2025-01-25',
    end_date: '2025-04-20',
    settlement: {
      key: '잔금',
      amount: 14852200,
      supply: 13502000,
      scheduled_date: '2025-04-20',
      confirmed_date: '2025-04-21',
      tax_invoice: true,
      tax_invoice_date: '2025-01-25',
    }
  },
  {
    title: '25년 교원그룹 2월',
    customer_id: CUSTOMER_IDS['교원그룹'],
    contract_amount: 14165000,
    settlement_type: '잔금',
    start_date: '2025-02-20',
    end_date: '2025-05-20',
    settlement: {
      key: '잔금',
      amount: 15581500,
      supply: 14165000,
      scheduled_date: '2025-05-20',
      confirmed_date: '2025-05-20',
      tax_invoice: true,
      tax_invoice_date: '2025-02-25',
    }
  },
  {
    title: '25년 교원그룹 3월',
    customer_id: CUSTOMER_IDS['교원그룹'],
    contract_amount: 30579000,
    settlement_type: '잔금',
    start_date: '2025-03-24',
    end_date: '2025-06-20',
    settlement: {
      key: '잔금',
      amount: 33636900,
      supply: 30579000,
      scheduled_date: '2025-06-20',
      confirmed_date: '2025-06-20',
      tax_invoice: true,
      tax_invoice_date: '2025-03-25',
    }
  },
  {
    title: '25년 교원그룹 4월',
    customer_id: CUSTOMER_IDS['교원그룹'],
    contract_amount: 34239800,
    settlement_type: '잔금',
    start_date: '2025-04-28',
    end_date: '2025-07-21',
    settlement: {
      key: '잔금',
      amount: 37663780,
      supply: 34239800,
      scheduled_date: '2025-07-20',
      confirmed_date: '2025-07-20',
      tax_invoice: true,
      tax_invoice_date: '2025-04-25',
    }
  },
  {
    title: '25년 교원그룹 5월',
    customer_id: CUSTOMER_IDS['교원그룹'],
    contract_amount: 67349000,
    settlement_type: '잔금',
    start_date: '2025-05-28',
    end_date: '2025-08-20',
    settlement: {
      key: '잔금',
      amount: 74083900,
      supply: 67349000,
      scheduled_date: '2025-08-20',
      confirmed_date: '2025-08-20',
      tax_invoice: false,
      tax_invoice_date: '',
    }
  },
  {
    title: '25년 교원그룹 6월',
    customer_id: CUSTOMER_IDS['교원그룹'],
    contract_amount: 56681200,
    settlement_type: '잔금',
    start_date: '2025-06-27',
    end_date: '2025-09-20',
    settlement: {
      key: '잔금',
      amount: 62349320,
      supply: 56681200,
      scheduled_date: '2025-09-20',
      confirmed_date: '2025-09-22',
      tax_invoice: true,
      tax_invoice_date: '2025-09-22',
    }
  },
  {
    title: '25년 교원그룹 7월',
    customer_id: CUSTOMER_IDS['교원그룹'],
    contract_amount: 69182800,
    settlement_type: '잔금',
    start_date: '2025-07-25',
    end_date: '2025-10-20',
    settlement: {
      key: '잔금',
      amount: 76101080,
      supply: 69182800,
      scheduled_date: '2025-10-20',
      confirmed_date: '2025-10-20',
      tax_invoice: false,
      tax_invoice_date: '',
    }
  },
  // === 에스이시스템 ===
  {
    title: '에스이시스템 6평형 냉방전용 납품건',
    customer_id: CUSTOMER_IDS['에스이시스템'],
    contract_amount: 373000,
    settlement_type: '잔금',
    start_date: '2025-07-06',
    end_date: '2025-07-07',
    settlement: {
      key: '잔금',
      amount: 373000, // 세금포함 = 계약금액 (소액이라 VAT 포함 금액이 계약금액과 동일한 듯)
      supply: 339091,
      scheduled_date: '2025-07-07',
      confirmed_date: '2025-07-08',
      tax_invoice: true,
      tax_invoice_date: '2025-07-08',
    }
  },
  {
    title: '에스이시스템 9평형 벽걸이 냉방전용 납품',
    customer_id: CUSTOMER_IDS['에스이시스템'],
    contract_amount: 749000,
    settlement_type: '잔금',
    start_date: '2025-06-27',
    end_date: '2025-06-30',
    settlement: {
      key: '잔금',
      amount: 749000,
      supply: 680910,
      scheduled_date: '2025-06-30',
      confirmed_date: '2025-07-01',
      tax_invoice: true,
      tax_invoice_date: '2025-06-30',
    }
  },
];

async function createItem(item) {
  const totalWithVat = item.contract_amount + Math.floor(item.contract_amount * 0.1);

  // 1. 계약(contract) 생성
  const { data: contract, error: cErr } = await supabase
    .from('contracts')
    .insert({
      title: item.title,
      customer_id: item.customer_id,
      contract_amount: item.contract_amount,
      settlement_type: item.settlement_type,
      start_date: item.start_date,
      end_date: item.end_date,
    })
    .select()
    .single();

  if (cErr) {
    console.error(`  ✗ 계약 생성 실패: ${item.title}`, cErr.message);
    return null;
  }

  // 2. 의뢰(request) 생성 — status: 계약 성공
  const { data: request, error: rErr } = await supabase
    .from('requests')
    .insert({
      title: item.title,
      customer_id: item.customer_id,
      contract_id: contract.id,
      status: '계약 성공',
      inquiry_date: item.start_date,
      hidden: false,
    })
    .select()
    .single();

  if (rErr) {
    console.error(`  ✗ 의뢰 생성 실패: ${item.title}`, rErr.message);
    return null;
  }

  // 계약에 request_id 연결
  await supabase.from('contracts').update({ request_id: request.id }).eq('id', contract.id);

  // 3. settlement_meta 생성
  const s = item.settlement;
  const settlementStatusMap = {
    [s.key]: {
      payment_confirmed: true,
      actual_amount: s.amount,
      received_date: s.confirmed_date,
      tax_invoice_issued: s.tax_invoice,
      tax_invoice_date: s.tax_invoice_date || '',
      payment_entries: [
        {
          id: 'entry-1',
          amount: s.amount,
          paid_at: s.confirmed_date,
          note: '',
          confirmed: true,
        }
      ],
      has_upcoming: false,
    }
  };

  const stageRatios = {
    _mode: 'amount',
    선금: 0,
    중도금: 0,
    잔금: 0,
    [s.key]: s.amount,
  };

  const stageScheduledDates = {
    [s.key]: s.scheduled_date,
  };

  const { error: mErr } = await supabase
    .from('contract_settlement_meta')
    .insert({
      contract_id: contract.id,
      settlement_status_map: settlementStatusMap,
      stage_ratios: stageRatios,
      middle_installments: 1,
      stage_scheduled_dates: stageScheduledDates,
    });

  if (mErr) {
    console.error(`  ✗ 메타 생성 실패: ${item.title}`, mErr.message);
    return null;
  }

  return { request, contract };
}

async function main() {
  console.log(`총 ${items.length}건 생성 시작...\n`);

  let success = 0;
  let fail = 0;

  for (const item of items) {
    const result = await createItem(item);
    if (result) {
      console.log(`  ✓ ${item.title} — 의뢰:${result.request.id.slice(0,8)} 계약:${result.contract.id.slice(0,8)}`);
      success++;
    } else {
      fail++;
    }
  }

  console.log(`\n완료: 성공 ${success}건 / 실패 ${fail}건`);
}

main().catch(console.error);
