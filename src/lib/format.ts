// ============================================
// SAC 프로젝트 - 포맷팅 유틸리티
// ============================================

import { format, differenceInDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * 금액 포맷 (₩1,234,567)
 * 음수일 경우 -₩1,234,567 형태로 표시
 */
export function formatCurrency(amount: number, currency: string = 'KRW'): string {
  if (currency === 'KRW') {
    const formatted = Math.abs(amount).toLocaleString('ko-KR');
    return amount < 0 ? `-₩${formatted}` : `₩${formatted}`;
  }

  // 기타 통화
  const formatter = new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
  });

  return formatter.format(amount);
}

/**
 * 날짜 포맷 (2025년 1월 1일)
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = parseISO(dateStr);
    return format(date, 'yyyy년 M월 d일', { locale: ko });
  } catch {
    return dateStr;
  }
}

/**
 * 날짜+시간 포맷 (2025년 1월 1일 오후 3시 30분)
 */
export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = parseISO(dateStr);
    return format(date, 'yyyy년 M월 d일 a h시 m분', { locale: ko });
  } catch {
    return dateStr;
  }
}

/**
 * 짧은 날짜 (2025.01.01)
 */
export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = parseISO(dateStr);
    return format(date, 'yyyy.MM.dd');
  } catch {
    return dateStr;
  }
}

/**
 * 연-월 포맷 (2025년 1월)
 */
export function formatYearMonth(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = parseISO(dateStr);
    return format(date, 'yyyy년 M월', { locale: ko });
  } catch {
    return dateStr;
  }
}

/**
 * 이익률 포맷 (12.34%)
 */
export function formatProfitRate(rate: number): string {
  return `${rate.toFixed(2)}%`;
}

/**
 * D-day 계산 (D-9, D+27, D-Day)
 * 미래 날짜: D-9 (9일 남음)
 * 과거 날짜: D+27 (27일 지남)
 * 오늘: D-Day
 */
export function formatDday(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const targetDate = parseISO(dateStr);
    const today = new Date();
    // 시간 부분 제거하여 날짜만 비교
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);

    const diff = differenceInDays(target, today);

    if (diff === 0) return 'D-Day';
    if (diff > 0) return `D-${diff}`;
    return `D+${Math.abs(diff)}`;
  } catch {
    return '';
  }
}

/**
 * D-day 색상 클래스 반환
 * 긴급(3일 이내): 빨간색
 * 주의(7일 이내): 주황색
 * 여유: 기본색
 */
export function getDdayColor(dateStr: string): string {
  if (!dateStr) return 'text-gray-500';
  try {
    const targetDate = parseISO(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);

    const diff = differenceInDays(target, today);

    if (diff < 0) return 'text-red-500 font-semibold'; // 기한 초과
    if (diff <= 3) return 'text-red-500 font-medium';  // 긴급
    if (diff <= 7) return 'text-amber-500';            // 주의
    return 'text-gray-600';                              // 여유
  } catch {
    return 'text-gray-500';
  }
}

/**
 * 전화번호 포맷 (010-1234-5678, 02-123-4567)
 */
export function formatPhone(phone: string): string {
  if (!phone) return '';

  // 숫자만 추출
  const digits = phone.replace(/\D/g, '');

  // 휴대폰 (010, 011, 016, 017, 018, 019)
  if (/^01[016789]/.test(digits)) {
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
  }

  // 서울 (02)
  if (digits.startsWith('02')) {
    if (digits.length === 10) {
      return `02-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 9) {
      return `02-${digits.slice(2, 5)}-${digits.slice(5)}`;
    }
  }

  // 일반 지역번호 (031, 032, ...)
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // 포맷 불가시 원본 반환
  return phone;
}

/**
 * 사업자등록번호 포맷 (123-45-67890)
 */
export function formatBusinessNumber(num: string): string {
  if (!num) return '';
  const digits = num.replace(/\D/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }
  return num;
}

/**
 * 파일 크기 포맷 (1.2 MB, 345 KB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
