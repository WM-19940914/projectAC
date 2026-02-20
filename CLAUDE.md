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
│   ├── api/                # API 라우트 (admin 권한 CRUD)
│   │   ├── requests/       # 의뢰 삭제 API
│   │   └── customers/      # 고객 추가/수정/삭제 API
│   └── layout.tsx          # 루트 레이아웃
├── components/
│   ├── ui/                 # shadcn/ui 공통 컴포넌트
│   └── layout/             # 사이드바, 헤더 등
├── lib/
│   ├── supabase/           # Supabase 클라이언트 (client/server/admin)
│   ├── constants.ts        # 상수 (상태값, 메뉴 등)
│   ├── utils.ts            # 유틸리티 함수
│   ├── validators.ts       # Zod 스키마
│   └── format.ts           # 포맷팅 함수
├── types/                  # TypeScript 타입 정의
├── hooks/                  # 커스텀 훅
└── providers/              # Context Provider (Auth, Query)
scripts/                    # 데이터 임포트 스크립트
supabase/migrations/        # DB 마이그레이션 SQL
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

## DB 연동 패턴 (필수 준수)
클라이언트 컴포넌트에서 Supabase 직접 호출하면 **RLS 정책에 막힐 수 있다.**
반드시 아래 패턴을 따른다:

### 데이터 조회 (READ)
- **서버 컴포넌트** (`page.tsx`)에서 `createAdminClient()`로 조회
- `export const dynamic = "force-dynamic"` 필수 (캐시 방지)

### 데이터 변경 (CREATE / UPDATE / DELETE)
- **API 라우트** (`src/app/api/`)에서 `createAdminClient()`로 처리
- 변경 후 반드시 `revalidatePath("해당경로")` 호출 (캐시 갱신)
- 클라이언트에서는 `fetch("/api/...")` 로 호출

```typescript
// 예시: src/app/api/customers/route.ts
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export async function DELETE(req) {
  const { id } = await req.json()
  const supabase = createAdminClient()
  await supabase.from("customers").delete().eq("id", id)
  revalidatePath("/clients")  // ← 이거 빠지면 F5 새로고침 시 삭제된 데이터 다시 나타남
  return NextResponse.json({ success: true })
}
```

### 주의사항
- `createClient()` (클라이언트용) → RLS 적용됨, 조회만 가능할 수 있음
- `createAdminClient()` (서버용) → RLS 우회, 서버에서만 사용
- `revalidatePath` 없으면 Next.js가 캐시된 데이터를 보여줌

## 추가 라이브러리
- **드래그앤드롭:** `@hello-pangea/dnd` (칸반보드에서 사용)
- **엑셀 처리:** `xlsx` (데이터 임포트/엑스포트)
- **환경변수:** `dotenv` (스크립트에서 .env.local 로드)
