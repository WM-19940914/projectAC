# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**M** — 건설/공사 영업·계약·정산 관리 시스템. 소규모 팀(2~5명)이 의뢰 접수부터 계약, 정산까지 전체 흐름을 관리하는 Next.js 14 앱.

## 개발 명령어

```bash
npm run dev          # 개발 서버 (predev로 UTF-8 체크 자동 실행)
npm run build        # 프로덕션 빌드 (타입 에러 확인용 — 테스트 프레임워크 없음)
npm run lint         # ESLint 실행
npm run check:utf8   # UTF-8 인코딩 검사
npm run import:customers   # 고객 데이터 임포트 (Excel/CSV)
npm run import:prices      # 가격표 데이터 임포트
npm run export:data        # 데이터 내보내기
```

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
모든 API가 동일한 구조: GET/POST/PATCH/DELETE → `createAdminClient()` → whitelist 필드 검증 → DB 작업 → `revalidatePath()` → 응답. `src/middleware.ts`가 `/api/` 경로에 UTF-8 헤더(`Content-Type: application/json; charset=utf-8`, `Content-Language: ko-KR`, `Cache-Control: no-cache`)를 자동 설정한다. 일부 API는 `jsonWithUTF8()` (`src/lib/utf8-response.ts`)도 병행 사용.

### 업무 흐름
```
의뢰 접수 → 고객 등록 → 견적서 작성 → 계약 체결 → 정산/지출 관리
```

### 의뢰 상태 — 이중 시스템 주의

**칸반 컬럼용** (`src/lib/constants.ts`의 `REQUEST_STATUSES`) + **TypeScript 타입** (`src/types/index.ts`의 `RequestStatus`):
`견적 문의` | `영업중` | `계약 성공` | `수주 실패` | `숨김`

두 정의가 통일됨. 수정 시 양쪽 모두 확인할 것.

### 의뢰 칸반보드 (핵심 모듈)

`src/app/(dashboard)/requests/` — 9개 파일로 역할별 분리:

| 파일 | 역할 |
|------|------|
| `page.tsx` | 서버 컴포넌트. requests+customers 병렬 조회, stage_summaries 사전 계산 |
| `kanban-board.tsx` | 메인 오케스트레이터. DnD + 모든 하위 모듈 통합 |
| `kanban-types.ts` | 공유 타입 (`RequestItem`, `ContractSummary`, `SettlementStage` 등) |
| `sales-flow-panel.tsx` | 3컬럼 레이아웃 래퍼 (견적/계약/지출 탭 호스팅) |
| `contract-flow-tab.tsx` | 계약 생성·연결 + 정산 단계 관리 + 세금계산서 |
| `quotations-tab.tsx` | 확정 견적 표시 (마진/인센티브) |
| `settlement-utils.ts` | 정산 계산 유틸 14개+ (비율·VAT·상태 정규화) |
| `inline-editors.tsx` | 인라인 편집 컴포넌트 5종 (blur 시 자동 저장) |
| `order-delivery-tab.tsx` / `expense-tab.tsx` | 주문배송 / 지출·수익성 탭 |

**의뢰 4가지 표시 상태:**
- 일반 → 칸반 컬럼에 카드로 표시
- `hidden=true` → 하단 "숨김" 접기 패널
- `status="수주 실패"` → 하단 "수주 실패" 접기 패널
- `status="숨김"` → DB 조회 자체에서 제외 (`neq("status", "숨김")`)

### 정산 시스템 (3단계 모델)

**단계:** `선금` → `중도금` (1~5차 분할 가능) → `잔금`
- DB: `contracts.settlement_type` (텍스트, 예: "선금,중도금,잔금")
- DB: `contract_settlement_meta` 테이블 → `stage_ratios`, `settlement_status_map`, `middle_installments`, `stage_scheduled_dates`, `vat_total_override`
- 메타데이터는 `contract_settlement_meta` 테이블이 단일 진실 공급원 (memo에는 순수 텍스트만 저장)

**계산 흐름:**
```
공급가액(contract_amount) × stage_ratio% → stageSupply
stageSupply × 10% → VAT
stageSupply + VAT → 단계별 예정 금액
sum(confirmed payment_entries) → 실제 입금액
→ "paid" / "partial" / "unpaid" 상태 판정
```

**입금 엔트리:** 단계별로 복수 부분 입금 가능. `confirmed=true`만 합산. 미확인+미래일자 = `has_upcoming`.

핵심 유틸: `settlement-utils.ts`의 `normalizeSettlementStatusKey()`, `buildSettlementRows()`, `computeStageSummaries()`

### 견적 에디터

`src/app/(dashboard)/quotes/quote-editor-sheet.tsx` — Sheet(사이드 패널) 기반 스프레드시트형 에디터.

**구조:** 장비탭(에어컨 10행) + 설치비탭(10행) + 갑지(요약) + 사용자 정의 탭(최대 5개)

**자동 계산:** 행 편집 시 `recalcPricing()` → 매입단가, 제안가, 마진, 이익 자동 산출. 1000원 단위 반올림 옵션.

**자동 저장:** useRef 기반 스냅샷 비교 → 변경 감지 시만 저장. 초기 로드 중에는 저장 방지.

**PDF/Excel 내보내기:** `src/lib/quote-export.ts` — jsPDF로 간이/상세 견적서 2가지 PDF 형식 생성, xlsx로 원가분석 포함 다중 시트 Excel 내보내기. Pretendard 폰트 캐싱, 로고/도장 이미지 렌더링 포함.

## 디자인 시스템 (필수 준수)

### 컬러 팔레트 — 이 5색의 Tailwind 클래스명만 사용. Tailwind 기본 색상(blue, red, green 등) 사용 금지.

| 이름 | 실제 HEX (tailwind.config.ts) | Tailwind 클래스 | 용도 |
|------|------|-----------------|------|
| Sky Aqua | `#475569` (slate-600) | `sky-aqua` | 메인 포인트, 버튼, 링크 |
| Tropical Teal | `#64748B` (slate-700) | `tropical-teal` | 보조 포인트, 호버, 아이콘 |
| Muted Teal | `#22C55E` (green-500) | `muted-teal` | 성공/완료 상태, 배지 |
| Vanilla Custard | `#F59E0B` (amber-500) | `vanilla-custard` | 경고, 알림, 하이라이트 |
| Soft Blush | `#EF4444` (red-500) | `soft-blush` | 에러, 삭제, 위험 |

배경/텍스트는 흰색(#FFFFFF), 검정/회색 계열만 허용.

### 폰트
- **본문/전체:** Pretendard → `font-sans` 기본 적용 (weight 400~500)
- **강조:** Pretendard → `font-sans font-semibold` (weight 600)
- **제목:** 코드에서 `font-heading` 클래스가 사용되지만, tailwind.config.ts에 정의가 없으므로 실질적으로 브라우저 기본 sans-serif로 폴백됨
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
- `src/lib/quote-export.ts` — 견적서 PDF/Excel 내보내기 (간이/상세 2가지 형식)
- `tailwind.config.ts` — 커스텀 컬러/폰트 정의

## 환경 변수

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase admin key (서버 전용, 비공개)

## 보안/품질 — 전체 완료 (2026-03-21)

> 5건 모두 완료. RPC 마이그레이션(`scripts/migrations/002-delete-cascade-rpc.sql`)만 Supabase SQL 에디터에서 실행하면 트랜잭션 보호 활성화.

- ✅ DELETE 트랜잭션 보호 — RPC 우선 + 폴백 순차 삭제
- ✅ Role 기반 접근 제어 — `src/lib/api-auth.ts` (`requireAdmin`, `requireAdminOrSales`)
- ✅ console.error NODE_ENV 가드 — `src/lib/logger.ts` (`logError`)
- ✅ MIME 매직넘버 검증 — logo/stamp route에 바이트 헤더 확인
- ✅ 사이드바 접근성 — aria-label 4곳 추가
