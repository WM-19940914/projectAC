# M - 건설/공사 영업·계약·정산 관리 시스템

## 프로젝트 개요
- **프로젝트명:** M
- **업종:** 건설/공사 (시공, 원청, 영업/수주 전반)
- **사용자:** 소규모 팀 (2~5명)
- **목적:** 건설 영업부터 계약, 정산까지 전체 흐름을 한곳에서 관리

## 기술 스택
- **프레임워크:** Next.js 14 (App Router)
- **언어:** TypeScript
- **DB/백엔드:** Supabase (PostgreSQL + Auth + Storage)
- **스타일링:** Tailwind CSS + shadcn/ui
- **상태관리:** TanStack React Query
- **폼:** React Hook Form + Zod (유효성 검사)
- **차트:** Recharts
- **PDF:** jsPDF + jspdf-autotable
- **엑셀:** xlsx

## 핵심 메뉴 구조
```
대시보드           → /dashboard
영업
  ├─ 의뢰          → /requests
  ├─ 고객          → /clients
  └─ 견적서        → /quotes
계약
  └─ 계약          → /contracts
정산·지출
  ├─ 정산          → /settlements
  └─ 지출          → /expenses
설정
  └─ 비즈니스 설정  → /settings
```

## 업무 흐름
의뢰 접수 → 고객 등록 → 견적서 작성 → 계약 체결 → 정산/지출 관리

## 폴더 구조
```
src/
├── app/                    # 페이지 (App Router)
│   ├── (auth)/             # 로그인/회원가입
│   ├── (dashboard)/        # 대시보드 레이아웃
│   └── layout.tsx          # 루트 레이아웃
├── components/
│   ├── ui/                 # shadcn/ui 공통 컴포넌트
│   └── layout/             # 사이드바, 헤더 등
├── lib/
│   ├── supabase/           # Supabase 클라이언트 (client/server)
│   ├── constants.ts        # 상수 (상태값, 메뉴 등)
│   ├── utils.ts            # 유틸리티 함수
│   ├── validators.ts       # Zod 스키마
│   └── format.ts           # 포맷팅 함수
├── types/                  # TypeScript 타입 정의
├── hooks/                  # 커스텀 훅
└── providers/              # Context Provider (Auth, Query)
```

## 폰트 시스템 (필수 준수)
| 용도 | 폰트 | Tailwind 클래스 | weight | 사용 예시 |
|------|------|-----------------|--------|-----------|
| 제목 (Heading) | Plus Jakarta Sans | `font-heading` | 600~800 | 페이지 제목, 섹션 헤더, 모달 타이틀 |
| 본문 (Body) | Pretendard | `font-sans` (기본) | 400~500 | 일반 텍스트, 목록, 설명 |
| 강조 (Emphasis) | Pretendard | `font-sans font-semibold` | 600 | 상태 배지, 중요 수치, 라벨 |

- 제목에는 반드시 `font-heading` 클래스 사용
- 본문은 기본 폰트(Pretendard)가 적용되므로 별도 클래스 불필요
- 이 외의 폰트는 사용하지 않는다

## 디자인 컬러 팔레트 (필수 준수)
아래 5가지 색상만 사용한다. 이 외의 색상은 절대 사용하지 않는다.
| 이름 | HEX | Tailwind 커스텀 | 용도 예시 |
|------|------|-----------------|-----------|
| Sky Aqua | `#42CAFD` | `sky-aqua` | 메인 포인트, 버튼, 링크, 활성 상태 |
| Tropical Teal | `#66B3BA` | `tropical-teal` | 보조 포인트, 호버, 아이콘 |
| Muted Teal | `#8EB19D` | `muted-teal` | 성공/완료 상태, 배지, 태그 |
| Vanilla Custard | `#F6EFA6` | `vanilla-custard` | 경고, 알림, 하이라이트 배경 |
| Soft Blush | `#F0D2D1` | `soft-blush` | 에러, 삭제, 위험 상태 |

- 배경/텍스트는 **흰색(#FFFFFF)**, **검정/회색 계열**만 허용
- 위 5색 외의 파랑(blue-600 등), 빨강, 초록 등 Tailwind 기본 색상 사용 금지

## 개발 규칙
- 코드에 **한글 주석** 작성
- 컴포넌트는 기능별로 분리
- Supabase RLS(Row Level Security) 활용
- shadcn/ui 컴포넌트 우선 사용
- 새 페이지는 `src/app/(dashboard)/` 아래에 생성
- 색상은 반드시 **디자인 컬러 팔레트** 5색만 사용
