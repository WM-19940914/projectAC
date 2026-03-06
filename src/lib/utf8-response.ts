/**
 * UTF-8 인코딩 강제 유틸리티
 * 모든 API 응답에 UTF-8 콘텐츠 타입을 강제로 설정
 */

type ResponseBody = Record<string, any> | unknown;

export interface UTF8Response {
  headers: {
    'Content-Type': string;
    'Content-Language': string;
    'Charset': string;
  };
}

/**
 * API 응답 메타데이터를 UTF-8로 강제 설정
 */
export function withUTF8Response(
  data: ResponseBody,
  status: number = 200
): [body: ResponseBody, config: { status: number; headers: Record<string, string> }] {
  return [
    data,
    {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Language': 'ko-KR',
        'X-Charset': 'UTF-8',
      },
    },
  ];
}

/**
 * JSON 응답 헬퍼 (UTF-8 강제)
 */
export function jsonWithUTF8(
  data: ResponseBody,
  options?: { status?: number; headers?: Record<string, string> }
) {
  const [body, config] = withUTF8Response(data, options?.status);
  
  return Response.json(body, {
    status: config.status,
    headers: {
      ...config.headers,
      ...options?.headers,
    },
  });
}

/**
 * 데이터 검증 및 정제 (UTF-8)
 */
export function validateUTF8String(str: unknown): string | null {
  if (typeof str !== 'string') {
    return typeof str === 'object' ? JSON.stringify(str) : String(str);
  }

  // 물음표 연속 감지
  if (/\?{2,}/.test(str)) {
    console.warn(`⚠️  UTF-8 손상 감지: ${str.substring(0, 30)}`);
    return `[손상] ${str}`;
  }

  // UTF-8 유효성 검증
  try {
    const buffer = Buffer.from(str, 'utf8');
    const decoded = buffer.toString('utf8');
    if (decoded !== str) {
      console.warn(`⚠️  UTF-8 오류: ${str.substring(0, 30)}`);
      return `[오류] ${str}`;
    }
  } catch (e) {
    console.warn(`⚠️  인코딩 예외: ${String(e)}`);
    return `[예외] ${str}`;
  }

  return str;
}

/**
 * 객체의 모든 문자열 필드를 UTF-8 검증
 */
export function validateObjectUTF8<T extends Record<string, any>>(obj: T): T {
  const result = { ...obj };

  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string') {
      result[key] = validateUTF8String(value) || value;
    } else if (typeof value === 'object' && value !== null) {
      result[key] = validateObjectUTF8(value);
    }
  }

  return result;
}

/**
 * 데이터베이스 응답을 UTF-8로 정제
 */
export function sanitizeDBResponse<T extends Record<string, any>>(
  data: T | T[]
): T | T[] {
  if (Array.isArray(data)) {
    return data.map(item => validateObjectUTF8(item)) as T[];
  }
  return validateObjectUTF8(data);
}
