# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**M** — 건설/공사 영업·계약·정산 관리 시스템. 소규모 팀(2~5명)이 의뢰 접수부터 계약, 정산까지 전체 흐름을 관리하는 Next.js 14 앱.

## 개발 명령어

```bash
npm run dev          # 개발 서버 (predev로 UTF-8 체크 자동 실행)
npm run build        # 프로덕션 빌드
npm run lint         # ESLint 실행
npm run check:utf8   # UTF-8 인코딩 검사
npm run import:customers   # 고객 데이터 임포트 (Excel/CSV)
npm run import:prices      # 가격표 데이터 임포트
```

- **테스트 프레임워크 없음** — 현재 단위/E2E 테스트 미설정. `npm run build`로 타입 에러 확인.
- `npm install` 시 `prepare` 스크립트가 git hooks를 자동 설정함 (`scripts/setup-githooks.mjs`)
- pre-commit hook이 스테이징된 파일의 UTF-8 인코딩을 검사함

## 기술 스택

- **Next.js 14** (App Router) + TypeScript
- **Supabase** (PostgreSQL + Auth + Storage) — RLS 활용
- **Tailwind CSS** + **shadcn/ui** (Radix UI 기반)
- **TanStack React Query** (staleTime 5분, retry 1)
- **React Hook Form** + **Zod** (폼 + 유효성 검사)
- **@hello-pangea/dnd** (칸반 드래그앤드롭) — `reactStrictMode: false`로 설정됨
- **jsPDF/jspdf-autotable** (PDF), **xlsx** (엑셀), **Recharts** (차트)
- Import alias: `@/*` → `./src/*`

## 아키텍처

### 데이터 흐름 패턴 (필수 준수)

클라이언트에서 Supabase 직접 호출하면 RLS에 막힌다. 반드시 아래 패턴을 따른다:

**조회 (READ):** 서버 컴포넌트(`page.tsx`)에서 `createAdminClient()`로 조회. `export const dynamic = "force-dynamic"` 필수.

**변경 (CREATE/UPDATE/DELETE):** API 라우트(`src/app/api/`)에서 `createAdminClient()`로 처리. 변경 후 반드시 `revalidatePath()` 호출. 클라이언트에서는 `fetch("/api/...")`.

```
서버 컴포넌트(page.tsx) → createAdminClient() → DB 조회 → props로 클라이언트 컴포넌트에 전달
클라이언트 컴포넌트 → fetch("/api/...") → API Route(createAdminClient) → DB 변경 → revalidatePath()
```

### Supabase 클라이언트 3종
- `src/lib/supabase/client.ts` — 브라우저용, RLS 적용
- `src/lib/supabase/server.ts` — 서버 컴포넌트용, 쿠키 기반
- `src/lib/supabase/admin.ts` — **서버 전용**, RLS 우회 (service_role_key). 절대 클라이언트에 노출 금지

### 인증
- `src/providers/auth-provider.tsx` — AuthContext (User + Profile)
- 역할: `admin` | `sales` | `viewer`
- `src/providers/query-provider.tsx` — TanStack React Query 설정

### 라우트 구조
- `src/app/(auth)/` — 로그인/회원가입 (centered layout)
- `src/app/(dashboard)/` — 메인 앱 (sidebar + header layout)
  - `/dashboard`, `/requests`(칸반), `/clients`, `/quotes`(에디터), `/contracts`, `/settlements`, `/expenses`, `/price-list`, `/contract-templates`, `/contract-documents`, `/settings`
- `src/app/api/` — CRUD 엔드포인트 (quotes, customers, requests, contracts, expenses, order-deliveries, price-list, settings)

### API 라우트 패턴
모든 API가 동일한 구조: GET/POST/PATCH/DELETE → `createAdminClient()` → whitelist 필드 검증 → DB 작업 → `revalidatePath()` → `jsonWithUTF8()` 응답 (`src/lib/utf8-response.ts`). 새 API 라우트 작성 시 `jsonWithUTF8()`을 사용해야 한글 깨짐 방지.

### 업무 흐름
```
의뢰 접수 → 고객 등록 → 견적서 작성 → 계약 체결 → 정산/지출 관리
```

의뢰 상태 칸반: `견적 문의` → `영업중` → `계약 성공` / `수주 실패` / `숨김` (`src/lib/constants.ts`의 `REQUEST_STATUSES`)

## 디자인 시스템 (필수 준수)

### 컬러 팔레트 — 이 5색만 사용. Tailwind 기본 색상(blue, red, green 등) 사용 금지.
| 이름 | HEX | Tailwind 클래스 | 용도 |
|------|------|-----------------|------|
| Sky Aqua | `#42CAFD` | `sky-aqua` | 메인 포인트, 버튼, 링크 |
| Tropical Teal | `#66B3BA` | `tropical-teal` | 보조 포인트, 호버, 아이콘 |
| Muted Teal | `#8EB19D` | `muted-teal` | 성공/완료 상태, 배지 |
| Vanilla Custard | `#F6EFA6` | `vanilla-custard` | 경고, 알림, 하이라이트 |
| Soft Blush | `#F0D2D1` | `soft-blush` | 에러, 삭제, 위험 |

배경/텍스트는 흰색(#FFFFFF), 검정/회색 계열만 허용.

### 폰트
- **제목:** Plus Jakarta Sans → `font-heading` (weight 600~800)
- **본문:** Pretendard → `font-sans` 기본 적용 (weight 400~500)
- **강조:** Pretendard → `font-sans font-semibold` (weight 600)
- 이 외의 폰트 사용 금지

## 개발 규칙

- 코드에 **한글 주석** 작성 (과하다 싶을 정도로 상세하게)
- shadcn/ui 컴포넌트 우선 사용
- 새 페이지는 `src/app/(dashboard)/` 아래에 생성
- 잘 작동하는 코드를 임의로 대규모 리팩토링하지 않는다
- 크게 바꿔야 할 때는 반드시 사전에 물어보고 승인을 받는다
- `revalidatePath` 없으면 Next.js가 캐시된 데이터를 보여줌 — 변경 API에서 절대 빠뜨리지 않는다

## 주요 참조 파일

- `src/types/index.ts` — 도메인 타입 정의 (Customer, Request, Contract, Quotation 등)
- `src/lib/constants.ts` — 상태값 enum, 사이드바 메뉴, 카테고리 목록
- `src/lib/format.ts` — 통화(₩), 날짜 포맷 유틸리티
- `src/lib/validators.ts` — Zod 스키마 (login, signup)
- `src/lib/utf8-response.ts` — API 응답 UTF-8 강제 헬퍼 (`jsonWithUTF8`)
- `tailwind.config.ts` — 커스텀 컬러/폰트 정의

## 환경 변수

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase admin key (서버 전용, 비공개)
