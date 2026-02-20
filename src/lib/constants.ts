// ============================================
// M 프로젝트 - 상수 정의
// ============================================

// ----- 의뢰 상태 설정 -----
export const REQUEST_STATUSES = [
  { value: '견적 문의', label: '견적 문의', color: 'bg-sky-aqua/10 text-sky-aqua', columnColor: 'border-t-sky-aqua' },
  { value: '영업중', label: '영업중', color: 'bg-tropical-teal/10 text-tropical-teal', columnColor: 'border-t-tropical-teal' },
  { value: '계약 성공', label: '계약 성공', color: 'bg-muted-teal/10 text-muted-teal', columnColor: 'border-t-muted-teal' },
  { value: '수주 실패', label: '수주 실패', color: 'bg-soft-blush/30 text-soft-blush', columnColor: 'border-t-soft-blush' },
  { value: '숨김', label: '숨김', color: 'bg-gray-50 text-gray-500', columnColor: 'border-t-gray-300' },
] as const;

// ----- 계약 상태 -----
export const CONTRACT_STATUSES = [
  { value: '계약 준비 중', label: '계약 준비 중', color: 'bg-sky-aqua/10 text-sky-aqua', columnColor: 'border-t-sky-aqua' },
  { value: '계약 진행 중', label: '계약 진행 중', color: 'bg-tropical-teal/10 text-tropical-teal', columnColor: 'border-t-tropical-teal' },
  { value: '계약 종료', label: '계약 종료', color: 'bg-muted-teal/10 text-muted-teal', columnColor: 'border-t-muted-teal' },
  { value: '계약 중단', label: '계약 중단', color: 'bg-soft-blush/30 text-soft-blush', columnColor: 'border-t-soft-blush' },
  { value: '숨김', label: '숨김', color: 'bg-gray-50 text-gray-500', columnColor: 'border-t-gray-300' },
] as const;

// ----- 정산 상태 -----
export const SETTLEMENT_STATUSES = [
  { value: '정산 예정', label: '정산 예정', color: 'bg-sky-aqua/10 text-sky-aqua', columnColor: 'border-t-sky-aqua' },
  { value: '정산 지연', label: '정산 지연', color: 'bg-vanilla-custard/30 text-vanilla-custard', columnColor: 'border-t-vanilla-custard' },
  { value: '정산 완료', label: '정산 완료', color: 'bg-muted-teal/10 text-muted-teal', columnColor: 'border-t-muted-teal' },
  { value: '정산 중단', label: '정산 중단', color: 'bg-soft-blush/30 text-soft-blush', columnColor: 'border-t-soft-blush' },
  { value: '숨김', label: '숨김', color: 'bg-gray-50 text-gray-500', columnColor: 'border-t-gray-300' },
] as const;

// ----- 정산 형태 -----
export const SETTLEMENT_TYPES = ['잔금', '선급금', '중도금', '추가 정산'] as const;

// ----- 계정 과목 -----
export const ACCOUNT_CATEGORIES = ['삼성전자 제품', '설치공사비', '사매입 제품', '기타'] as const;

// ----- 결제수단 -----
export const PAYMENT_METHODS = ['계좌 이체', '카드 결제', '기타'] as const;

// ----- 세율 옵션 -----
export const TAX_RATES = ['10%', '0%', '면세'] as const;

// ----- 세금계산서 수령 여부 -----
export const TAX_INVOICE_RECEIVED_OPTIONS = ['수령', '미수령', '해당없음'] as const;

// ----- 통화 옵션 -----
export const CURRENCY_OPTIONS = ['KRW', 'USD', 'EUR', 'JPY', 'CNY'] as const;

// ----- 고객 유형 -----
export const CUSTOMER_TYPES = ['법인', '개인', '관공서', '기타'] as const;

// ----- 계약 카테고리 -----
export const CONTRACT_CATEGORIES = ['설치공사', '유지보수', '제품판매', '용역', '기타'] as const;

// ----- 사이드바 메뉴 구조 -----
export const SIDEBAR_MENU = [
  {
    title: '대시보드',
    href: '/dashboard',
    icon: 'LayoutDashboard',
  },
  {
    title: '의뢰',
    href: '/requests',
    icon: 'CheckSquare',
  },
  {
    title: '고객',
    href: '/clients',
    icon: 'Users',
  },
  {
    title: '견적서',
    href: '/quotes',
    icon: 'FileText',
  },
  {
    title: '계약',
    href: '/contracts',
    icon: 'FileSignature',
  },
  {
    title: '정산',
    href: '/settlements',
    icon: 'DollarSign',
  },
  {
    title: '지출',
    href: '/expenses',
    icon: 'CreditCard',
  },
] as const;

// ----- 페이지네이션 기본값 -----
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
