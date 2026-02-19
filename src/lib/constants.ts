// ============================================
// SAC 프로젝트 - 상수 정의
// ============================================

// ----- 의뢰 상태 설정 -----
export const REQUEST_STATUSES = [
  { value: '견적 문의', label: '견적 문의', color: 'bg-blue-50 text-blue-700', columnColor: 'border-t-blue-400' },
  { value: '영업중', label: '영업중', color: 'bg-orange-50 text-orange-700', columnColor: 'border-t-orange-400' },
  { value: '계약 성공', label: '계약 성공', color: 'bg-green-50 text-green-700', columnColor: 'border-t-green-400' },
  { value: '수주 실패', label: '수주 실패', color: 'bg-red-50 text-red-700', columnColor: 'border-t-red-400' },
  { value: '숨김', label: '숨김', color: 'bg-gray-50 text-gray-500', columnColor: 'border-t-gray-300' },
] as const;

// ----- 계약 상태 -----
export const CONTRACT_STATUSES = [
  { value: '계약 준비 중', label: '계약 준비 중', color: 'bg-blue-50 text-blue-700', columnColor: 'border-t-blue-400' },
  { value: '계약 진행 중', label: '계약 진행 중', color: 'bg-yellow-50 text-yellow-700', columnColor: 'border-t-yellow-400' },
  { value: '계약 종료', label: '계약 종료', color: 'bg-green-50 text-green-700', columnColor: 'border-t-green-400' },
  { value: '계약 중단', label: '계약 중단', color: 'bg-red-50 text-red-700', columnColor: 'border-t-red-400' },
  { value: '숨김', label: '숨김', color: 'bg-gray-50 text-gray-500', columnColor: 'border-t-gray-300' },
] as const;

// ----- 정산 상태 -----
export const SETTLEMENT_STATUSES = [
  { value: '정산 예정', label: '정산 예정', color: 'bg-blue-50 text-blue-700', columnColor: 'border-t-blue-400' },
  { value: '정산 지연', label: '정산 지연', color: 'bg-orange-50 text-orange-700', columnColor: 'border-t-orange-400' },
  { value: '정산 완료', label: '정산 완료', color: 'bg-green-50 text-green-700', columnColor: 'border-t-green-400' },
  { value: '정산 중단', label: '정산 중단', color: 'bg-red-50 text-red-700', columnColor: 'border-t-red-400' },
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
    title: '고객 관리',
    href: '/customers',
    icon: 'Building2',
  },
  {
    title: '의뢰 관리',
    href: '/requests',
    icon: 'FileText',
  },
  {
    title: '계약 관리',
    href: '/contracts',
    icon: 'FileSignature',
  },
  {
    title: '정산 관리',
    href: '/settlements',
    icon: 'Calculator',
  },
  {
    title: '지출 관리',
    href: '/expenses',
    icon: 'Receipt',
  },
  {
    title: '견적서',
    href: '/quotations',
    icon: 'ClipboardList',
  },
  {
    title: '입출금 내역',
    href: '/transactions',
    icon: 'ArrowLeftRight',
  },
  {
    title: '고객 지도',
    href: '/map',
    icon: 'Map',
  },
] as const;

// ----- 페이지네이션 기본값 -----
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
